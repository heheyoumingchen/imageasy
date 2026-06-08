import { useState } from 'react';
import type { AdjustmentKey, AdjustmentParams, FilterType } from '../../types/editor';
import BasicAdjustPanel from './BasicAdjustPanel';
import FilterPanel from './FilterPanel';

type EditorInspectorProps = {
  adjustments: AdjustmentParams;
  isEnglish?: boolean;
  onChange: (key: AdjustmentKey, value: number) => void;
  onFilterChange: (value: FilterType) => void;
  onFilterIntensityChange: (value: number) => void;
  onResetFilters: () => void;
};

const tabClassName =
  'flex-1 flex h-10 items-center justify-center rounded text-sm font-bold transition-all duration-200';

const EditorInspector = ({
  adjustments,
  isEnglish = false,
  onChange,
  onFilterChange,
  onFilterIntensityChange,
  onResetFilters
}: EditorInspectorProps) => {
  const [activePanel, setActivePanel] = useState<'basic' | 'filters'>('basic');
  const copy = isEnglish
    ? {
        panelLabel: 'Inspector',
        basicAdjustments: 'Basic',
        filters: 'Filters'
      }
    : {
        panelLabel: '编辑调色面板',
        basicAdjustments: '基础功能',
        filters: '滤镜'
      };

  return (
    <aside aria-label={copy.panelLabel} className="h-full min-w-0 flex flex-col bg-white overflow-hidden">
      <div className="p-5 border-b border-border-light/60">
        <div className="flex bg-bg-main p-1 rounded">
          <button
            type="button"
            aria-pressed={activePanel === 'basic'}
            className={`${tabClassName} ${
              activePanel === 'basic'
                ? 'bg-white text-meitu'
                : 'text-[#8D93A1] hover:text-[#515867]'
            }`}
            onClick={() => setActivePanel('basic')}
          >
            {copy.basicAdjustments}
          </button>
          <button
            type="button"
            aria-pressed={activePanel === 'filters'}
            className={`${tabClassName} ${
              activePanel === 'filters'
                ? 'bg-white text-meitu'
                : 'text-[#8D93A1] hover:text-[#515867]'
            }`}
            onClick={() => setActivePanel('filters')}
          >
            {copy.filters}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
        {activePanel === 'basic' ? (
          <BasicAdjustPanel adjustments={adjustments} isEnglish={isEnglish} onChange={onChange} />
        ) : (
          <FilterPanel
            filterType={adjustments.filterType}
            filterIntensity={adjustments.filterIntensity}
            isEnglish={isEnglish}
            onFilterChange={onFilterChange}
            onIntensityChange={onFilterIntensityChange}
            onReset={onResetFilters}
          />
        )}
      </div>
    </aside>
  );
};

export default EditorInspector;
