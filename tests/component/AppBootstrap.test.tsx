import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';

describe('App bootstrap', () => {
  it('renders product name and default workspace shell', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: '图片批量处理助手' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '图片编辑' })).toBeInTheDocument();
    expect(screen.getByText('图片预览区')).toBeInTheDocument();
  });

  it('switches to stable placeholder pages from navigation', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /转换图片/i }));

    expect(screen.getByText('稳定入口已就绪')).toBeInTheDocument();
    expect(screen.getByText('后续接入 PDF、PPT、Word 批量转图片能力，本轮先保留稳定页面入口与布局位置。')).toBeInTheDocument();
  });
});
