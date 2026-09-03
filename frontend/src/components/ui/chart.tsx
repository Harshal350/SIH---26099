export function HBarChart({
  data,
  valueKey,
  labelKey,
  max,
}: {
  data: any[];
  valueKey: string;
  labelKey: string;
  max?: number;
}) {
  const m = max ?? Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  const colors = ["bg-primary", "bg-success", "bg-warning", "bg-destructive", "bg-primary/60", "bg-accent-foreground"];
  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const v = Number(d[valueKey]) || 0;
        const pct = Math.max(2, (v / m) * 100);
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="w-40 shrink-0 truncate text-right text-sm text-muted-foreground">{d[labelKey]}</div>
            <div className="flex-1">
              <div className="h-4 w-full overflow-hidden rounded bg-muted">
                <div
                  className={`h-full ${colors[i % colors.length]} rounded`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <div className="w-16 shrink-0 text-right text-sm font-medium">{v.toLocaleString()}</div>
          </div>
        );
      })}
    </div>
  );
}

export function DonutChart({
  segments,
  size = 160,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const strokes = segments.map((s) => {
    const start = (acc / total) * 360;
    acc += s.value;
    const span = (s.value / total) * 360;
    return { ...s, start, span };
  });
  const r = 15.9155; // circumference = 100
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 42 42" style={{ width: size, height: size }} className="-rotate-90">
        <circle cx="21" cy="21" r={r} fill="transparent" stroke="hsl(var(--muted))" strokeWidth="6" />
        {strokes.map((s, i) => (
          <circle
            key={i}
            cx="21"
            cy="21"
            r={r}
            fill="transparent"
            stroke={s.color}
            strokeWidth="6"
            strokeDasharray={`${s.span} ${100 - s.span}`}
            strokeDashoffset={-s.start}
          />
        ))}
      </svg>
      <div className="space-y-1.5">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-medium">{Math.round((s.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
