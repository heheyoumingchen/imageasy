import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ConfirmDialog from '../../src/components/feedback/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('does not render when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        title="存在未保存修改"
        confirmLabel="确认"
        cancelLabel="取消"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />
    );

    expect(screen.queryByText('存在未保存修改')).not.toBeInTheDocument();
  });

  it('renders content and triggers handlers when open', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open
        title="存在未保存修改"
        confirmLabel="确认"
        cancelLabel="取消"
        onConfirm={onConfirm}
        onCancel={onCancel}
      >
        <p className="mt-3 text-sm text-[#515867]">确认切换吗</p>
      </ConfirmDialog>
    );

    expect(screen.getByText('存在未保存修改')).toBeInTheDocument();
    expect(screen.getByText('确认切换吗')).toBeInTheDocument();

    const overlay = screen.getByRole('dialog', { name: '存在未保存修改' }).parentElement;
    expect(overlay?.className).not.toContain('bg-black/60');
    expect(screen.getByRole('dialog', { name: '存在未保存修改' }).className).toContain('bg-white');
    expect(screen.getByRole('button', { name: '确认' }).className).toContain('bg-meitu');

    await user.click(screen.getByRole('button', { name: '取消' }));
    await user.click(screen.getByRole('button', { name: '确认' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
