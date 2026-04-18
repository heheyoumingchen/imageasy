import type { EditorImageSummary, AdjustmentParams } from '../../types/editor';

type ImagePreviewCanvasProps = {
  image: EditorImageSummary | null;
  adjustments: AdjustmentParams;
  previewUrl: string | null;
  isLoading: boolean;
  error: string | null;
};

const ImagePreviewCanvas = ({ image, adjustments, previewUrl, isLoading, error }: ImagePreviewCanvasProps) => {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-50">图片预览区</h3>
          <p className="mt-2 text-sm text-slate-400">使用 Rust command 生成预览，保持与保存输出一致。</p>
        </div>
        <div className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1 text-xs text-slate-400">P0 主链路</div>
      </div>

      <div className="relative mt-6 flex min-h-[480px] items-center justify-center rounded-[28px] border border-dashed border-slate-700 bg-slate-950/70 p-6">
        {error ? (
          <div className="max-w-md text-center">
            <div className="text-base font-medium text-rose-300">预览生成失败</div>
            <p className="mt-2 text-sm text-slate-400">{error}</p>
          </div>
        ) : previewUrl ? (
          <div className="w-full space-y-4">
            <div className="flex justify-center">
              <img src={previewUrl} alt={image?.name ?? 'preview'} className="max-h-[420px] rounded-2xl object-contain shadow-2xl shadow-slate-950/40" />
            </div>
            <div className="text-center text-sm text-slate-500">
              亮度 {adjustments.brightness} / 对比度 {adjustments.contrast} / 饱和度 {adjustments.saturation}
            </div>
          </div>
        ) : (
          <div className="max-w-md text-center">
            <div className="text-base font-medium text-slate-200">{image ? image.name : '等待打开本地图片'}</div>
            <p className="mt-2 text-sm text-slate-500">打开图片后，这里会显示真实预览。</p>
          </div>
        )}

        {isLoading && !error ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[28px] bg-slate-950/35">
            <div className="rounded-full border border-slate-700 bg-slate-950/85 px-4 py-2 text-sm text-slate-200">
              正在更新预览...
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ImagePreviewCanvas;
