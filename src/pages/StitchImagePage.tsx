import { useState } from 'react';
import { useMemo } from 'react';
import { Plus, Eraser, FolderOpen } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { useStitchingWorkflow } from '../hooks/useStitchingWorkflow';
import StitchingSettingsPanel from '../components/stitching/StitchingSettingsPanel';
import LayoutSelector from '../components/stitching/LayoutSelector';
import LayoutCanvas from '../components/stitching/LayoutCanvas';

const StitchImagePage = () => {
  const language = useLanguage();
  const workflow = useStitchingWorkflow();

  // 右侧面板切换状态
  const [activePanel, setActivePanel] = useState<'layout' | 'settings'>('layout');

  const copy = useMemo(
    () =>
      language === 'en-US'
        ? {
            title: 'Layout Stitching',
            addImages: 'Add images',
            clear: 'Clear',
            download: 'Download',
            downloading: 'Downloading...',
            openOutputDirectory: 'Open output directory',
            layoutTemplates: 'Layout',
            stitchingSettings: 'Settings',
            exported: (path: string) => `Exported: ${path}`,
            errors: {
              outputDirectoryRequired: 'Please choose an output directory first',
              notEnoughImages: 'At least 2 images are required',
              templateRequired: 'Please choose a layout template first'
            },
            settings: {
              canvasRatio: 'Canvas ratio',
              styleSettings: 'Style Settings',
              margin: 'Margin',
              spacing: 'Spacing',
              borderRadius: 'Radius',
              backgroundColor: 'Background',
              exportSettings: 'Export Settings',
              resolution: 'Resolution',
              resolutionNormal: '768px',
              resolutionStandard: '1080px',
              resolutionHigh: '1536px',
              resolutionUltra: '2160px'
            }
          }
        : {
            title: '布局拼接',
            addImages: '添加图片',
            clear: '清空',
            download: '下载',
            downloading: '正在下载...',
            openOutputDirectory: '打开输出目录',
            layoutTemplates: '布局模板',
            stitchingSettings: '拼接设置',
            exported: (path: string) => `已导出：${path}`,
            errors: {
              outputDirectoryRequired: '请先选择输出目录',
              notEnoughImages: '至少需要 2 张图片',
              templateRequired: '请先选择布局模板'
            },
            settings: {
              canvasRatio: '画幅比例',
              styleSettings: '样式设置',
              margin: '边距',
              spacing: '间距',
              borderRadius: '圆角',
              backgroundColor: '背景',
              exportSettings: '导出设置',
              resolution: '清晰度',
              resolutionNormal: '768px',
              resolutionStandard: '1080px',
              resolutionHigh: '1536px',
              resolutionUltra: '2160px'
            }
          },
    [language]
  );

  const handleStartStitching = () => workflow.startStitching(copy.errors);

  const filledImageCount = workflow.images.filter(Boolean).length;

  const tabClassName = 'flex-1 flex h-10 items-center justify-center rounded text-sm font-bold transition-all duration-200';

  return (
    <div className="flex flex-col h-full overflow-hidden bg-bg-main animate-in fade-in duration-500">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between gap-6 px-6 py-4 border-b border-border-light/60 bg-white">
        {/* 左侧：添加图片 + 清空（同样式） */}
        <div className="flex items-center gap-3">
          <button
            onClick={workflow.importImages}
            disabled={workflow.isRunning}
            className="flex h-10 items-center gap-2 px-4 rounded-lg border border-border-light bg-white text-[#515867] text-[13px] font-bold hover:text-meitu hover:border-meitu transition-all disabled:opacity-50"
          >
            <Plus size={16} />
            {copy.addImages}
          </button>
          <button
            onClick={workflow.clearImages}
            disabled={workflow.isRunning || filledImageCount === 0}
            className="flex h-10 items-center gap-2 px-4 rounded-lg border border-border-light bg-white text-[#515867] text-[13px] font-bold hover:text-meitu hover:border-meitu transition-all disabled:opacity-50"
          >
            <Eraser size={16} />
            {copy.clear}
          </button>
        </div>

        {/* 右侧：下载 + 打开输出目录 */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex h-10 items-center gap-2 px-5 rounded-lg bg-meitu text-white text-[13px] font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            onClick={handleStartStitching}
            disabled={!workflow.canStart}
          >
            {workflow.isRunning && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {workflow.isRunning ? copy.downloading : copy.download}
          </button>
          <button
            type="button"
            className="flex h-10 items-center gap-2 px-4 rounded-lg border border-border-light bg-white text-[#515867] text-[13px] font-bold hover:border-meitu hover:text-meitu transition-all disabled:opacity-50"
            onClick={workflow.openOutputDirectory}
            disabled={!workflow.outputDirectory}
          >
            <FolderOpen size={16} />
            {copy.openOutputDirectory}
          </button>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* 中间：画布预览区 */}
        <div className="flex-1 min-w-0 flex flex-col">
          {(workflow.pageError || workflow.lastOutputPath) && (
            <div className="px-6 pt-4">
              {workflow.pageError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                  {workflow.pageError}
                </div>
              )}
              {workflow.lastOutputPath && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-600">
                  {copy.exported(workflow.lastOutputPath)}
                </div>
              )}
            </div>
          )}
          <div className="flex-1 min-h-0">
            <LayoutCanvas
              template={workflow.selectedTemplate}
              canvasRatio={workflow.canvasRatio}
              padding={workflow.padding}
              spacing={workflow.spacing}
              borderRadius={workflow.borderRadius}
              backgroundColor={workflow.backgroundColor}
              images={workflow.images}
              onAddImage={workflow.importImageForCell}
              onRemoveImage={workflow.removeImage}
              onImportImages={workflow.importImages}
              onSwapImages={workflow.swapImages}
              onUpdateTransform={workflow.updateImageTransform}
              onResetTransform={workflow.resetImageTransform}
            />
          </div>
        </div>

        {/* 右侧：切换面板 */}
        <aside className="w-[280px] shrink-0 flex flex-col border-l border-border-light bg-white overflow-hidden">
          {/* 切换标签 */}
          <div className="p-5 border-b border-border-light/60">
            <div className="flex bg-bg-main p-1 rounded">
              <button
                type="button"
                aria-pressed={activePanel === 'layout'}
                className={`${tabClassName} ${
                  activePanel === 'layout'
                    ? 'bg-white text-meitu'
                    : 'text-[#8D93A1] hover:text-[#515867]'
                }`}
                onClick={() => setActivePanel('layout')}
              >
                {copy.layoutTemplates}
              </button>
              <button
                type="button"
                aria-pressed={activePanel === 'settings'}
                className={`${tabClassName} ${
                  activePanel === 'settings'
                    ? 'bg-white text-meitu'
                    : 'text-[#8D93A1] hover:text-[#515867]'
                }`}
                onClick={() => setActivePanel('settings')}
              >
                {copy.stitchingSettings}
              </button>
            </div>
          </div>

          {/* 面板内容区 */}
          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar [scrollbar-gutter:stable]">
            {activePanel === 'layout' ? (
              <LayoutSelector selectedTemplate={workflow.selectedTemplate} onSelectTemplate={workflow.selectTemplate} />
            ) : (
              <StitchingSettingsPanel
                copy={copy.settings}
                canvasRatio={workflow.canvasRatio}
                padding={workflow.padding}
                spacing={workflow.spacing}
                borderRadius={workflow.borderRadius}
                backgroundColor={workflow.backgroundColor}
                resolution={workflow.resolution}
                disabled={workflow.isRunning}
                onCanvasRatioChange={workflow.setCanvasRatio}
                onPaddingChange={workflow.setPadding}
                onSpacingChange={workflow.setSpacing}
                onBorderRadiusChange={workflow.setBorderRadius}
                onBackgroundColorChange={workflow.setBackgroundColor}
                onResolutionChange={workflow.setResolution}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default StitchImagePage;
