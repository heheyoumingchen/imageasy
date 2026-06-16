import { useMemo } from 'react';
import { Plus, FolderOpen, Trash2 } from 'lucide-react';
import ConversionItemList from '../components/convert-image/ConversionItemList';
import ConversionSettingsPanel from '../components/convert-image/ConversionSettingsPanel';
import { useConversionWorkflow } from '../hooks/useConversionWorkflow';
import { useLanguage } from '../hooks/useLanguage';

const ConvertImagePage = () => {
  const {
    items,
    selectedItemId,
    globalSettings,
    isRunning,
    pageError,
    canStart,
    selectItem,
    toggleItemSelected,
    updateGlobalSettings,
    buildItemSummary,
    importFiles,
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
              running: 'Converting…',
              openOutputDirectory: 'Open output directory'
            },
            settings: {
              panelLabel: 'Conversion settings',
              panelTitle: 'Conversion settings',
              pageRange: 'Page range',
              allPages: 'All pages',
              customPages: 'Page range',
              customPageRangeLabel: 'Page range',
              pageRangeHint: 'PDF / PPT only'
            }
          }
        : {
            toolbar: {
              importFiles: '添加文件',
              clearList: '清空列表',
              start: '开始转换',
              running: '转换进行中…',
              openOutputDirectory: '打开输出目录'
            },
            settings: {
              panelLabel: '转换设置区',
              panelTitle: '转换设置',
              pageRange: '页范围',
              allPages: '全选页',
              customPages: '页码范围',
              customPageRangeLabel: '页码范围',
              pageRangeHint: '仅 PDF / PPT 生效'
            }
          },
    [language]
  );

  // 页码范围仅对 PDF / PPT 等文档类生效，列表无文档时禁用控件。
  const hasDocumentItem = items.some((item) => item.kind === 'document');

  return (
    <div className="flex flex-col h-full p-5 gap-4 overflow-hidden">
      {pageError ? (
        <div className="rounded border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center gap-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {pageError}
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={importFiles}
              className="flex h-10 items-center gap-2 px-4 rounded-lg border border-border-light bg-white text-[#515867] text-[13px] font-bold hover:text-meitu hover:border-meitu transition-all"
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

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-10 items-center gap-2 px-4 rounded-lg bg-meitu text-white text-[13px] font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
              onClick={startConversion}
              disabled={isRunning || !canStart}
            >
              {isRunning && (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {isRunning ? copy.toolbar.running : copy.toolbar.start}
            </button>
            <button
              type="button"
              className="flex h-10 items-center gap-2 px-4 rounded-lg border border-border-light bg-white text-[#515867] text-[13px] font-bold transition-all hover:border-meitu hover:text-meitu disabled:opacity-50"
              onClick={openOutputDirectory}
              disabled={!globalSettings.outputDirectory}
            >
              <FolderOpen size={16} />
              {copy.toolbar.openOutputDirectory}
            </button>
          </div>
        </div>
      </div>

      {/* 转换设置与文件列表共用一个底纹 */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col rounded-lg border border-border-light bg-white">
        <ConversionSettingsPanel
          copy={copy.settings}
          settings={globalSettings}
          disabled={isRunning}
          pageRangeEnabled={hasDocumentItem}
          pageRangeHint={copy.settings.pageRangeHint}
          onChange={updateGlobalSettings}
        />
        <ConversionItemList items={items} selectedItemId={selectedItemId} buildSummary={buildItemSummary} onSelect={selectItem} onToggleSelected={toggleItemSelected} />
      </div>
    </div>
  );
};

export default ConvertImagePage;
