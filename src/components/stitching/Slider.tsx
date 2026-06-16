import type { CSSProperties } from 'react';

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
};

// 滑过区域填充品牌色，未滑过区域保持浅灰，与设置页滑杆视觉一致。
const buildTrackStyle = (value: number, min: number, max: number): CSSProperties => {
  const ratio = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return {
    background: `linear-gradient(90deg, #FF2D6C 0%, #FF2D6C ${ratio}%, #E8EAF0 ${ratio}%, #E8EAF0 100%)`
  };
};

const Slider = ({ label, value, min, max, unit = 'px', disabled = false, onChange }: Props) => {
  return (
    <label className="block">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-[#5D6472] uppercase tracking-wider opacity-60">{label}</span>
        <span className="text-sm font-bold text-[#1A1D23]">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={buildTrackStyle(value, min, max)}
        className="mt-2 w-full h-2 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-meitu [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:active:scale-95 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-meitu [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:hover:scale-110 [&::-moz-range-thumb]:active:scale-95"
      />
    </label>
  );
};

export default Slider;
