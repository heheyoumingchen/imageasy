import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BasicAdjustPanel from '../../src/components/image-editor/BasicAdjustPanel';
import type { AdjustmentParams } from '../../src/types/editor';

const adjustments: AdjustmentParams = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  sharpen: 0,
  clarity: 0,
  quality: 100,
  filterType: 'none',
  filterIntensity: 0,
  rotation: 0,
  crop: null
};

describe('BasicAdjustPanel', () => {
  it('renders sliders with visible color progress styling', () => {
    render(<BasicAdjustPanel adjustments={adjustments} onChange={vi.fn()} />);

    const brightnessSlider = screen.getByLabelText('亮度');
    const qualitySlider = screen.getByLabelText('压缩质量');

    expect(brightnessSlider.getAttribute('style')).toContain('linear-gradient');
    expect(qualitySlider.getAttribute('style')).toContain('linear-gradient');
  });
});
