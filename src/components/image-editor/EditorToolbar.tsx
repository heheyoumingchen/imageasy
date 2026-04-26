type EditorToolbarProps = {
  canGoPrevious: boolean;
  canGoNext: boolean;
  hasUnsavedChanges: boolean;
  onOpenImage: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSave: () => void;
};

const toolbarButtonClass =
  'inline-flex min-w-[112px] items-center justify-center rounded-xl border border-cyan-400/30 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-100 shadow-sm transition hover:border-cyan-300/60 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40';

const EditorToolbar = ({
  canGoPrevious,
  canGoNext,
  hasUnsavedChanges,
  onOpenImage,
  onPrevious,
  onNext,
  onSave
}: EditorToolbarProps) => {
  return (
    <section className="mb-6 rounded-3xl border border-slate-700 bg-slate-900/85 p-4 shadow-lg shadow-slate-950/30">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-50">编辑工具栏</h3>
          <p className="mt-1 text-sm text-slate-400">先从这里打开图片，再进行切图和保存。</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={toolbarButtonClass} onClick={onOpenImage}>
          打开图片
        </button>
        <button type="button" className={toolbarButtonClass} onClick={onPrevious} disabled={!canGoPrevious}>
          上一张
        </button>
        <button type="button" className={toolbarButtonClass} onClick={onNext} disabled={!canGoNext}>
          下一张
        </button>
        <button type="button" className={toolbarButtonClass} onClick={onSave} disabled={!hasUnsavedChanges}>
          保存 JPG
        </button>
      </div>
    </section>
  );
};

export default EditorToolbar;
