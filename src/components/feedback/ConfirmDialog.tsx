type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

const ConfirmDialog = ({ open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel }: ConfirmDialogProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-3 text-sm text-slate-300">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
