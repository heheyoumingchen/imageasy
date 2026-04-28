import type { AdjustmentKey, AdjustmentParams } from '../../types/editor';

type BasicAdjustPanelProps = {
  adjustments: AdjustmentParams;
  onChange: (key: AdjustmentKey, value: number) => void;
};

const sliderClass =
  'mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[linear-gradient(90deg,#ffbfd4_0%,#f0eef7_100%)] accent-[#ff4f8f]';

const sliderEntries: Array<{ key: Exclude<AdjustmentKey, 'quality'>; label: string }> = [
  { key: 'brightness', label: '亮度' },
  { key: 'contrast', label: '对比度' },
  { key: 'saturation', label: '饱和度' },
  { key: 'sharpen', label: '锐化' },
  { key: 'clarity', label: '清晰度' }
];

const BasicAdjustPanel = ({ adjustments, onChange }: BasicAdjustPanelProps) => {
  return (
    <div className="space-y-3 bg-transparent p-0">
      {sliderEntries.map(({ key, label }) => (
        <label key={key} className="block text-[13px] text-[#5d6472]">
          <div className="mb-1.5 grid grid-cols-[1fr_36px] items-center gap-3">
            <span>{label}</span>
            <span className="text-right tabular-nums text-[#a0a6b2]">{adjustments[key]}</span>
          </div>
          <input
            aria-label={label}
            className={sliderClass}
            type="range"
            min={-100}
            max={100}
            value={adjustments[key]}
            onChange={(event) => onChange(key, Number(event.currentTarget.value))}
          />
        </label>
      ))}
      <label className="block text-[13px] text-[#5d6472]">
        <div className="mb-1.5 grid grid-cols-[1fr_36px] items-center gap-3">
          <span>压缩质量</span>
          <span className="text-right tabular-nums text-[#a0a6b2]">{adjustments.quality}</span>
        </div>
        <input
          aria-label="压缩质量"
          className={sliderClass}
          type="range"
          min={1}
          max={100}
          step={1}
          value={adjustments.quality}
          onChange={(event) => onChange('quality', Number(event.currentTarget.value))}
        />
      </label>
    </div>
  );
};

export default BasicAdjustPanel;
