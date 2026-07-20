import { useMemo } from 'react';
import { Plus, Trash2, FolderOpen } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { useSplittingWorkflow } from '../hooks/useSplittingWorkflow';
import SplittingItemList from '../components/splitting/SplittingItemList';
import SplittingSettingsPanel from '../components/splitting/SplittingSettingsPanel';

const SplitImagePage = () => {
  const workflow = useSplittingWorkflow();
  const language = useLanguage();
  const copy = useMemo(() => language === 'en-US' ? {
    pageTitle: 'Image Splitting',
    add: 'Import files', clear: 'Clear list', split: 'Split Image', cancel: 'Cancel', openOutputDirectory: 'Open output directory', empty: 'Supports images and PDF files. Drag a folder here to open it.', pageUnit: 'pages', statusReady: 'Ready', statusRunning: 'Splitting', statusFailed: 'Failed', statusDone: (count: number) => `Done ${count}`,
    settings: { mode: 'Mode', modeHorizontal: 'Horizontal', modeVertical: 'Vertical', modeGrid: 'Grid', splitParameters: 'Split Parameters', horizontalSplits: 'Horizontal splits', verticalSplits: 'Vertical splits', previewParts: (count: number) => `This will create ${count} parts` },
    errors: { outputDirectoryRequired: 'Please choose an output directory first' }
  } : {
    pageTitle: '图片分割',
    add: '添加文件', clear: '清空列表', split: '分割图片', cancel: '取消', openOutputDirectory: '打开输出目录', empty: '支持图片和 PDF 文件，拖拽文件夹即可打开。', pageUnit: '页', statusReady: '待处理', statusRunning: '分割中', statusFailed: '失败', statusDone: (count: number) => `完成 ${count} 张`,
    settings: { mode: '模式', modeHorizontal: '横向分割', modeVertical: '竖向分割', modeGrid: '网格分割', splitParameters: '分割参数', horizontalSplits: '横向分割份数', verticalSplits: '竖向分割份数', previewParts: (count: number) => `这将创建 ${count} 个部分` },
    errors: { outputDirectoryRequired: '请先选择输出目录' }
  }, [language]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-bg-main animate-in fade-in duration-500">
      {workflow.pageError ? <div className="mb-4 rounded border border-red-100 bg-red-50/50 px-6 py-4 text-sm text-red-600 flex items-center gap-3"><span className="font-bold">{workflow.pageError}</span></div> : null}

      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border-light/60 bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={workflow.importFiles}
            disabled={workflow.isRunning}
            className="flex h-10 items-center gap-2 px-4 rounded-lg border border-border-light bg-white text-[#515867] text-[13px] font-bold hover:text-meitu hover:border-meitu transition-all disabled:opacity-50"
          >
            <Plus size={16} />
            {copy.add}
          </button>
          <button
            type="button"
            onClick={workflow.clearList}
            disabled={workflow.isRunning}
            className="flex h-10 items-center gap-2 px-4 rounded-lg border border-border-light bg-white text-[#515867] text-[13px] font-bold hover:text-meitu hover:border-meitu transition-all disabled:opacity-50"
          >
            <Trash2 size={16} />
            {copy.clear}
          </button>
        </div>
        <div className="flex items-center gap-3">
          {workflow.isRunning ? (
            <button
              type="button"
              className="flex h-10 items-center gap-2 px-4 rounded-lg border border-meitu bg-white text-meitu text-[13px] font-bold transition-all hover:bg-[#FFF5F6]"
              onClick={workflow.cancelSplitting}
            >
              {copy.cancel}
            </button>
          ) : (
            <button
              type="button"
              className="flex h-10 items-center gap-2 px-4 rounded-lg bg-meitu text-white text-[13px] font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
              onClick={() => workflow.startSplitting(copy.errors)}
              disabled={!workflow.canStart}
            >
              {copy.split}
            </button>
          )}
          <button
            type="button"
            className="flex h-10 items-center gap-2 px-4 rounded-lg border border-border-light bg-white text-[#515867] text-[13px] font-bold transition-all hover:border-meitu hover:text-meitu disabled:opacity-50"
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
        {/* 左侧：文件列表 */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <SplittingItemList items={workflow.items} copy={copy} onToggleSelected={workflow.toggleItemSelected} />
          </div>
        </div>

        {/* 右侧：设置面板 */}
        <aside className="w-[280px] shrink-0 flex flex-col border-l border-border-light bg-white overflow-hidden">
          {/* 面板内容区 */}
          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar [scrollbar-gutter:stable]">
            <h2 className="text-lg font-bold text-[#1A1D23] mb-5 flex items-center gap-3">
              <div className="w-1.5 h-6 bg-meitu rounded-full" />
              {copy.pageTitle}
            </h2>
            <SplittingSettingsPanel
              copy={copy.settings}
              mode={workflow.mode}
              horizontalSplits={workflow.horizontalSplits}
              verticalSplits={workflow.verticalSplits}
              disabled={workflow.isRunning}
              onModeChange={workflow.updateMode}
              onHorizontalSplitsChange={workflow.updateHorizontalSplits}
              onVerticalSplitsChange={workflow.updateVerticalSplits}
            />
          </div>
        </aside>
      </div>
    </div>
  );
};

export default SplitImagePage;
