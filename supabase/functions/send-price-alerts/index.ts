import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SITE_URL = 'https://obczajone.pl';
const FROM_ADDRESS = 'obczajone.pl <alerty@obczajone.pl>';

/** Poniżej tego progu obniżka jest szumem i nie warto pisać maila. */
const MIN_DROP_PERCENT = 2;

type Drop = {
  favoriteId: string;
  userId: string;
  listingId: string;
  title: string;
  previousPrice: number;
  currentPrice: number;
};

function formatPln(value: number): string {
  return `${Math.round(value).toLocaleString('pl-PL')} zł`;
}

function buildEmail(drops: Drop[], unsubscribeToken?: string): { subject: string; html: string } {
  const subject =
    drops.length === 1
      ? `Cena spadła: ${drops[0].title}`
      : `Ceny spadły w ${drops.length} obserwowanych ogłoszeniach`;

  const items = drops
    .map((d) => {
      const diff = d.previousPrice - d.currentPrice;
      const percent = ((diff / d.previousPrice) * 100).toFixed(0);
      return `
        <li style="margin-bottom:16px">
          <a href="${SITE_URL}/listing/${d.listingId}" style="font-weight:600;color:#111">${d.title}</a><br>
          <span style="color:#444">
            ${formatPln(d.previousPrice)} &rarr; <strong>${formatPln(d.currentPrice)}</strong>
            (o ${formatPln(diff)} taniej, ${percent}%)
          </span>
        </li>`;
    })
    .join('');

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px">
      <h2 style="margin:0 0 16px">Cena spadła</h2>
      <p style="color:#444;margin:0 0 16px">
        Sprzedający obniżył cenę w ${drops.length === 1 ? 'ogłoszeniu, które obserwujesz' : 'obserwowanych przez Ciebie ogłoszeniach'}.
        To dobry moment na negocjacje.
      </p>
      <ul style="padding-left:18px;margin:0 0 24px">${items}</ul>
      <p style="color:#777;font-size:12px;margin:0">
        Dostajesz tę wiadomość, bo włączyłeś powiadomienia o cenie w serwisie obczajone.pl.
        ${unsubscribeToken
          ? `<a href="${SITE_URL}/wypisz/${unsubscribeToken}" style="color:#777">Wypisz się jednym kliknięciem</a>.`
          : `Możesz je wyłączyć na stronie ogłoszenia albo w <a href="${SITE_URL}/profile" style="color:#777">swoim profilu</a>.`}
      </p>
    </div>`;

  return { subject, html };
}

/**
 * Wysyłka przez Resend. Bez sekretu RESEND_API_KEY funkcja nie wysyła nic i
 * mówi o tym w logach - tak samo jak opinia AI zachowuje się bez klucza
 * Anthropica. Dzięki temu można ją wdrożyć, zanim skonfigurujesz pocztę.
 */
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.error('RESEND_API_KEY not set; skipping send to', to);
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
    });

    if (!response.ok) {
      console.error('Resend rejected the message:', response.status, await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send alert email:', error);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: watched, error } = await supabase
      .from('favorites')
      .select('id, user_id, listing_id, last_notified_price, listing:listings(title, current_price)')
      .eq('notify_on_price_drop', true);

    if (error) {
      throw new Error(`Failed to read watched listings: ${error.message}`);
    }

    const dropsByUser = new Map<string, Drop[]>();

    for (const row of watched || []) {
      const listing = (row as any).listing;
      if (!listing || !(listing.current_price > 0)) continue;

      // Bez zapamiętanej ceny nie ma od czego liczyć spadku - zapisujemy
      // bieżącą i czekamy na kolejny przebieg.
      const reference = row.last_notified_price;
      if (reference == null) {
        await supabase
          .from('favorites')
          .update({ last_notified_price: listing.current_price })
          .eq('id', row.id);
        continue;
      }

      const dropPercent = ((reference - listing.current_price) / reference) * 100;
      if (dropPercent < MIN_DROP_PERCENT) continue;

      const list = dropsByUser.get(row.user_id) || [];
      list.push({
        favoriteId: row.id,
        userId: row.user_id,
        listingId: row.listing_id,
        title: listing.title || 'Ogłoszenie',
        previousPrice: Number(reference),
        currentPrice: Number(listing.current_price),
      });
      dropsByUser.set(row.user_id, list);
    }

    let sent = 0;
    let skipped = 0;

    for (const [userId, drops] of dropsByUser) {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      const email = userData?.user?.email;

      if (!email) {
        skipped += drops.length;
        continue;
      }

      const { subject, html } = buildEmail(drops);
      const ok = await sendEmail(email, subject, html);

      if (!ok) {
        skipped += drops.length;
        continue;
      }

      // Przesuwamy punkt odniesienia dopiero po udanej wysyłce, żeby nieudany
      // mail nie skasował spadku, o którym użytkownik nigdy się nie dowiedział.
      for (const drop of drops) {
        await supabase
          .from('favorites')
          .update({ last_notified_price: drop.currentPrice })
          .eq('id', drop.favoriteId);
      }

      sent += drops.length;
    }

    /*
      Obserwujący bez konta. Ta sama logika ceny odniesienia co przy
      `favorites`, tylko adresat jest w wierszu zamiast w auth.users - i każdy
      mail niesie własny link do wypisania, bo nie ma profilu, w którym można
      by to wyłączyć.
    */
    const { data: emailWatchers, error: watcherError } = await supabase
      .from('listing_price_watchers')
      .select('id, listing_id, email, unsubscribe_token, last_notified_price, listing:listings(title, current_price)');

    if (watcherError) {
      throw new Error(`Failed to read e-mail watchers: ${watcherError.message}`);
    }

    let emailSent = 0;
    let emailSkipped = 0;

    for (const row of emailWatchers || []) {
      const listing = (row as any).listing;
      if (!listing || !(listing.current_price > 0)) continue;

      const reference = row.last_notified_price;
      if (reference == null) {
        await supabase
          .from('listing_price_watchers')
          .update({ last_notified_price: listing.current_price })
          .eq('id', row.id);
        continue;
      }

      const dropPercent = ((reference - listing.current_price) / reference) * 100;
      if (dropPercent < MIN_DROP_PERCENT) continue;

      const drop: Drop = {
        favoriteId: row.id,
        userId: '',
        listingId: row.listing_id,
        title: listing.title || 'Ogłoszenie',
        previousPrice: Number(reference),
        currentPrice: Number(listing.current_price),
      };

      const { subject, html } = buildEmail([drop], row.unsubscribe_token);
      const ok = await sendEmail(row.email, subject, html);

      if (!ok) {
        emailSkipped += 1;
        continue;
      }

      await supabase
        .from('listing_price_watchers')
        .update({ last_notified_price: drop.currentPrice })
        .eq('id', row.id);

      emailSent += 1;
    }

    return new Response(
      JSON.stringify({
        success: true,
        watched: watched?.length || 0,
        usersNotified: dropsByUser.size,
        alertsSent: sent,
        alertsSkipped: skipped,
        emailWatchers: emailWatchers?.length || 0,
        emailAlertsSent: emailSent,
        emailAlertsSkipped: emailSkipped,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('send-price-alerts failed:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
