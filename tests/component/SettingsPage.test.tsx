import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import SettingsPage from '../../src/pages/SettingsPage';
import { SETTINGS_STORAGE_KEY } from '../../src/stores/settingsStore';

describe('SettingsPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('updates max concurrency and remember-last-params flag', async () => {
    const user = userEvent.setup();

    render(<SettingsPage />);

    const maxConcurrencyInput = screen.getByLabelText('最大并发任务数');
    const rememberCheckbox = screen.getByLabelText('记住上次参数');

    await user.clear(maxConcurrencyInput);
    await user.type(maxConcurrencyInput, '4');
    await user.click(rememberCheckbox);

    expect(screen.getByDisplayValue('4')).toBeInTheDocument();
    expect(screen.getByLabelText('记住上次参数')).toBeChecked();
    expect(window.localStorage.getItem(SETTINGS_STORAGE_KEY)).toContain('"maxConcurrency":4');
    expect(window.localStorage.getItem(SETTINGS_STORAGE_KEY)).toContain('"rememberLastParams":true');
  });

  it('renders output directory strategy options', () => {
    render(<SettingsPage />);

    expect(screen.getByLabelText('默认输出目录策略')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '与原图同目录' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '自定义目录（P1 接入）' })).toBeInTheDocument();
  });
});
