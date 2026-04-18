import type { AdjustmentParams } from '../../types/editor';

type BasicAdjustPanelProps = {
  adjustments: AdjustmentParams;
  onChange: (key: keyof AdjustmentParams, value: number) => void;
};

const sliderClass = 'mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800';

const BasicAdjustPanel = ({ adjustments, onChange }: BasicAdjustPanelProps) => {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
      <h3 className="text-lg font-semibold text-slate-50">基础调整</h3>
      <div className="mt-4 space-y-4">
        {(Object.entries(adjustments) as Array<[keyof AdjustmentParams, number]>).map(([key, value]) => (
          <label key={key} className="block">
            <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
              <span>{key === 'brightness' ? '亮度' : key === 'contrast' ? '对比度' : '饱和度'}</span>
              <span>{value}</span>
            </div>
            <input
              aria-label={key}
              className={sliderClass}
              type="range"
              min={-100}
              max={100}
              value={value}
              onChange={(event) => onChange(key, Number(event.currentTarget.value))}
            />
          </label>
        ))}
      </div>
    </div>
  );
};

export default BasicAdjustPanel;
