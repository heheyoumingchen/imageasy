import { useEffect, useState } from 'react';
import type { AdjustmentParams, CropRect, EditorImageSummary } from '../../types/editor';
import EditorPreviewToolbar from './EditorPreviewToolbar';
import ImagePreviewCanvas from './ImagePreviewCanvas';

type EditorPreviewStageProps = {
  image: EditorImageSummary | null;
  adjustments: AdjustmentParams;
  previewUrl: string | null;
  isLoading: boolean;
  error: string | null;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onApplyCrop: (crop: CropRect | null) => void;
};

const clampZoom = (value: number) => Math.min(2, Math.max(0.5, value));

const EditorPreviewStage = ({
  image,
  adjustments,
  previewUrl,
  isLoading,
  error,
  onRotateLeft,
  onRotateRight,
  onApplyCrop
}: EditorPreviewStageProps) => {
  const [zoomValue, setZoomValue] = useState(1);
  const [isZoomSliderOpen, setIsZoomSliderOpen] = useState(false);
  const [isCropping, setIsCropping] = useState(false);

  useEffect(() => {
    setZoomValue(1);
    setIsZoomSliderOpen(false);
    setIsCropping(false);
  }, [previewUrl]);

  return (
    <div className="rounded-[20px] border border-[#ececf2] bg-white p-3.5 shadow-[0_10px_24px_rgba(23,28,41,0.04)]">
      <div className="rounded-[20px] bg-[#fbfbfd] px-3.5 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-[13px] font-medium text-[#666d7a]">预览窗口</h3>
            <p className="mt-0.5 text-[10px] text-[#b0b5c0]">旋转、裁剪与缩放都在这里完成。</p>
          </div>
          <EditorPreviewToolbar
            disabled={!previewUrl}
            isCropping={isCropping}
            isZoomSliderOpen={isZoomSliderOpen}
            zoomValue={zoomValue}
            onRotateLeft={onRotateLeft}
            onRotateRight={onRotateRight}
            onStartCrop={() => setIsCropping(true)}
            onToggleZoomSlider={() => setIsZoomSliderOpen((value) => !value)}
            onZoomChange={(value) => setZoomValue(clampZoom(value))}
          />
        </div>

        <ImagePreviewCanvas
          image={image}
          adjustments={adjustments}
          previewUrl={previewUrl}
          isLoading={isLoading}
          error={error}
          scale={zoomValue}
          isCropping={isCropping}
          onCroppingChange={setIsCropping}
          onApplyCrop={onApplyCrop}
        />
      </div>
    </div>
  );
};

export default EditorPreviewStage;
