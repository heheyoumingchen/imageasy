import { Plus, X, Move } from 'lucide-react';
import type { LayoutTemplate, CanvasRatio } from '../../types/stitchingLayout';
import type { StitchingCanvasImage } from '../../types/stitching';

type Props = {
  template: LayoutTemplate | null;
  canvasRatio: CanvasRatio;
  padding: number;
  spacing: number;
  borderRadius: number;
  backgroundColor: string;
  images: Array<StitchingCanvasImage | undefined>;
  onAddImage: (cellIndex: number) => void;
  onRemoveImage: (cellIndex: number) => void;
  onImportImages: () => void;
};

const ratioValues: Record<CanvasRatio, number> = {
  '1:1': 1,
  '3:4': 3 / 4,
  '9:16': 9 / 16,
  '4:3': 4 / 3,
  '16:9': 16 / 9
};

const LayoutCanvas = ({ template, canvasRatio, padding, spacing, borderRadius, backgroundColor, images, onAddImage, onRemoveImage, onImportImages }: Props) => {
  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#FAFBFD] text-[#8D93A1]">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-lg bg-white shadow-inner">
          <svg viewBox="0 0 24 24" className="w-10 h-10 opacity-20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-sm font-medium opacity-60">选择左侧布局模板开始拼接</p>
      </div>
    );
  }

  const aspectRatio = ratioValues[canvasRatio];
  const maxCanvasWidth = 800;
  const maxCanvasHeight = 600;

  let canvasWidth = maxCanvasWidth;
  let canvasHeight = canvasWidth / aspectRatio;

  if (canvasHeight > maxCanvasHeight) {
    canvasHeight = maxCanvasHeight;
    canvasWidth = canvasHeight * aspectRatio;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#FAFBFD] p-8">
      <div
        className="shadow-lg rounded-lg overflow-hidden"
        style={{ width: canvasWidth, height: canvasHeight, backgroundColor, padding }}
      >
        <div className="relative w-full h-full grid" style={{
          gap: spacing,
          gridTemplateColumns: `repeat(${template.cols}, 1fr)`,
          gridTemplateRows: `repeat(${template.rows}, 1fr)`
        }}>
          {template.cells.map((cell, index) => {
            const image = images[index];

            return (
              <div
                key={index}
                className="relative border border-dashed border-[#E2E4E9] bg-white overflow-hidden group"
                style={{
                  borderRadius,
                  gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
                  gridRow: `${cell.row + 1} / span ${cell.rowSpan}`
                }}
              >
                {image ? (
                  <>
                    {image.preview ? (
                      <img
                        src={image.preview}
                        alt={image.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#F3F4F8]">
                        <span className="text-xs text-[#8C93A1] font-medium truncate px-2">
                          {image.name}
                        </span>
                      </div>
                    )}
                    {/* 悬停工具栏 */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => onRemoveImage(index)}
                        className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white text-meitu flex items-center justify-center transition-all"
                        title="删除"
                      >
                        <X size={16} />
                      </button>
                      <button
                        type="button"
                        className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white text-[#515867] flex items-center justify-center transition-all cursor-move"
                        title="移动"
                      >
                        <Move size={16} />
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAddImage(index)}
                    className="w-full h-full flex items-center justify-center text-[#C5CAD3] hover:text-meitu hover:bg-meitu-light/30 transition-all"
                  >
                    <Plus size={32} strokeWidth={1.5} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LayoutCanvas;
