import type { EditorImageSummary } from '../../types/editor';
import { formatFileSize } from '../../utils/formatters';

type EditorBottomStatusBarProps = {
  image: EditorImageSummary | null;
  currentIndex: number;
  totalImages: number;
};

const EditorBottomStatusBar = ({ image, currentIndex, totalImages }: EditorBottomStatusBarProps) => {
  return (
    <footer className="rounded-[20px] border border-[#ececf2] bg-white px-5 py-4 shadow-[0_10px_24px_rgba(23,28,41,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-[#5a6170]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-[11px] tracking-[0.14em] text-[#a0a6b2]">当前文件</span>
          <span>{image?.name ?? '未打开'}</span>
          <span>{image ? `${image.width} × ${image.height}` : '--'}</span>
          <span>{image ? formatFileSize(image.sizeBytes) : '--'}</span>
        </div>
        <div className="text-sm text-[#7f8795]">{totalImages === 0 ? '-- / --' : `${currentIndex + 1} / ${totalImages}`}</div>
      </div>
    </footer>
  );
};

export default EditorBottomStatusBar;
