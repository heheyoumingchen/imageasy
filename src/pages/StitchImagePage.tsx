import { useState } from 'react';
import { useMemo } from 'react';
import { Plus, Eraser, Play } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import StitchingSettingsPanel from '../components/stitching/StitchingSettingsPanel';
import LayoutSelector from '../components/stitching/LayoutSelector';
import LayoutCanvas from '../components/stitching/LayoutCanvas';
import type { LayoutTemplate, CanvasRatio } from '../types/stitchingLayout';
import type { StitchingNamingPattern, StitchingOutputFormat, StitchingResolution } from '../types/stitching';
import { layoutTemplates } from '../types/stitchingLayout';

const StitchImagePage = () => {
  const language = useLanguage();

  // 右侧面板切换状态
  const [activePanel, setActivePanel] = useState<'layout' | 'settings'>('layout');

  // 布局状态
  const [selectedTemplate, setSelectedTemplate] = useState<LayoutTemplate | null>(
    layoutTemplates[4] ? layoutTemplates[4][0] : null
  );
  const [canvasRatio, setCanvasRatio] = useState<CanvasRatio>('1:1');
  const [images, setImages] = useState<Array<{ path: string; name: string; preview?: string }>>([]);

  // 拼接设置
  const [outputDirectory, setOutputDirectory] = useState('');
  const [outputFormat, setOutputFormat] = useState<StitchingOutputFormat>('jpg');
  const [namingPattern, setNamingPattern] = useState<StitchingNamingPattern>('source-name-index');
  const [padding, setPadding] = useState(0);
  const [spacing, setSpacing] = useState(0);
  const [borderRadius, setBorderRadius] = useState(0);
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');
  const [resolution, setResolution] = useState<StitchingResolution>(1080);
  const [quality, setQuality] = useState(100);

  const [isRunning, setIsRunning] = useState(false);

  const copy = useMemo(
    () =>
      language === 'en-US'
        ? {
            addImages: 'Add images',
            clear: 'Clear',
            download: 'Download',
            downloading: 'Downloading...',
            layoutTemplates: 'Layout',
            stitchingSettings: 'Settings',
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
              resolutionUltra: '2160px',
              quality: 'Quality',
              outputFormat: 'Format',
              outputDirectory: 'Output directory',
              chooseDirectory: 'Choose path',
              namingPattern: 'Naming pattern',
              namingPatternIndexed: 'Source name - index',
              namingPatternDate: 'Source name - date'
            }
          }
        : {
            addImages: '添加图片',
            clear: '清空',
            download: '下载',
            downloading: '正在下载...',
            layoutTemplates: '布局模板',
            stitchingSettings: '拼接设置',
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
              resolutionUltra: '2160px',
              quality: '质量',
              outputFormat: '导出格式',
              outputDirectory: '输出目录',
              chooseDirectory: '选择路径',
              namingPattern: '命名规则',
              namingPatternIndexed: '原文件名-序号',
              namingPatternDate: '原文件名-日期-序号'
            }
          },
    [language]
  );

  const selectOutputDirectory = async () => {
    // TODO: 实现文件夹选择
    console.log('选择输出目录');
  };

  const handleImportImages = async () => {
    // TODO: 实现图片选择
    console.log('导入图片');
  };

  const handleAddImage = (cellIndex: number) => {
    // TODO: 为特定单元格添加图片
    console.log('为单元格添加图片:', cellIndex);
  };

  const handleRemoveImage = (cellIndex: number) => {
    setImages((prev) => prev.filter((_, index) => index !== cellIndex));
  };

  const handleClear = () => {
    setImages([]);
  };

  const handleStartStitching = async () => {
    if (!outputDirectory) {
      alert(language === 'en-US' ? 'Please choose an output directory first' : '请先选择输出目录');
      return;
    }

    if (images.length < 2) {
      alert(language === 'en-US' ? 'At least 2 images are required' : '至少需要 2 张图片');
      return;
    }

    setIsRunning(true);
    // TODO: 调用后端拼接命令
    console.log('开始拼接', {
      template: selectedTemplate,
      canvasRatio,
      images,
      padding,
      spacing,
      borderRadius,
      backgroundColor,
      resolution,
      quality,
      outputFormat,
      namingPattern
    });

    setTimeout(() => {
      setIsRunning(false);
    }, 2000);
  };

  const tabClassName = 'flex-1 flex h-10 items-center justify-center rounded text-sm font-bold transition-all duration-200';

  return (
    <div className="flex flex-col h-full overflow-hidden bg-bg-main animate-in fade-in duration-500">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-light/60 bg-white">
        <h2 className="text-base font-bold text-[#1A1D23]">
          {language === 'en-US' ? 'Layout Stitching' : '布局拼接'}
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleImportImages}
            disabled={isRunning}
            className="flex h-10 items-center gap-2 px-4 rounded-lg bg-meitu text-white text-[13px] font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
          >
            <Plus size={16} />
            {copy.addImages}
          </button>
          <button
            onClick={handleClear}
            disabled={isRunning || images.length === 0}
            className="flex h-10 items-center gap-2 px-4 rounded-lg border border-border-light bg-white text-[#515867] text-[13px] font-bold hover:text-meitu hover:border-meitu transition-all disabled:opacity-50"
          >
            <Eraser size={16} />
            {copy.clear}
          </button>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* 中间：画布预览区 */}
        <div className="flex-1 min-w-0">
          <LayoutCanvas
            template={selectedTemplate}
            canvasRatio={canvasRatio}
            images={images}
            onAddImage={handleAddImage}
            onRemoveImage={handleRemoveImage}
            onImportImages={handleImportImages}
          />
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
          <div className="flex-1 overflow-y-scroll p-5 custom-scrollbar [scrollbar-gutter:stable]">
            {activePanel === 'layout' ? (
              <LayoutSelector selectedTemplate={selectedTemplate} onSelectTemplate={setSelectedTemplate} />
            ) : (
              <StitchingSettingsPanel
                copy={copy.settings}
                canvasRatio={canvasRatio}
                padding={padding}
                spacing={spacing}
                borderRadius={borderRadius}
                backgroundColor={backgroundColor}
                resolution={resolution}
                quality={quality}
                outputFormat={outputFormat}
                outputDirectory={outputDirectory}
                namingPattern={namingPattern}
                disabled={isRunning}
                onCanvasRatioChange={setCanvasRatio}
                onPaddingChange={setPadding}
                onSpacingChange={setSpacing}
                onBorderRadiusChange={setBorderRadius}
                onBackgroundColorChange={setBackgroundColor}
                onResolutionChange={setResolution}
                onQualityChange={setQuality}
                onOutputFormatChange={setOutputFormat}
                onOutputDirectoryChange={selectOutputDirectory}
                onNamingPatternChange={setNamingPattern}
              />
            )}
          </div>

          {/* 底部按钮 */}
          <div className="p-5 border-t border-border-light/60">
            <button
              type="button"
              className="w-full h-10 rounded-lg bg-meitu text-white font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
              onClick={handleStartStitching}
              disabled={isRunning || images.length < 2 || !outputDirectory}
            >
              {isRunning ? (
                <div className="h-6 w-6 animate-spin rounded-full border-3 border-white border-t-transparent" />
              ) : (
                <Play size={24} fill="currentColor" />
              )}
              {isRunning ? copy.downloading : copy.download}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default StitchImagePage;
