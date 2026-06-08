import { useEffect, useMemo, useRef, useState } from 'react';
import EditorBottomStatusBar from '../components/image-editor/EditorBottomStatusBar';
import EditorFilmstrip from '../components/image-editor/EditorFilmstrip';
import EditorInspector from '../components/image-editor/EditorInspector';
import EditorPreviewStage from '../components/image-editor/EditorPreviewStage';
import EditorTopActionBar from '../components/image-editor/EditorTopActionBar';
import UnsavedChangeDialog from '../components/image-editor/UnsavedChangeDialog';
import { commitCropToWorkingImage, generateImagePreview, openImageSession, saveImageAsJpg } from '../services/editorCommands';
import { chooseJpgSavePath, openImageFile } from '../services/fileDialog';
import { useLanguage } from '../hooks/useLanguage';
import { toDisplayErrorMessage } from '../utils/errors';
import { useEditorStore } from '../stores/editorStore';
import type { AdjustmentKey, AdjustmentParams } from '../types/editor';

const buildDefaultSavePath = (sourcePath: string) => {
  const normalized = sourcePath.replace(/\\/g, '/');
  const lastSlashIndex = normalized.lastIndexOf('/');
  const directory = lastSlashIndex >= 0 ? normalized.slice(0, lastSlashIndex + 1) : '';
  const fileName = lastSlashIndex >= 0 ? normalized.slice(lastSlashIndex + 1) : normalized;
  const dotIndex = fileName.lastIndexOf('.');
  const stem = dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName;

  return `${directory}${stem}_001.jpg`;
};

const isEditorBusy = (isOpening: boolean, isSaving: boolean, isCropCommitting: boolean) => isOpening || isSaving || isCropCommitting;

const canNavigateImages = (isOpening: boolean, isSaving: boolean, isCropCommitting: boolean, currentIndex: number) =>
  !isOpening && !isSaving && !isCropCommitting && currentIndex > 0;

const canAdvanceImages = (
  isOpening: boolean,
  isSaving: boolean,
  isCropCommitting: boolean,
  currentIndex: number,
  totalImages: number
) => !isOpening && !isSaving && !isCropCommitting && currentIndex >= 0 && currentIndex < totalImages - 1;

