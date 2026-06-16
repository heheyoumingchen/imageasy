import type { ConversionOutputSettings } from '../../types/conversion';

type ConversionSettingsPanelCopy = {
  panelLabel: string;
  panelTitle: string;
  pageRange: string;
  allPages: string;
  customPages: string;
  customPageRangeLabel: string;
};

type ConversionSettingsPanelProps = {
  copy: ConversionSettingsPanelCopy;
  settings: ConversionOutputSettings;
  disabled: boolean;
  // 页码范围仅对 PDF / PPT 等文档类生效；列表无文档时禁用。
  pageRangeEnabled: boolean;
  pageRangeHint: string;
  onChange: (partial: Partial<ConversionOutputSettings>) => void;
};

const pageRangeToggleClass =
  'flex h-10 items-center justify-center rounded-lg px-2 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50';

const ConversionSettingsPanel = ({ copy, settings, disabled, pageRangeEnabled, pageRangeHint, onChange }: ConversionSettingsPanelProps) => {
  const controlsDisabled = disabled || !pageRangeEnabled;
  return (
    <aside aria-label={copy.panelLabel} className="px-5 py-4 border-b border-border-light/60">
      <div className="flex items-center gap-4">
        <h2 className="shrink-0 text-sm font-bold text-[#1A1D23] flex items-center gap-2">
          <div className="w-1.5 h-5 bg-meitu rounded-full" />
          {copy.panelTitle}
        </h2>
        <div data-testid="page-range-row" className="grid grid-cols-[96px_96px_minmax(0,1fr)] items-center gap-2 flex-1">
          <button
            type="button"
            className={`${pageRangeToggleClass} ${settings.pageRangeMode === 'all' ? 'bg-meitu-light text-meitu' : 'bg-transparent text-[#8D93A1] hover:bg-[#FAFBFD] hover:text-[#515867]'}`}
            onClick={() => onChange({ pageRangeMode: 'all', pageRangeText: '' })}
            disabled={controlsDisabled}
          >
            {copy.allPages}
          </button>
          <button
            type="button"
            className={`${pageRangeToggleClass} ${settings.pageRangeMode === 'custom' ? 'bg-meitu-light text-meitu' : 'bg-transparent text-[#8D93A1] hover:bg-[#FAFBFD] hover:text-[#515867]'}`}
            onClick={() => onChange({ pageRangeMode: 'custom' })}
            disabled={controlsDisabled}
          >
            {copy.customPages}
          </button>
          <input
            aria-label={`${copy.customPageRangeLabel}输入`}
            className="min-w-0 w-full h-10 rounded-lg border border-border-light bg-[#FAFBFD] px-4 text-sm font-bold text-[#1A1D23] outline-none focus:border-meitu focus:ring-4 focus:ring-meitu/10 disabled:cursor-not-allowed disabled:opacity-50"
            type="text"
            placeholder={pageRangeEnabled ? '例如: 1-5, 8, 11-13' : pageRangeHint}
            value={settings.pageRangeText}
            disabled={controlsDisabled || settings.pageRangeMode !== 'custom'}
            onChange={(event) => onChange({ pageRangeText: event.target.value })}
          />
        </div>
      </div>
    </aside>
  );
};

export default ConversionSettingsPanel;
