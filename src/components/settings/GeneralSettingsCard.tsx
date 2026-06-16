import type { CSSProperties } from 'react';
import type { PersistedSettings } from '../../stores/settingsStore';

const buildSliderStyle = (value: number, min: number, max: number): CSSProperties => {
  const ratio = ((value - min) / (max - min)) * 100;
  return {
    background: `linear-gradient(90deg, #FF2D6C 0%, #FF2D6C ${ratio}%, #ECECF2 ${ratio}%, #ECECF2 100%)`
  };
};

type GeneralSettingsCardProps = {
  copy: {
    general: string;
    theme: string;
    themeDark: string;
    themeLight: string;
    language: string;
    maxConcurrency: string;
    outputQuality: string;
    cacheTitle: string;
    cleanCache: string;
  };
  formState: PersistedSettings;
  isLoading: boolean;
  cacheSizeText: string;
  isClearingCache: boolean;
  onThemeChange: (theme: PersistedSettings['theme']) => void;
  onLanguageChange: (language: PersistedSettings['language']) => void;
  onMaxConcurrencyChange: (value: number) => void;
  onOutputQualityChange: (value: number) => void;
  onClearCache: () => void;
};

export const GeneralSettingsCard = ({
  copy,
  formState,
  isLoading,
  cacheSizeText,
  isClearingCache,
  onThemeChange,
  onLanguageChange,
  onMaxConcurrencyChange,
  onOutputQualityChange,
  onClearCache
}: GeneralSettingsCardProps) => (
  <section className="px-8 py-5">
    <h2 className="text-title-2 mb-2 flex items-center gap-3">
      <div className="w-1.5 h-6 bg-meitu rounded-full" />
      {copy.general}
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
      {/* Column 1: Theme */}
      <div>
        <span className="block text-sm font-bold text-[#5D6472] mb-4">{copy.theme}</span>
        <div className="flex gap-4">
          <button
            type="button"
            aria-label={copy.themeLight}
            onClick={() => onThemeChange('light')}
            className="relative flex-1 group"
          >
            <div className={`p-3 rounded border-2 transition-all duration-300 ${formState.theme === 'light' ? 'border-meitu bg-meitu-light/30' : 'border-border-light bg-bg-main'}`}>
              <div className="aspect-[4/3] rounded bg-white border border-gray-200 overflow-hidden mb-2">
                <div className="h-3 bg-gray-50 border-b border-gray-100 px-2 flex items-center gap-0.5">
                  <div className="w-1 h-1 rounded-full bg-gray-300" />
                  <div className="w-1 h-1 rounded-full bg-gray-300" />
                  <div className="w-1 h-1 rounded-full bg-gray-300" />
                </div>
                <div className="p-2 space-y-1.5">
                  <div className="h-1.5 w-3/4 bg-gray-100 rounded" />
                  <div className="h-1.5 w-1/2 bg-gray-100 rounded" />
                </div>
              </div>
              <div className="flex items-center justify-center gap-1 pt-1">
                <svg viewBox="0 0 20 20" fill="currentColor" className={`w-3.5 h-3.5 ${formState.theme === 'light' ? 'text-meitu' : 'text-[#8D93A1]'}`}>
                  <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zm0 13a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zm-8-5a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 012 10zm13 0a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 0115 10zM4.343 4.343a.75.75 0 011.06 0l1.061 1.06a.75.75 0 01-1.06 1.061l-1.061-1.06a.75.75 0 010-1.06zm9.193 9.193a.75.75 0 011.06 0l1.061 1.06a.75.75 0 01-1.06 1.061l-1.061-1.06a.75.75 0 010-1.06zM4.343 15.657a.75.75 0 010-1.06l1.06-1.061a.75.75 0 111.061 1.06l-1.06 1.061a.75.75 0 01-1.06 0zm9.193-9.193a.75.75 0 010-1.06l1.06-1.061a.75.75 0 111.061 1.06l-1.06 1.061a.75.75 0 01-1.06 0zM10 7a3 3 0 100 6 3 3 0 000-6z" />
                </svg>
                <span className={`text-xs font-bold ${formState.theme === 'light' ? 'text-meitu' : 'text-[#8D93A1]'}`}>{copy.themeLight}</span>
              </div>
            </div>
            {formState.theme === 'light' && (
              <div className="absolute -top-2 -right-2 w-5 h-5 bg-meitu text-white rounded-full flex items-center justify-center shadow-lg">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>
          <button
            type="button"
            aria-label={copy.themeDark}
            onClick={() => onThemeChange('dark')}
            className="relative flex-1 group"
          >
            <div className={`p-3 rounded border-2 transition-all duration-300 ${formState.theme === 'dark' ? 'border-meitu bg-meitu-light/30' : 'border-border-light bg-[#1A1D23]'}`}>
              <div className="aspect-[4/3] rounded bg-[#2A2F3E] border border-gray-700 overflow-hidden mb-2">
                <div className="h-3 bg-[#1A1D23] border-b border-gray-800 px-2 flex items-center gap-0.5">
                  <div className="w-1 h-1 rounded-full bg-gray-600" />
                  <div className="w-1 h-1 rounded-full bg-gray-600" />
                  <div className="w-1 h-1 rounded-full bg-gray-600" />
                </div>
                <div className="p-2 space-y-1.5">
                  <div className="h-1.5 w-3/4 bg-gray-700 rounded" />
                  <div className="h-1.5 w-1/2 bg-gray-700 rounded" />
                </div>
              </div>
              <div className="flex items-center justify-center gap-1 pt-1">
                <svg viewBox="0 0 20 20" fill="currentColor" className={`w-3.5 h-3.5 ${formState.theme === 'dark' ? 'text-meitu' : 'text-[#8D93A1]'}`}>
                  <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
                </svg>
                <span className={`text-xs font-bold ${formState.theme === 'dark' ? 'text-meitu' : 'text-[#8D93A1]'}`}>{copy.themeDark}</span>
              </div>
            </div>
            {formState.theme === 'dark' && (
              <div className="absolute -top-2 -right-2 w-5 h-5 bg-meitu text-white rounded-full flex items-center justify-center shadow-lg">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>
        </div>
      </div>
      {/* Column 2: Concurrency + Output Quality */}
      <div className="space-y-8">
        <label className="block">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-[#5D6472]">{copy.maxConcurrency}</span>
            <span className="text-xs font-bold text-meitu bg-meitu-light px-2.5 py-1 rounded-full tabular-nums">{formState.maxConcurrency}</span>
          </div>
          <div data-testid="settings-concurrency-control" className="flex max-w-[280px] items-center gap-6">
            <input
              aria-label={copy.maxConcurrency}
              type="range"
              min="1"
              max="8"
              className="w-full h-1.5 rounded-full cursor-pointer"
              style={buildSliderStyle(formState.maxConcurrency, 1, 8)}
              value={formState.maxConcurrency}
              onChange={(event) => onMaxConcurrencyChange(Number(event.target.value))}
            />
          </div>
          <p className="mt-3 text-xs text-[#8D93A1] font-medium leading-relaxed opacity-70">
            建议设置为 CPU 核心数的一半（当前核心: 8），设置过高会导致系统卡顿。
          </p>
        </label>

        <label className="block">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-[#5D6472]">{copy.outputQuality}</span>
            <span className="text-xs font-bold text-meitu bg-meitu-light px-2.5 py-1 rounded-full tabular-nums">{formState.exportSettings.quality}%</span>
          </div>
          <div className="flex max-w-[280px] items-center gap-6">
            <input
              aria-label={copy.outputQuality}
              type="range"
              min="1"
              max="100"
              step="1"
              className="w-full h-1.5 rounded-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              style={buildSliderStyle(formState.exportSettings.quality, 1, 100)}
              value={formState.exportSettings.quality}
              disabled={isLoading}
              onChange={(event) => onOutputQualityChange(Number(event.target.value))}
            />
          </div>
        </label>
      </div>
      {/* Column 3: Language + Cache */}
      <div className="flex flex-col gap-8">
        <label className="block">
          <span className="text-sm font-bold text-[#5D6472]">{copy.language}</span>
          <div className="relative mt-3">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#8D93A1]">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
              </svg>
            </div>
            <select
              aria-label={copy.language}
              className="w-full h-10 rounded border border-border-light bg-[#FAFBFD] pl-10 pr-10 text-sm font-bold text-[#1A1D23] outline-none transition-all focus:border-meitu focus:ring-4 focus:ring-meitu/10 appearance-none cursor-pointer"
              disabled={isLoading}
              value={formState.language}
              onChange={(event) => onLanguageChange(event.target.value as PersistedSettings['language'])}
            >
              <option value="zh-CN">简体中文 (Simplified Chinese)</option>
              <option value="en-US">English (US)</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#8D93A1]">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </label>

        <div data-testid="settings-cache-card">
          <span className="block text-sm font-bold text-[#5D6472] mb-4">{copy.cacheTitle}</span>
          <div className="flex h-10 items-center justify-between gap-4 rounded border border-border-light bg-[#FAFBFD] px-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 text-meitu">
                <path d="M3.75 3A1.75 1.75 0 002 4.75v3.26a3.235 3.235 0 011.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75zM3.75 9A1.75 1.75 0 002 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-4.5A1.75 1.75 0 0016.25 9H3.75z" />
              </svg>
              <span className="text-sm font-bold text-meitu tabular-nums">{cacheSizeText}</span>
            </div>
            <button
              type="button"
              className="h-7 px-4 rounded border border-meitu bg-white text-[13px] font-bold text-meitu transition-all hover:bg-meitu-light active:scale-95 disabled:opacity-40"
              disabled={isClearingCache}
              onClick={onClearCache}
            >
              {copy.cleanCache}
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
);



