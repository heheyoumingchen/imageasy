import type { EditorImageSummary } from '../../types/editor';
import { formatFileSize } from '../../utils/formatters';

type EditorStatusBarProps = {
  image: EditorImageSummary | null;
  totalImages: number;
  hasUnsavedChanges: boolean;
};

const valueClassName = 'max-w-[180px] truncate text-right text-slate-300';

const EditorStatusBar = ({ image, totalImages, hasUnsavedChanges }: EditorStatusBarProps) => {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
      <h3 className="text-lg font-semibold text-slate-50">状态栏</h3>
      <dl className="mt-4 space-y-3 text-sm text-slate-400">
        <div className="flex items-start justify-between gap-4">
          <dt className="shrink-0">文件名</dt>
          <dd className={valueClassName} title={image?.name ?? '未打开'}>{image?.name ?? '未打开'}</dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="shrink-0">分辨率</dt>
          <dd className={valueClassName}>{image ? `${image.width} × ${image.height}` : '--'}</dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="shrink-0">文件大小</dt>
          <dd className={valueClassName}>{image ? formatFileSize(image.sizeBytes) : '--'}</dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="shrink-0">目录图片数</dt>
          <dd className={valueClassName}>{totalImages}</dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="shrink-0">修改状态</dt>
          <dd className={valueClassName}>{hasUnsavedChanges ? '未保存' : '已保存'}</dd>
        </div>
      </dl>
    </div>
  );
};

export default EditorStatusBar;
