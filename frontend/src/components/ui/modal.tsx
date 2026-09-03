import * as React from "react";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const width =
    size === "sm" ? "max-w-md" : size === "md" ? "max-w-lg" : size === "lg" ? "max-w-2xl" : "max-w-4xl";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative z-10 w-full ${width} rounded-lg border bg-card shadow-xl`}>
        {title && (
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div className="text-base font-semibold">{title}</div>
            <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  tone = "danger",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "success" | "warning" | "primary";
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex justify-end gap-2">
          <button className="rounded-md border px-4 py-2 text-sm hover:bg-muted" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`rounded-md px-4 py-2 text-sm text-white ${
              tone === "danger"
                ? "bg-destructive hover:bg-destructive/90"
                : tone === "success"
                ? "bg-success hover:bg-success/90"
                : tone === "warning"
                ? "bg-warning hover:bg-warning/90"
                : "bg-primary hover:bg-primary/90"
            }`}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
