type ToastItem = {
  id: string;
  message: string;
  tone: 'success' | 'error' | 'info';
};

const toneClassMap = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  error: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  info: 'border-slate-700 bg-slate-800 text-slate-100'
} as const;

const ToastHost = ({ toasts }: { toasts: ToastItem[] }) => {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div key={toast.id} className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${toneClassMap[toast.tone]}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
};

export default ToastHost;
