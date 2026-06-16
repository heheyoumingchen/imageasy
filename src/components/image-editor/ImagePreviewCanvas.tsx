import { useEffect, useMemo, useRef, useState } from 'react';
import type { CropRect, EditorImageSummary, AdjustmentParams } from '../../types/editor';
import { cropToOverlayRect, getDisplayedImageRect, pointerDeltaToImageDelta } from '../../utils/editorCropLayout';

type ImagePreviewCanvasProps = {
  image: EditorImageSummary | null;
  adjustments: AdjustmentParams;
  previewUrl: string | null;
  isLoading: boolean;
  isCropCommitting?: boolean;
  isEnglish?: boolean;
  error: string | null;
  scale: number;
  isCropping: boolean;
  cssFilter?: string;
  cssTransform?: string;
  onCroppingChange: (value: boolean) => void;
  onApplyCrop: (crop: CropRect | null) => void | Promise<void>;
};

type CropInteraction =
  | {
      mode: 'move';
      startX: number;
      startY: number;
      initialCrop: CropRect;
    }
  | {
      mode: 'resize-se';
      startX: number;
      startY: number;
      initialCrop: CropRect;
    };

const MIN_CROP_SIZE = 80;

const buildDefaultCrop = (image: EditorImageSummary | null): CropRect | null => {
  if (!image) {
    return null;
  }

  return {
    x: Math.round(image.width * 0.15),
    y: Math.round(image.height * 0.15),
    width: Math.round(image.width * 0.7),
    height: Math.round(image.height * 0.7)
  };
};

const clampCrop = (crop: CropRect, image: EditorImageSummary | null) => {
  if (!image) {
    return crop;
  }

  const maxX = Math.max(0, image.width - MIN_CROP_SIZE);
  const maxY = Math.max(0, image.height - MIN_CROP_SIZE);
  const x = Math.min(Math.max(0, crop.x), maxX);
  const y = Math.min(Math.max(0, crop.y), maxY);
  const maxWidth = image.width - x;
  const maxHeight = image.height - y;

  return {
    x,
    y,
    width: Math.min(Math.max(MIN_CROP_SIZE, crop.width), maxWidth),
    height: Math.min(Math.max(MIN_CROP_SIZE, crop.height), maxHeight)
  };
};

