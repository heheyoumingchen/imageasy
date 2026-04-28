import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EditorInspector from '../../src/components/image-editor/EditorInspector';
import type { AdjustmentParams } from '../../src/types/editor';

const adjustments: AdjustmentParams = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpen: 0,
  clarity: 0,
  quality: 90,
  filterType: 'none',
  filterIntensity: 0,
  rotation: 0,
  crop: null
};

describe('EditorInspector', () => {
  it('renders the redesign adjustment panel in ordered sections and keeps filter controls visible', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onFilterChange = vi.fn();

    render(
      <EditorInspector
        adjustments={adjustments}
        onChange={onChange}
        onFilterChange={onFilterChange}
        onFilterIntensityChange={vi.fn()}
        onResetFilters={vi.fn()}
      />
    );

    expect(screen.getByRole('complementary', { name: '编辑调色面板' })).toBeInTheDocument();
    expect(screen.getByText('基础调整')).toBeInTheDocument();
    expect(screen.getByText('滤镜')).toBeInTheDocument();
    expect(screen.getByLabelText('亮度')).toBeInTheDocument();
    expect(screen.getByLabelText('压缩质量')).toBeInTheDocument();
    expect(screen.getByLabelText('滤镜类型')).toBeInTheDocument();
    expect(screen.getByLabelText('滤镜强度')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('滤镜类型'), 'warm');
    expect(onFilterChange).toHaveBeenCalledWith('warm');
  });
});
