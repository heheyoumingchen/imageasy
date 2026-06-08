import Slider from './Slider';
import ColorPalette from './ColorPalette';
import ButtonGroup from './ButtonGroup';
import type { StitchingNamingPattern, StitchingOutputFormat, StitchingResolution } from '../../types/stitching';
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
  quality: string;
  outputFormat: string;
  outputDirectory: string;
  chooseDirectory: string;
  namingPattern: string;
  namingPatternIndexed: string;
  namingPatternDate: string;
};

type Props = {
  copy: Copy;
  canvasRatio: CanvasRatio;
  padding: number;
  spacing: number;
  borderRadius: number;
  backgroundColor: string;
  resolution: StitchingResolution;
  quality: number;
  outputFormat: StitchingOutputFormat;
  outputDirectory: string;
  namingPattern: StitchingNamingPattern;
  disabled: boolean;
  onCanvasRatioChange: (value: CanvasRatio) => void;
  onPaddingChange: (value: number) => void;
  onSpacingChange: (value: number) => void;
  onBorderRadiusChange: (value: number) => void;
  onBackgroundColorChange: (value: string) => void;
  onResolutionChange: (value: StitchingResolution) => void;
  onQualityChange: (value: number) => void;
  onOutputFormatChange: (value: StitchingOutputFormat) => void;
  onOutputDirectoryChange: () => void;
  onNamingPatternChange: (value: StitchingNamingPattern) => void;
};

const fieldClass = 'mt-2 h-10 w-full rounded-lg border border-border-light bg-[#FAFBFD] px-4 text-sm font-bold text-[#1A1D23] outline-none transition-all focus:border-meitu focus:ring-4 focus:ring-meitu/10 appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';

const sectionTitleClass = 'text-sm font-bold text-[#1A1D23] mb-4';

const StitchingSettingsPanel = ({
  copy,
  canvasRatio,
  padding,
  spacing,
  borderRadius,
  backgroundColor,
  resolution,
  quality,
  outputFormat,
  outputDirectory,
  namingPattern,
  disabled,
  onCanvasRatioChange,
  onPaddingChange,
  onSpacingChange,
  onBorderRadiusChange,
  onBackgroundColorChange,
  onResolutionChange,
  onQualityChange,
  onOutputFormatChange,
  onOutputDirectoryChange,
  onNamingPatternChange
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

        <Slider
          label={copy.quality}
          value={quality}
          min={0}
          max={100}
          unit="%"
          disabled={disabled}
          onChange={onQualityChange}
        />

        <label className="block">
          <span className="text-[13px] font-bold text-[#5D6472] uppercase tracking-wider opacity-60">{copy.outputFormat}</span>
          <select
            aria-label={copy.outputFormat}
            className={fieldClass}
            value={outputFormat}
            disabled={disabled}
            onChange={(event) => onOutputFormatChange(event.target.value as StitchingOutputFormat)}
          >
            <option value="jpg">JPG</option>
            <option value="png">PNG</option>
            <option value="webp">WebP</option>
          </select>
        </label>

        <label className="block">
          <span className="text-[13px] font-bold text-[#5D6472] uppercase tracking-wider opacity-60">{copy.outputDirectory}</span>
          <div className="relative mt-3 flex items-center gap-3 min-w-0">
            <input
              aria-label={copy.outputDirectory}
              className="min-w-0 flex-1 h-10 rounded-lg border border-border-light bg-[#FAFBFD] px-4 text-sm font-bold text-[#1A1D23] truncate outline-none opacity-80 disabled:opacity-50"
              value={outputDirectory}
              readOnly
              disabled={disabled}
            />
            <button
              type="button"
              className="h-10 shrink-0 rounded-lg border-2 border-meitu bg-white px-4 text-sm font-bold text-meitu hover:bg-meitu-light transition-all active:scale-95 whitespace-nowrap disabled:cursor-not-allowed disabled:border-border-light disabled:bg-[#FAFBFD] disabled:text-[#B5BBC7]"
              onClick={onOutputDirectoryChange}
              disabled={disabled}
            >
              {copy.chooseDirectory}
            </button>
          </div>
        </label>

        <label className="block">
          <span className="text-[13px] font-bold text-[#5D6472] uppercase tracking-wider opacity-60">{copy.namingPattern}</span>
          <select
            aria-label={copy.namingPattern}
            className={fieldClass}
            value={namingPattern}
            disabled={disabled}
            onChange={(event) => onNamingPatternChange(event.target.value as StitchingNamingPattern)}
          >
            <option value="source-name-index">{copy.namingPatternIndexed}</option>
            <option value="source-name-date">{copy.namingPatternDate}</option>
          </select>
        </label>
      </div>
    </section>
  </div>
);

export default StitchingSettingsPanel;
