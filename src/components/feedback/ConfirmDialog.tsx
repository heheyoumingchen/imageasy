import type { ReactNode } from 'react';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
};

const ConfirmDialog = ({ open, title, children, confirmLabel, cancelLabel, onConfirm, onCancel }: ConfirmDialogProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-lg border border-border-light bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-[#1A1D23]">{title}</h2>
        {children}
        <div className="mt-6 flex justify-end gap-3">
          {cancelLabel && onCancel ? (
            <button className="rounded-lg border border-border-light px-4 py-2 text-sm text-[#515867]" onClick={onCancel}>
              {cancelLabel}
            </button>
          ) : null}
          <button className="rounded-lg bg-meitu px-4 py-2 text-sm font-medium text-white" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
