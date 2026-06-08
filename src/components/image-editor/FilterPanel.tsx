import type { CSSProperties } from 'react';
import type { FilterType } from '../../types/editor';

type FilterPanelProps = {
  filterType: FilterType;
  filterIntensity: number;
  isEnglish?: boolean;
  onFilterChange: (value: FilterType) => void;
  onIntensityChange: (value: number) => void;
  onReset: () => void;
};

const sliderClass =
  'mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full';

const buildSliderStyle = (value: number, min: number, max: number): CSSProperties => {
  const ratio = ((value - min) / (max - min)) * 100;
  return {
    background: `linear-gradient(90deg, #FF2D6C 0%, #FF2D6C ${ratio}%, #ECECF2 ${ratio}%, #ECECF2 100%)`
  };
};

const actionButtonClass =
  'w-full h-10 rounded-lg border border-border-light bg-white text-sm font-bold text-[#616877] transition-all hover:border-meitu hover:text-meitu hover:bg-meitu-light active:scale-95 disabled:opacity-30 disabled:pointer-events-none';

const FilterPanel = ({ filterType, filterIntensity, isEnglish = false, onFilterChange, onIntensityChange, onReset }: FilterPanelProps) => {
  const copy = isEnglish
    ? {
        filterType: 'Filter Type',
        filterIntensity: 'Intensity',
        resetFilters: 'Reset Filter',
        none: 'None',
        grayscale: 'B&W',
        warm: 'Warmth',
        cool: 'Coolness',
        vintage: 'Vintage',
        sepia: 'Sepia',
        vivid: 'Vivid',
        fade: 'Fade',
        cinematic: 'Cinema',
        noir: 'Noir',
        polaroid: 'Polaroid',
        dreamy: 'Dreamy',
        summer: 'Summer',
        forest: 'Forest'
      }
    : {
        filterType: '选择滤镜',
        filterIntensity: '滤镜强度',
        resetFilters: '重置滤镜',
        none: '无滤镜',
        grayscale: '经典黑白',
        warm: '暖阳气息',
        cool: '清冷海洋',
        vintage: '复古胶片',
        sepia: '怀旧棕调',
        vivid: '鲜艳明快',
        fade: '褪色朦胧',
        cinematic: '电影质感',
        noir: '暗夜黑金',
        polaroid: '宝丽来',
        dreamy: '梦幻柔光',
        summer: '盛夏阳光',
        forest: '森系青调'
      };

  const filters: Array<{ value: FilterType; label: string }> = [
    { value: 'none', label: copy.none },
    { value: 'grayscale', label: copy.grayscale },
    { value: 'warm', label: copy.warm },
    { value: 'cool', label: copy.cool },
    { value: 'vintage', label: copy.vintage },
    { value: 'sepia', label: copy.sepia },
    { value: 'vivid', label: copy.vivid },
    { value: 'fade', label: copy.fade },
    { value: 'cinematic', label: copy.cinematic },
    { value: 'noir', label: copy.noir },
    { value: 'polaroid', label: copy.polaroid },
    { value: 'dreamy', label: copy.dreamy },
    { value: 'summer', label: copy.summer },
    { value: 'forest', label: copy.forest }
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[13px] font-bold text-[#1A1D23] uppercase tracking-wider opacity-60">{copy.filterType}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {filters.map((filter) => {
            const active = filterType === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                aria-pressed={active}
                className={`h-10 rounded-lg border px-3 text-sm font-bold text-center transition-all ${
                  active
                    ? 'border-meitu bg-meitu-light text-meitu'
                    : 'border-border-light bg-white text-[#616877] hover:border-meitu hover:text-meitu'
                }`}
                onClick={() => onFilterChange(filter.value)}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className={`block group transition-opacity duration-300 ${filterType === 'none' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[13px] font-medium text-[#5D6472] group-hover:text-meitu transition-colors">{copy.filterIntensity}</span>
          <span className="text-[11px] font-bold tabular-nums text-meitu bg-meitu-light px-1.5 py-0.5 rounded">
            {filterIntensity}%
          </span>
        </div>
        <input
          aria-label={copy.filterIntensity}
          className={sliderClass}
          style={buildSliderStyle(filterIntensity, 0, 100)}
          type="range"
          min={0}
          max={100}
          step={1}
          value={filterIntensity}
          disabled={filterType === 'none'}
          onChange={(event) => onIntensityChange(Number(event.currentTarget.value))}
        />
      </label>

      <div className="pt-4 border-t border-border-light/50">
        <button
          type="button"
          className={actionButtonClass}
          onClick={onReset}
          disabled={filterType === 'none'}
        >
          {copy.resetFilters}
        </button>
      </div>
    </div>
  );
};

export default FilterPanel;
