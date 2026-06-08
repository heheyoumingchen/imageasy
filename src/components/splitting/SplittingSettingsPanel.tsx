import Slider from '../stitching/Slider';
import ButtonGroup from '../stitching/ButtonGroup';
import type { SplittingMode, SplittingOutputFormat } from '../../types/splitting';

type Copy = {
  mode: string;
  modeHorizontal: string;
  modeVertical: string;
  modeGrid: string;
  splitParameters: string;
  horizontalSplits: string;
  verticalSplits: string;
  previewParts: (count: number) => string;
  outputSettings: string;
  outputFormat: string;
  quality: string;
};

type Props = {
  copy: Copy;
  mode: SplittingMode;
  horizontalSplits: number;
  verticalSplits: number;
  outputFormat: SplittingOutputFormat;
  quality: number;
  disabled: boolean;
  onModeChange: (value: SplittingMode) => void;
  onHorizontalSplitsChange: (value: number) => void;
  onVerticalSplitsChange: (value: number) => void;
  onOutputFormatChange: (value: SplittingOutputFormat) => void;
  onQualityChange: (value: number) => void;
};

const fieldClass = 'mt-2 h-10 w-full rounded-lg border border-border-light bg-[#FAFBFD] px-4 text-sm font-bold text-[#1A1D23] outline-none transition-all focus:border-meitu focus:ring-4 focus:ring-meitu/10 appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';

const sectionTitleClass = 'text-sm font-bold text-[#1A1D23] mb-4';

const SplittingSettingsPanel = ({
  copy,
  mode,
  horizontalSplits,
  verticalSplits,
  outputFormat,
  quality,
  disabled,
  onModeChange,
  onHorizontalSplitsChange,
  onVerticalSplitsChange,
  onOutputFormatChange,
  onQualityChange
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

      {/* 输出设置 */}
      <section>
        <h3 className={sectionTitleClass}>{copy.outputSettings}</h3>
        <div className="space-y-4">
          <label className="block">
            <span className="text-[13px] font-bold text-[#5D6472] uppercase tracking-wider opacity-60">{copy.outputFormat}</span>
            <select
              aria-label={copy.outputFormat}
              className={fieldClass}
              value={outputFormat}
              disabled={disabled}
              onChange={(event) => onOutputFormatChange(event.target.value as SplittingOutputFormat)}
            >
              <option value="jpg">JPG</option>
              <option value="png">PNG</option>
              <option value="webp">WebP</option>
            </select>
          </label>

          <Slider
            label={copy.quality}
            value={quality}
            min={0}
            max={100}
            unit="%"
            disabled={disabled}
            onChange={onQualityChange}
          />
        </div>
      </section>
    </div>
  );
};

export default SplittingSettingsPanel;
