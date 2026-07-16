import type { KeyboardEvent } from 'react';
import type { ConversionItem } from '../../types/conversion';

type ConversionItemListProps = {
  items: ConversionItem[];
  selectedItemId: string | null;
  buildSummary: (id: string) => string;
  onSelect: (id: string) => void;
  onToggleSelected: (id: string) => void;
};

const statusLabelMap = {
  ready: '待处理',
  running: '处理中',
  success: '已完成',
  failed: '失败',
  unsupported: '不支持'
} as const;

const statusClassMap = {
  ready: 'bg-[#F3F4F8] text-[#8C93A1]',
  running: 'bg-[#EEF5FF] text-[#3B82F6]',
  success: 'bg-[#EEF9F0] text-[#22C55E]',
  failed: 'bg-[#FFF1F3] text-meitu',
  unsupported: 'bg-[#F3F4F8] text-[#8F95A3]'
} as const;

const badgeClassByExtension: Record<string, string> = {
  psd: 'bg-[#274F8F]',
  pdf: 'bg-[#FF6B61]',
  docx: 'bg-[#2B579A]',
  doc: 'bg-[#2B579A]',
  wps: 'bg-[#F0771D]',
  jpg: 'bg-[#22C55E]',
  jpeg: 'bg-[#22C55E]',
  png: 'bg-[#FFB95F]',
  tif: 'bg-[#A78BFA]',
  tiff: 'bg-[#A78BFA]',
  webp: 'bg-[#4FC3F7]'
};

const getExtensionBadge = (item: ConversionItem) => {
  const extension = item.imageMetadata?.extension ?? item.documentMetadata?.extension ?? item.sourceName.split('.').pop() ?? 'file';
  const normalizedExtension = extension.toLowerCase();

  return {
    label: normalizedExtension.toUpperCase(),
    className: badgeClassByExtension[normalizedExtension] ?? 'bg-[#8F98A8]'
  };
};

const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>, itemId: string, onSelect: (id: string) => void) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onSelect(itemId);
  }
};

const ConversionItemList = ({ items, selectedItemId, buildSummary, onSelect, onToggleSelected }: ConversionItemListProps) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-[#8D93A1] animate-in fade-in zoom-in-95 duration-500">
          <div className="w-20 h-20 rounded-lg bg-bg-main flex items-center justify-center mb-6 shadow-inner">
             <svg viewBox="0 0 24 24" className="w-10 h-10 opacity-20" fill="none" stroke="currentColor" strokeWidth="1.5">
               <path d="M12 5v14M5 12h14" strokeLinecap="round" />
             </svg>
          </div>
          <p className="text-sm font-medium opacity-60">暂无待处理文件</p>
        </div>
      ) : null}
      {items.map((item) => {
        const active = item.id === selectedItemId;
        const badge = getExtensionBadge(item);

        return (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(item.id)}
            onKeyDown={(event) => handleKeyDown(event, item.id, onSelect)}
            className={`grid w-full grid-cols-[32px_52px_1fr_100px] items-center gap-5 rounded-lg px-5 py-4 text-left transition-all duration-300 group ${
              active
                ? 'bg-meitu-light shadow-md shadow-meitu/5 border border-meitu/20'
                : 'hover:bg-[#FAFBFD] border border-transparent hover:border-border-light'
            }`}
          >
            <div className="flex items-center justify-center">
              <input
                aria-label={`选择 ${item.sourceName}`}
                type="checkbox"
                checked={item.selected}
                onChange={(event) => {
                  event.stopPropagation();
                  onToggleSelected(item.id);
                }}
                onClick={(event) => event.stopPropagation()}
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
              <div className={`truncate text-sm font-bold transition-colors ${active ? 'text-meitu' : 'text-[#1A1D23]'}`}>
                {item.sourceName}
              </div>
              <div className="mt-1 text-[11px] font-medium text-[#8D93A1] flex items-center gap-3">
                <span>{buildSummary(item.id)}</span>
                {item.errorMessage ? (
                  <span className="text-meitu truncate flex-1 flex items-center gap-1 font-bold">
                     <span className="w-1 h-1 rounded-full bg-meitu" />
                     {item.errorMessage}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex justify-end">
              <span className={`inline-flex items-center justify-center min-w-[76px] rounded-lg px-3 py-1.5 text-[11px] font-bold shadow-sm transition-all ${statusClassMap[item.status]}`}>
                {statusLabelMap[item.status]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ConversionItemList;
