export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function fmtPct(v: number): string {
  return `${Math.round(v * 100)}%`;
}
