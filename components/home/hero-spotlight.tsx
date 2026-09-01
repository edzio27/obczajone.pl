import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ArrowUpRight, MapPin, TrendingDown } from 'lucide-react';
import { ListingThumbnail } from '@/components/listing-thumbnail';
import type { HeroSpotlight as Spotlight } from '@/lib/home-data';

const W = 260;
const H = 64;

/**
 * Buduje ścieżkę SVG z serii cen.
 *
 * Świadomie ręcznie, a nie recharts: nagłówek renderuje się na serwerze i ma
 * być pierwszą rzeczą na ekranie, a recharts to komponent kliencki, który
 * dołożyłby kilkadziesiąt kilobajtów JS-u do ścieżki krytycznej po to, żeby
 * narysować jedną łamaną bez osi, siatki i tooltipa.
 */
function buildPath(series: number[]) {
  const min = Math.min(...series);
  const max = Math.max(...series);
  // Płaski odcinek dzieliłby przez zero - wtedy rysujemy linię w połowie wysokości.
  const span = max - min || 1;
  // Ostatni punkt cofnięty o grubość kreski, żeby jej zaokrąglony koniec nie
  // został przycięty na prawej krawędzi wykresu.
  const usableW = W - 2;
  const stepX = series.length > 1 ? usableW / (series.length - 1) : 0;

  const points = series.map((price, i) => {
    const x = i * stepX;
    const y = H - ((price - min) / span) * (H - 8) - 4;
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${usableW},${H} L0,${H} Z`;

  return { line, area };
}

export function HeroSpotlight({ spotlight }: { spotlight: Spotlight }) {
  const { line, area } = buildPath(spotlight.series);
  const saved = spotlight.startPrice - spotlight.currentPrice;

  return (
    <Link
      href={`/listing/${spotlight.id}`}
      className="group block w-full max-w-md rounded-2xl border border-white/12 bg-white/[0.06] p-5 backdrop-blur-xl transition-all duration-300 ease-spring hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.09]"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/20 px-2.5 py-1 text-[11px] font-bold text-success">
          <TrendingDown className="h-3 w-3" />
          Cena spadła o {Math.abs(spotlight.changePercent).toFixed(0)}%
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
          {spotlight.source}
        </span>
      </div>

      <div className="mt-4 flex gap-3.5">
        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-white/10 flex items-center justify-center">
          <ListingThumbnail src={spotlight.image_url} alt={spotlight.title} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-white">
            {spotlight.title}
          </h3>
          <p className="mt-1 flex items-center gap-1 truncate text-xs text-white/45">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            {spotlight.location || 'Polska'}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-end gap-2.5">
        <span className="text-2xl font-extrabold tabular text-white leading-none">
          {spotlight.currentPrice.toLocaleString('pl-PL')} zł
        </span>
        <span className="pb-0.5 text-sm font-semibold tabular text-white/35 line-through">
          {spotlight.startPrice.toLocaleString('pl-PL')} zł
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 h-14 w-full overflow-visible"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Wykres ceny: z ${spotlight.startPrice} zł do ${spotlight.currentPrice} zł`}
      >
        <defs>
          <linearGradient id="hero-spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity="0.22" />
            <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#hero-spark)" />
        <path
          d={line}
          fill="none"
          stroke="hsl(var(--success))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
        <p className="text-xs text-white/50">
          {saved.toLocaleString('pl-PL')} zł mniej niż{' '}
          {formatDistanceToNow(new Date(spotlight.firstSeenAt), { locale: pl })} temu
        </p>
        <span className="inline-flex items-center gap-1 text-xs font-bold text-white/70 transition-all duration-300 ease-spring group-hover:gap-2 group-hover:text-white">
          Zobacz
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
