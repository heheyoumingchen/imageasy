import type { ConversionItem } from '../../types/conversion';

type ConversionItemListProps = {
  items: ConversionItem[];
  selectedItemId: string | null;
  buildSummary: (id: string) => string;
  onSelect: (id: string) => void;
};

const kindLabelMap = {
  image: '图片',
  document: '文档',
  unsupported: '不支持'
} as const;

const ConversionItemList = ({ items, selectedItemId, buildSummary, onSelect }: ConversionItemListProps) => {
  return (
    <section aria-label="转换任务列表" className="rounded-[20px] border border-[#ececf2] bg-white p-4">
      <div className="space-y-2">
        {items.length === 0 ? <p className="text-sm text-[#7b8290]">请先导入要转换的文件或文件夹。</p> : null}
        {items.map((item) => {
          const active = item.id === selectedItemId;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`flex w-full flex-col rounded-[16px] border px-3 py-3 text-left ${
                active ? 'border-[#ffc3d7] bg-[#fff5f8]' : 'border-[#efeff4] bg-[#fcfcfe]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-[#313744]">{item.sourceName}</span>
                <span className="text-xs text-[#9ba1ae]">{kindLabelMap[item.kind]}</span>
              </div>
              <div className="mt-1 text-xs text-[#7b8290]">{buildSummary(item.id)}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default ConversionItemList;
