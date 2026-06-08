import type { CSSProperties } from 'react';
import type { ConversionColorMode, ConversionOutputFormat, ConversionOutputSettings } from '../../types/conversion';

type ConversionSettingsPanelCopy = {
  panelLabel: string;
  panelTitle: string;
  outputDirectory: string;
  chooseOutputDirectory: string;
  outputFormat: string;
  colorMode: string;
  namingPattern: string;
  outputQuality: string;
  dpi: string;
  pageRange: string;
  allPages: string;
  customPages: string;
  customPageRangeLabel: string;
  grayCmyk: string;
  sourceNameIndex: string;
  sourceNameDate: string;
};

type ConversionSettingsPanelProps = {
  copy: ConversionSettingsPanelCopy;
  settings: ConversionOutputSettings;
  disabled: boolean;
  onChange: (partial: Partial<ConversionOutputSettings>) => void;
  onChooseOutputDirectory: () => void;
};

const fieldClass = 'mt-1.5 h-10 w-full rounded-lg border border-border-light bg-[#FAFBFD] px-4 text-sm font-bold text-[#1A1D23] outline-none transition-all focus:border-meitu focus:ring-4 focus:ring-meitu/10 appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';
const sliderClass = 'h-1.5 w-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed disabled:opacity-50';
const pageRangeToggleClass =
  'flex h-10 items-center justify-center rounded-lg px-2 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50';

const buildSliderStyle = (value: number, min: number, max: number): CSSProperties => {
  const ratio = ((value - min) / (max - min)) * 100;
  return {
    background: `linear-gradient(90deg, #FF2D6C 0%, #FF2D6C ${ratio}%, #ECECF2 ${ratio}%, #ECECF2 100%)`
  };
};

const ConversionSettingsPanel = ({ copy, settings, disabled, onChange, onChooseOutputDirectory }: ConversionSettingsPanelProps) => {
  return (
    <aside aria-label={copy.panelLabel} className="rounded border border-border-light bg-white p-5 overflow-hidden">
      <h2 className="text-lg font-bold text-[#1A1D23] mb-5 flex items-center gap-3">
        <div className="w-1.5 h-6 bg-meitu rounded-full" />
        {copy.panelTitle}
      </h2>
      <div className="space-y-4">
        <div>
          <label className="block">
            <span className="text-[13px] font-bold text-[#5D6472] uppercase tracking-wider opacity-60">{copy.outputDirectory}</span>
            <div className="relative mt-3 flex items-center gap-3 min-w-0">
              <input
                aria-label={copy.outputDirectory}
                className="min-w-0 flex-1 h-10 rounded-lg border border-border-light bg-[#FAFBFD] px-4 text-sm font-bold text-[#1A1D23] truncate outline-none opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                type="text"
                value={settings.outputDirectory}
                readOnly
                disabled={disabled}
              />
              <button
                type="button"
                className="h-10 shrink-0 rounded-lg border-2 border-meitu bg-white px-4 text-sm font-bold text-meitu hover:bg-meitu-light transition-all active:scale-95 whitespace-nowrap disabled:cursor-not-allowed disabled:border-border-light disabled:bg-[#FAFBFD] disabled:text-[#B5BBC7]"
                onClick={onChooseOutputDirectory}
                disabled={disabled}
              >
                {copy.chooseOutputDirectory}
              </button>
            </div>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <label className="block">
            <span className="text-[13px] font-bold text-[#5D6472] uppercase tracking-wider opacity-60">{copy.namingPattern}</span>
            <div className="relative mt-2">
              <select
                aria-label={copy.namingPattern}
                className={fieldClass}
                value={settings.namingPattern}
                disabled={disabled}
                onChange={(event) => onChange({ namingPattern: event.target.value as ConversionOutputSettings['namingPattern'] })}
              >
                <option value="source-name-index">{copy.sourceNameIndex}</option>
                <option value="source-name-date">{copy.sourceNameDate}</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#8D93A1]">
                 <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                   <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                 </svg>
              </div>
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[13px] font-bold text-[#5D6472] uppercase tracking-wider opacity-60">{copy.outputFormat}</span>
              <div className="relative mt-2">
                <select
                  aria-label={copy.outputFormat}
                  className={fieldClass}
                  value={settings.outputFormat}
                  disabled={disabled}
                  onChange={(event) => onChange({ outputFormat: event.target.value as ConversionOutputFormat })}
                >
                  <option value="jpg">JPG</option>
                  <option value="png">PNG</option>
                  <option value="webp">WebP</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#8D93A1]">
                   <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                     <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                   </svg>
                </div>
              </div>
            </label>

            <label className="block">
              <span className="text-[13px] font-bold text-[#5D6472] uppercase tracking-wider opacity-60">{copy.colorMode}</span>
              <div className="relative mt-2">
                <select
                  aria-label={copy.colorMode}
                  className={fieldClass}
                  value={settings.colorMode}
                  disabled={disabled}
                  onChange={(event) => onChange({ colorMode: event.target.value as ConversionColorMode })}
                >
                  <option value="rgb">RGB</option>
                  <option value="cmyk">CMYK</option>
                  <option value="gray-cmyk">{copy.grayCmyk}</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#8D93A1]">
                   <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                     <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                   </svg>
                </div>
              </div>
            </label>
          </div>
        </div>

        <label className="block group">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-bold text-[#5D6472] uppercase tracking-wider opacity-60">{copy.outputQuality}</span>
            <span className="text-sm font-bold text-meitu bg-meitu-light px-2 py-0.5 rounded-full tabular-nums">{settings.quality}%</span>
          </div>
          <input
            aria-label={copy.outputQuality}
            className={sliderClass}
            style={buildSliderStyle(settings.quality, 1, 100)}
            type="range"
            min={1}
            max={100}
            step={1}
            value={settings.quality}
            disabled={disabled}
            onChange={(event) => onChange({ quality: Number(event.target.value) })}
          />
        </label>

        <div data-testid="page-range-row" className="grid grid-cols-[96px_96px_minmax(0,1fr)] items-center gap-2">
          <button
            type="button"
            className={`${pageRangeToggleClass} ${settings.pageRangeMode === 'all' ? 'bg-meitu-light text-meitu' : 'bg-transparent text-[#8D93A1] hover:bg-[#FAFBFD] hover:text-[#515867]'}`}
            onClick={() => onChange({ pageRangeMode: 'all', pageRangeText: '' })}
            disabled={disabled}
          >
            {copy.allPages}
          </button>
          <button
            type="button"
            className={`${pageRangeToggleClass} ${settings.pageRangeMode === 'custom' ? 'bg-meitu-light text-meitu' : 'bg-transparent text-[#8D93A1] hover:bg-[#FAFBFD] hover:text-[#515867]'}`}
            onClick={() => onChange({ pageRangeMode: 'custom' })}
            disabled={disabled}
          >
            {copy.customPages}
          </button>
          <input
            aria-label={`${copy.customPageRangeLabel}输入`}
            className="min-w-0 w-full h-10 rounded-lg border border-border-light bg-[#FAFBFD] px-4 text-sm font-bold text-[#1A1D23] outline-none focus:border-meitu focus:ring-4 focus:ring-meitu/10 disabled:cursor-not-allowed disabled:opacity-50"
            type="text"
            placeholder="例如: 1-5, 8, 11-13"
            value={settings.pageRangeText}
            disabled={disabled || settings.pageRangeMode !== 'custom'}
            onChange={(event) => onChange({ pageRangeText: event.target.value })}
          />
        </div>
      </div>
    </aside>
  );
};

export default ConversionSettingsPanel;
