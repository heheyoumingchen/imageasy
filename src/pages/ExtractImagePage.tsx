import { useMemo } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { useExtractionWorkflow } from '../hooks/useExtractionWorkflow';
import ConfirmDialog from '../components/feedback/ConfirmDialog';
import BatchFooterBar from '../components/shared/BatchFooterBar';
import ExtractionItemList from '../components/extraction/ExtractionItemList';
import ConversionBatchStatus from '../components/convert-image/ConversionBatchStatus';
import { Plus, Play, Trash2 } from 'lucide-react';

const ExtractImagePage = () => {
  const {
    items,
    outputDirectory,
    pageError,
    isRunning,
    failedDetailsOpen,
    setFailedDetailsOpen,
    stats,
    failedItems,
    importDocuments,
    openOutputDirectory,
    retryFailed,
    toggleItemSelected,
    clearList,
    startExtraction
  } = useExtractionWorkflow();
  const language = useLanguage();

  const copy = useMemo(
    () =>
      language === 'en-US'
        ? {
            importDocuments: 'Import documents',
            documentCount: (count: number) => `${count} documents`,
            documentListLabel: 'File Name',
            emptyDocuments: 'Supports Word, PDF, and PPT files. Drag a folder here to open it.',
            pageUnit: 'pages',
            estimatedImages: (count: number) => `Estimated ${count} images`,
            statusDone: (count: number) => `Done ${count}`,
            statusRunning: 'Extracting',
            statusFailed: 'Failed',
            statusReady: 'Ready',
            actions: {
              startExtraction: 'Start extraction',
              running: 'Extracting...',
              openOutputDirectory: 'Open output directory',
              retryFailedItems: 'Retry failed items',
              toggleFailedDetails: 'Error details',
              selectOutputDirectoryError: 'Please choose an output directory first',
            },
            batchStatus: {
              totalLabel: 'Total',
              successLabel: 'Success',
              failedLabel: 'Failed',
              runningLabel: 'Running',
              progressTitle: 'Overall progress'
            },
            emptyFailedItems: 'No failed items.',
            footer: {
              regionLabel: 'Extraction task status bar',
              currentTask: 'Current task',
              queuedFiles: 'Queued files',
              outputDirectory: 'Output directory',
              completed: 'Completed',
              failed: 'Failed',
              version: 'Version',
              currentTaskValue: 'Image extraction',
              emptyOutputDirectory: '--',
              versionValue: 'V1.0'
            }
          }
        : {
            importDocuments: '添加文件',
            documentCount: (count: number) => `${count} 个文档`,
            documentListLabel: '文件列表',
            emptyDocuments: '支持word、pdf、ppt文件，拖拽文件夹即可打开。',
            pageUnit: '页',
            estimatedImages: (count: number) => `预计 ${count} 张图片`,
            statusDone: (count: number) => `完成 ${count} 张`,
            statusRunning: '提取中',
            statusFailed: '失败',
            statusReady: '待处理',
            actions: {
              startExtraction: '开始提取',
              running: '正在提取...',
              openOutputDirectory: '打开输出目录',
              retryFailedItems: '重试失败项',
              toggleFailedDetails: '错误详情',
              selectOutputDirectoryError: '请先选择输出目录',
            },
            batchStatus: {
              totalLabel: '总数',
              successLabel: '成功',
              failedLabel: '失败',
              runningLabel: '进行中',
              progressTitle: '全局进度'
            },
            emptyFailedItems: '当前没有失败项。',
            footer: {
              regionLabel: '提取任务页状态栏',
              currentTask: '当前任务',
              queuedFiles: '队列文件',
              outputDirectory: '输出目录',
              completed: '已完成',
              failed: '失败',
              version: '版本号',
              currentTaskValue: '图片提取',
              emptyOutputDirectory: '--',
              versionValue: 'V1.0'
            }
          },
    [language]
  );

  const failedDetailsId = 'extraction-failed-details';

  return (
    <div className="flex flex-col h-full p-5 overflow-hidden bg-bg-main animate-in fade-in duration-500">
      {pageError ? (
        <div className="mb-4 rounded border border-red-100 bg-red-50/50 px-6 py-4 text-sm text-red-600 flex items-center gap-3 animate-in slide-in-from-top-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="font-bold">{pageError}</span>
        </div>
      ) : null}

      <div className="flex-1 grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 min-h-0 overflow-hidden">
        <div className="flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-light/60">
             <h2 className="text-base font-bold text-[#1A1D23]">{copy.documentListLabel}</h2>
             <div className="flex items-center gap-3">
               <button
                 onClick={importDocuments}
                 className="flex h-10 items-center gap-2 px-4 rounded-lg bg-meitu text-white text-[13px] font-bold hover:brightness-110 active:scale-95 transition-all"
               >
                 <Plus size={16} />
                 {copy.importDocuments}
               </button>
               <button
                 onClick={clearList}
                 className="flex h-10 items-center gap-2 px-4 rounded-lg border border-border-light bg-white text-[#515867] text-[13px] font-bold hover:text-meitu hover:border-meitu transition-all"
               >
                 <Trash2 size={16} />
                 {language === 'en-US' ? 'Clear list' : '清空列表'}
               </button>
             </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <ExtractionItemList
              items={items}
              copy={{
                documentListLabel: copy.documentListLabel,
                emptyDocuments: copy.emptyDocuments,
                pageUnit: copy.pageUnit,
                estimatedImages: copy.estimatedImages,
                statusDone: copy.statusDone,
                statusRunning: copy.statusRunning,
                statusFailed: copy.statusFailed,
                statusReady: copy.statusReady
              }}
              onToggleSelected={toggleItemSelected}
            />
          </div>
        </div>

        <aside className="flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar">
          <button
            type="button"
            className="w-full h-10 rounded-lg bg-meitu text-white font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
            onClick={() => startExtraction(copy.actions.selectOutputDirectoryError)}
            disabled={isRunning || items.filter(i => i.status === 'ready' && i.selected).length === 0}
          >
            {isRunning ? (
              <div className="h-6 w-6 animate-spin rounded-full border-3 border-white border-t-transparent" />
            ) : (
              <Play size={24} fill="currentColor" />
            )}
            {isRunning ? copy.actions.running : copy.actions.startExtraction}
          </button>
        </aside>
      </div>

      <div className="mt-4 pt-4 border-t border-border-light/60">
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
          onRetryFailed={retryFailed}
          onToggleDetails={() => setFailedDetailsOpen((current) => !current)}
          canOpenOutputDirectory={Boolean(outputDirectory)}
          canRetryFailed={stats.failed > 0}
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
                <li key={item.sourcePath} className="rounded-lg bg-slate-800/70 px-3 py-2">
                  <p className="font-semibold text-[#1A1D23]">{item.sourceName}</p>
                  <p className="mt-1 break-words text-[#515867]">{item.errorMessage ?? copy.emptyFailedItems}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[#515867]">{copy.emptyFailedItems}</p>
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
        outputDirectoryValue={outputDirectory || copy.footer.emptyOutputDirectory}
        completedValue={stats.success}
        failedValue={stats.failed}
        versionValue={copy.footer.versionValue}
      />
    </div>
  );
};

export default ExtractImagePage;
