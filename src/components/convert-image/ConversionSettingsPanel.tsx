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
  onChange: (partial: Partial<ConversionOutputSettings>) => void;
};

const pageRangeToggleClass =
  'flex h-10 items-center justify-center rounded-lg px-2 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50';

const ConversionSettingsPanel = ({ copy, settings, disabled, onChange }: ConversionSettingsPanelProps) => {
  return (
    <aside aria-label={copy.panelLabel} className="rounded border border-border-light bg-white p-5 overflow-hidden">
      <h2 className="text-lg font-bold text-[#1A1D23] mb-5 flex items-center gap-3">
        <div className="w-1.5 h-6 bg-meitu rounded-full" />
        {copy.panelTitle}
      </h2>
      <div className="space-y-4">
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
