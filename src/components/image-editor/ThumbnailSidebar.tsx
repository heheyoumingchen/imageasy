import type { EditorDirectoryImage } from '../../types/editor';

type ThumbnailSidebarProps = {
  images: EditorDirectoryImage[];
  currentIndex: number;
  onSelect: (index: number) => void;
};

const ThumbnailSidebar = ({ images, currentIndex, onSelect }: ThumbnailSidebarProps) => {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
      <h3 className="text-lg font-semibold text-slate-50">缩略图列表</h3>
      <p className="mt-2 text-sm text-slate-400">当前目录图片会在这里显示真实缩略图，点击即可切换。</p>

      <div className="mt-6 space-y-3">
        {images.map((image) => {
          const active = image.index === currentIndex;

          return (
            <button
              key={image.path}
              type="button"
              onClick={() => onSelect(image.index)}
              className={`flex w-full items-center gap-3 overflow-hidden rounded-2xl border px-3 py-3 text-left ${
                active ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-slate-800 bg-slate-950/60'
              }`}
              title={image.name}
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80">
                <img src={image.thumbnailDataUrl} alt={`${image.name} 缩略图`} className="h-full w-full object-cover" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-200">{image.name}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {image.width} × {image.height}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ThumbnailSidebar;
