import type { FilterType } from '../../types/editor';

type FilterPanelProps = {
  filterType: FilterType;
  filterIntensity: number;
  onFilterChange: (value: FilterType) => void;
  onIntensityChange: (value: number) => void;
  onReset: () => void;
};

const selectClass =
  'mt-2 h-10 w-full rounded-[14px] border border-[#ececf2] bg-[#fafafd] px-3 text-sm text-[#424854] outline-none transition focus:border-[#ff9fbd] focus:ring-2 focus:ring-[#ff9fbd]/20';

const inputClass =
  'mt-2 h-10 w-full rounded-[14px] border border-[#ececf2] bg-[#fafafd] px-3 text-sm text-[#424854] outline-none transition focus:border-[#ff9fbd] focus:ring-2 focus:ring-[#ff9fbd]/20';

const actionButtonClass =
  'rounded-full border border-[#ececf2] bg-white px-3.5 py-2 text-sm text-[#616877] transition hover:border-[#ff9fbd] hover:text-[#ff5c93] disabled:cursor-not-allowed disabled:opacity-40';

const FilterPanel = ({ filterType, filterIntensity, onFilterChange, onIntensityChange, onReset }: FilterPanelProps) => {
  return (
    <div className="space-y-3 bg-transparent p-0">
      <label className="block text-[13px] text-[#5d6472]">
        <div className="grid grid-cols-[1fr_36px] items-center gap-3">
          <span>滤镜类型</span>
          <span className="text-right text-[#a0a6b2]">&nbsp;</span>
        </div>
        <select className={selectClass} value={filterType} onChange={(event) => onFilterChange(event.target.value as FilterType)}>
          <option value="none">无滤镜</option>
          <option value="grayscale">黑白</option>
          <option value="warm">暖色</option>
          <option value="cool">冷色</option>
          <option value="vintage">复古</option>
        </select>
      </label>
      <label className="block text-[13px] text-[#5d6472]">
        <div className="grid grid-cols-[1fr_36px] items-center gap-3">
          <span>滤镜强度</span>
          <span className="text-right tabular-nums text-[#a0a6b2]">{filterIntensity}</span>
        </div>
        <input
          aria-label="滤镜强度"
          className={inputClass}
          type="number"
          min={0}
          max={100}
          step={1}
          value={filterIntensity}
          disabled={filterType === 'none'}
          onChange={(event) => onIntensityChange(Number(event.currentTarget.value))}
        />
      </label>
      <button type="button" className={`${actionButtonClass} mt-1`} onClick={onReset} disabled={filterType === 'none' && filterIntensity === 0}>
        重置滤镜
      </button>
    </div>
  );
};

export default FilterPanel;
