import type { SplittingItem } from '../../types/splitting';

type Copy = {
  empty: string;
  pageUnit: string;
  statusReady: string;
  statusRunning: string;
  statusFailed: string;
  statusDone: (count: number) => string;
};

type Props = { items: SplittingItem[]; copy: Copy; onToggleSelected: (sourcePath: string) => void };

const statusClassMap = { ready: 'bg-[#F3F4F8] text-[#8C93A1]', running: 'bg-[#EEF5FF] text-[#3B82F6]', success: 'bg-[#EEF9F0] text-[#22C55E]', failed: 'bg-[#FFF1F3] text-meitu' } as const;

const labelFor = (item: SplittingItem, copy: Copy) => item.status === 'success' ? copy.statusDone(item.splitCount) : item.status === 'running' ? copy.statusRunning : item.status === 'failed' ? copy.statusFailed : copy.statusReady;
const summaryFor = (item: SplittingItem, copy: Copy) => item.kind === 'pdf' ? `PDF · ${item.pdfMetadata?.pageCount ?? '-'} ${copy.pageUnit}` : `${item.imageMetadata?.width ?? '-'} × ${item.imageMetadata?.height ?? '-'} · ${(item.imageMetadata?.extension ?? item.sourceName.split('.').pop() ?? 'file').toUpperCase()}`;
const extensionFor = (item: SplittingItem) => (item.imageMetadata?.extension ?? item.pdfMetadata?.extension ?? item.sourceName.split('.').pop() ?? 'file').toUpperCase();

const SplittingItemList = ({ items, copy, onToggleSelected }: Props) => (
  <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
    {items.length === 0 ? <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-[#8D93A1] animate-in fade-in zoom-in-95 duration-500"><div className="mb-4 flex h-20 w-20 items-center justify-center rounded-lg bg-bg-main shadow-inner"><svg viewBox="0 0 24 24" className="w-10 h-10 opacity-20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg></div><p className="px-8 text-center text-sm font-medium opacity-60">{copy.empty}</p></div> : null}
    {items.map((item) => <div key={item.sourcePath} className="grid w-full grid-cols-[32px_52px_1fr_100px] items-center gap-5 rounded-lg px-5 py-4 text-left transition-all duration-300 border border-transparent hover:bg-[#FAFBFD] hover:border-border-light group">
      <div className="flex items-center justify-center"><input aria-label={`选择 ${item.sourceName}`} type="checkbox" checked={item.selected} onChange={() => onToggleSelected(item.sourcePath)} className="h-5 w-5 rounded border-[#E2E4E9] accent-meitu" /></div>
      <div aria-label={`文件类型 ${extensionFor(item)}`} className="flex h-10 w-12 items-center justify-center rounded-lg bg-[#8F98A8] text-[10px] font-bold text-white shadow-sm transition-transform group-hover:scale-105">{extensionFor(item)}</div>
      <div className="min-w-0"><div className="truncate text-sm font-bold text-[#1A1D23]">{item.sourceName}</div><div className="mt-1 text-[11px] font-medium text-[#8D93A1] flex items-center gap-3"><span>{summaryFor(item, copy)}</span>{item.errorMessage ? <span className="text-meitu truncate flex-1 flex items-center gap-1 font-bold"><span className="w-1 h-1 rounded-full bg-meitu" />{item.errorMessage}</span> : null}</div></div>
      <div className="flex justify-end"><span className={`inline-flex items-center justify-center min-w-[76px] rounded-lg px-3 py-1.5 text-[11px] font-bold shadow-sm transition-all ${statusClassMap[item.status]}`}>{labelFor(item, copy)}</span></div>
    </div>)}
  </div>
);

export default SplittingItemList;
