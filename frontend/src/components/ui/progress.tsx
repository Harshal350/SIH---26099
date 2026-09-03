import * as React from "react";

export function Progress({ value, tone = "primary" }: { value: number; tone?: "primary" | "success" | "warning" | "danger" }) {
  const color =
    tone === "success"
      ? "bg-success"
      : tone === "warning"
      ? "bg-warning"
      : tone === "danger"
      ? "bg-destructive"
      : "bg-primary";
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}
