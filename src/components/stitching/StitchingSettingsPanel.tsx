import Slider from './Slider';
import ColorPalette from './ColorPalette';
import ButtonGroup from './ButtonGroup';
import type { StitchingResolution } from '../../types/stitching';
import type { CanvasRatio } from '../../types/stitchingLayout';

type Copy = {
  canvasRatio: string;
  styleSettings: string;
  margin: string;
  spacing: string;
  borderRadius: string;
  backgroundColor: string;
  exportSettings: string;
  resolution: string;
  resolutionNormal: string;
  resolutionStandard: string;
  resolutionHigh: string;
  resolutionUltra: string;
};

type Props = {
  copy: Copy;
  canvasRatio: CanvasRatio;
  padding: number;
  spacing: number;
  borderRadius: number;
  backgroundColor: string;
  resolution: StitchingResolution;
  disabled: boolean;
  onCanvasRatioChange: (value: CanvasRatio) => void;
  onPaddingChange: (value: number) => void;
  onSpacingChange: (value: number) => void;
  onBorderRadiusChange: (value: number) => void;
  onBackgroundColorChange: (value: string) => void;
  onResolutionChange: (value: StitchingResolution) => void;
};

const sectionTitleClass = 'text-sm font-bold text-[#1A1D23] mb-4';

const StitchingSettingsPanel = ({
  copy,
  canvasRatio,
  padding,
  spacing,
  borderRadius,
  backgroundColor,
  resolution,
  disabled,
  onCanvasRatioChange,
  onPaddingChange,
  onSpacingChange,
  onBorderRadiusChange,
  onBackgroundColorChange,
  onResolutionChange
}: Props) => (
  <div className="space-y-6">
    {/* 画幅比例 - 无标题 */}
    <ButtonGroup
      label={copy.canvasRatio}
      value={canvasRatio}
      options={[
        { label: '1:1', value: '1:1' as CanvasRatio },
        { label: '3:4', value: '3:4' as CanvasRatio },
        { label: '9:16', value: '9:16' as CanvasRatio },
        { label: '4:3', value: '4:3' as CanvasRatio },
        { label: '16:9', value: '16:9' as CanvasRatio }
      ]}
      disabled={disabled}
      onChange={onCanvasRatioChange}
    />

    {/* 样式设置 */}
    <section>
      <h3 className={sectionTitleClass}>{copy.styleSettings}</h3>
      <div className="space-y-4">
        <Slider
          label={copy.margin}
          value={padding}
          min={0}
          max={100}
          unit="px"
          disabled={disabled}
          onChange={onPaddingChange}
        />
        <Slider
          label={copy.spacing}
          value={spacing}
          min={0}
          max={100}
          unit="px"
          disabled={disabled}
          onChange={onSpacingChange}
        />
        <Slider
          label={copy.borderRadius}
          value={borderRadius}
          min={0}
          max={50}
          unit="px"
          disabled={disabled}
          onChange={onBorderRadiusChange}
        />
        <ColorPalette
          label={copy.backgroundColor}
          value={backgroundColor}
          disabled={disabled}
          onChange={onBackgroundColorChange}
        />
      </div>
    </section>

    {/* 导出设置 */}
    <section>
      <h3 className={sectionTitleClass}>{copy.exportSettings}</h3>
      <div className="space-y-4">
        <ButtonGroup
          label={copy.resolution}
          value={resolution}
          options={[
            { label: copy.resolutionNormal, value: 768 as StitchingResolution },
            { label: copy.resolutionStandard, value: 1080 as StitchingResolution },
            { label: copy.resolutionHigh, value: 1536 as StitchingResolution },
            { label: copy.resolutionUltra, value: 2160 as StitchingResolution }
          ]}
          disabled={disabled}
          onChange={onResolutionChange}
        />
      </div>
    </section>
  </div>
);

export default StitchingSettingsPanel;
