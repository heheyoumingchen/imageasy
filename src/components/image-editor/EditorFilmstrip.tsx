import type { EditorDirectoryImage } from '../../types/editor';

type EditorFilmstripProps = {
  images: EditorDirectoryImage[];
  currentIndex: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (index: number) => void;
};

const navButtonClass =
  'inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#ececf2] bg-white text-[#717887] transition hover:border-[#ff9fbd] hover:text-[#ff5c93] disabled:cursor-not-allowed disabled:opacity-40';

const EditorFilmstrip = ({ images, currentIndex, canGoPrevious, canGoNext, onPrevious, onNext, onSelect }: EditorFilmstripProps) => {
  return (
    <section aria-label="底部胶片带" className="rounded-[20px] border border-[#ececf2] bg-white px-3.5 py-3.5 shadow-[0_10px_24px_rgba(23,28,41,0.04)]">
      <div className="flex items-center gap-2.5">
        <button type="button" className={navButtonClass} onClick={onPrevious} disabled={!canGoPrevious} aria-label="上一张">
          ←
        </button>

        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-2.5 pb-1">
            {images.map((image) => {
              const active = image.index === currentIndex;
              return (
                <button
                  key={image.path}
                  type="button"
                  onClick={() => onSelect(image.index)}
                  className={`flex min-w-[128px] flex-col items-center gap-1.5 overflow-hidden rounded-[16px] border px-2 py-2 text-center transition ${
                    active
                      ? 'border-[#ffc3d7] bg-[#fff5f8] shadow-[0_6px_14px_rgba(255,105,160,0.06)]'
                      : 'border-[#efeff4] bg-[#fcfcfe] hover:border-[#ffd9e5]'
                  }`}
                  title={image.name}
                >
                  <div className="h-11 w-full overflow-hidden rounded-[12px] bg-[#eef0f5]">
                    <img src={image.thumbnailDataUrl} alt={`${image.name} 缩略图`} className="h-full w-full object-cover" />
                  </div>
                  <div className="w-full truncate text-[11px] font-medium text-[#555c69]">{image.name}</div>
                  <div className="text-[11px] text-[#a1a6b3]">{image.index + 1}.0</div>
                </button>
              );
            })}
          </div>
        </div>

        <button type="button" className={navButtonClass} onClick={onNext} disabled={!canGoNext} aria-label="下一张">
          →
        </button>
      </div>
    </section>
  );
};

export default EditorFilmstrip;
