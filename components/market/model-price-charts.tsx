'use client';

import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { IndexPoint } from '@/lib/market-trends';
import type { ModelCharts } from '@/lib/model-charts';

const AXIS_TICK = { fontSize: 11, fill: '#6b7280' };
const PRIMARY = 'hsl(var(--primary))';
const MUTED = '#9ca3af';

function pln(value: number): string {
  return `${Math.round(value).toLocaleString('pl-PL')} zł`;
}

function thousands(value: number): string {
  return `${Math.round(value / 1000).toLocaleString('pl-PL')} tys.`;
}

function ChartTooltip({ active, payload, label, render }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-4 py-3 shadow-lg text-sm">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {render(payload)}
    </div>
  );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <div className="mt-4 h-64 w-full">{children}</div>
    </div>
  );
}

/**
 * Indeks modelu na tle rynku. Oba startują od 100 w tym samym tygodniu,
 * więc od razu widać, czy model tanieje szybciej niż reszta.
 */
function IndexVsMarket({ name, model, market }: { name: string; model: IndexPoint[]; market: IndexPoint[] }) {
  const weeks = Array.from(new Set([...market, ...model].map((p) => p.week))).sort();
  const first = new Date(weeks[0]);
  first.setDate(first.getDate() - 7);
  const byWeek = (points: IndexPoint[]) => new Map(points.map((p) => [p.week, p.value]));
  const m = byWeek(model);
  const r = byWeek(market);
  const data = [
    { label: format(first, 'd MMM', { locale: pl }), model: 100, market: 100 },
    ...weeks.map((w) => ({
      label: format(new Date(w), 'd MMM', { locale: pl }),
      model: m.get(w) ?? null,
      market: r.get(w) ?? null,
    })),
  ];
  const values = data.flatMap((d) => [d.model, d.market]).filter((v): v is number => v != null);
  const yMin = Math.floor(Math.min(...values) * 2) / 2 - 0.5;
  const yMax = Math.ceil(Math.max(...values) * 2) / 2 + 0.5;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid horizontal vertical={false} stroke="#e5e7eb" strokeOpacity={0.6} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis domain={[yMin, yMax]} tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          content={
            <ChartTooltip
              render={(payload: any[]) =>
                payload.map((p) => (
                  <p key={p.dataKey} style={{ color: p.color }}>
                    {p.name}: {Number(p.value).toLocaleString('pl-PL', { maximumFractionDigits: 2 })}
                  </p>
                ))
              }
            />
          }
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="model" name={name} stroke={PRIMARY} strokeWidth={3} dot={{ r: 3 }} connectNulls />
        <Line
          type="monotone"
          dataKey="market"
          name="Cały rynek"
          stroke={MUTED}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function MedianBars({
  data,
  labelKey,
}: {
  data: { label: string; median: number; n: number }[];
  labelKey: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid horizontal vertical={false} stroke="#e5e7eb" strokeOpacity={0.6} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tickFormatter={thousands} tick={AXIS_TICK} tickLine={false} axisLine={false} width={68} />
        <Tooltip
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          content={
            <ChartTooltip
              render={(payload: any[]) => (
                <>
                  <p className="font-semibold">{pln(payload[0].payload.median)}</p>
                  <p className="text-xs text-muted-foreground">
                    mediana z {payload[0].payload.n} ogłoszeń ({labelKey})
                  </p>
                </>
              )}
            />
          }
        />
        <Bar dataKey="median" fill={PRIMARY} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Distribution({ data }: { data: ModelCharts['distribution'] }) {
  const rows = data.map((d) => ({ label: `${thousands(d.from)}–${thousands(d.to)}`, n: d.n }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid horizontal vertical={false} stroke="#e5e7eb" strokeOpacity={0.6} />
        <XAxis
          dataKey="label"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => v.split('–')[0]}
        />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          content={
            <ChartTooltip
              render={(payload: any[]) => (
                <p className="font-semibold">{payload[0].payload.n} ogłoszeń</p>
              )}
            />
          }
        />
        <Bar dataKey="n" fill={MUTED} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ModelPriceCharts({
  name,
  charts,
  marketIndex,
}: {
  name: string;
  charts: ModelCharts;
  marketIndex: IndexPoint[];
}) {
  const mileage = charts.byMileage.map((p, i, all) => ({
    label: i === all.length - 1 && p.from >= 300000 ? `${p.from / 1000}+ tys. km` : `${p.from / 1000}–${p.from / 1000 + 50} tys. km`,
    median: p.median,
    n: p.n,
  }));
  const years = charts.byYear.map((p) => ({ label: String(p.year), median: p.median, n: p.n }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {charts.index.length >= 2 && (
        <ChartCard
          title={`Ceny ${name} na tle rynku`}
          description="Zmiana cen tych samych aut tydzień po tygodniu, 100 = pierwszy tydzień pomiarów."
        >
          <IndexVsMarket name={name} model={charts.index} market={marketIndex} />
        </ChartCard>
      )}
      {years.length >= 2 && (
        <ChartCard title="Mediana ceny według rocznika" description="Aktywne ogłoszenia, roczniki z co najmniej 3 autami.">
          <MedianBars data={years} labelKey="rocznik" />
        </ChartCard>
      )}
      {mileage.length >= 2 && (
        <ChartCard
          title="Mediana ceny według przebiegu"
          description="Ile kosztuje auto w kolejnych przedziałach przebiegu, co 50 tys. km."
        >
          <MedianBars data={mileage} labelKey="przebieg" />
        </ChartCard>
      )}
      {charts.distribution.length >= 2 && (
        <ChartCard
          title="Rozkład cen"
          description="Ile ogłoszeń w jakim przedziale cenowym, bez 5% najtańszych i najdroższych."
        >
          <Distribution data={charts.distribution} />
        </ChartCard>
      )}
    </div>
  );
}
