import type { ConversionColorMode, ConversionOutputFormat, ConversionOutputSettings } from '../../types/conversion';

type ConversionSettingsPanelProps = {
  settings: ConversionOutputSettings;
  onChange: (partial: Partial<ConversionOutputSettings>) => void;
};

const fieldClass = 'mt-2 h-10 w-full rounded-[14px] border border-[#ececf2] bg-[#fafafd] px-3 text-sm text-[#424854]';

const ConversionSettingsPanel = ({ settings, onChange }: ConversionSettingsPanelProps) => {
  return (
    <aside aria-label="转换设置区" className="rounded-[20px] border border-[#ececf2] bg-[#f9f9fc] p-4">
      <label className="block text-sm text-[#5d6472]">
        输出格式
        <select
          className={fieldClass}
          value={settings.outputFormat}
          onChange={(event) => onChange({ outputFormat: event.target.value as ConversionOutputFormat })}
        >
          <option value="jpg">JPG</option>
          <option value="png">PNG</option>
          <option value="webp">WebP</option>
        </select>
      </label>
      <label className="mt-3 block text-sm text-[#5d6472]">
        输出色彩方案
        <select
          className={fieldClass}
          value={settings.colorMode}
          onChange={(event) => onChange({ colorMode: event.target.value as ConversionColorMode })}
        >
          <option value="rgb">RGB</option>
          <option value="cmyk">CMYK</option>
          <option value="gray-cmyk">灰度 CMYK</option>
        </select>
      </label>
      <label className="mt-3 flex items-center gap-2 text-sm text-[#5d6472]">
        <input
          type="radio"
          name="page-range-mode"
          checked={settings.pageRangeMode === 'all'}
          onChange={() => onChange({ pageRangeMode: 'all', pageRangeText: '' })}
        />
        全部页
      </label>
      <label className="mt-2 flex items-center gap-2 text-sm text-[#5d6472]">
        <input
          aria-label="指定页码范围"
          type="radio"
          name="page-range-mode"
          checked={settings.pageRangeMode === 'custom'}
          onChange={() => onChange({ pageRangeMode: 'custom', pageRangeText: '' })}
        />
        指定范围
      </label>
      <input
        aria-label="页码范围"
        className={fieldClass}
        type="text"
        value={settings.pageRangeText}
        disabled={settings.pageRangeMode === 'all'}
        onChange={(event) => onChange({ pageRangeText: event.target.value })}
      />
    </aside>
  );
};

export default ConversionSettingsPanel;
