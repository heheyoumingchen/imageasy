import { useMemo } from 'react';
import { Plus, Play, Trash2 } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { useSplittingWorkflow } from '../hooks/useSplittingWorkflow';
import BatchFooterBar from '../components/shared/BatchFooterBar';
import ConversionBatchStatus from '../components/convert-image/ConversionBatchStatus';
import ConfirmDialog from '../components/feedback/ConfirmDialog';
import SplittingItemList from '../components/splitting/SplittingItemList';
import SplittingSettingsPanel from '../components/splitting/SplittingSettingsPanel';

const SplitImagePage = () => {
  const workflow = useSplittingWorkflow();
  const language = useLanguage();
  const copy = useMemo(() => language === 'en-US' ? {
    pageTitle: 'Image Splitting',
    fileList: 'File Name', add: 'Import files', clear: 'Clear list', split: 'Split Image', splitting: 'Splitting...', empty: 'Supports images and PDF files. Drag a folder here to open it.', pageUnit: 'pages', statusReady: 'Ready', statusRunning: 'Splitting', statusFailed: 'Failed', statusDone: (count: number) => `Done ${count}`,
    settings: { mode: 'Mode', modeHorizontal: 'Horizontal', modeVertical: 'Vertical', modeGrid: 'Grid', splitParameters: 'Split Parameters', horizontalSplits: 'Horizontal splits', verticalSplits: 'Vertical splits', previewParts: (count: number) => `This will create ${count} parts` },
    errors: { outputDirectoryRequired: 'Please choose an output directory first' },
    actions: { openOutputDirectory: 'Open output directory', retryFailedItems: 'Retry failed items', toggleFailedDetails: 'Error details', emptyFailedItems: 'No failed items.' },
    batchStatus: { totalLabel: 'Total', successLabel: 'Success', failedLabel: 'Failed', runningLabel: 'Running', progressTitle: 'Overall progress' },
    footer: { regionLabel: 'Splitting task footer', currentTask: 'Current task', queuedFiles: 'Queued files', outputDirectory: 'Output directory', completed: 'Completed', failed: 'Failed', version: 'Version', currentTaskValue: 'Image splitting', emptyOutputDirectory: '--', versionValue: 'V1.0' }
  } : {
    pageTitle: '图片分割',
    fileList: '文件列表', add: '添加文件', clear: '清空列表', split: '分割图片', splitting: '正在分割...', empty: '支持图片和 PDF 文件，拖拽文件夹即可打开。', pageUnit: '页', statusReady: '待处理', statusRunning: '分割中', statusFailed: '失败', statusDone: (count: number) => `完成 ${count} 张`,
    settings: { mode: '模式', modeHorizontal: '横向分割', modeVertical: '竖向分割', modeGrid: '网格分割', splitParameters: '分割参数', horizontalSplits: '横向分割份数', verticalSplits: '竖向分割份数', previewParts: (count: number) => `这将创建 ${count} 个部分` },
    errors: { outputDirectoryRequired: '请先选择输出目录' },
    actions: { openOutputDirectory: '打开输出目录', retryFailedItems: '重试失败项', toggleFailedDetails: '错误详情', emptyFailedItems: '当前没有失败项。' },
    batchStatus: { totalLabel: '总数', successLabel: '成功', failedLabel: '失败', runningLabel: '进行中', progressTitle: '全局进度' },
    footer: { regionLabel: '分割任务页状态栏', currentTask: '当前任务', queuedFiles: '队列文件', outputDirectory: '输出目录', completed: '已完成', failed: '失败', version: '版本号', currentTaskValue: '图片分割', emptyOutputDirectory: '--', versionValue: 'V1.0' }
  }, [language]);
  const failedDetailsId = 'splitting-failed-details';

  return (
    <div className="flex flex-col h-full overflow-hidden bg-bg-main animate-in fade-in duration-500">
      {workflow.pageError ? <div className="mb-4 rounded border border-red-100 bg-red-50/50 px-6 py-4 text-sm text-red-600 flex items-center gap-3"><span className="font-bold">{workflow.pageError}</span></div> : null}

      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-light/60 bg-white">
        <h2 className="text-base font-bold text-[#1A1D23]">{copy.fileList}</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={workflow.importFiles}
            disabled={workflow.isRunning}
            className="flex h-10 items-center gap-2 px-4 rounded-lg bg-meitu text-white text-[13px] font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
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
          <div className="flex-1 overflow-y-scroll p-5 custom-scrollbar [scrollbar-gutter:stable]">
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

          {/* 底部按钮 */}
          <div className="p-5 border-t border-border-light/60">
            <button
              type="button"
              className="w-full h-10 rounded-lg bg-meitu text-white font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
              onClick={() => workflow.startSplitting(copy.errors)}
              disabled={workflow.isRunning || !workflow.canStart}
            >
              {workflow.isRunning ? (
                <div className="h-6 w-6 animate-spin rounded-full border-3 border-white border-t-transparent" />
              ) : (
                <Play size={24} fill="currentColor" />
              )}
              {workflow.isRunning ? copy.splitting : copy.split}
            </button>
          </div>
        </aside>
      </div>

      <div className="mt-4 pt-4 border-t border-border-light/60">
        <ConversionBatchStatus
          copy={{ ...copy.batchStatus, openOutputDirectory: copy.actions.openOutputDirectory, toggleFailedDetails: copy.actions.toggleFailedDetails, retryFailedItems: copy.actions.retryFailedItems }}
          total={workflow.stats.total}
          running={workflow.stats.running}
          success={workflow.stats.success}
          failed={workflow.stats.failed}
          onOpenOutputDirectory={workflow.openOutputDirectory}
          onRetryFailed={workflow.retryFailed}
          onToggleDetails={() => workflow.setFailedDetailsOpen((current) => !current)}
          canOpenOutputDirectory={Boolean(workflow.outputDirectory)}
          canRetryFailed={workflow.stats.failed > 0}
          failedDetailsOpen={workflow.failedDetailsOpen}
          failedDetailsAriaControls={failedDetailsId}
        />
        <ConfirmDialog
          open={workflow.failedDetailsOpen}
          title={copy.actions.toggleFailedDetails}
          confirmLabel={language === 'en-US' ? 'Close' : '关闭'}
          onConfirm={() => workflow.setFailedDetailsOpen(false)}
        >
          {workflow.failedItems.length > 0 ? (
            <ul className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1 text-sm text-[#515867] custom-scrollbar">
              {workflow.failedItems.map((item) => (
                <li key={item.sourcePath} className="rounded-lg bg-slate-800/70 px-3 py-2">
                  <p className="font-semibold text-[#1A1D23]">{item.sourceName}</p>
                  <p className="mt-1 break-words text-[#515867]">{item.errorMessage ?? copy.actions.emptyFailedItems}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[#515867]">{copy.actions.emptyFailedItems}</p>
          )}
        </ConfirmDialog>
      </div>

      <BatchFooterBar
        regionLabel={copy.footer.regionLabel}
        currentTaskLabel={copy.footer.currentTask}
        queuedFilesLabel={copy.footer.queuedFiles}
        outputDirectoryLabel={copy.footer.outputDirectory}
        completedLabel={copy.footer.completed}
        failedLabel={copy.footer.failed}
        versionLabel={copy.footer.version}
        currentTaskValue={copy.footer.currentTaskValue}
        queuedFilesValue={workflow.stats.total}
        outputDirectoryValue={workflow.outputDirectory || copy.footer.emptyOutputDirectory}
        completedValue={workflow.stats.success}
        failedValue={workflow.stats.failed}
        versionValue={copy.footer.versionValue}
      />
    </div>
  );
};

export default SplitImagePage;
