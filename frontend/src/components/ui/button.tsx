import * as React from "react";

type Variant = "primary" | "outline" | "ghost" | "danger" | "success" | "warning";
type Size = "default" | "sm" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  outline: "border bg-transparent hover:bg-muted",
  ghost: "hover:bg-muted",
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  success: "bg-success text-success-foreground hover:bg-success/90",
  warning: "bg-warning text-warning-foreground hover:bg-warning/90",
};

const sizes: Record<Size, string> = {
  default: "px-4 py-2",
  sm: "px-2.5 py-1.5 text-xs",
  icon: "p-2",
};

export function Button({
  className,
  variant = "primary",
  size = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className ?? ""}`} {...props} />;
}
