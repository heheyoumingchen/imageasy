import type { AdjustmentParams } from '../types/editor';

/**
 * 将编辑器全部调整参数转换为 CSS filter 字符串，实现实时预览。
 * 借鉴美图秀秀方案：原图直显 + CSS filter 实时调整，保存时才走精确渲染。
 *
 * 支持的映射：
 * - brightness: CSS brightness() — 范围 0~2, 1=不变
 * - contrast: CSS contrast() — 范围 0~2, 1=不变
 * - saturation: CSS saturate() — 范围 0~2, 1=不变
 * - temperature: sepia + hue-rotate 近似暖色调
 * - sharpen: 用 contrast 微调近似（CSS 无原生锐化）
 * - clarity: 用 contrast 微调近似
 * - filter presets: grayscale/sepia/hue-rotate/saturate 组合
 */
export function adjustmentsToCssFilter(adjustments: AdjustmentParams): string | undefined {
  const parts: string[] = [];

  // 亮度: Rust 范围 -100..100 → CSS 0.0..2.0
  if (adjustments.brightness !== 0) {
    parts.push(`brightness(${(1 + adjustments.brightness / 100).toFixed(3)})`);
  }

  // 对比度: Rust 范围 -100..100 → CSS 0.0..2.0
  const contrastBase = adjustments.contrast;
  // 锐化和清晰度用微量对比度近似
  const sharpContrast = adjustments.sharpen * 0.08 + adjustments.clarity * 0.06;
  const totalContrast = contrastBase + sharpContrast;
  if (Math.abs(totalContrast) > 0.1) {
    parts.push(`contrast(${(1 + totalContrast / 100).toFixed(3)})`);
  }

  // 饱和度: Rust 范围 -100..100 → CSS 0.0..2.0
  if (adjustments.saturation !== 0) {
    parts.push(`saturate(${(1 + adjustments.saturation / 100).toFixed(3)})`);
  }

  // 色温: 正值偏暖（加黄/红），负值偏冷（加蓝）
  if (adjustments.temperature !== 0) {
    const temp = adjustments.temperature / 100; // -1 ~ 1
    if (temp > 0) {
      // 暖色：sepia 叠加 + hue-rotate 微调
      parts.push(`sepia(${(temp * 0.25).toFixed(3)})`);
      parts.push(`hue-rotate(${(-temp * 10).toFixed(1)}deg)`);
    } else {
      // 冷色：hue-rotate 偏蓝
      parts.push(`hue-rotate(${(-temp * 15).toFixed(1)}deg)`);
    }
  }

  // 色调偏移
  if (adjustments.tint !== 0) {
    parts.push(`hue-rotate(${(adjustments.tint * 0.15).toFixed(1)}deg)`);
  }

  // 滤镜预设
  const filterParts = filterPresetToCss(adjustments.filterType, adjustments.filterIntensity / 100);
  if (filterParts) {
    parts.push(filterParts);
  }

  return parts.length > 0 ? parts.join(' ') : undefined;
}

/**
 * 将滤镜预设转换为 CSS filter 近似。
 */
function filterPresetToCss(filterType: string, intensity: number): string | undefined {
  if (filterType === 'none' || intensity <= 0) return undefined;

  const i = Math.min(intensity, 1);

  switch (filterType) {
    case 'grayscale':
      return `grayscale(${i.toFixed(2)})`;
    case 'sepia':
      return `sepia(${i.toFixed(2)})`;
    case 'warm':
      return `sepia(${(i * 0.2).toFixed(3)}) saturate(${(1 + i * 0.2).toFixed(2)}) hue-rotate(${(-i * 15).toFixed(1)}deg)`;
    case 'cool':
      return `hue-rotate(${(i * 20).toFixed(1)}deg) saturate(${(1 - i * 0.1).toFixed(2)})`;
    case 'vintage':
      return `sepia(${(i * 0.35).toFixed(3)}) contrast(${(1 + i * 0.1).toFixed(2)}) saturate(${(1 - i * 0.2).toFixed(2)})`;
    case 'vivid':
      return `saturate(${(1 + i * 0.5).toFixed(2)}) contrast(${(1 + i * 0.15).toFixed(2)})`;
    case 'fade':
      return `brightness(${(1 + i * 0.12).toFixed(3)}) contrast(${(1 - i * 0.15).toFixed(3)}) saturate(${(1 - i * 0.25).toFixed(3)})`;
    case 'cinematic':
      return `sepia(${(i * 0.1).toFixed(3)}) contrast(${(1 + i * 0.12).toFixed(3)}) hue-rotate(${(-i * 8).toFixed(1)}deg)`;
    case 'noir':
      return `grayscale(${i.toFixed(2)}) contrast(${(1 + i * 0.25).toFixed(2)})`;
    case 'polaroid':
      return `sepia(${(i * 0.15).toFixed(3)}) brightness(${(1 + i * 0.06).toFixed(3)}) saturate(${(1 - i * 0.15).toFixed(3)})`;
    case 'dreamy':
      return `brightness(${(1 + i * 0.1).toFixed(3)}) contrast(${(1 - i * 0.08).toFixed(3)}) hue-rotate(${(i * 10).toFixed(1)}deg)`;
    case 'summer':
      return `sepia(${(i * 0.12).toFixed(3)}) saturate(${(1 + i * 0.2).toFixed(2)}) hue-rotate(${(-i * 10).toFixed(1)}deg)`;
    case 'forest':
      return `saturate(${(1 - i * 0.1).toFixed(3)}) hue-rotate(${(i * 25).toFixed(1)}deg)`;
    default:
      return undefined;
  }
}

/**
 * 将旋转参数转换为 CSS transform（旋转不是 filter，单独处理）。
 */
export function adjustmentsToTransform(rotation: number): string | undefined {
  const deg = rotation % 360;
  return deg !== 0 ? `rotate(${deg}deg)` : undefined;
}
