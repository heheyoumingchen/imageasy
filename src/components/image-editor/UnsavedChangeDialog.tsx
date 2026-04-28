type UnsavedChangeDialogProps = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const actionButtonClass =
  'inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium transition';

const UnsavedChangeDialog = ({ open, onConfirm, onCancel }: UnsavedChangeDialogProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(28,31,39,0.24)] p-4 backdrop-blur-sm">
      <div className="w-full max-w-[420px] rounded-[28px] border border-[#efeff4] bg-white p-6 shadow-[0_24px_60px_rgba(23,28,41,0.16)]">
        <h3 className="text-base font-semibold text-[#2f3440]">存在未保存修改</h3>
        <p className="mt-3 text-sm leading-6 text-[#7e8594]">当前图片参数已修改。现在切换将丢失未保存内容，是否继续切换？</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className={`${actionButtonClass} border border-[#ececf2] bg-white text-[#616877] hover:border-[#ff9fbd] hover:text-[#ff5c93]`}
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`${actionButtonClass} bg-[linear-gradient(135deg,#ff6b9f_0%,#8d7dff_100%)] text-white shadow-[0_12px_28px_rgba(255,105,160,0.22)] hover:brightness-105`}
          >
            不保存并切换
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnsavedChangeDialog;
