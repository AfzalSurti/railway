import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type ToastVariant = 'success' | 'error' | 'info';

type Toast = {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  notify: (toast: Omit<Toast, 'id'>) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(100%-2rem,24rem)] flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-card ${
              toast.variant === 'success'
                ? 'border-emerald-200 bg-white'
                : toast.variant === 'error'
                  ? 'border-rose-200 bg-white'
                  : 'border-slate-200 bg-white'
            }`}
          >
            <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
            {toast.message ? <p className="mt-1 text-sm text-slate-500">{toast.message}</p> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
