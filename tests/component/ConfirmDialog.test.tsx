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
        message="确认切换吗"
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
        message="确认切换吗"
        confirmLabel="确认"
        cancelLabel="取消"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText('存在未保存修改')).toBeInTheDocument();
    expect(screen.getByText('确认切换吗')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '取消' }));
    await user.click(screen.getByRole('button', { name: '确认' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
