import * as React from "react";
import { useState } from "react";

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const pos =
    side === "top"
      ? "bottom-full left-1/2 mb-1.5 -translate-x-1/2"
      : side === "bottom"
      ? "top-full left-1/2 mt-1.5 -translate-x-1/2"
      : side === "left"
      ? "right-full top-1/2 mr-1.5 -translate-y-1/2"
      : "left-full top-1/2 ml-1.5 -translate-y-1/2";
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          className={`pointer-events-none absolute z-50 w-max max-w-xs rounded-md border bg-card px-2.5 py-1.5 text-xs font-normal text-foreground shadow-lg ${pos}`}
        >
          {content}
        </span>
      )}
    </span>
  );
}
