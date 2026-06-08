import type { ExtractionDocumentInfo } from '../../types/extraction';

type ExtractionItem = ExtractionDocumentInfo & {
  status: 'ready' | 'running' | 'success' | 'failed';
  selected: boolean;
  extractedCount: number;
  errorMessage: string | null;
};

type ExtractionItemListProps = {
  items: ExtractionItem[];
  copy: {
    documentListLabel: string;
    emptyDocuments: string;
    pageUnit: string;
    estimatedImages: (count: number) => string;
    statusDone: (count: number) => string;
    statusRunning: string;
    statusFailed: string;
    statusReady: string;
  };
  onToggleSelected: (sourcePath: string) => void;
};

const statusLabelMap = (item: ExtractionItem, copy: ExtractionItemListProps['copy']) => {
  if (item.status === 'success') return copy.statusDone(item.extractedCount);
  if (item.status === 'running') return copy.statusRunning;
  if (item.status === 'failed') return copy.statusFailed;
  return copy.statusReady;
};

const statusClassMap = {
  ready: 'bg-[#F3F4F8] text-[#8C93A1]',
  running: 'bg-[#EEF5FF] text-[#3B82F6]',
  success: 'bg-[#EEF9F0] text-[#22C55E]',
  failed: 'bg-[#FFF1F3] text-meitu',
} as const;

const badgeClassByExtension: Record<string, string> = {
  docx: 'bg-[#2B579A]',
  pdf: 'bg-[#FF6B61]',
};

const getDocumentBadge = (item: ExtractionItem) => {
  const normalizedExtension = item.extension.toLowerCase();
  return {
    label: normalizedExtension.toUpperCase(),
    className: badgeClassByExtension[normalizedExtension] ?? 'bg-[#8F98A8]'
  };
};

const ExtractionItemList = ({ items, copy, onToggleSelected }: ExtractionItemListProps) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
      {items.length === 0 ? (
        <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-[#8D93A1] animate-in fade-in zoom-in-95 duration-500">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-lg bg-bg-main shadow-inner">
             <svg viewBox="0 0 24 24" className="w-10 h-10 opacity-20" fill="none" stroke="currentColor" strokeWidth="1.5">
               <path d="M12 5v14M5 12h14" strokeLinecap="round" />
             </svg>
          </div>
          <p className="px-8 text-center text-sm font-medium opacity-60">{copy.emptyDocuments}</p>
        </div>
      ) : null}
      {items.map((item) => {
        const badge = getDocumentBadge(item);
        const label = statusLabelMap(item, copy);

        return (
          <div
            key={item.sourcePath}
            className="grid w-full grid-cols-[32px_52px_1fr_100px] items-center gap-5 rounded-lg px-5 py-4 text-left transition-all duration-300 border border-transparent hover:bg-[#FAFBFD] hover:border-border-light group"
          >
            <div className="flex items-center justify-center">
              <input
                aria-label={`选择 ${item.sourceName}`}
                type="checkbox"
                checked={item.selected}
                onChange={() => onToggleSelected(item.sourcePath)}
                className="h-5 w-5 rounded border-[#E2E4E9] accent-meitu"
              />
            </div>
            <div
              aria-label={`文件类型 ${badge.label}`}
              className={`flex h-10 w-12 items-center justify-center rounded-lg text-[10px] font-bold text-white shadow-sm transition-transform group-hover:scale-105 ${badge.className}`}
            >
              {badge.label}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-[#1A1D23]">
                {item.sourceName}
              </div>
              <div className="mt-1 text-[11px] font-medium text-[#8D93A1] flex items-center gap-3">
                <span>{item.extension.toUpperCase()} · {item.pageCount || '-'} {copy.pageUnit} · {copy.estimatedImages(item.embeddedImageCount)}</span>
                {item.errorMessage ? (
                  <span className="text-meitu truncate flex-1 flex items-center gap-1 font-bold">
                     <span className="w-1 h-1 rounded-full bg-meitu" />
                     {item.errorMessage}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex justify-end">
              <span className={`inline-flex items-center justify-center min-w-[76px] rounded-lg px-3 py-1.5 text-[11px] font-bold shadow-sm transition-all ${statusClassMap[item.status === 'success' || item.status === 'running' || item.status === 'failed' ? item.status : 'ready']}`}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ExtractionItemList;
