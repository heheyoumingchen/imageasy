import { FolderOpen, Undo2, Redo2, FileOutput, RotateCcw, RotateCw, ZoomIn, Crop, Trash2 } from 'lucide-react';

type EditorTopActionBarProps = {
  hasUnsavedChanges: boolean;
  canUndo: boolean;
  canRedo: boolean;
  isBusy: boolean;
  canDelete?: boolean;
  isEnglish?: boolean;
  onOpenImage: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onRotateLeft?: () => void;
  onRotateRight?: () => void;
  onZoom?: () => void;
  onCrop?: () => void;
  onDelete?: () => void;
};

const EditorTopActionBar = ({
  hasUnsavedChanges,
  canUndo,
  canRedo,
  isBusy,
  canDelete = false,
  isEnglish = false,
  onOpenImage,
  onUndo,
  onRedo,
  onSave,
  onRotateLeft,
  onRotateRight,
  onZoom,
  onCrop,
  onDelete
}: EditorTopActionBarProps) => {
  const copy = isEnglish
    ? {
        openImage: 'Open',
        undo: 'Undo',
        redo: 'Redo',
        rotateLeft: 'Rotate Left',
        rotateRight: 'Rotate Right',
        zoom: 'Zoom',
        crop: 'Crop',
        delete: 'Delete',
        saveJpg: 'Export'
      }
    : {
        openImage: '打开',
        undo: '撤销',
        redo: '重做',
        rotateLeft: '左旋转',
        rotateRight: '右旋转',
        zoom: '缩放',
        crop: '裁剪',
        delete: '删除',
        saveJpg: '导出'
      };

  return (
    <header data-testid="editor-top-action-bar" className="min-w-0 flex items-center justify-between mb-2 bg-white rounded-lg border border-border-light px-5 py-2">
      <div data-testid="editor-toolbar-groups" className="min-w-0 flex items-center gap-2 overflow-x-auto no-scrollbar pr-3">
        <button
          type="button"
          className="flex h-10 items-center justify-center gap-2 rounded border border-border-light bg-white px-4 text-[13px] font-bold text-[#515867] transition-all duration-200 hover:border-meitu hover:text-meitu active:scale-95 disabled:opacity-40"
          onClick={onOpenImage}
          disabled={isBusy}
        >
          <FolderOpen size={20} className="text-meitu" />
          {copy.openImage}
        </button>

        <div className="w-px h-5 bg-border-light/60 mx-1" />

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded text-[#515867] transition-all hover:bg-bg-main hover:text-meitu active:scale-95 disabled:opacity-30"
            onClick={onUndo}
            disabled={!canUndo}
            title={copy.undo}
          >
            <Undo2 size={20} />
          </button>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded text-[#515867] transition-all hover:bg-bg-main hover:text-meitu active:scale-95 disabled:opacity-30"
            onClick={onRedo}
            disabled={!canRedo}
            title={copy.redo}
          >
            <Redo2 size={20} />
          </button>
        </div>

        <div className="w-px h-5 bg-border-light/60 mx-1" />

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded text-[#515867] transition-all hover:bg-bg-main hover:text-meitu active:scale-95 disabled:opacity-40"
            onClick={onRotateLeft}
            disabled={isBusy}
            title={copy.rotateLeft}
          >
            <RotateCcw size={20} />
          </button>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded text-[#515867] transition-all hover:bg-bg-main hover:text-meitu active:scale-95 disabled:opacity-40"
            onClick={onRotateRight}
            disabled={isBusy}
            title={copy.rotateRight}
          >
            <RotateCw size={20} />
          </button>
        </div>

        <div className="w-px h-5 bg-border-light/60 mx-1" />

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded text-[#515867] transition-all hover:bg-bg-main hover:text-meitu active:scale-95 disabled:opacity-40"
            onClick={onZoom}
            disabled={isBusy}
            title={copy.zoom}
          >
            <ZoomIn size={20} />
          </button>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded text-[#515867] transition-all hover:bg-bg-main hover:text-meitu active:scale-95 disabled:opacity-40"
            onClick={onCrop}
            disabled={isBusy}
            title={copy.crop}
          >
            <Crop size={20} />
          </button>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded text-[#515867] transition-all hover:bg-bg-main hover:text-red-500 active:scale-95 disabled:opacity-40"
            onClick={onDelete}
            disabled={isBusy || !canDelete}
            title={copy.delete}
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      <button
        type="button"
        className="shrink-0 flex h-10 items-center justify-center gap-2 rounded-lg bg-meitu px-6 text-[13px] font-bold text-white transition-all duration-300 hover:brightness-110 active:scale-95 disabled:opacity-50"
        onClick={onSave}
        disabled={!hasUnsavedChanges || isBusy}
      >
        <FileOutput size={20} />
        {copy.saveJpg}
      </button>
    </header>
  );
};

export default EditorTopActionBar;
