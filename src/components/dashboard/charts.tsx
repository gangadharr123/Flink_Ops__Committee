"use client";

// Dashboard charts (Recharts). Colours come from the --viz-* CSS variables
// in globals.css. Severity and shelf condition use status colours and are
// always named in the legend and tooltip, so colour is never the only cue.
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS = { fontSize: 12, fill: "var(--muted-foreground)" };
// Thin surface-coloured gap between touching segments, not a border.
const GAP = { stroke: "var(--card)", strokeWidth: 2 };

type TooltipEntry = { name?: string | number; value?: number | string; color?: string };

// Shared tooltip: label on top, one row per series with a colour swatch.
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      <ul className="flex flex-col gap-0.5">
        {payload.map((entry) => (
          <li key={String(entry.name)} className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm" style={{ background: entry.color }} />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto pl-3 font-medium tabular-nums">{entry.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function legendText(value: string) {
  return <span className="text-xs text-foreground">{value}</span>;
}

const SEVERITY_SERIES = [
  { key: "immediate", name: "Immediate", color: "var(--viz-critical)" },
  { key: "high", name: "High", color: "var(--viz-serious)" },
  { key: "medium", name: "Medium", color: "var(--viz-warning)" },
  { key: "low", name: "Low", color: "var(--viz-neutral)" },
] as const;

// Open issues per hub, one horizontal bar per hub split by severity.
export function OpenBySeverityChart({
  data,
}: {
  data: { hub: string; immediate: number; high: number; medium: number; low: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={60 + data.length * 48}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }} barCategoryGap={12}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="hub" tick={AXIS} axisLine={false} tickLine={false} width={84} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
        <Legend formatter={legendText} iconType="square" iconSize={10} />
        {SEVERITY_SERIES.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} stackId="sev" fill={s.color} {...GAP} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

const CONDITION_SERIES = [
  { key: "clean", name: "Clean", color: "var(--viz-good)" },
  { key: "dusty", name: "Dusty (incl. minor dust)", color: "var(--viz-warning)" },
  { key: "mould", name: "Mould", color: "var(--viz-critical)" },
] as const;

// Shelf condition counts per visit for one hub: is it getting better?
export function ShelfConditionChart({
  visits,
}: {
  visits: { label: string; clean: number; dusty: number; mould: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={visits} margin={{ left: -8, right: 8 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={40} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
        <Legend formatter={legendText} iconType="square" iconSize={10} />
        {CONDITION_SERIES.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} stackId="cond" fill={s.color} {...GAP} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// Topics raised on the most visits. One series, so no legend: the card
// title names it.
export function TopTopicsChart({
  data,
}: {
  data: { topic: string; visits: number; times: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={40 + data.length * 34}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }} barCategoryGap={8}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="topic"
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          width={130}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="visits" name="Visits raised on" fill="var(--viz-hub-1)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Issues resolved per month, one column per hub.
export function ResolvedPerMonthChart({
  data,
  hubs,
}: {
  data: { label: string; counts: Record<string, number> }[];
  hubs: string[];
}) {
  const rows = data.map((m) => ({ label: m.label, ...m.counts }));
  const colors = ["var(--viz-hub-1)", "var(--viz-hub-2)"];
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ left: -8, right: 8 }} barGap={2} barCategoryGap="25%">
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={40} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
        <Legend formatter={legendText} iconType="square" iconSize={10} />
        {hubs.map((hub, i) => (
          <Bar
            key={hub}
            dataKey={hub}
            name={hub}
            fill={colors[i] ?? "var(--viz-neutral)"}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
