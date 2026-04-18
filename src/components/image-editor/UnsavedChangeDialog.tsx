type UnsavedChangeDialogProps = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const UnsavedChangeDialog = ({ open, onConfirm, onCancel }: UnsavedChangeDialogProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-slate-950/50">
        <h3 className="text-lg font-semibold text-slate-50">存在未保存修改</h3>
        <p className="mt-3 text-sm leading-6 text-slate-400">当前图片参数已修改。现在切换将丢失未保存内容，是否继续切换？</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-800 bg-slate-950/80 px-4 py-2 text-sm text-slate-200"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100"
          >
            不保存并切换
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnsavedChangeDialog;
