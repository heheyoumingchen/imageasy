import type { NamingPattern, OutputDirectoryStrategy } from '../../stores/settingsStore';

export type TaskColorMode = 'rgb' | 'cmyk' | 'grayscale';
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
  sourceNameOriginal: string;
  outputFormat: string;
  colorMode: string;
  grayscale: string;
  outputDirectoryStrategy: string;
  sameAsSource: string;
  custom: string;
  chooseDefaultOutputDirectory: string;
  defaultOutputDirectoryPlaceholder: string;
};

type TaskSettingsCardProps = {
  copy: TaskSettingsCardCopy;
  value: TaskSettingsValue;
  formatOptions: TaskOutputFormat[];
  showColorMode: boolean;
  outputDirectoryStrategy: OutputDirectoryStrategy;
  defaultOutputDirectory: string;
  disabled?: boolean;
  onChange: (partial: Partial<TaskSettingsValue>) => void;
  onOutputDirectoryStrategyChange: (value: OutputDirectoryStrategy) => void;
  onChooseDefaultOutputDirectory: () => void;
};

const fieldClass =
  'mt-2 h-10 w-full rounded border border-border-light bg-[#FAFBFD] px-4 text-sm font-bold text-[#1A1D23] outline-none transition-all focus:border-meitu focus:ring-4 focus:ring-meitu/10 appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';

const labelClass = 'text-[13px] font-bold text-[#5D6472] uppercase tracking-wider opacity-60';

const formatLabelMap: Record<TaskOutputFormat, string> = {
  jpg: 'JPG',
  png: 'PNG',
  webp: 'WebP'
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
  outputDirectoryStrategy,
  defaultOutputDirectory,
  disabled = false,
  onChange,
  onOutputDirectoryStrategyChange,
  onChooseDefaultOutputDirectory
}: TaskSettingsCardProps) => (
  <section className="px-8 py-5">
    <h2 className="text-title-2 mb-4 flex items-center gap-3">
      <div className="w-1.5 h-6 bg-meitu rounded-full" />
      {copy.title}
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5">
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
            <option value="source-name-original">{copy.sourceNameOriginal}</option>
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
              <option value="grayscale">{copy.grayscale}</option>
            </select>
            <ChevronIcon />
          </div>
        </label>
      ) : null}

      {/* 第二排：默认输出目录策略 + 缓存（同一排） */}
      <label className="block">
        <span className={labelClass}>{copy.outputDirectoryStrategy}</span>
        <div className="relative">
          <select
            aria-label={copy.outputDirectoryStrategy}
            className={fieldClass}
            value={outputDirectoryStrategy}
            disabled={disabled}
            onChange={(event) => onOutputDirectoryStrategyChange(event.target.value as OutputDirectoryStrategy)}
          >
            <option value="same-as-source">{copy.sameAsSource}</option>
            <option value="custom">{copy.custom}</option>
          </select>
          <ChevronIcon />
        </div>
      </label>

      <div className="md:col-span-2">
        <span className={labelClass}>{copy.chooseDefaultOutputDirectory}</span>
        <div className="mt-2 flex items-center gap-3">
          <div
            data-testid="settings-default-output-path"
            className={`flex h-10 min-w-0 flex-1 items-center rounded border border-border-light bg-[#FAFBFD] px-4 text-sm font-bold ${defaultOutputDirectory ? 'text-[#1A1D23]' : 'text-[#8D93A1]'}`}
          >
            <span className="truncate">{defaultOutputDirectory || copy.defaultOutputDirectoryPlaceholder}</span>
          </div>
          <button
            type="button"
            className="h-10 shrink-0 px-4 rounded border border-meitu bg-white text-[13px] font-bold text-meitu transition-all hover:bg-meitu-light active:scale-95 disabled:opacity-40"
            disabled={disabled || outputDirectoryStrategy !== 'custom'}
            onClick={onChooseDefaultOutputDirectory}
          >
            {copy.chooseDefaultOutputDirectory}
          </button>
        </div>
      </div>
    </div>
  </section>
);
