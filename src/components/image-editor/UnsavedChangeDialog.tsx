type UnsavedChangeDialogProps = {
  isEnglish?: boolean;
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const actionButtonClass =
  'inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium transition';

const UnsavedChangeDialog = ({ isEnglish = false, open, onConfirm, onCancel }: UnsavedChangeDialogProps) => {
  if (!open) {
    return null;
  }

  const copy = isEnglish
    ? {
        title: 'Unsaved changes',
        description: 'The current image has unsaved adjustments. Switching now will discard them. Do you want to continue?',
        cancel: 'Cancel',
        confirm: 'Switch without saving'
      }
    : {
        title: '存在未保存修改',
        description: '当前图片参数已修改。现在切换将丢失未保存内容，是否继续切换？',
        cancel: '取消',
        confirm: '不保存并切换'
      };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(28,31,39,0.24)] p-4 backdrop-blur-sm">
      <div className="w-full max-w-[420px] rounded border border-[#efeff4] bg-white p-6 shadow-lg">
        <h3 className="text-base font-semibold text-[#2f3440]">{copy.title}</h3>
        <p className="mt-3 text-sm leading-6 text-[#7e8594]">{copy.description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className={`${actionButtonClass} border border-[#ececf2] bg-white text-[#616877] hover:border-[#ff9fbd] hover:text-[#ff5c93]`}
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`${actionButtonClass} bg-meitu text-white hover:brightness-105`}
          >
            {copy.confirm}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnsavedChangeDialog;
