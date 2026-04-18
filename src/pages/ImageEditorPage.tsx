import { useEffect, useMemo, useRef, useState } from 'react';
import EditorRightPanel from '../components/image-editor/EditorRightPanel';
import EditorStatusBar from '../components/image-editor/EditorStatusBar';
import EditorToolbar from '../components/image-editor/EditorToolbar';
import ImagePreviewCanvas from '../components/image-editor/ImagePreviewCanvas';
import ThumbnailSidebar from '../components/image-editor/ThumbnailSidebar';
import UnsavedChangeDialog from '../components/image-editor/UnsavedChangeDialog';
import { generateImagePreview, openImageSession, saveImageAsJpg } from '../services/editorCommands';
import { chooseJpgSavePath, openImageFile } from '../services/fileDialog';
import { useEditorStore } from '../stores/editorStore';
import type { AdjustmentParams } from '../types/editor';

const buildDefaultSavePath = (sourcePath: string) => {
  const normalized = sourcePath.replace(/\\/g, '/');
  const lastSlashIndex = normalized.lastIndexOf('/');
  const directory = lastSlashIndex >= 0 ? normalized.slice(0, lastSlashIndex + 1) : '';
  const fileName = lastSlashIndex >= 0 ? normalized.slice(lastSlashIndex + 1) : normalized;
  const dotIndex = fileName.lastIndexOf('.');
  const stem = dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName;

  return `${directory}${stem}_edited.jpg`;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== '{}') {
      return serialized;
    }
  } catch {
    // ignore serialization failure
  }

  return fallback;
};

const ImageEditorPage = () => {
  const {
    currentImage,
    currentIndex,
    directoryImages,
    adjustments,
    copiedAdjustments,
    hasUnsavedChanges,
    pendingSwitchTarget,
    openImages,
    updateAdjustment,
    copyAdjustments,
    pasteAdjustments,
    markSaved,
    requestSwitch,
    confirmSwitch,
    cancelSwitch,
    goToPrevious,
    goToNext
  } = useEditorStore();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const latestPreviewRequestId = useRef(0);

  useEffect(() => {
    if (!currentImage) {
      setPreviewUrl(null);
      return;
    }

    const requestId = latestPreviewRequestId.current + 1;
    latestPreviewRequestId.current = requestId;

    let cancelled = false;
    const timerId = window.setTimeout(() => {
      const loadPreview = async () => {
        setIsPreviewLoading(true);
        setPageError(null);

        try {
          const result = await generateImagePreview({
            path: currentImage.path,
            adjustments,
            maxWidth: 560,
            maxHeight: 420
          });

          if (!cancelled && requestId === latestPreviewRequestId.current) {
            setPreviewUrl(result.dataUrl);
          }
        } catch (error) {
          if (!cancelled && requestId === latestPreviewRequestId.current) {
            setPageError(getErrorMessage(error, '无法生成图片预览'));
          }
        } finally {
          if (!cancelled && requestId === latestPreviewRequestId.current) {
            setIsPreviewLoading(false);
          }
        }
      };

      void loadPreview();
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [currentImage, adjustments]);

  const handleOpenImage = async () => {
    setIsOpening(true);
    setPageError(null);

    try {
      const path = await openImageFile();
      if (!path) {
        return;
      }

      const session = await openImageSession(path);
      openImages(session);
    } catch (error) {
      setPageError(getErrorMessage(error, '打开图片失败'));
    } finally {
      setIsOpening(false);
    }
  };

  const handleSave = async () => {
    if (!currentImage) {
      return;
    }

    setIsSaving(true);
    setPageError(null);

    try {
      const targetPath = await chooseJpgSavePath(buildDefaultSavePath(currentImage.path));
      if (!targetPath) {
        return;
      }

      await saveImageAsJpg({
        sourcePath: currentImage.path,
        targetPath,
        adjustments,
        quality: 90
      });

      markSaved();
    } catch (error) {
      setPageError(getErrorMessage(error, '保存 JPG 失败'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeAdjustment = (key: keyof AdjustmentParams, value: number) => {
    updateAdjustment(key, value);
  };

  const toolbarDisabledLabel = useMemo(() => {
    if (isOpening) {
      return '正在打开图片';
    }

    if (isSaving) {
      return '正在保存 JPG';
    }

    return null;
  }, [isOpening, isSaving]);

  return (
    <section>
      <EditorToolbar
        canGoPrevious={!isOpening && !isSaving && currentIndex > 0}
        canGoNext={!isOpening && !isSaving && currentIndex >= 0 && currentIndex < directoryImages.length - 1}
        hasCopiedAdjustments={Boolean(copiedAdjustments)}
        hasUnsavedChanges={hasUnsavedChanges}
        onOpenImage={handleOpenImage}
        onPrevious={goToPrevious}
        onNext={goToNext}
        onCopy={copyAdjustments}
        onPaste={pasteAdjustments}
        onSave={handleSave}
      />

      {toolbarDisabledLabel ? <p className="mb-4 text-sm text-slate-400">{toolbarDisabledLabel}</p> : null}
      {pageError ? <p className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{pageError}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <ThumbnailSidebar
          images={directoryImages}
          currentIndex={currentIndex}
          onSelect={(index) => requestSwitch({ index, reason: 'thumbnail' })}
        />

        <ImagePreviewCanvas
          image={currentImage}
          adjustments={adjustments}
          previewUrl={previewUrl}
          isLoading={isPreviewLoading}
          error={pageError}
        />

        <div className="space-y-6">
          <EditorRightPanel adjustments={adjustments} onChange={handleChangeAdjustment} />
          <EditorStatusBar
            image={currentImage}
            totalImages={directoryImages.length}
            hasUnsavedChanges={hasUnsavedChanges}
          />
        </div>
      </div>

      <UnsavedChangeDialog
        open={Boolean(pendingSwitchTarget)}
        onConfirm={confirmSwitch}
        onCancel={cancelSwitch}
      />
    </section>
  );
};

export default ImageEditorPage;
