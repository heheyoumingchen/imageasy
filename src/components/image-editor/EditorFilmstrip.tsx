import { useEffect, useRef, useState } from 'react';
import type { EditorDirectoryImage } from '../../types/editor';
import { generateEditorThumbnail } from '../../services/editorCommands';

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

  // 胶片栏缩略图按需懒加载：后端打开会话时不再一次性生成全部缩略图，
  // 这里仅对当前可见且缺缩略图的项并行请求生成，并缓存到组件本地状态（不使用本地文件 URL）。
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const requestedRef = useRef<Set<string>>(new Set());
  const activeImagePathsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    activeImagePathsRef.current = new Set(images.map((image) => image.path));
    requestedRef.current = new Set();
    setThumbnails({});

    return () => {
      activeImagePathsRef.current = new Set();
    };
  }, [images]);

  useEffect(() => {
    const loadVisibleThumbnails = () => {
      const missingImages = visibleImages.filter((image) => {
        if (image.thumbnailDataUrl || thumbnails[image.path] || requestedRef.current.has(image.path)) {
          return false;
        }
        requestedRef.current.add(image.path);
        return true;
      });

      for (const image of missingImages) {
        void generateEditorThumbnail(image.path)
          .then((dataUrl) => {
            if (!activeImagePathsRef.current.has(image.path)) {
              requestedRef.current.delete(image.path);
              return;
            }
            setThumbnails((current) => ({ ...current, [image.path]: dataUrl }));
          })
          .catch(() => {
            requestedRef.current.delete(image.path);
            // 单张缩略图失败不阻断其它项，占位图标继续显示；下次可见时允许重试。
          });
      }
    };

    loadVisibleThumbnails();
    // visibleImages 由 images + currentIndex 推导；thumbnails 用于避免失败重试时重复请求已成功项。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, currentIndex, thumbnails]);

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
                const thumbnailSrc = image.thumbnailDataUrl || thumbnails[image.path];
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
                      {thumbnailSrc ? (
                        <img
                          src={thumbnailSrc}
                          alt={copy.thumbnailAlt(image.name)}
                          className={`h-full w-full object-cover transition-transform duration-500 ${active ? 'scale-110' : 'group-hover:scale-110'}`}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[#F3F4F8] text-[#C5CAD3]">
                          <ImageIcon size={20} />
                        </div>
                      )}
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
