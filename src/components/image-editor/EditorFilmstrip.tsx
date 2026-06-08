import type { EditorDirectoryImage } from '../../types/editor';

import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';

type EditorFilmstripProps = {
  images: EditorDirectoryImage[];
  currentIndex: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  isDisabled?: boolean;
  isEnglish?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (index: number) => void;
};

const arrowButtonClass = 'flex h-10 w-10 shrink-0 items-center justify-center rounded border border-border-light bg-white text-[#717887] transition-all duration-300 hover:border-meitu hover:text-meitu hover:bg-meitu-light disabled:opacity-20 disabled:hover:bg-white disabled:hover:text-[#717887] active:scale-90';

const getVisibleWindow = (images: EditorDirectoryImage[], currentIndex: number, windowSize: number) => {
  if (images.length <= windowSize) {
    return images;
  }

  let start = currentIndex - Math.floor(windowSize / 2);
  if (start < 0) {
    start = 0;
  } else if (start + windowSize > images.length) {
    start = images.length - windowSize;
  }

  return images.slice(start, start + windowSize);
};

const EditorFilmstrip = ({ images, currentIndex, canGoPrevious, canGoNext, isDisabled = false, isEnglish = false, onPrevious, onNext, onSelect }: EditorFilmstripProps) => {
  const copy = isEnglish
    ? {
        regionLabel: 'Filmstrip',
        empty: 'No images found',
        previous: 'Previous',
        next: 'Next',
        thumbnailAlt: (name: string) => `${name} thumbnail`
      }
    : {
        regionLabel: '底部胶片带',
        empty: '暂无图片',
        previous: '上一张',
        next: '下一张',
        thumbnailAlt: (name: string) => `${name} 缩略图`
      };

  const visibleImages = getVisibleWindow(images, currentIndex, 6);

  return (
    <section aria-label={copy.regionLabel} className="min-w-0 bg-white rounded-lg border border-border-light p-2">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className={arrowButtonClass}
          onClick={onPrevious}
          disabled={isDisabled || !canGoPrevious}
          aria-label={copy.previous}
        >
          <ChevronLeft size={24} />
        </button>

        <div data-testid="editor-filmstrip-scroller" className="min-w-0 flex flex-1 justify-center">
          {images.length === 0 ? (
            <div className="flex h-20 items-center justify-center rounded border border-dashed border-border-light bg-bg-main text-xs font-bold text-[#98A0AF] gap-2">
              <ImageIcon size={16} />
              {copy.empty}
            </div>
          ) : (
            <div className="flex gap-3 px-1 py-1">
              {visibleImages.map((image) => {
                const active = image.index === currentIndex;
                return (
                  <button
                    key={image.path}
                    type="button"
                    onClick={() => onSelect(image.index)}
                    disabled={isDisabled}
                    className={`relative max-w-[104px] min-w-[104px] shrink-0 overflow-hidden rounded-lg transition-all duration-300 p-0.5 group disabled:cursor-not-allowed disabled:opacity-40 ${
                      active ? 'ring-2 ring-meitu ring-offset-1 bg-white' : 'hover:scale-[1.02] opacity-60 hover:opacity-100'
                    }`}
                    title={image.name}
                  >
                    <div className="h-[74px] w-full overflow-hidden rounded bg-bg-main border border-black/5">
                      <img
                        src={image.thumbnailDataUrl}
                        alt={copy.thumbnailAlt(image.name)}
                        className={`h-full w-full object-cover transition-transform duration-500 ${active ? 'scale-110' : 'group-hover:scale-110'}`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          className={arrowButtonClass}
          onClick={onNext}
          disabled={isDisabled || !canGoNext}
          aria-label={copy.next}
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </section>
  );
};

export default EditorFilmstrip;
