import { useEffect, useMemo, useRef, useState } from 'react';
import EditorBottomStatusBar from '../components/image-editor/EditorBottomStatusBar';
import EditorFilmstrip from '../components/image-editor/EditorFilmstrip';
import EditorInspector from '../components/image-editor/EditorInspector';
import EditorPreviewStage from '../components/image-editor/EditorPreviewStage';
import EditorTopActionBar from '../components/image-editor/EditorTopActionBar';
import UnsavedChangeDialog from '../components/image-editor/UnsavedChangeDialog';
import { generateImagePreview, openImageSession, saveImageAsJpg } from '../services/editorCommands';
import { chooseJpgSavePath, openImageFile } from '../services/fileDialog';
import { useEditorStore } from '../stores/editorStore';
import type { AdjustmentKey, AdjustmentParams } from '../types/editor';

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
  }

  return fallback;
};

const ImageEditorPage = () => {
  const {
    currentImage,
    currentIndex,
    directoryImages,
    adjustments,
    past,
    future,
    hasUnsavedChanges,
    pendingSwitchTarget,
    openImages,
    updateAdjustment,
    updateFilter,
    updateFilterIntensity,
    resetFilters,
    rotateLeft,
    rotateRight,
    applyCrop,
    undo,
    redo,
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
        quality: adjustments.quality
      });

      markSaved();
    } catch (error) {
      setPageError(getErrorMessage(error, '保存 JPG 失败'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeAdjustment = (key: AdjustmentKey, value: number) => {
    updateAdjustment(key, value);
  };

  const handleChangeFilter = (filterType: AdjustmentParams['filterType']) => {
    updateFilter(filterType);
  };

  const handleChangeFilterIntensity = (value: number) => {
    updateFilterIntensity(value);
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
    <section className="min-h-full rounded-[24px] border border-[#ececf2] bg-[#f8f8fb] p-3.5 text-[#2f3440] shadow-[0_12px_30px_rgba(23,28,41,0.05)]">
      <EditorTopActionBar
        hasUnsavedChanges={hasUnsavedChanges}
        canUndo={!isOpening && !isSaving && past.length > 0}
        canRedo={!isOpening && !isSaving && future.length > 0}
        onOpenImage={handleOpenImage}
        onUndo={undo}
        onRedo={redo}
        onSave={handleSave}
      />

      {toolbarDisabledLabel ? <p className="mb-4 px-1 text-sm text-[#9ca2ae]">{toolbarDisabledLabel}</p> : null}
      {pageError ? (
        <p className="mb-4 rounded-[18px] border border-[#ffd3df] bg-[#fff3f7] px-4 py-3 text-sm text-[#d94d80]">{pageError}</p>
      ) : null}

      <div className="grid gap-4.5 xl:grid-cols-[minmax(0,1fr)_296px]">
        <section aria-label="图片编辑主舞台" className="rounded-[20px] border border-[#ececf2] bg-[#fbfbfd] p-4 shadow-[0_10px_24px_rgba(23,28,41,0.04)]">
          <EditorPreviewStage
            image={currentImage}
            adjustments={adjustments}
            previewUrl={previewUrl}
            isLoading={isPreviewLoading}
            error={pageError}
            onRotateLeft={rotateLeft}
            onRotateRight={rotateRight}
            onApplyCrop={applyCrop}
          />

          <div className="mt-4">
            <EditorFilmstrip
              images={directoryImages}
              currentIndex={currentIndex}
              canGoPrevious={!isOpening && !isSaving && currentIndex > 0}
              canGoNext={!isOpening && !isSaving && currentIndex >= 0 && currentIndex < directoryImages.length - 1}
              onPrevious={goToPrevious}
              onNext={goToNext}
              onSelect={(index) => requestSwitch({ index, reason: 'thumbnail' })}
            />
          </div>
        </section>

        <div className="space-y-5">
          <EditorInspector
            adjustments={adjustments}
            onChange={handleChangeAdjustment}
            onFilterChange={handleChangeFilter}
            onFilterIntensityChange={handleChangeFilterIntensity}
            onResetFilters={resetFilters}
          />
          <EditorBottomStatusBar image={currentImage} currentIndex={currentIndex} totalImages={directoryImages.length} />
        </div>
      </div>

      <UnsavedChangeDialog open={Boolean(pendingSwitchTarget)} onConfirm={confirmSwitch} onCancel={cancelSwitch} />
    </section>
  );
};

export default ImageEditorPage;
