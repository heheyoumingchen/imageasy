import { Plus, X, Pencil, ZoomIn, ZoomOut, Check, RotateCcw, Move } from 'lucide-react';
import { useRef, useState } from 'react';
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
  onSwapImages: (fromIndex: number, toIndex: number) => void;
  onUpdateTransform: (cellIndex: number, transform: { scale?: number; offsetX?: number; offsetY?: number }) => void;
  onResetTransform: (cellIndex: number) => void;
};

const ratioValues: Record<CanvasRatio, number> = {
  '1:1': 1,
  '3:4': 3 / 4,
  '9:16': 9 / 16,
  '4:3': 4 / 3,
  '16:9': 16 / 9
};

const SCALE_STEP = 0.2;
const SCALE_MIN = 1;
const SCALE_MAX = 6;

// 编辑模式下的预览：图片以 contain 适配方格（留白露出背景），
// offset 以方格尺寸的比例平移（translate% 相对元素自身尺寸，与后端 offset*target 一致），scale 居中缩放。
const previewTransform = (image: StitchingCanvasImage) =>
  `translate(${image.offsetX * 100}%, ${image.offsetY * 100}%) scale(${image.scale})`;

// 拖拽平移状态：记录起点与起始 offset，以及方格像素尺寸用于换算比例。
type PanState = {
  index: number;
  startX: number;
  startY: number;
  startOffsetX: number;
  startOffsetY: number;
  rectW: number;
  rectH: number;
};

const LayoutCanvas = ({
  template,
  canvasRatio,
  padding,
  spacing,
  borderRadius,
  backgroundColor,
  images,
  onAddImage,
  onRemoveImage,
  onImportImages,
  onSwapImages,
  onUpdateTransform,
  onResetTransform
}: Props) => {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [pointerDragFrom, setPointerDragFrom] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const panRef = useRef<PanState | null>(null);
  const [isPanning, setIsPanning] = useState(false);

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

  const handleDragStart = (index: number, event: React.DragEvent) => {
    if (editingIndex !== null || !images[index]) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
    setDragFrom(index);
  };

  const handleDrop = (toIndex: number) => {
    if (dragFrom !== null && dragFrom !== toIndex) {
      onSwapImages(dragFrom, toIndex);
    }
    setDragFrom(null);
  };

  const handlePointerDown = (index: number) => {
    if (editingIndex !== null || !images[index]) return;
    setPointerDragFrom(index);
  };

  const handlePointerUp = (toIndex: number) => {
    if (pointerDragFrom !== null && pointerDragFrom !== toIndex) {
      onSwapImages(pointerDragFrom, toIndex);
    }
    setPointerDragFrom(null);
  };

  const adjustScale = (index: number, delta: number) => {
    const current = images[index];
    if (!current) return;
    onUpdateTransform(index, { scale: current.scale + delta });
  };

  // 鼠标按下进入平移：记录起点与方格像素尺寸。
  const handlePanStart = (index: number, event: React.MouseEvent) => {
    const current = images[index];
    if (!current) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    panRef.current = {
      index,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: current.offsetX,
      startOffsetY: current.offsetY,
      rectW: rect.width,
      rectH: rect.height
    };
    setIsPanning(true);
  };

  const handlePanMove = (event: React.MouseEvent) => {
    const pan = panRef.current;
    if (!pan) return;
    const deltaX = (event.clientX - pan.startX) / pan.rectW;
    const deltaY = (event.clientY - pan.startY) / pan.rectH;
    onUpdateTransform(pan.index, {
      offsetX: pan.startOffsetX + deltaX,
      offsetY: pan.startOffsetY + deltaY
    });
  };

  const handlePanEnd = () => {
    panRef.current = null;
    setIsPanning(false);
  };

  const editToolbarButton =
    'w-9 h-9 rounded-lg bg-white/95 hover:bg-white text-[#515867] hover:text-meitu flex items-center justify-center transition-all shadow-sm disabled:opacity-40 disabled:hover:text-[#515867]';

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
            const isEditing = editingIndex === index;

            return (
              <div
                key={index}
                data-testid={`stitching-cell-${index}`}
                draggable={Boolean(image) && !isEditing}
                onPointerDown={() => handlePointerDown(index)}
                onPointerUp={() => handlePointerUp(index)}
                onDragStart={(event) => handleDragStart(index, event)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDrop(index)}
                className={`relative border bg-white overflow-hidden group ${
                  isEditing ? 'border-2 border-meitu' : 'border border-dashed border-[#E2E4E9]'
                }`}
                style={{
                  borderRadius,
                  gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
                  gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
                  cursor: image && !isEditing ? 'move' : 'default'
                }}
              >
                {image ? (
                  <>
                    {image.preview ? (
                      <img
                        src={image.preview}
                        alt={image.name}
                        draggable={false}
                        className="w-full h-full object-cover transition-transform duration-75 select-none"
                        style={{ transform: previewTransform(image) }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#F3F4F8]">
                        <span className="text-xs text-[#8C93A1] font-medium truncate px-2">
                          {image.name}
                        </span>
                      </div>
                    )}

                    {isEditing ? (
                      <>
                        {/* 拖拽平移热区：覆盖整格，按下并拖动鼠标平移图片 */}
                        <div
                          className="absolute inset-0"
                          style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
                          onMouseDown={(event) => handlePanStart(index, event)}
                          onMouseMove={handlePanMove}
                          onMouseUp={handlePanEnd}
                          onMouseLeave={handlePanEnd}
                        />
                        {/* 编辑模式工具栏 */}
                        <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-1.5 p-2 pointer-events-none">
                          <span className="pointer-events-none flex items-center gap-1 rounded-lg bg-black/40 px-2 py-1 text-[11px] font-bold text-white">
                            <Move size={12} />
                            拖拽移动
                          </span>
                        </div>
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 p-2">
                          <button type="button" title="缩小" className={editToolbarButton} disabled={image.scale <= SCALE_MIN} onClick={() => adjustScale(index, -SCALE_STEP)}>
                            <ZoomOut size={16} />
                          </button>
                          <button type="button" title="放大" className={editToolbarButton} disabled={image.scale >= SCALE_MAX} onClick={() => adjustScale(index, SCALE_STEP)}>
                            <ZoomIn size={16} />
                          </button>
                          <button type="button" title="重置" className={editToolbarButton} onClick={() => onResetTransform(index)}>
                            <RotateCcw size={16} />
                          </button>
                          <button type="button" title="完成" className="w-9 h-9 rounded-lg bg-meitu hover:brightness-110 text-white flex items-center justify-center transition-all shadow-sm" onClick={() => setEditingIndex(null)}>
                            <Check size={16} />
                          </button>
                        </div>
                      </>
                    ) : (
                      /* 悬停工具栏 */
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingIndex(index)}
                          className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white text-[#515867] hover:text-meitu flex items-center justify-center transition-all"
                          title="编辑"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveImage(index)}
                          className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white text-meitu flex items-center justify-center transition-all"
                          title="删除"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
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
