import type { AdjustmentKey, AdjustmentParams, FilterType } from '../../types/editor';
import BasicAdjustPanel from './BasicAdjustPanel';
import EditorInspectorSection from './EditorInspectorSection';
import FilterPanel from './FilterPanel';

type EditorInspectorProps = {
  adjustments: AdjustmentParams;
  onChange: (key: AdjustmentKey, value: number) => void;
  onFilterChange: (value: FilterType) => void;
  onFilterIntensityChange: (value: number) => void;
  onResetFilters: () => void;
};

const EditorInspector = ({ adjustments, onChange, onFilterChange, onFilterIntensityChange, onResetFilters }: EditorInspectorProps) => {
  return (
    <aside aria-label="编辑调色面板" className="space-y-3.5 rounded-[20px] border border-[#ececf2] bg-[#f9f9fc] p-3.5 shadow-[0_10px_24px_rgba(23,28,41,0.04)]">
      <EditorInspectorSection title="基础调整">
        <BasicAdjustPanel adjustments={adjustments} onChange={onChange} />
      </EditorInspectorSection>
      <EditorInspectorSection title="滤镜">
        <FilterPanel
          filterType={adjustments.filterType}
          filterIntensity={adjustments.filterIntensity}
          onFilterChange={onFilterChange}
          onIntensityChange={onFilterIntensityChange}
          onReset={onResetFilters}
        />
      </EditorInspectorSection>
    </aside>
  );
};

export default EditorInspector;
