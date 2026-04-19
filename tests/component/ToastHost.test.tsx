import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ToastHost from '../../src/components/feedback/ToastHost';

describe('ToastHost', () => {
  it('renders toast messages', () => {
    render(
      <ToastHost
        toasts={[
          { id: 'toast-1', message: '保存成功', tone: 'success' },
          { id: 'toast-2', message: '保存失败', tone: 'error' }
        ]}
      />
    );

    expect(screen.getByText('保存成功')).toBeInTheDocument();
    expect(screen.getByText('保存失败')).toBeInTheDocument();
  });
});
