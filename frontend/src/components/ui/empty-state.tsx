import * as React from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-dashed rounded-lg px-6 py-16 text-center">
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
