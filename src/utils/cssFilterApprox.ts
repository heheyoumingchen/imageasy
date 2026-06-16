import type { AdjustmentParams } from '../types/editor';

/**
 * 根据"已渲染基准"和"当前目标"参数的差值，生成近似 CSS filter 字符串。
 * 用于滑块拖动时的即时视觉反馈，Rust 精确渲染完成后清除。
 *
 * CSS filter 只能近似 brightness/contrast/saturation 三个维度：
 * - brightness(): 1.0 = 不变。Rust 范围 -100..100 映射到 CSS 0.0..2.0。
 * - contrast(): 1.0 = 不变。Rust 范围 -100..100 映射到 CSS 0.0..2.0。
 * - saturate(): 1.0 = 不变。Rust 范围 -100..100 映射到 CSS 0.0..2.0。
 */
export function computeCssFilterDelta(
  rendered: AdjustmentParams,
  target: AdjustmentParams
): string | undefined {
  const brightnessDelta = target.brightness - rendered.brightness;
  const contrastDelta = target.contrast - rendered.contrast;
  const saturationDelta = target.saturation - rendered.saturation;

  // 无差值则无需 CSS filter
  if (brightnessDelta === 0 && contrastDelta === 0 && saturationDelta === 0) {
    return undefined;
  }

  const parts: string[] = [];

  if (brightnessDelta !== 0) {
    // Rust brightness range is roughly -100..100 (though technically -255..255 for adjust_contrast)
    // CSS brightness: 1.0 = identity, 0 = black, 2 = double
    const cssBrightness = 1.0 + brightnessDelta / 100;
    parts.push(`brightness(${cssBrightness.toFixed(3)})`);
  }

  if (contrastDelta !== 0) {
    // CSS contrast: 1.0 = identity
    const cssContrast = 1.0 + contrastDelta / 100;
    parts.push(`contrast(${cssContrast.toFixed(3)})`);
  }

  if (saturationDelta !== 0) {
    // CSS saturate: 1.0 = identity
    const cssSaturate = 1.0 + saturationDelta / 100;
    parts.push(`saturate(${cssSaturate.toFixed(3)})`);
  }

  return parts.join(' ');
}