const ImagePreviewCanvas = ({
  image,
  adjustments,
  previewUrl,
  isLoading,
  isCropCommitting = false,
  isEnglish = false,
  error,
  scale,
  isCropping,
  cssFilter,
  cssTransform,
  onCroppingChange,
  onApplyCrop
}: ImagePreviewCanvasProps) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [draftCrop, setDraftCrop] = useState<CropRect | null>(adjustments.crop);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const cropInteractionRef = useRef<CropInteraction | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    setOffset({ x: 0, y: 0 });
    offsetRef.current = { x: 0, y: 0 };
    setDraftCrop(isCropping ? adjustments.crop ?? buildDefaultCrop(image) : adjustments.crop);
    dragOriginRef.current = null;
    cropInteractionRef.current = null;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, [previewUrl, adjustments.crop, isCropping, image]);

  useEffect(() => {
    const measure = () => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      setViewportSize({
        width: rect.width || viewportRef.current?.clientWidth || 760,
        height: rect.height || viewportRef.current?.clientHeight || 560
      });
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [previewUrl, scale, image]);

  const copy = isEnglish
    ? {
        previewFailed: 'Preview generation failed',
        cropArea: 'Crop area',
        resizeSouthEast: 'Resize crop bottom right corner',
        waitingTitle: image ? image.name : 'Waiting for a local image',
        waitingDescription: 'Open an image and the live preview will appear here.',
        confirmCrop: 'Apply crop',
        cancelCrop: 'Cancel crop',
        updatingPreview: 'Updating preview...'
      }
    : {
        previewFailed: '预览生成失败',
        cropArea: '裁剪区域',
        resizeSouthEast: '调整裁剪右下角',
        waitingTitle: image ? image.name : '等待打开本地图片',
        waitingDescription: '打开图片后，这里会显示真实预览。',
        confirmCrop: '确认裁剪',
        cancelCrop: '取消裁剪',
        updatingPreview: '正在更新预览...'
      };

  const displayedRect = useMemo(() => {
    if (!image || viewportSize.width === 0 || viewportSize.height === 0) {
      return null;
    }

    return getDisplayedImageRect({
      viewportWidth: viewportSize.width,
      viewportHeight: viewportSize.height,
      imageWidth: image.width,
      imageHeight: image.height,
      scale,
      offsetX: offset.x,
      offsetY: offset.y
    });
  }, [image, viewportSize, scale, offset]);

  const activeCrop = draftCrop;
  const overlayCrop = image && activeCrop && displayedRect
    ? cropToOverlayRect(activeCrop, displayedRect, { width: image.width, height: image.height })
    : null;

  const handlePointerDown = (event: React.PointerEvent<HTMLImageElement>) => {
    if (scale <= 1 || isCropping) {
      return;
    }

    const target = event.target as HTMLElement;
    target.setPointerCapture?.(event.pointerId);
    dragOriginRef.current = {
      x: event.clientX - offsetRef.current.x,
      y: event.clientY - offsetRef.current.y
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLImageElement>) => {
    if (!dragOriginRef.current || scale <= 1 || isCropping) {
      return;
    }

    const newX = event.clientX - dragOriginRef.current.x;
    const newY = event.clientY - dragOriginRef.current.y;
    offsetRef.current = { x: newX, y: newY };

    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const container = previewContainerRef.current;
        if (container) {
          container.style.transform = `translate(${offsetRef.current.x}px, ${offsetRef.current.y}px)`;
        }
      });
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLImageElement>) => {
    if (dragOriginRef.current) {
      (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
      dragOriginRef.current = null;
      // Commit final position to React state and clear inline transform
      const container = previewContainerRef.current;
      if (container) {
        container.style.transform = '';
      }
      setOffset(offsetRef.current);
    }
  };

  const beginCropMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draftCrop || isCropCommitting) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    cropInteractionRef.current = {
      mode: 'move',
      startX: event.clientX,
      startY: event.clientY,
      initialCrop: draftCrop
    };
  };

  const beginResizeSouthEast = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!draftCrop || isCropCommitting) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    cropInteractionRef.current = {
      mode: 'resize-se',
      startX: event.clientX,
      startY: event.clientY,
      initialCrop: draftCrop
    };
  };

  const handleCropPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const interaction = cropInteractionRef.current;
    if (!interaction || !image || isCropCommitting) {
      return;
    }

    const imageDelta = displayedRect
      ? pointerDeltaToImageDelta({
          displayedRect,
          imageWidth: image.width,
          imageHeight: image.height,
          deltaX: event.clientX - interaction.startX,
          deltaY: event.clientY - interaction.startY
        })
      : { x: 0, y: 0 };

    if (interaction.mode === 'move') {
      setDraftCrop(
        clampCrop(
          {
            ...interaction.initialCrop,
            x: interaction.initialCrop.x + imageDelta.x,
            y: interaction.initialCrop.y + imageDelta.y
          },
          image
        )
      );
      return;
    }

    setDraftCrop(
      clampCrop(
        {
          ...interaction.initialCrop,
          width: interaction.initialCrop.width + imageDelta.x,
          height: interaction.initialCrop.height + imageDelta.y
        },
        image
      )
    );
  };

  const finishCropInteraction = () => {
    cropInteractionRef.current = null;
  };

  return (
    <div
      ref={viewportRef}
      className="relative flex flex-1 w-full h-full items-center justify-center overflow-hidden bg-transparent"
      onPointerMove={handleCropPointerMove}
      onPointerUp={finishCropInteraction}
      onPointerLeave={finishCropInteraction}
    >
      {error ? (
        <div className="max-w-md rounded border border-red-100 bg-white/50 p-8 text-center backdrop-blur-sm">
          <div className="text-base font-bold text-meitu">{copy.previewFailed}</div>
          <p className="mt-2 text-sm text-[#8D93A1]">{error}</p>
        </div>
      ) : previewUrl && displayedRect ? (
        <div
          ref={previewContainerRef}
          data-testid="preview-stage-content"
          className="absolute will-change-transform"
          style={{
            left: displayedRect.left,
            top: displayedRect.top,
            width: displayedRect.width,
            height: displayedRect.height
          }}
        >
          <img
            ref={previewImageRef}
            src={previewUrl}
            alt="preview"
            className="h-full w-full rounded select-none"
            style={{
              cursor: scale > 1 && !isCropping ? 'grab' : 'default',
              filter: cssFilter || undefined,
              transform: cssTransform || undefined
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />

          {overlayCrop ? (
            <div
              data-testid="crop-box"
              className={`absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5),0_0_20px_rgba(255,45,108,0.3)] ring-2 ring-meitu ${isCropCommitting ? 'pointer-events-none opacity-80' : 'pointer-events-auto'}`}
              style={{
                left: overlayCrop.left - displayedRect.left,
                top: overlayCrop.top - displayedRect.top,
                width: overlayCrop.width,
                height: overlayCrop.height
              }}
              onPointerDown={beginCropMove}
            >
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-40">
                {[...Array(4)].map((_, i) => (
                  <div key={`v-${i}`} className="border-r border-white/60 h-full" />
                ))}
                {[...Array(4)].map((_, i) => (
                  <div key={`h-${i}`} className="border-b border-white/60 w-full absolute left-0" style={{ top: `${i * 33.33}%` }} />
                ))}
              </div>

              <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/20 bg-meitu/90 px-4 py-1.5 text-[11px] font-bold text-white shadow-2xl backdrop-blur-md">
                {copy.cropArea} {activeCrop?.width ?? 0} × {activeCrop?.height ?? 0}
              </div>

              <div className="absolute -top-2 -left-2 w-4 h-4 rounded-full border-2 border-meitu bg-white shadow-lg" />
              <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full border-2 border-meitu bg-white shadow-lg" />
              <div className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full border-2 border-meitu bg-white shadow-lg" />
              <button
                type="button"
                data-testid="crop-resize-se"
                aria-label={copy.resizeSouthEast}
                className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full border-2 border-white bg-meitu shadow-xl cursor-nwse-resize active:scale-125 transition-all flex items-center justify-center"
                onPointerDown={beginResizeSouthEast}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </button>
            </div>
          ) : null}
        </div>
      ) : previewUrl ? null : (
        <div className="flex max-w-sm flex-col items-center gap-6 p-12 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded bg-white text-meitu opacity-20">
            <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <div>
            <div className="mb-2 text-lg font-bold text-[#1A1D23]">{copy.waitingTitle}</div>
            <p className="text-sm leading-relaxed text-[#8D93A1]">{copy.waitingDescription}</p>
          </div>
        </div>
      )}

      {isCropping ? (
        <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-4 rounded border border-border-light bg-white p-2">
          <button
            type="button"
            disabled={isCropCommitting}
            className="inline-flex h-10 items-center justify-center rounded bg-meitu px-6 text-sm font-bold text-white hover:brightness-110 active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100 disabled:active:scale-100"
            onClick={() => {
              if (isCropCommitting) {
                return;
              }
              void onApplyCrop(draftCrop);
            }}
          >
            {copy.confirmCrop}
          </button>
          <button
            type="button"
            disabled={isCropCommitting}
            className="inline-flex h-10 items-center justify-center rounded px-6 text-sm font-bold text-[#5D6472] hover:bg-bg-main transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            onClick={() => {
              setDraftCrop(adjustments.crop);
              onCroppingChange(false);
            }}
          >
            {copy.cancelCrop}
          </button>
        </div>
      ) : null}

      {isLoading && !error ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-bg-main/40 backdrop-blur-[1px] transition-opacity duration-300">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-meitu/20 border-t-meitu rounded-full animate-spin" />
            <div className="text-xs font-bold text-meitu uppercase tracking-widest">{copy.updatingPreview}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ImagePreviewCanvas;