const ImageEditorPage = () => {
  const {
    originalImage,
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
    commitDestructiveCrop,
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
  const [isCropCommitting, setIsCropCommitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isZoomSliderOpen, setIsZoomSliderOpen] = useState(false);
  const [isCropping, setIsCropping] = useState(false);

  const latestPreviewRequestId = useRef(0);
  const latestCropRequestId = useRef(0);
  const language = useLanguage();
  const isEnglish = language === 'en-US';

  const copy = useMemo(
    () =>
      isEnglish
        ? {
            previewFailed: 'Failed to generate image preview',
            cropFailed: 'Failed to commit crop',
            openFailed: 'Failed to open image',
            saveFailed: 'Failed to save JPG',
            busyOpening: 'Opening image',
            busySaving: 'Saving JPG',
            busyPreview: 'Updating preview',
            stageLabel: 'Editor stage'
          }
        : {
            previewFailed: '无法生成图片预览',
            cropFailed: '提交裁剪失败',
            openFailed: '打开图片失败',
            saveFailed: '保存 JPG 失败',
            busyOpening: '正在打开图片',
            busySaving: '正在保存 JPG',
            busyPreview: '正在更新预览',
            stageLabel: '图片编辑主舞台'
          },
    [isEnglish]
  );

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
            maxWidth: 760,
            maxHeight: 560
          });

          if (!cancelled && requestId === latestPreviewRequestId.current) {
            setPreviewUrl(result.dataUrl);
          }
        } catch (error) {
          if (!cancelled && requestId === latestPreviewRequestId.current) {
            setPageError(toDisplayErrorMessage(error, copy.previewFailed));
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
  }, [currentImage, adjustments, copy.previewFailed]);

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
      setPageError(toDisplayErrorMessage(error, copy.openFailed));
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
      const defaultPath = buildDefaultSavePath(originalImage?.path ?? currentImage.path);
      const targetPath = await chooseJpgSavePath(defaultPath);
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
      setPageError(toDisplayErrorMessage(error, copy.saveFailed));
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyCrop = async (crop: AdjustmentParams['crop']) => {
    if (isCropCommitting) {
      return;
    }

    if (!currentImage || !crop) {
      setIsCropping(false);
      return;
    }

    const requestId = latestCropRequestId.current + 1;
    latestCropRequestId.current = requestId;
    const sourcePath = currentImage.path;
    const requestAdjustments = adjustments;

    setIsCropCommitting(true);
    setPageError(null);

    try {
      const result = await commitCropToWorkingImage({
        sourcePath,
        rotation: requestAdjustments.rotation,
        crop
      });

      const activeState = useEditorStore.getState();
      const isStaleRequest = latestCropRequestId.current !== requestId;
      const sessionChanged = activeState.currentImage?.path !== sourcePath;

      if (isStaleRequest || sessionChanged) {
        return;
      }

      commitDestructiveCrop({
        workingImage: result.workingImage,
        preservedAdjustments: requestAdjustments
      });
      setIsCropping(false);
    } catch (error) {
      const isLatestRequest = latestCropRequestId.current === requestId;
      if (isLatestRequest) {
        setPageError(toDisplayErrorMessage(error, copy.cropFailed));
      }
    } finally {
      if (latestCropRequestId.current === requestId) {
        setIsCropCommitting(false);
      }
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

  const handleDeleteImage = () => {
    if (!currentImage || directoryImages.length === 0) {
      return;
    }

    const newImages = directoryImages.filter((_, i) => i !== currentIndex);
    if (newImages.length === 0) {
      useEditorStore.getState().reset();
      setPreviewUrl(null);
      return;
    }

    const nextIndex = currentIndex >= newImages.length ? newImages.length - 1 : currentIndex;
    const reindexed = newImages.map((img, i) => ({ ...img, index: i }));
    const nextImage = reindexed[nextIndex];
    useEditorStore.getState().switchToIndex(nextIndex);
    useEditorStore.setState({
      directoryImages: reindexed,
      currentIndex: nextIndex,
      currentImage: nextImage,
      originalImage: nextImage
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-bg-main">
      <div className="flex-1 flex min-w-0 overflow-hidden">
        <div data-testid="editor-workspace-column" className="flex-1 flex min-w-0 flex-col min-h-0 p-4 gap-3">
          <EditorTopActionBar
            hasUnsavedChanges={hasUnsavedChanges}
            canUndo={!isEditorBusy(isOpening, isSaving, isCropCommitting) && past.length > 0}
            canRedo={!isEditorBusy(isOpening, isSaving, isCropCommitting) && future.length > 0}
            isBusy={isEditorBusy(isOpening, isSaving, isCropCommitting)}
            canDelete={currentImage !== null && directoryImages.length > 0}
            isEnglish={isEnglish}
            onOpenImage={handleOpenImage}
            onUndo={undo}
            onRedo={redo}
            onSave={handleSave}
            onRotateLeft={rotateLeft}
            onRotateRight={rotateRight}
            onZoom={() => setIsZoomSliderOpen(!isZoomSliderOpen)}
            onCrop={() => setIsCropping(true)}
            onDelete={handleDeleteImage}
          />

          {pageError ? (
            <div className="rounded border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center gap-2">
               <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {pageError}
            </div>
          ) : null}

          <div className="flex-1 relative min-w-0">
            <EditorPreviewStage
              image={currentImage}
              adjustments={adjustments}
              isEnglish={isEnglish}
              previewUrl={previewUrl}
              isLoading={isPreviewLoading}
              isCropCommitting={isCropCommitting}
              error={pageError}
              onApplyCrop={handleApplyCrop}
              externalIsCropping={isCropping}
              onExternalIsCroppingChange={setIsCropping}
              externalIsZoomSliderOpen={isZoomSliderOpen}
              onExternalIsZoomSliderOpenChange={setIsZoomSliderOpen}
            />
          </div>

          <EditorFilmstrip
            images={directoryImages}
            currentIndex={currentIndex}
            canGoPrevious={canNavigateImages(isOpening, isSaving, isCropCommitting, currentIndex)}
            canGoNext={canAdvanceImages(isOpening, isSaving, isCropCommitting, currentIndex, directoryImages.length)}
            isDisabled={isCropCommitting}
            isEnglish={isEnglish}
            onPrevious={goToPrevious}
            onNext={goToNext}
            onSelect={(index) => requestSwitch({ index, reason: 'thumbnail' })}
          />
        </div>

        <div data-testid="editor-inspector-shell" className="w-[280px] shrink-0 flex flex-col border-l border-border-light bg-white overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <EditorInspector
              adjustments={adjustments}
              isEnglish={isEnglish}
              onChange={handleChangeAdjustment}
              onFilterChange={handleChangeFilter}
              onFilterIntensityChange={handleChangeFilterIntensity}
              onResetFilters={resetFilters}
            />
          </div>
        </div>
      </div>

      <EditorBottomStatusBar
        image={currentImage}
        originalName={originalImage?.name}
        currentIndex={currentIndex}
        isEnglish={isEnglish}
        totalImages={directoryImages.length}
      />

      <UnsavedChangeDialog isEnglish={isEnglish} open={Boolean(pendingSwitchTarget)} onConfirm={confirmSwitch} onCancel={cancelSwitch} />
    </div>
  );
};

export default ImageEditorPage;
