import * as React from "react";

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: React.ReactNode }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${
            active === t.key
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
