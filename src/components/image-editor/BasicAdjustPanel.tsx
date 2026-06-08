import type { CSSProperties } from 'react';
import type { AdjustmentKey, AdjustmentParams } from '../../types/editor';

type BasicAdjustPanelProps = {
  adjustments: AdjustmentParams;
  isEnglish?: boolean;
  onChange: (key: AdjustmentKey, value: number) => void;
};

const sliderClass =
  'mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full';

const buildSliderStyle = (value: number, min: number, max: number): CSSProperties => {
  const ratio = ((value - min) / (max - min)) * 100;
  return {
    background: `linear-gradient(90deg, #FF2D6C 0%, #FF2D6C ${ratio}%, #ECECF2 ${ratio}%, #ECECF2 100%)`
  };
};

const BasicAdjustPanel = ({ adjustments, isEnglish = false, onChange }: BasicAdjustPanelProps) => {
  const sections: Array<{
    title: string;
    items: Array<{ key: Exclude<AdjustmentKey, 'quality'>; label: string; min: number; max: number }>;
  }> = isEnglish
    ? [
        {
          title: 'Basic Adjustment',
          items: [
            { key: 'brightness', label: 'Brightness', min: -100, max: 100 },
            { key: 'contrast', label: 'Contrast', min: -100, max: 100 }
          ]
        },
        {
          title: 'Detail Enhancement',
          items: [
            { key: 'sharpen', label: 'Sharpen', min: -100, max: 100 },
            { key: 'clarity', label: 'Clarity', min: -100, max: 100 }
          ]
        },
        {
          title: 'Color Adjustment',
          items: [
            { key: 'saturation', label: 'Saturation', min: -100, max: 100 },
            { key: 'temperature', label: 'Temperature', min: -100, max: 100 },
            { key: 'tint', label: 'Tint', min: -100, max: 100 }
          ]
        }
      ]
    : [
        {
          title: '基础调整',
          items: [
            { key: 'brightness', label: '亮度', min: -100, max: 100 },
            { key: 'contrast', label: '对比度', min: -100, max: 100 }
          ]
        },
        {
          title: '细节增强',
          items: [
            { key: 'sharpen', label: '锐化', min: -100, max: 100 },
            { key: 'clarity', label: '清晰度', min: -100, max: 100 }
          ]
        },
        {
          title: '色彩调整',
          items: [
            { key: 'saturation', label: '饱和度', min: -100, max: 100 },
            { key: 'temperature', label: '色温', min: -100, max: 100 },
            { key: 'tint', label: '色调', min: -100, max: 100 }
          ]
        }
      ];

  const qualityLabel = isEnglish ? 'Quality' : '压缩质量';

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.title} className="space-y-3">
          <h3 className="text-xs font-bold text-[#1A1D23] uppercase tracking-wider opacity-60">
            {section.title}
          </h3>
          <div className="space-y-3">
            {section.items.map(({ key, label, min, max }) => (
              <label key={key} className="block group">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-[#5D6472] group-hover:text-meitu transition-colors">
                    {label}
                  </span>
                  <span className="text-[11px] font-bold tabular-nums text-meitu bg-meitu-light px-1.5 py-0.5 rounded">
                    {adjustments[key]}
                  </span>
                </div>
                <input
                  aria-label={label}
                  className={sliderClass}
                  style={buildSliderStyle(adjustments[key], min, max)}
                  type="range"
                  min={min}
                  max={max}
                  value={adjustments[key]}
                  onChange={(event) => onChange(key, Number(event.currentTarget.value))}
                />
              </label>
            ))}
          </div>
        </div>
      ))}

      <div>
        <label className="block group">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#5D6472] group-hover:text-meitu transition-colors">
              {qualityLabel}
            </span>
            <span className="text-[11px] font-bold tabular-nums text-meitu bg-meitu-light px-1.5 py-0.5 rounded">
              {adjustments.quality}%
            </span>
          </div>
          <input
            aria-label={qualityLabel}
            className={sliderClass}
            style={buildSliderStyle(adjustments.quality, 1, 100)}
            type="range"
            min={1}
            max={100}
            step={1}
            value={adjustments.quality}
            onChange={(event) => onChange('quality', Number(event.currentTarget.value))}
          />
        </label>
      </div>
    </div>
  );
};

export default BasicAdjustPanel;

