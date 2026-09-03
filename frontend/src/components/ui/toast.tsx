import { createContext, useContext, useCallback, useRef, useState, ReactNode } from "react";

type ToastKind = "success" | "error" | "info" | "warning";
interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: (kind: ToastKind, title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

const toneClass: Record<ToastKind, string> = {
  success: "border-success/40 bg-success/10 text-success",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  info: "border-primary/40 bg-primary/10 text-primary",
  warning: "border-warning/40 bg-warning/10 text-warning",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((kind: ToastKind, title: string, message?: string) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, kind, title, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg border p-3 shadow-lg backdrop-blur ${toneClass[t.kind]}`}
          >
            <p className="text-sm font-semibold">{t.title}</p>
            {t.message && <p className="mt-0.5 text-xs opacity-90">{t.message}</p>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
