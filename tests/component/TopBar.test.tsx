import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TopBar from '../../src/components/layout/TopBar';

const windowControls = vi.hoisted(() => ({
  minimize: vi.fn(),
  toggleMaximize: vi.fn(),
  close: vi.fn()
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => windowControls
}));

describe('TopBar', () => {
  it('keeps drag region off window buttons while still exposing a draggable title strip', async () => {
    const user = userEvent.setup();

    render(<TopBar />);

    const banner = screen.getByRole('banner');
    const brandLogo = screen.getByAltText('imageasy logo');
    expect(screen.getByText('imageasy').className).toContain('text-2xl');
    const minimizeButton = screen.getByRole('button', { name: '最小化' });
    const closeButton = screen.getByRole('button', { name: '关闭' });

    expect(brandLogo.getAttribute('src')).toBe('/brand/logo.png');
    expect(banner).toHaveAttribute('data-tauri-drag-region');
    expect(minimizeButton).not.toHaveAttribute('data-tauri-drag-region');
    expect(closeButton).not.toHaveAttribute('data-tauri-drag-region');

    await user.click(minimizeButton);
    await user.click(closeButton);

    expect(windowControls.minimize).toHaveBeenCalledTimes(1);
    expect(windowControls.close).toHaveBeenCalledTimes(1);
  });
});
