import type { CSSProperties } from 'react';
import type { NamingPattern } from '../../stores/settingsStore';

export type TaskColorMode = 'rgb' | 'cmyk' | 'gray-cmyk';
export type TaskOutputFormat = 'jpg' | 'png' | 'webp';

export type TaskSettingsValue = {
  namingPattern: NamingPattern;
  outputFormat: TaskOutputFormat;
  colorMode?: TaskColorMode;
  quality?: number;
};

export type TaskSettingsCardCopy = {
  title: string;
  namingPattern: string;
  sourceNameIndex: string;
  sourceNameDate: string;
  outputFormat: string;
  colorMode: string;
  grayCmyk: string;
  outputQuality: string;
};

type TaskSettingsCardProps = {
  copy: TaskSettingsCardCopy;
  value: TaskSettingsValue;
  formatOptions: TaskOutputFormat[];
  showColorMode: boolean;
  showQuality: boolean;
  disabled?: boolean;
  onChange: (partial: Partial<TaskSettingsValue>) => void;
};

const fieldClass =
  'mt-2 h-10 w-full rounded border border-border-light bg-[#FAFBFD] px-4 text-sm font-bold text-[#1A1D23] outline-none transition-all focus:border-meitu focus:ring-4 focus:ring-meitu/10 appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';

const labelClass = 'text-[13px] font-bold text-[#5D6472] uppercase tracking-wider opacity-60';

const formatLabelMap: Record<TaskOutputFormat, string> = {
  jpg: 'JPG',
  png: 'PNG',
  webp: 'WebP'
};

const buildSliderStyle = (value: number, min: number, max: number): CSSProperties => {
  const ratio = ((value - min) / (max - min)) * 100;
  return {
    background: `linear-gradient(90deg, #FF2D6C 0%, #FF2D6C ${ratio}%, #ECECF2 ${ratio}%, #ECECF2 100%)`
  };
};

const ChevronIcon = () => (
  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#8D93A1]">
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  </div>
);

export const TaskSettingsCard = ({
  copy,
  value,
  formatOptions,
  showColorMode,
  showQuality,
  disabled = false,
  onChange
}: TaskSettingsCardProps) => (
  <section className="bg-white rounded border border-border-light px-8 py-5">
    <h2 className="text-lg font-bold text-[#1A1D23] mb-4 flex items-center gap-3">
      <div className="w-1.5 h-6 bg-meitu rounded-full" />
      {copy.title}
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <label className="block">
        <span className={labelClass}>{copy.namingPattern}</span>
        <div className="relative">
          <select
            aria-label={copy.namingPattern}
            className={fieldClass}
            value={value.namingPattern}
            disabled={disabled}
            onChange={(event) => onChange({ namingPattern: event.target.value as NamingPattern })}
          >
            <option value="source-name-index">{copy.sourceNameIndex}</option>
            <option value="source-name-date">{copy.sourceNameDate}</option>
          </select>
          <ChevronIcon />
        </div>
      </label>

      <label className="block">
        <span className={labelClass}>{copy.outputFormat}</span>
        <div className="relative">
          <select
            aria-label={copy.outputFormat}
            className={fieldClass}
            value={value.outputFormat}
            disabled={disabled}
            onChange={(event) => onChange({ outputFormat: event.target.value as TaskOutputFormat })}
          >
            {formatOptions.map((format) => (
              <option key={format} value={format}>
                {formatLabelMap[format]}
              </option>
            ))}
          </select>
          <ChevronIcon />
        </div>
      </label>

      {showColorMode && value.colorMode !== undefined ? (
        <label className="block">
          <span className={labelClass}>{copy.colorMode}</span>
          <div className="relative">
            <select
              aria-label={copy.colorMode}
              className={fieldClass}
              value={value.colorMode}
              disabled={disabled}
              onChange={(event) => onChange({ colorMode: event.target.value as TaskColorMode })}
            >
              <option value="rgb">RGB</option>
              <option value="cmyk">CMYK</option>
              <option value="gray-cmyk">{copy.grayCmyk}</option>
            </select>
            <ChevronIcon />
          </div>
        </label>
      ) : null}

      {showQuality && value.quality !== undefined ? (
        <label className="block">
          <div className="flex items-center justify-between">
            <span className={labelClass}>{copy.outputQuality}</span>
            <span className="text-sm font-bold text-meitu bg-meitu-light px-2 py-0.5 rounded-full tabular-nums">
              {value.quality}%
            </span>
          </div>
          <input
            aria-label={copy.outputQuality}
            className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed disabled:opacity-50"
            style={buildSliderStyle(value.quality, 1, 100)}
            type="range"
            min={1}
            max={100}
            step={1}
            value={value.quality}
            disabled={disabled}
            onChange={(event) => onChange({ quality: Number(event.target.value) })}
          />
        </label>
      ) : null}
    </div>
  </section>
);
