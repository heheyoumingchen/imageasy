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
    <div className="block">
      <span className="text-[13px] font-bold text-[#5D6472] uppercase tracking-wider opacity-60">{label}</span>
      <div className="mt-3 flex items-center gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color.name}
            type="button"
            disabled={disabled}
            onClick={() => handlePresetClick(color.value)}
            className={`relative w-10 h-10 rounded-full border-2 transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
              value === color.value ? 'border-meitu scale-110' : 'border-border-light hover:scale-105'
            } ${color.name === 'transparent' ? 'bg-white' : ''}`}
            style={{ backgroundColor: color.name === 'transparent' ? 'transparent' : color.display }}
            aria-label={color.name}
          >
            {color.name === 'transparent' && (
              <div className="absolute inset-0 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-transparent" style={{
                  backgroundImage: 'linear-gradient(45deg, #E8EAF0 25%, transparent 25%), linear-gradient(-45deg, #E8EAF0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #E8EAF0 75%), linear-gradient(-45deg, transparent 75%, #E8EAF0 75%)',
                  backgroundSize: '8px 8px',
                  backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px'
                }} />
              </div>
            )}
          </button>
        ))}

        {/* 自定义取色器 */}
        <label className={`relative w-10 h-10 rounded-full border-2 cursor-pointer transition-all ${
          isCustomColor ? 'border-meitu scale-110' : 'border-border-light hover:scale-105'
        } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
          <input
            type="color"
            value={customColor}
            disabled={disabled}
            onChange={(e) => handleCustomChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <div
            className="w-full h-full rounded-full"
            style={{ backgroundColor: isCustomColor ? value : customColor }}
          />
        </label>
      </div>
    </div>
  );
};

export default ColorPalette;
