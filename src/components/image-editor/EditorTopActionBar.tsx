type EditorTopActionBarProps = {
  hasUnsavedChanges: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onOpenImage: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
};

const buttonClass =
  'inline-flex h-9 min-w-[84px] items-center justify-center rounded-full border border-[#ececf2] bg-white px-3.5 text-sm font-medium text-[#515867] transition hover:border-[#ff9fbd] hover:text-[#ff5c93] disabled:cursor-not-allowed disabled:opacity-40';

const primaryButtonClass =
  'inline-flex h-9 min-w-[84px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff6b9f_0%,#8d7dff_100%)] px-3.5 text-sm font-medium text-white shadow-[0_12px_28px_rgba(255,105,160,0.25)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40';

const EditorTopActionBar = ({ hasUnsavedChanges, canUndo, canRedo, onOpenImage, onUndo, onRedo, onSave }: EditorTopActionBarProps) => {
  return (
    <section aria-label="顶部主动作区" className="mb-4 rounded-[20px] border border-[#ececf2] bg-white px-4 py-3.5 shadow-[0_10px_24px_rgba(23,28,41,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[#2f3440]">图片编辑</h3>
          <p className="mt-1 text-xs text-[#9aa0ab]">打开、撤销、重做与导出操作集中显示。</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" className={buttonClass} onClick={onOpenImage}>
            打开图片
          </button>
          <button type="button" className={buttonClass} onClick={onUndo} disabled={!canUndo}>
            撤销
          </button>
          <button type="button" className={buttonClass} onClick={onRedo} disabled={!canRedo}>
            重做
          </button>
          <button type="button" className={primaryButtonClass} onClick={onSave} disabled={!hasUnsavedChanges} aria-label="保存 JPG">
            保存
          </button>
        </div>
      </div>
    </section>
  );
};

export default EditorTopActionBar;
