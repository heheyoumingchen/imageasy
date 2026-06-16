import { useEffect, useMemo, useState } from 'react';
import type { AdjustmentParams, CropRect, EditorImageSummary } from '../../types/editor';
import ImagePreviewCanvas from './ImagePreviewCanvas';

type EditorPreviewStageProps = {
  image: EditorImageSummary | null;
  adjustments: AdjustmentParams;
  previewUrl: string | null;
  isLoading: boolean;
  isCropCommitting?: boolean;
  isEnglish?: boolean;
  error: string | null;
  cssFilter?: string;
  onApplyCrop: (crop: CropRect | null) => void | Promise<void>;
  externalIsCropping?: boolean;
  onExternalIsCroppingChange?: (value: boolean) => void;
  externalIsZoomSliderOpen?: boolean;
  onExternalIsZoomSliderOpenChange?: (value: boolean) => void;
};

const clampZoom = (value: number) => Math.min(2, Math.max(0.5, value));

const EditorPreviewStage = ({
  image,
  adjustments,
  previewUrl,
  isLoading,
  isCropCommitting = false,
  isEnglish = false,
  error,
  cssFilter,
  onApplyCrop,
  externalIsCropping,
  onExternalIsCroppingChange,
  externalIsZoomSliderOpen,
  onExternalIsZoomSliderOpenChange
}: EditorPreviewStageProps) => {
  const [internalZoomValue, setInternalZoomValue] = useState(1);
  const [internalIsZoomSliderOpen, setInternalIsZoomSliderOpen] = useState(false);
  const [internalIsCropping, setInternalIsCropping] = useState(false);

  const isCropping = externalIsCropping ?? internalIsCropping;
  const setIsCropping = onExternalIsCroppingChange ?? setInternalIsCropping;
  const isZoomSliderOpen = externalIsZoomSliderOpen ?? internalIsZoomSliderOpen;
  const setIsZoomSliderOpen = onExternalIsZoomSliderOpenChange ?? setInternalIsZoomSliderOpen;
  const zoomValue = internalZoomValue;
  const setZoomValue = setInternalZoomValue;
  const copy = useMemo(
    () =>
      isEnglish
        ? {
            zoom: 'Zoom',
            zoomLevel: 'Zoom level'
          }
        : {
            zoom: '缩放',
            zoomLevel: '缩放倍率'
          },
    [isEnglish]
  );

  useEffect(() => {
    setInternalZoomValue(1);
    setInternalIsZoomSliderOpen(false);
    setInternalIsCropping(false);
  }, [previewUrl]);

  return (
    <div data-testid="editor-preview-stage" className="absolute inset-0 flex flex-col min-h-0 overflow-hidden rounded bg-[#F4F6FB]">
      <div className="flex-1 relative flex flex-col min-h-0">
        {isZoomSliderOpen ? (
          <div className="absolute top-4 right-4 z-10">
            <label className="flex items-center gap-4 rounded border border-white/40 bg-white/80 backdrop-blur-md px-4 py-2 text-xs font-bold text-meitu animate-in fade-in slide-in-from-right-4 duration-300">
              <span className="uppercase tracking-wider">{copy.zoom}</span>
              <input
                aria-label={copy.zoomLevel}
                type="range"
                min={0.5}
                max={2}
                step={0.1}
                className="h-1.5 w-24 accent-meitu bg-meitu-light rounded-full appearance-none cursor-pointer"
                value={zoomValue}
                onChange={(event) => setZoomValue(clampZoom(Number(event.currentTarget.value)))}
              />
              <span className="tabular-nums min-w-[3ch]">{zoomValue.toFixed(1)}x</span>
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center rounded px-3 text-[12px] font-bold text-[#515867] transition-all hover:bg-bg-main active:scale-95"
                onClick={() => setIsZoomSliderOpen(false)}
              >
                ×
              </button>
            </label>
          </div>
        ) : null}

        <div className="flex-1 flex items-center justify-center bg-transparent overflow-hidden transition-all duration-500">
          <ImagePreviewCanvas
            image={image}
            adjustments={adjustments}
            previewUrl={previewUrl}
            isLoading={isLoading}
            isCropCommitting={isCropCommitting}
            isEnglish={isEnglish}
            error={error}
            scale={zoomValue}
            isCropping={isCropping}
            cssFilter={cssFilter}
            onCroppingChange={setIsCropping}
            onApplyCrop={onApplyCrop}
          />
        </div>
      </div>
    </div>
  );
};

export default EditorPreviewStage;
