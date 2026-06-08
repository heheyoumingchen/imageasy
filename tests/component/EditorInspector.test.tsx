import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EditorInspector from '../../src/components/image-editor/EditorInspector';
import type { AdjustmentParams } from '../../src/types/editor';

const adjustments: AdjustmentParams = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  sharpen: 0,
  clarity: 0,
  quality: 90,
  filterType: 'none',
  filterIntensity: 0,
  rotation: 0,
  crop: null
};

describe('EditorInspector', () => {
  it('switches between basic adjustments and filter controls', async () => {
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
    expect(screen.getByRole('button', { name: '基础功能' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '滤镜' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('亮度')).toBeInTheDocument();
    expect(screen.getByLabelText('色温')).toBeInTheDocument();
    expect(screen.getByLabelText('色调')).toBeInTheDocument();
    expect(screen.getByText('压缩质量')).toBeInTheDocument();
    expect(screen.queryByLabelText('选择滤镜')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '滤镜' }));

    expect(screen.getByRole('button', { name: '基础功能' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '滤镜' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '无滤镜' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '经典黑白' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '暖阳气息' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清冷海洋' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复古胶片' })).toBeInTheDocument();
    expect(screen.getByLabelText('滤镜强度')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '暖阳气息' }));
    expect(onFilterChange).toHaveBeenCalledWith('warm');
  });
});
