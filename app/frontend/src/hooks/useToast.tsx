import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type Toast = {
  id: number;
  tone: "success" | "error" | "info";
  message: string;
};

type ToastContextValue = {
  push: (tone: Toast["tone"], message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const value = useMemo(
    () => ({
      push(tone: Toast["tone"], message: string) {
        const next = Date.now() + Math.random();
        setToasts((current) => [...current, { id: next, tone, message }]);
        window.setTimeout(() => {
          setToasts((current) => current.filter((toast) => toast.id !== next));
        }, 3500);
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
