import { useEffect, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { chooseOutputDirectory, openDirectoryInSystem } from '../services/fileDialog';
import {
  fetchDownloadThumbnail,
  inspectDownloadSource,
  saveDownloadImages,
  subscribeDownloadMetadata
} from '../services/imageDownloadCommands';
import { useLanguage } from '../hooks/useLanguage';
import { formatFileSize } from '../utils/formatters';
import { toErrorMessage } from '../utils/errors';
import type { DownloadableImageItem, ImageDownloadMetadataEvent, ImageDownloadMode } from '../types/imageDownload';

const resolveDownloadMode = (value: string): ImageDownloadMode => {
  try {
    return new URL(value).hostname === 'mp.weixin.qq.com' ? 'wechat-article' : 'webpage';
  } catch {
    return 'webpage';
  }
};

const ImageDownloadPage = () => {
  const language = useLanguage();
  const [url, setUrl] = useState('');
  const [outputDirectory, setOutputDirectory] = useState('');
  const [items, setItems] = useState<DownloadableImageItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [failedPreviewIds, setFailedPreviewIds] = useState<string[]>([]);
  const [thumbnailPaths, setThumbnailPaths] = useState<Record<string, string>>({});
  const thumbnailRequestedRef = useRef<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const copy = language === 'en-US'
    ? {
        placeholder: 'Enter a webpage or article URL',
        inspect: 'Inspect images',
        chooseDirectory: 'Choose path',
        batchDownload: 'Batch download',
        openDirectory: 'Open output directory',
        selectOutputDirectoryError: 'Please choose an output directory first',
        selectImageError: 'Please choose at least one image',
        empty: 'No downloadable images found',
        outputDirectory: 'Output directory',
        resultTitle: 'Extracted results',
        selectAll: 'Select all'
      }
    : {
        placeholder: '请输入网页或公众号文章链接',
        inspect: '开始提取',
        chooseDirectory: '选择路径',
        batchDownload: '批量下载',
        openDirectory: '打开输出目录',
        selectOutputDirectoryError: '请先选择输出目录',
        selectImageError: '请先选择图片',
        empty: '未找到可下载图片',
        outputDirectory: '输出目录',
        resultTitle: '提取结果',
        selectAll: '全选'
      };

  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < items.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | null = null;

    void subscribeDownloadMetadata((payload) => {
      if (!active) {
        return;
      }

      setItems((current) => current.map((item) => (
        item.id === payload.id
          ? { ...item, sizeInBytes: payload.sizeInBytes, format: payload.format }
          : item
      )));
    }).then((cleanup) => {
      if (active) {
        unlisten = cleanup;
      } else {
        cleanup();
      }
    });

    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  const handleInspect = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setPageError(language === 'en-US' ? 'Please enter a URL' : '请输入链接');
      return;
    }
    if (!outputDirectory) {
      setPageError(copy.selectOutputDirectoryError);
      return;
    }

    setItems([]);
    setSelectedIds([]);
    setFailedPreviewIds([]);
    setThumbnailPaths({});
    thumbnailRequestedRef.current.clear();
    setIsInspecting(true);
    setPageError(null);
    try {
      const result = await inspectDownloadSource({ mode: resolveDownloadMode(trimmedUrl), url: trimmedUrl });
      setItems(result.images);
      setSelectedIds(result.images.map((item) => item.id));
      // 预览经后端代理（带 Referer 绕过防盗链），不再直接热链远程图片。
      loadThumbnails(trimmedUrl, result.images);
    } catch (error) {
      setPageError(toErrorMessage(error));
    } finally {
      setIsInspecting(false);
    }
  };

  const loadThumbnails = (pageUrl: string, list: DownloadableImageItem[]) => {
    const queue = list.filter((item) => {
      if (thumbnailRequestedRef.current.has(item.id)) {
        return false;
      }
      thumbnailRequestedRef.current.add(item.id);
      return true;
    });
    if (queue.length === 0) {
      return;
    }
    let cursor = 0;
    const workerCount = Math.min(4, queue.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (cursor < queue.length) {
        const item = queue[cursor];
        cursor += 1;
        const cachedPath = await fetchDownloadThumbnail(pageUrl, item.sourceUrl);
        if (cachedPath) {
          setThumbnailPaths((current) => ({ ...current, [item.id]: cachedPath }));
        } else {
          setFailedPreviewIds((current) => (current.includes(item.id) ? current : [...current, item.id]));
        }
      }
    });
    void Promise.all(workers);
  };

  const handleChooseOutputDirectory = async () => {
    const selected = await chooseOutputDirectory(outputDirectory || undefined);
    if (selected) {
      setOutputDirectory(selected);
    }
  };

  const runDownload = async (imageIds: string[]) => {
    const trimmedUrl = url.trim();
    if (!outputDirectory) {
      setPageError(copy.selectOutputDirectoryError);
      return;
    }
    if (imageIds.length === 0) {
      setPageError(copy.selectImageError);
      return;
    }

    setIsDownloading(true);
    setPageError(null);
    try {
      await saveDownloadImages({
        mode: resolveDownloadMode(trimmedUrl),
        pageUrl: trimmedUrl,
        outputDirectory,
        imageIds,
      });
    } catch (error) {
      setPageError(toErrorMessage(error));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleBatchDownload = async () => runDownload(selectedIds);
  const handleDownloadOne = async (imageId: string) => runDownload([imageId]);
  const toggleSelectedId = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };
  const toggleAllSelected = () => {
    setSelectedIds((current) => (current.length === items.length ? [] : items.map((item) => item.id)));
  };
  const markPreviewFailed = (id: string) => {
    setFailedPreviewIds((current) => (current.includes(id) ? current : [...current, id]));
  };

  return (
    <div className="flex flex-col h-full p-5 overflow-hidden bg-bg-main animate-in fade-in duration-500">
      <section className="flex-1 min-h-0 overflow-y-auto bg-white p-5 pr-2 custom-scrollbar">
        <div className="space-y-5 pr-3">
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
                <span>{copy.outputDirectory}</span>
                <div className="flex gap-3">
                  <input value={outputDirectory} readOnly className="h-10 flex-1 rounded border border-border-light bg-[#FBFCFE] px-4 text-sm text-[#1A1D23] outline-none" />
                  <button type="button" onClick={handleChooseOutputDirectory} className="inline-flex h-10 shrink-0 items-center justify-center rounded border border-border-light bg-white px-4 text-sm font-semibold text-[#515867] transition hover:border-meitu hover:text-meitu">
                    {copy.chooseDirectory}
                  </button>
                </div>
              </label>

              <button type="button" onClick={() => outputDirectory && openDirectoryInSystem(outputDirectory)} disabled={!outputDirectory} className="inline-flex h-10 items-center justify-center rounded border border-border-light bg-white px-4 text-sm font-semibold text-[#515867] transition hover:border-meitu hover:text-meitu disabled:cursor-not-allowed disabled:opacity-60">
                {copy.openDirectory}
              </button>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder={copy.placeholder}
                className="h-10 rounded border border-border-light bg-[#FBFCFE] px-4 text-sm outline-none transition focus:border-meitu"
              />

              <button type="button" onClick={handleInspect} disabled={isInspecting || !outputDirectory} className="inline-flex h-10 items-center justify-center rounded bg-meitu px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                {copy.inspect}
              </button>
            </div>
          </div>

          {pageError ? (
            <div className="rounded border border-[#FFD4DD] bg-[#FFF6F8] px-4 py-3 text-sm text-meitu">
              {pageError}
            </div>
          ) : null}

          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[#1A1D23]">{copy.resultTitle}</h2>

              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#515867]">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAllSelected}
                    disabled={items.length === 0}
                    aria-label={copy.selectAll}
                    className="h-4 w-4 rounded accent-meitu"
                  />
                  <span>{copy.selectAll}</span>
                </label>

                <button type="button" onClick={handleBatchDownload} disabled={isDownloading} className="inline-flex h-10 items-center justify-center rounded border border-border-light bg-white px-5 text-sm font-semibold text-[#515867] transition hover:border-meitu hover:text-meitu disabled:cursor-not-allowed disabled:opacity-60">
                  {copy.batchDownload}
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-border-light bg-[#FBFCFE] text-sm text-[#8D93A1]">
                {copy.empty}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {items.map((item) => {
                  const selected = selectedIds.includes(item.id);
                  const previewFailed = failedPreviewIds.includes(item.id);
                  const displayTitle = item.title || item.name;
                  const displaySize = item.sizeInBytes > 0 ? formatFileSize(item.sizeInBytes) : '加载中';
                  const displayFormat = item.format ? item.format.toUpperCase() : '加载中';

                  return (
                    <div
                      key={item.id}
                      data-testid="download-image-card"
                      className="group relative rounded-lg border border-border-light bg-white p-3 transition hover:border-[#D9DDE7]"
                    >
                      <label className="block cursor-pointer">
                        <input
                          type="checkbox"
                          aria-label={`选择 ${displayTitle}`}
                          checked={selected}
                          onChange={() => toggleSelectedId(item.id)}
                          className="absolute left-3 top-3 z-10 h-4 w-4 rounded accent-meitu"
                        />
                        {previewFailed ? (
                          <div className="flex aspect-square w-full items-center justify-center rounded-md border border-dashed border-border-light bg-[#FBFCFE] text-xs font-semibold text-[#8D93A1]">
                            预览不可用
                          </div>
                        ) : !thumbnailPaths[item.id] ? (
                          <div className="flex aspect-square w-full items-center justify-center rounded-md border border-dashed border-border-light bg-[#FBFCFE] text-xs font-semibold text-[#8D93A1]">
                            预览加载中…
                          </div>
                        ) : (
                          <img
                            src={convertFileSrc(thumbnailPaths[item.id])}
                            alt={displayTitle}
                            onError={() => markPreviewFailed(item.id)}
                            className="aspect-square w-full rounded-md object-cover"
                          />
                        )}
                      </label>
                      <div className="mt-2 min-w-0">
                        <div className="truncate text-xs font-semibold text-[#1A1D23]">{displayTitle}</div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-[#8D93A1]">
                          <span>{displaySize}</span>
                          <span>{displayFormat}</span>
                        </div>
                      </div>
                      <button type="button" onClick={() => handleDownloadOne(item.id)} aria-label={`下载 ${displayTitle}`} className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#F4F6FB] px-3 text-sm font-semibold text-[#515867] transition hover:bg-meitu hover:text-white">
                        下载
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ImageDownloadPage;
