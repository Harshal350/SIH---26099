import * as React from "react";

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="border-b bg-muted/50">{children}</thead>;
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y">{children}</tbody>;
}

export function TR({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr onClick={onClick} className={`hover:bg-muted/40 ${onClick ? "cursor-pointer" : ""} ${className ?? ""}`}>
      {children}
    </tr>
  );
}

export function TH({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className ?? ""}`}>{children}</th>;
}

export function TD({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={`px-4 py-3 align-middle ${className ?? ""}`}>{children}</td>;
}
