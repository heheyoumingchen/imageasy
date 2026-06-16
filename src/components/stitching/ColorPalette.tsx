import { useState } from 'react';

type Props = {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

const PRESET_COLORS = [
  { name: 'transparent', value: 'transparent', display: '#FFFFFF' },
  { name: 'white', value: '#FFFFFF', display: '#FFFFFF' },
  { name: 'black', value: '#000000', display: '#000000' },
  { name: 'blue', value: '#3B82F6', display: '#3B82F6' },
  { name: 'green', value: '#10B981', display: '#10B981' },
  { name: 'orange', value: '#F97316', display: '#F97316' },
  { name: 'yellow', value: '#FBBF24', display: '#FBBF24' }
];

// 自定义取色圆圈使用多彩渐变，提示可任选颜色。
const RAINBOW_GRADIENT = 'conic-gradient(from 0deg, #FF2D6C, #F97316, #FBBF24, #10B981, #3B82F6, #A855F7, #FF2D6C)';

const ColorPalette = ({ label, value, disabled = false, onChange }: Props) => {
  const [customColor, setCustomColor] = useState(value);

  const isCustomColor = !PRESET_COLORS.some((color) => color.value === value);

  const handlePresetClick = (colorValue: string) => {
    if (!disabled) {
      onChange(colorValue);
    }
  };

  const handleCustomChange = (newColor: string) => {
    setCustomColor(newColor);
    onChange(newColor);
  };

  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <span className="text-[13px] font-bold text-[#5D6472] uppercase tracking-wider opacity-60">{label}</span>
      {/* 预设色与自定义取色统一靠右显示 */}
      <div className="ml-auto flex items-center gap-1.5">
        {PRESET_COLORS.map((color) => (
          <button
            key={color.name}
            type="button"
            disabled={disabled}
            onClick={() => handlePresetClick(color.value)}
            className={`relative w-5 h-5 rounded-full border transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
              value === color.value ? 'border-meitu ring-1 ring-meitu scale-110' : 'border-border-light hover:scale-110'
            } ${color.name === 'transparent' ? 'bg-white' : ''}`}
            style={{ backgroundColor: color.name === 'transparent' ? 'transparent' : color.display }}
            aria-label={color.name}
          >
            {color.name === 'transparent' && (
              <div className="absolute inset-0 rounded-full overflow-hidden">
                <div className="absolute inset-0" style={{
                  backgroundImage: 'linear-gradient(45deg, #E8EAF0 25%, transparent 25%), linear-gradient(-45deg, #E8EAF0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #E8EAF0 75%), linear-gradient(-45deg, transparent 75%, #E8EAF0 75%)',
                  backgroundSize: '6px 6px',
                  backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0px'
                }} />
              </div>
            )}
          </button>
        ))}
        {/* 自定义取色：多彩圆圈，点击选色 */}
        <label
          className={`relative block w-5 h-5 rounded-full transition-all ${
            isCustomColor ? 'ring-2 ring-meitu ring-offset-1 scale-110' : 'ring-1 ring-border-light hover:scale-110'
          } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
          title={isCustomColor ? value : undefined}
        >
          <input
            type="color"
            value={customColor}
            disabled={disabled}
            onChange={(e) => handleCustomChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <span
            className="block w-full h-full rounded-full"
            style={{ background: isCustomColor ? value : RAINBOW_GRADIENT }}
          />
        </label>
      </div>
    </div>
  );
};

export default ColorPalette;
