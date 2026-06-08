import Slider from '../stitching/Slider';
import ButtonGroup from '../stitching/ButtonGroup';
import type { SplittingMode } from '../../types/splitting';

type Copy = {
  mode: string;
  modeHorizontal: string;
  modeVertical: string;
  modeGrid: string;
  splitParameters: string;
  horizontalSplits: string;
  verticalSplits: string;
  previewParts: (count: number) => string;
};

type Props = {
  copy: Copy;
  mode: SplittingMode;
  horizontalSplits: number;
  verticalSplits: number;
  disabled: boolean;
  onModeChange: (value: SplittingMode) => void;
  onHorizontalSplitsChange: (value: number) => void;
  onVerticalSplitsChange: (value: number) => void;
};

const sectionTitleClass = 'text-sm font-bold text-[#1A1D23] mb-4';

const SplittingSettingsPanel = ({
  copy,
  mode,
  horizontalSplits,
  verticalSplits,
  disabled,
  onModeChange,
  onHorizontalSplitsChange,
  onVerticalSplitsChange
}: Props) => {
  const totalParts = mode === 'grid' ? horizontalSplits * verticalSplits : mode === 'horizontal' ? horizontalSplits : verticalSplits;

  return (
    <div className="space-y-6">
      {/* 模式选项 */}
      <ButtonGroup
        label={copy.mode}
        value={mode}
        options={[
          { label: copy.modeHorizontal, value: 'horizontal' as SplittingMode },
          { label: copy.modeVertical, value: 'vertical' as SplittingMode },
          { label: copy.modeGrid, value: 'grid' as SplittingMode }
        ]}
        columns={2}
        disabled={disabled}
        onChange={onModeChange}
      />

      {/* 分割参数 */}
      <section>
        <h3 className={sectionTitleClass}>{copy.splitParameters}</h3>
        <div className="space-y-4">
          {(mode === 'horizontal' || mode === 'grid') && (
            <Slider
              label={copy.horizontalSplits}
              value={horizontalSplits}
              min={2}
              max={10}
              unit=""
              disabled={disabled}
              onChange={onHorizontalSplitsChange}
            />
          )}
          {(mode === 'vertical' || mode === 'grid') && (
            <Slider
              label={copy.verticalSplits}
              value={verticalSplits}
              min={2}
              max={10}
              unit=""
              disabled={disabled}
              onChange={onVerticalSplitsChange}
            />
          )}
          <p className="text-sm text-[#8D93A1] italic">
            {copy.previewParts(totalParts)}
          </p>
        </div>
      </section>
    </div>
  );
};

export default SplittingSettingsPanel;
