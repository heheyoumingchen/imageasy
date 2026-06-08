import { useMemo } from 'react';
import { Plus, Play, Trash2 } from 'lucide-react';
import ConversionBatchStatus from '../components/convert-image/ConversionBatchStatus';
import BatchFooterBar from '../components/shared/BatchFooterBar';
import ConversionItemList from '../components/convert-image/ConversionItemList';
import ConversionSettingsPanel from '../components/convert-image/ConversionSettingsPanel';
import ConfirmDialog from '../components/feedback/ConfirmDialog';
import { useConversionWorkflow } from '../hooks/useConversionWorkflow';
import { useLanguage } from '../hooks/useLanguage';

const ConvertImagePage = () => {
  const {
    items,
    selectedItemId,
    globalSettings,
    stats,
    isRunning,
    pageError,
    failedDetailsOpen,
    setFailedDetailsOpen,
    failedItems,
    canStart,
    selectItem,
    toggleItemSelected,
    updateGlobalSettings,
    buildItemSummary,
    importFiles,
    chooseDirectory,
    retryFailedItems,
    clearList,
    openOutputDirectory,
    startConversion
  } = useConversionWorkflow();
  const language = useLanguage();

  const copy = useMemo(
    () =>
      language === 'en-US'
        ? {
            toolbar: {
              importFiles: 'Import files',
              clearList: 'Clear list',
              start: 'Start conversion',
              running: 'Converting…'
            },
            settings: {
              panelLabel: 'Conversion settings',
              panelTitle: 'Conversion settings',
              outputDirectory: 'Output directory',
              chooseOutputDirectory: 'Choose path',
              outputFormat: 'Output format',
              colorMode: 'Color mode',
              namingPattern: 'Naming pattern',
              outputQuality: 'Output quality',
              dpi: 'DPI',
              pageRange: 'Page range',
              allPages: 'All pages',
              customPages: 'Page range',
              customPageRangeLabel: 'Page range',
              grayCmyk: 'Gray CMYK',
              sourceNameIndex: 'Source name - index',
              sourceNameDate: 'Source name - date'
            },
            actions: {
              openOutputDirectory: 'Open output directory',
              retryFailedItems: 'Retry failed items',
              toggleFailedDetails: 'Error details',
              emptyFailedItems: 'No failed items.'
            },
            batchStatus: {
              totalLabel: 'Total',
              successLabel: 'Success',
              failedLabel: 'Failed',
              runningLabel: 'Running',
              progressTitle: 'Overall progress'
            },
            footer: {
              regionLabel: 'Conversion task footer',
              currentTask: 'Current task',
              queuedFiles: 'Queued files',
              outputDirectory: 'Output directory',
              completed: 'Completed',
              failed: 'Failed',
              version: 'Version',
              currentTaskValue: 'Conversion',
              emptyOutputDirectory: '--',
              versionValue: 'V1.0'
            }
          }
        : {
            toolbar: {
              importFiles: '添加文件',
              clearList: '清空列表',
              start: '开始转换',
              running: '转换进行中…'
            },
            settings: {
              panelLabel: '转换设置区',
              panelTitle: '转换设置',
              outputDirectory: '输出目录',
              chooseOutputDirectory: '选择路径',
              outputFormat: '输出格式',
              colorMode: '输出色彩模式',
              namingPattern: '命名规则',
              outputQuality: '输出质量',
              dpi: 'DPI',
              pageRange: '页范围',
              allPages: '全选页',
              customPages: '页码范围',
              customPageRangeLabel: '页码范围',
              grayCmyk: '灰度 CMYK',
              sourceNameIndex: '原文件名-序号',
              sourceNameDate: '原文件名-日期-序号'
            },
            actions: {
              openOutputDirectory: '打开输出目录',
              retryFailedItems: '重试失败项',
              toggleFailedDetails: '错误详情',
              emptyFailedItems: '当前没有失败项。'
            },
            batchStatus: {
              totalLabel: '总数',
              successLabel: '成功',
              failedLabel: '失败',
              runningLabel: '进行中',
              progressTitle: '全局进度'
            },
            footer: {
              regionLabel: '转换任务页状态栏',
              currentTask: '当前任务',
              queuedFiles: '队列文件',
              outputDirectory: '输出目录',
              completed: '已完成',
              failed: '失败',
              version: '版本号',
              currentTaskValue: '格式转换',
              emptyOutputDirectory: '--',
              versionValue: 'V1.0'
            }
          },
    [language]
  );

  const failedDetailsId = 'conversion-failed-details';

  return (
    <div className="flex flex-col h-full p-5 overflow-hidden">
      {pageError ? (
        <div className="mb-3 rounded border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center gap-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {pageError}
        </div>
      ) : null}

      <div className="flex-1 grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 min-h-0 overflow-hidden">
        <div className="flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-light/60">
             <h2 className="text-base font-bold text-[#1A1D23]">文件列表</h2>
             <div className="flex items-center gap-3">
               <button
                 onClick={importFiles}
                 className="flex h-10 items-center gap-2 px-4 rounded-lg bg-meitu text-white text-[13px] font-bold hover:brightness-110 active:scale-95 transition-all"
               >
                 <Plus size={16} />
                 {copy.toolbar.importFiles}
               </button>
               <button
                 type="button"
                 onClick={clearList}
                 disabled={isRunning}
                 className="flex h-10 items-center gap-2 px-4 rounded-lg border border-border-light bg-white text-[#515867] text-[13px] font-bold hover:text-meitu hover:border-meitu transition-all disabled:cursor-not-allowed disabled:border-border-light disabled:bg-[#FAFBFD] disabled:text-[#B5BBC7]"
               >
                 <Trash2 size={16} />
                 {copy.toolbar.clearList}
               </button>
             </div>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            <ConversionItemList items={items} selectedItemId={selectedItemId} buildSummary={buildItemSummary} onSelect={selectItem} onToggleSelected={toggleItemSelected} />
          </div>
        </div>

        <aside className="flex flex-col gap-4 overflow-y-auto pr-1">
          <ConversionSettingsPanel
            copy={copy.settings}
            settings={globalSettings}
            disabled={isRunning}
            onChange={updateGlobalSettings}
            onChooseOutputDirectory={chooseDirectory}
          />

          <button
            type="button"
            className="w-full h-10 rounded-lg bg-meitu text-white font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
            onClick={startConversion}
            disabled={isRunning || !canStart}
          >
            {isRunning ? (
              <div className="h-6 w-6 animate-spin rounded-full border-3 border-white border-t-transparent" />
            ) : (
              <Play size={24} fill="currentColor" />
            )}
            {isRunning ? copy.toolbar.running : copy.toolbar.start}
          </button>
        </aside>
      </div>

      <div className="mt-4 pt-4 border-t border-border-light">
        <ConversionBatchStatus
          copy={{
            ...copy.batchStatus,
            openOutputDirectory: copy.actions.openOutputDirectory,
            toggleFailedDetails: copy.actions.toggleFailedDetails,
            retryFailedItems: copy.actions.retryFailedItems
          }}
          total={stats.total}
          running={stats.running}
          success={stats.success}
          failed={stats.failed}
          onOpenOutputDirectory={openOutputDirectory}
          onRetryFailed={retryFailedItems}
          onToggleDetails={() => setFailedDetailsOpen((current) => !current)}
          canOpenOutputDirectory={Boolean(globalSettings.outputDirectory)}
          canRetryFailed={failedItems.length > 0}
          failedDetailsOpen={failedDetailsOpen}
          failedDetailsAriaControls={failedDetailsId}
        />
        <ConfirmDialog
          open={failedDetailsOpen}
          title={copy.actions.toggleFailedDetails}
          confirmLabel={language === 'en-US' ? 'Close' : '关闭'}
          onConfirm={() => setFailedDetailsOpen(false)}
        >
          {failedItems.length > 0 ? (
            <ul className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1 text-sm text-[#515867] custom-scrollbar">
              {failedItems.map((item) => (
                <li key={item.id} className="rounded-lg bg-slate-800/70 px-3 py-2">
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
        queuedFilesValue={stats.total}
        outputDirectoryValue={globalSettings.outputDirectory || copy.footer.emptyOutputDirectory}
        completedValue={stats.success}
        failedValue={stats.failed}
        versionValue={copy.footer.versionValue}
      />
    </div>
  );
};

export default ConvertImagePage;
