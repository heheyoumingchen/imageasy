import { useEffect, useRef, useState } from 'react';
import type { CropRect, EditorImageSummary, AdjustmentParams } from '../../types/editor';

type ImagePreviewCanvasProps = {
  image: EditorImageSummary | null;
  adjustments: AdjustmentParams;
  previewUrl: string | null;
  isLoading: boolean;
  error: string | null;
  scale: number;
  isCropping: boolean;
  onCroppingChange: (value: boolean) => void;
  onApplyCrop: (crop: CropRect | null) => void;
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
  error,
  scale,
  isCropping,
  onCroppingChange,
  onApplyCrop
}: ImagePreviewCanvasProps) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [draftCrop, setDraftCrop] = useState<CropRect | null>(adjustments.crop);
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const cropInteractionRef = useRef<CropInteraction | null>(null);

  useEffect(() => {
    setOffset({ x: 0, y: 0 });
    setDraftCrop(isCropping ? adjustments.crop ?? buildDefaultCrop(image) : adjustments.crop);
    dragOriginRef.current = null;
    cropInteractionRef.current = null;
  }, [previewUrl, adjustments.crop, isCropping, image]);

  const handlePointerDown = (event: React.PointerEvent<HTMLImageElement>) => {
    if (scale <= 1 || isCropping) {
      return;
    }

    dragOriginRef.current = {
      x: event.clientX - offset.x,
      y: event.clientY - offset.y
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLImageElement>) => {
    if (!dragOriginRef.current || scale <= 1 || isCropping) {
      return;
    }

    setOffset({
      x: event.clientX - dragOriginRef.current.x,
      y: event.clientY - dragOriginRef.current.y
    });
  };

  const handlePointerUp = () => {
    dragOriginRef.current = null;
  };

  const beginCropMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draftCrop) {
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
    if (!draftCrop) {
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
    if (!interaction || !image) {
      return;
    }

    const deltaX = Math.round(event.clientX - interaction.startX);
    const deltaY = Math.round(event.clientY - interaction.startY);

    if (interaction.mode === 'move') {
      setDraftCrop(
        clampCrop(
          {
            ...interaction.initialCrop,
            x: interaction.initialCrop.x + deltaX,
            y: interaction.initialCrop.y + deltaY
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
          width: interaction.initialCrop.width + deltaX,
          height: interaction.initialCrop.height + deltaY
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
      className="relative mt-3.5 flex min-h-[520px] items-center justify-center overflow-hidden rounded-[22px] border border-[#ececf2] bg-[linear-gradient(180deg,#f7f8fb_0%,#f2f4f8_100%)] px-5 py-4"
      onPointerMove={handleCropPointerMove}
      onPointerUp={finishCropInteraction}
      onPointerLeave={finishCropInteraction}
    >
      {error ? (
        <div className="max-w-md text-center">
          <div className="text-base font-medium text-[#d94d80]">预览生成失败</div>
          <p className="mt-2 text-sm text-[#8f95a2]">{error}</p>
        </div>
      ) : previewUrl ? (
        <div className="w-full space-y-5">
          <div className="relative flex min-h-[404px] items-center justify-center overflow-hidden rounded-[18px] border border-[#ececf2] bg-white px-5 py-4">
            <img
              src={previewUrl}
              alt={image?.name ?? 'preview'}
              className="max-h-[388px] rounded-[14px] object-contain shadow-[0_18px_36px_rgba(23,28,41,0.12)]"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                cursor: scale > 1 && !isCropping ? 'grab' : 'default'
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />

            {draftCrop ? (
              <div className="pointer-events-none absolute inset-10 rounded-[18px] border border-dashed border-[#ffacc9] bg-[rgba(255,111,165,0.06)]">
                <div
                  data-testid="crop-box"
                  className="pointer-events-auto absolute rounded-[18px] border border-[#ff8fb8] bg-[rgba(255,255,255,0.28)] shadow-[0_12px_28px_rgba(255,105,160,0.14)]"
                  style={{
                    left: `${(draftCrop.x / image!.width) * 100}%`,
                    top: `${(draftCrop.y / image!.height) * 100}%`,
                    width: `${(draftCrop.width / image!.width) * 100}%`,
                    height: `${(draftCrop.height / image!.height) * 100}%`
                  }}
                  onPointerDown={beginCropMove}
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-4 text-sm text-[#7d5062]">
                    <div className="rounded-full border border-[#ffd3e2] bg-white px-4 py-2 shadow-[0_10px_24px_rgba(255,105,160,0.12)]">
                      裁剪区域 {draftCrop.width} × {draftCrop.height}
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="crop-resize-se"
                    aria-label="调整裁剪右下角"
                    className="absolute right-[-10px] bottom-[-10px] h-5 w-5 rounded-full border border-white bg-[#ff6b9f] shadow-[0_8px_18px_rgba(255,105,160,0.28)]"
                    onPointerDown={beginResizeSouthEast}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-[#8a90a0]">
            <span>亮度 {adjustments.brightness}</span>
            <span>对比度 {adjustments.contrast}</span>
            <span>饱和度 {adjustments.saturation}</span>
          </div>
        </div>
      ) : (
        <div className="max-w-md text-center">
          <div className="text-base font-medium text-[#454c59]">{image ? image.name : '等待打开本地图片'}</div>
          <p className="mt-2 text-sm text-[#9aa0ad]">打开图片后，这里会显示真实预览。</p>
        </div>
      )}

      {isCropping ? (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-white px-4 py-3 shadow-[0_12px_28px_rgba(23,28,41,0.10)]">
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff6b9f_0%,#8d7dff_100%)] px-4 text-sm font-medium text-white"
            onClick={() => {
              onApplyCrop(draftCrop);
              onCroppingChange(false);
            }}
          >
            确认裁剪
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-full border border-[#ececf2] bg-white px-4 text-sm text-[#59606f]"
            onClick={() => {
              setDraftCrop(adjustments.crop);
              onCroppingChange(false);
            }}
          >
            取消裁剪
          </button>
        </div>
      ) : null}

      {isLoading && !error ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[26px] bg-[rgba(255,255,255,0.56)]">
          <div className="rounded-full border border-[#f0d7e1] bg-white px-4 py-2 text-sm text-[#7e8593]">正在更新预览...</div>
        </div>
      ) : null}
    </div>
  );
};

export default ImagePreviewCanvas;
