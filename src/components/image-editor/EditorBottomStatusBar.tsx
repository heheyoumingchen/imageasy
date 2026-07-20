import type { EditorImageSummary } from '../../types/editor';
import { formatFileSize } from '../../utils/formatters';

type EditorBottomStatusBarProps = {
  image: EditorImageSummary | null;
  originalName?: string | null;
  currentIndex: number;
  isEnglish?: boolean;
  totalImages: number;
};

const EditorBottomStatusBar = ({ image, originalName, currentIndex, isEnglish = false, totalImages }: EditorBottomStatusBarProps) => {
  const copy = isEnglish
    ? {
        currentFile: 'Current file',
        unopened: 'Not opened'
      }
    : {
        currentFile: '当前文件',
        unopened: '未打开'
      };

  return (
    <footer
      role="contentinfo"
      className="flex items-center justify-between px-6 py-2.5 text-[12px] text-[#8D93A1] border-t border-border-light bg-white"
    >
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase tracking-wider opacity-60">{copy.currentFile}:</span>
          <span className="font-bold text-[#313744]">
            {image ? `${originalName ?? image.name} · ${isEnglish ? 'Size:' : '尺寸：'}${image.width} × ${image.height} · ${isEnglish ? 'File size:' : '大小：'}${formatFileSize(image.sizeBytes)}` : copy.unopened}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="font-bold text-meitu bg-meitu-light px-3 py-0.5 rounded-full text-[11px] tabular-nums">
          {totalImages === 0 ? '0 / 0' : `${currentIndex + 1} / ${totalImages}`}
        </div>
        <span className="font-bold opacity-60">Version: v0.1.0</span>
      </div>
    </footer>
  );
};

export default EditorBottomStatusBar;
