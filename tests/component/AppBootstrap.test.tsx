import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';

describe('App bootstrap', () => {
  it('renders the redesign shell with image editor selected by default', () => {
    render(<App />);

    const nav = screen.getByRole('navigation', { name: '主导航' });
    expect(within(nav).getByRole('button', { name: '图片编辑' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('button', { name: '转换图片' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: '提取图片' })).toBeInTheDocument();
    expect(within(nav).queryByRole('button', { name: '任务中心' })).not.toBeInTheDocument();

    const topChrome = screen.getByRole('banner');
    expect(within(topChrome).getByText('美图秀秀')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '图片编辑主舞台' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: '编辑调色面板' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('switches to the unified conversion workbench from navigation', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '转换图片' }));

    expect(screen.getByRole('button', { name: '导入文件' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导入文件夹' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始转换' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: '转换设置区' })).toBeInTheDocument();
  });
});
