import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SITE_URL = 'https://obczajone.pl';
const FROM_ADDRESS = 'obczajone.pl <alerty@obczajone.pl>';

/** Poniżej tego progu obniżka jest szumem i nie warto pisać maila. */
const MIN_DROP_PERCENT = 2;

/** Ile ofert pokazujemy w jednym mailu o modelu. Reszta czeka na stronie. */
const MAX_OFFERS_PER_MAIL = 5;

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
/**
 * Mail o nowych ofertach modelu.
 *
 * Osobny od `buildEmail`, bo mówi co innego. Tamten informuje, że cena
 * obserwowanej sztuki spadła; ten - że pojawiło się coś, czego wcześniej nie
 * było. Sklejanie obu w jeden szablon z warunkami dałoby wiadomość, która
 * w obu przypadkach brzmi niezręcznie.
 */
function buildModelEmail(
  brand: string,
  model: string,
  maxPrice: number | null,
  offers: { listingId: string; title: string; price: number; location: string | null }[],
  unsubscribeToken: string
): { subject: string; html: string } {
  const name = `${brand} ${model}`;
  const subject =
    offers.length === 1
      ? `Nowa oferta: ${name} za ${formatPln(offers[0].price)}`
      : `${offers.length} nowe oferty: ${name}`;

  const items = offers
    .map(
      (o) => `
        <li style="margin-bottom:16px">
          <a href="${SITE_URL}/listing/${o.listingId}" style="color:#111;font-weight:600;text-decoration:none">${o.title}</a><br>
          <span style="font-size:15px">${formatPln(o.price)}</span>
          ${o.location ? `<span style="color:#777"> — ${o.location}</span>` : ''}
        </li>`
    )
    .join('');

  const kryterium = maxPrice
    ? `${name} poniżej ${formatPln(maxPrice)}`
    : `${name}`;

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
      <p style="font-size:16px;margin:0 0 4px">Obserwujesz: <strong>${kryterium}</strong></p>
      <p style="color:#555;margin:0 0 20px">${offers.length === 1 ? 'Pojawiła się oferta, której wcześniej nie było.' : 'Pojawiły się oferty, których wcześniej nie było.'}</p>
      <ul style="padding-left:18px;margin:0 0 24px">${items}</ul>
      <p style="font-size:13px;color:#777;margin:0">
        Cenę każdej z nich śledzimy codziennie — jeśli sprzedający zejdzie, zobaczysz to na stronie ogłoszenia.<br>
        <a href="${SITE_URL}/wypisz/${unsubscribeToken}" style="color:#777">Wypisz się jednym kliknięciem</a>.
      </p>
    </div>`;

  return { subject, html };
}

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


    /*
      Alerty na model.

      Dobieranie ofert robi baza (`pending_model_alerts`), bo inaczej trzeba by
      ściągnąć tu wszystkie 14 tysięcy ogłoszeń raz na obserwującego. Funkcja
      oddaje gotowe pary obserwujący-ogłoszenie, których jeszcze nie wysłaliśmy.
    */
    const { data: pending, error: pendingError } = await supabase.rpc('pending_model_alerts');

    if (pendingError) {
      throw new Error(`Failed to read model alerts: ${pendingError.message}`);
    }

    type Pend = {
      watcher_id: string; email: string; unsubscribe_token: string;
      brand: string; model: string; max_price: number | null;
      is_first_run: boolean; listing_id: string; title: string;
      current_price: number; location: string | null;
    };

    const byWatcher = new Map<string, Pend[]>();
    for (const row of (pending || []) as Pend[]) {
      const bucket = byWatcher.get(row.watcher_id);
      bucket ? bucket.push(row) : byWatcher.set(row.watcher_id, [row]);
    }

    let modelSent = 0;
    let modelSkipped = 0;
    let modelPrimed = 0;

    for (const [watcherId, rows] of byWatcher) {
      const first = rows[0];

      /*
        Pierwszy przebieg tylko zapamiętuje, co już wisi. Ktoś, kto właśnie
        zapisał się na Octavię, ma kilkadziesiąt pasujących ofert sprzed
        tygodni - wysłanie ich wszystkich byłoby spamem, a nie alertem.
      */
      if (first.is_first_run) {
        const wpisy = rows.map((r) => ({ watcher_id: watcherId, listing_id: r.listing_id }));
        await supabase.from('model_watcher_notifications').insert(wpisy);
        modelPrimed += rows.length;
        continue;
      }

      // Najtańsze najpierw, a resztę zostawiamy na stronie modelu - mail z
      // trzydziestoma pozycjami nikomu nie pomaga.
      const offers = rows.slice(0, MAX_OFFERS_PER_MAIL).map((r) => ({
        listingId: r.listing_id,
        title: r.title || `${r.brand} ${r.model}`,
        price: Number(r.current_price),
        location: r.location,
      }));

      const { subject, html } = buildModelEmail(
        first.brand, first.model, first.max_price == null ? null : Number(first.max_price),
        offers, first.unsubscribe_token
      );

      const ok = await sendEmail(first.email, subject, html);

      if (!ok) {
        modelSkipped += 1;
        continue;
      }

      /*
        Odnotowujemy wszystkie pasujące, także te, które nie zmieściły się
        w mailu - inaczej jutro przyszłaby o nich druga wiadomość, choć nie są
        już niczym nowym.
      */
      await supabase
        .from('model_watcher_notifications')
        .insert(rows.map((r) => ({ watcher_id: watcherId, listing_id: r.listing_id })));

      modelSent += 1;
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
        modelWatchers: byWatcher.size,
        modelAlertsSent: modelSent,
        modelAlertsSkipped: modelSkipped,
        modelOffersPrimed: modelPrimed,
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
