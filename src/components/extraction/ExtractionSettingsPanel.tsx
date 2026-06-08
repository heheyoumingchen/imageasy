import type { ExtractionColorMode, ExtractionOutputFormat, ExtractionNamingPattern } from '../../types/extraction';

type ExtractionSettingsPanelCopy = {
  panelTitle: string;
  outputDirectory: string;
  chooseDirectory: string;
  outputFormat: string;
  colorMode: string;
  namingPattern: string;
  namingPatternIndexed: string;
  namingPatternDate: string;
  grayCmyk: string;
};

type ExtractionSettingsPanelProps = {
  copy: ExtractionSettingsPanelCopy;
  outputDirectory: string;
  outputFormat: ExtractionOutputFormat;
  colorMode: ExtractionColorMode;
  namingPattern: ExtractionNamingPattern;
  onOutputDirectoryChange: () => void;
  onOutputFormatChange: (value: ExtractionOutputFormat) => void;
  onColorModeChange: (value: ExtractionColorMode) => void;
  onNamingPatternChange: (value: ExtractionNamingPattern) => void;
};

const fieldClass = 'mt-2 h-10 w-full rounded-lg border border-border-light bg-[#FAFBFD] px-4 text-sm font-bold text-[#1A1D23] outline-none transition-all focus:border-meitu focus:ring-4 focus:ring-meitu/10 appearance-none cursor-pointer';

const ExtractionSettingsPanel = ({
  copy,
  outputDirectory,
  outputFormat,
  colorMode,
  namingPattern,
  onOutputDirectoryChange,
  onOutputFormatChange,
  onColorModeChange,
  onNamingPatternChange,
}: ExtractionSettingsPanelProps) => {
  return (
    <aside className="rounded border border-border-light bg-white p-5 overflow-hidden">
      <h2 className="text-lg font-bold text-[#1A1D23] mb-5 flex items-center gap-3">
        <div className="w-1.5 h-6 bg-meitu rounded-full" />
        {copy.panelTitle}
      </h2>
      <div className="space-y-6">
        <div>
          <label className="block">
            <span className="text-[13px] font-bold text-[#5D6472] uppercase tracking-wider opacity-60">{copy.outputDirectory}</span>
            <div className="relative mt-3 flex items-center gap-3 min-w-0">
              <input
                aria-label={copy.outputDirectory}
                className="min-w-0 flex-1 h-10 rounded-lg border border-border-light bg-[#FAFBFD] px-4 text-sm font-bold text-[#1A1D23] truncate outline-none opacity-80"
                type="text"
                value={outputDirectory}
                readOnly
              />
              <button
                type="button"
                className="h-10 shrink-0 rounded-lg border-2 border-meitu bg-white px-4 text-sm font-bold text-meitu hover:bg-meitu-light transition-all active:scale-95 whitespace-nowrap"
                onClick={onOutputDirectoryChange}
              >
                {copy.chooseDirectory}
              </button>
            </div>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-5">
          <label className="block">
            <span className="text-[13px] font-bold text-[#5D6472] uppercase tracking-wider opacity-60">{copy.namingPattern}</span>
            <div className="relative mt-2">
              <select
                aria-label={copy.namingPattern}
                className={fieldClass}
                value={namingPattern}
                onChange={(event) => onNamingPatternChange(event.target.value as ExtractionNamingPattern)}
              >
                <option value="source-name-index">{copy.namingPatternIndexed}</option>
                <option value="source-name-date">{copy.namingPatternDate}</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#8D93A1]">
                 <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                   <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                 </svg>
              </div>
            </div>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[13px] font-bold text-[#5D6472] uppercase tracking-wider opacity-60">{copy.outputFormat}</span>
              <div className="relative mt-2">
                <select
                  aria-label={copy.outputFormat}
                  className={fieldClass}
                  value={outputFormat}
                  onChange={(event) => onOutputFormatChange(event.target.value as ExtractionOutputFormat)}
                >
                  <option value="png">PNG</option>
                  <option value="jpg">JPG</option>
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
                  value={colorMode}
                  onChange={(event) => onColorModeChange(event.target.value as ExtractionColorMode)}
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
      </div>
    </aside>
  );
};

export default ExtractionSettingsPanel;
