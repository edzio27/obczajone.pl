import { createClient } from 'npm:@supabase/supabase-js@2';

/*
  Mail do firmy o nowym zapytaniu z formularza.

  Do 26.10.2026 zapytanie lądowało tylko w `partner_leads` i firma widziała je
  wyłącznie po zalogowaniu do panelu - a połowa firm konta w panelu nie miała.
  Jedyne zapytanie z pierwszych dwóch miesięcy (13.10, do GCC) przeleżało przez
  to dwa tygodnie nieprzeczytane.

  Wołana z triggera zaraz po zapisie zapytania i co kwadrans z crona, gdy coś
  czeka. Zawsze bierze wszystkie niewysłane z ostatniego tygodnia, więc nieudana
  wysyłka sama się ponawia, a dwa wywołania naraz nie wyślą dwóch maili, bo
  każde zapytanie jest najpierw zajmowane w bazie (`notified_at`).
*/

const SITE_URL = 'https://obczajone.pl';
const FROM_ADDRESS = 'obczajone.pl <zapytania@obczajone.pl>';

/** Starszego zapytania nie ma sensu już wysyłać - kupujący dawno kupił albo nie. */
const MAX_AGE_DAYS = 7;

type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  message: string;
  created_at: string;
  partner: { name: string; email: string | null } | null;
  listing: {
    id: string;
    title: string | null;
    current_price: number | null;
    location: string | null;
    url: string | null;
  } | null;
};

/** Wszystko, co wpisał odwiedzający, idzie do HTML-a przez to. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPln(value: number): string {
  return `${Math.round(value).toLocaleString('pl-PL')} zł`;
}

function buildEmail(lead: Lead): { subject: string; html: string } {
  const listing = lead.listing;
  const subject = listing?.title
    ? `Nowe zapytanie o oględziny: ${listing.title}`
    : 'Nowe zapytanie o oględziny z obczajone.pl';

  const kontakt = [
    lead.phone && `Telefon: <a href="tel:${esc(lead.phone)}" style="color:#111;font-weight:600">${esc(lead.phone)}</a>`,
    lead.email && `E-mail: <a href="mailto:${esc(lead.email)}" style="color:#111;font-weight:600">${esc(lead.email)}</a>`,
  ]
    .filter(Boolean)
    .join('<br>');

  const ogloszenie = listing
    ? `
      <p style="margin:0 0 4px;color:#555">Chodzi o ogłoszenie:</p>
      <p style="margin:0 0 20px">
        <a href="${SITE_URL}/listing/${listing.id}" style="color:#111;font-weight:600">${esc(listing.title || 'Ogłoszenie')}</a><br>
        ${listing.current_price ? `${formatPln(Number(listing.current_price))}` : ''}${listing.location ? ` — ${esc(listing.location)}` : ''}
        ${listing.url ? `<br><a href="${esc(listing.url)}" style="color:#777;font-size:13px">oryginał ogłoszenia</a>` : ''}
      </p>`
    : '';

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
      <p style="font-size:16px;margin:0 0 16px">Dzień dobry,<br>ktoś prosi <strong>${esc(lead.partner?.name || 'Państwa firmę')}</strong> o sprawdzenie przed zakupem.</p>
      <p style="margin:0 0 4px;color:#555">Kto pyta:</p>
      <p style="margin:0 0 20px"><strong>${esc(lead.name)}</strong><br>${kontakt}</p>
      ${ogloszenie}
      ${lead.message ? `<p style="margin:0 0 4px;color:#555">Wiadomość:</p><p style="margin:0 0 20px;white-space:pre-wrap">${esc(lead.message)}</p>` : ''}
      <p style="margin:0 0 20px">Kupujący czeka na kontakt od Państwa${lead.email ? ' - wystarczy odpowiedzieć na tego maila' : ''}.</p>
      <p style="font-size:13px;color:#777;margin:0">
        Wszystkie zapytania są też w <a href="${SITE_URL}/panel-partnera" style="color:#777">panelu partnera</a>.
        Nie pobieramy prowizji od ceny oględzin.
      </p>
    </div>`;

  return { subject, html };
}

async function sendEmail(
  to: string[],
  subject: string,
  html: string,
  replyTo: string | null
): Promise<boolean> {
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
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to,
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!response.ok) {
      console.error('Resend rejected the message:', response.status, await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send lead email:', error);
    return false;
  }
}

const LEAD_SELECT =
  'id, name, phone, email, message, created_at, partner:partners(name, email), listing:listings(id, title, current_price, location, url)';

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const since = new Date(Date.now() - MAX_AGE_DAYS * 86400_000).toISOString();
    const { data: pending, error } = await supabase
      .from('partner_leads')
      .select(LEAD_SELECT)
      .is('notified_at', null)
      .gte('created_at', since)
      .limit(20);

    if (error) throw new Error(`Failed to read leads: ${error.message}`);

    // Kopia do nas: widzimy każde zapytanie i możemy przekazać je ręcznie
    // firmie, która nie podała adresu.
    const adminCopy = Deno.env.get('LEADS_ADMIN_EMAIL');
    let sent = 0;
    let failed = 0;

    for (const lead of (pending || []) as unknown as Lead[]) {
      const to = [lead.partner?.email, adminCopy].filter((v): v is string => Boolean(v));
      if (to.length === 0) {
        console.error('Lead has no recipient (partner without e-mail):', lead.id);
      }

      // Zajmujemy zapytanie przed wysyłką; równoległe wywołanie go nie dostanie.
      const { data: claimed } = await supabase
        .from('partner_leads')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', lead.id)
        .is('notified_at', null)
        .select('id');
      if (!claimed?.length || to.length === 0) continue;

      const { subject, html } = buildEmail(lead);
      if (await sendEmail(to, subject, html, lead.email || null)) {
        sent++;
      } else {
        failed++;
        // Oddajemy z powrotem - następne wywołanie spróbuje jeszcze raz.
        await supabase.from('partner_leads').update({ notified_at: null }).eq('id', lead.id);
      }
    }

    return Response.json({ sent, failed });
  } catch (error) {
    console.error(error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
});
