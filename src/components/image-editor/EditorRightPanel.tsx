import BasicAdjustPanel from './BasicAdjustPanel';
import FilterPanel from './FilterPanel';
import type { AdjustmentParams } from '../../types/editor';

type EditorRightPanelProps = {
  adjustments: AdjustmentParams;
  onChange: (key: keyof AdjustmentParams, value: number) => void;
};

const EditorRightPanel = ({ adjustments, onChange }: EditorRightPanelProps) => {
  return (
    <div className="space-y-6">
      <BasicAdjustPanel adjustments={adjustments} onChange={onChange} />
      <FilterPanel />
    </div>
  );
};

export default EditorRightPanel;
