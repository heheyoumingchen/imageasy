import { useMemo } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { useExtractionWorkflow } from '../hooks/useExtractionWorkflow';
import ExtractionItemList from '../components/extraction/ExtractionItemList';
import { Plus, FolderOpen, Trash2 } from 'lucide-react';

const ExtractImagePage = () => {
  const {
    items,
    outputDirectory,
    pageError,
    isRunning,
    importDocuments,
    openOutputDirectory,
    toggleItemSelected,
    clearList,
    startExtraction,
    cancelExtraction
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
              clearList: 'Clear list',
              startExtraction: 'Start extraction',
              cancel: 'Cancel',
              openOutputDirectory: 'Open output directory',
              selectOutputDirectoryError: 'Please choose an output directory first',
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
              clearList: '清空列表',
              startExtraction: '开始提取',
              cancel: '取消',
              openOutputDirectory: '打开输出目录',
              selectOutputDirectoryError: '请先选择输出目录',
            }
          },
    [language]
  );

  return (
    <div className="flex flex-col h-full p-5 gap-4 overflow-hidden bg-bg-main animate-in fade-in duration-500">
      {pageError ? (
        <div className="rounded border border-red-100 bg-red-50/50 px-6 py-4 text-sm text-red-600 flex items-center gap-3 animate-in slide-in-from-top-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="font-bold">{pageError}</span>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={importDocuments}
            className="flex h-10 items-center gap-2 px-4 rounded-lg border border-border-light bg-white text-[#515867] text-[13px] font-bold hover:text-meitu hover:border-meitu transition-all"
          >
            <Plus size={16} />
            {copy.importDocuments}
          </button>
          <button
            onClick={clearList}
            className="flex h-10 items-center gap-2 px-4 rounded-lg border border-border-light bg-white text-[#515867] text-[13px] font-bold hover:text-meitu hover:border-meitu transition-all"
          >
            <Trash2 size={16} />
            {copy.actions.clearList}
          </button>
        </div>

        <div className="flex items-center gap-3">
          {isRunning ? (
            <button
              type="button"
              className="flex h-10 items-center gap-2 px-4 rounded-lg border border-meitu bg-white text-meitu text-[13px] font-bold transition-all hover:bg-[#FFF5F6]"
              onClick={cancelExtraction}
            >
              {copy.actions.cancel}
            </button>
          ) : (
            <button
              type="button"
              className="flex h-10 items-center gap-2 px-4 rounded-lg bg-meitu text-white text-[13px] font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
              onClick={() => startExtraction(copy.actions.selectOutputDirectoryError)}
              disabled={items.filter(i => i.status === 'ready' && i.selected).length === 0}
            >
              {copy.actions.startExtraction}
            </button>
          )}
          <button
            type="button"
            className="flex h-10 items-center gap-2 px-4 rounded-lg border border-border-light bg-white text-[#515867] text-[13px] font-bold transition-all hover:border-meitu hover:text-meitu disabled:opacity-50"
            onClick={openOutputDirectory}
            disabled={!outputDirectory}
          >
            <FolderOpen size={16} />
            {copy.actions.openOutputDirectory}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col rounded-lg border border-border-light bg-white">
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
  );
};

export default ExtractImagePage;
