import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UnsavedChangeDialog from '../../src/components/image-editor/UnsavedChangeDialog';

describe('UnsavedChangeDialog', () => {
  it('uses the theme red style for switching without saving', () => {
    render(<UnsavedChangeDialog open onCancel={vi.fn()} onConfirm={vi.fn()} />);

    const confirmButton = screen.getByRole('button', { name: '不保存并切换' });
    expect(confirmButton.className).toContain('bg-meitu');
    expect(confirmButton.className).not.toContain('linear-gradient');
  });
});
