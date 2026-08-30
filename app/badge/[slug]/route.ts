import { createClient } from '@supabase/supabase-js';
import { formatRating, inspectionCountLabel, reviewCountLabel } from '@/lib/partner-data';

/*
  Odznaka partnera jako obrazek SVG serwowany z naszej domeny.

  Obrazek, a nie fragment HTML-a, bo firma wkleja to w swój WordPress, Wix albo
  stopkę zrobioną przez kogoś innego pięć lat temu - i tam nasze style albo się
  rozjadą, albo zostaną wycięte razem ze skryptami. Obrazek wygląda wszędzie
  tak samo i sam się aktualizuje, gdy firmie przybędzie ocen.

  Sygnałem dla wyszukiwarki jest otaczający <a href>, a nie sam obrazek - stąd
  `alt` i tekst kotwicy w gotowcu do wklejenia.
*/

export const revalidate = 3600;

const PRIMARY = '#0d7a70';
const STAR = '#facc15';

type Theme = 'light' | 'dark';

/*
  `accent` różni się między wariantami celowo: firmowa zieleń #0d7a70 na
  granatowym tle daje kontrast około 2,3:1, czyli poniżej progu czytelności.
  Na ciemnym idzie jaśniejszy odcień tej samej barwy.
*/
const THEMES: Record<
  Theme,
  { bg: string; border: string; name: string; muted: string; accent: string }
> = {
  light: { bg: '#ffffff', border: '#e2e8f0', name: '#0f172a', muted: '#64748b', accent: PRIMARY },
  dark: { bg: '#0f172a', border: '#1e293b', name: '#f8fafc', muted: '#94a3b8', accent: '#5eead4' },
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Nazwy firm bywają długie, a odznaka ma stałą szerokość. */
function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

function star(x: number, y: number, filled: boolean): string {
  const points = [
    [0, -7],
    [2, -2.2],
    [6.9, -2.2],
    [3, 0.9],
    [4.3, 5.7],
    [0, 2.8],
    [-4.3, 5.7],
    [-3, 0.9],
    [-6.9, -2.2],
    [-2, -2.2],
  ]
    .map(([px, py]) => `${px},${py}`)
    .join(' ');

  return `<polygon points="${points}" transform="translate(${x} ${y}) scale(0.62)" fill="${
    filled ? STAR : '#d4d4d8'
  }"/>`;
}

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = await supabase
    .from('partners')
    .select('name, rating_avg, rating_count, inspection_count')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .maybeSingle();

  if (!data) {
    return new Response('Not found', { status: 404 });
  }

  const theme: Theme =
    new URL(request.url).searchParams.get('theme') === 'dark' ? 'dark' : 'light';
  const c = THEMES[theme];

  const name = escapeXml(truncate(data.name, 26));
  const rating = data.rating_avg as number | null;
  const ratingCount = (data.rating_count as number) ?? 0;
  const inspections = (data.inspection_count as number) ?? 0;

  // Trzecia linijka mówi to, czym firma może się realnie wykazać. Ocena, gdy
  // ją ma; w przeciwnym razie liczba opublikowanych werdyktów, bo pusta
  // odznaka jest gorsza niż jej brak.
  let stars = '';
  let detail = '';

  if (rating != null && ratingCount > 0) {
    const rounded = Math.round(rating);
    stars = [0, 1, 2, 3, 4].map((i) => star(96 + i * 15, 60, i < rounded)).join('');
    // Przy gwiazdkach zostaje ~130 px na tekst, więc mieści się ocena i liczba
    // opinii - liczba werdyktów musiałaby wyjechać poza ramkę.
    detail = `${formatRating(rating)} · ${reviewCountLabel(ratingCount)}`;
  } else if (inspections > 0) {
    detail = inspectionCountLabel(inspections);
  } else {
    detail = 'Sprawdzanie przed zakupem';
  }

  const detailX = stars ? 172 : 76;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="84" viewBox="0 0 320 84" role="img" aria-label="${name} — partner obczajone.pl">
  <rect x="0.5" y="0.5" width="319" height="83" rx="12" fill="${c.bg}" stroke="${c.border}"/>
  <g transform="translate(20 22)">
    <rect width="40" height="40" rx="10" fill="${theme === 'dark' ? '#14b8a6' : PRIMARY}"/>
    <path d="M12 20.5l5.5 5.5L28 15" fill="none" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <g font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">
    <text x="76" y="30" font-size="10.5" font-weight="600" letter-spacing="1.1" fill="${c.accent}">PARTNER OBCZAJONE.PL</text>
    <text x="76" y="49" font-size="15" font-weight="700" fill="${c.name}">${name}</text>
    ${stars}
    <text x="${detailX}" y="${stars ? 64 : 66}" font-size="11.5" fill="${c.muted}">${escapeXml(detail)}</text>
  </g>
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
