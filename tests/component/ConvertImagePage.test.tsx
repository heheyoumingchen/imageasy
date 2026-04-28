import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConvertImagePage from '../../src/pages/ConvertImagePage';
import { useConversionStore } from '../../src/stores/conversionStore';

vi.mock('../../src/services/fileDialog', () => ({
  openConversionFiles: vi.fn(),
  openConversionDirectory: vi.fn(),
  chooseOutputDirectory: vi.fn()
}));

vi.mock('../../src/services/conversionCommands', () => ({
  inspectConversionFile: vi.fn(),
  inspectConversionDirectory: vi.fn(),
  convertImageFile: vi.fn(),
  renderDocumentToImages: vi.fn()
}));

const { openConversionFiles } = await import('../../src/services/fileDialog');
const { inspectConversionFile, convertImageFile, renderDocumentToImages } = await import('../../src/services/conversionCommands');

describe('ConvertImagePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConversionStore.getState().reset();
  });

  it('imports mixed files and renders unified list entries', async () => {
    const user = userEvent.setup();
    vi.mocked(openConversionFiles).mockResolvedValue(['F:/demo/a.jpg', 'F:/demo/b.pdf']);
    vi.mocked(inspectConversionFile)
      .mockResolvedValueOnce({
        kind: 'image',
        sourcePath: 'F:/demo/a.jpg',
        sourceName: 'a.jpg',
        imageMetadata: { width: 800, height: 600, extension: 'jpg' },
        documentMetadata: null,
        errorMessage: null
      })
      .mockResolvedValueOnce({
        kind: 'document',
        sourcePath: 'F:/demo/b.pdf',
        sourceName: 'b.pdf',
        imageMetadata: null,
        documentMetadata: { pageCount: 12, extension: 'pdf' },
        errorMessage: null
      });

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '导入文件' }));

    expect(await screen.findByText('a.jpg')).toBeInTheDocument();
    expect(screen.getByText('b.pdf')).toBeInTheDocument();
    expect(screen.getByText('JPG / RGB')).toBeInTheDocument();
    expect(screen.getByText('JPG / RGB / 全部页')).toBeInTheDocument();
  });

  it('applies global output settings to document summaries', async () => {
    const user = userEvent.setup();
    vi.mocked(openConversionFiles).mockResolvedValue(['F:/demo/b.pdf']);
    vi.mocked(inspectConversionFile).mockResolvedValue({
      kind: 'document',
      sourcePath: 'F:/demo/b.pdf',
      sourceName: 'b.pdf',
      imageMetadata: null,
      documentMetadata: { pageCount: 12, extension: 'pdf' },
      errorMessage: null
    });

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '导入文件' }));
    await user.selectOptions(screen.getByLabelText('输出格式'), 'png');
    await user.selectOptions(screen.getByLabelText('输出色彩方案'), 'gray-cmyk');

    expect(await screen.findByText('PNG / 灰度 CMYK / 全部页')).toBeInTheDocument();
  });

  it('starts mixed conversion and updates the batch status', async () => {
    const user = userEvent.setup();
    vi.mocked(openConversionFiles).mockResolvedValue(['F:/demo/a.jpg', 'F:/demo/b.pdf']);
    vi.mocked(inspectConversionFile)
      .mockResolvedValueOnce({
        kind: 'image',
        sourcePath: 'F:/demo/a.jpg',
        sourceName: 'a.jpg',
        imageMetadata: { width: 800, height: 600, extension: 'jpg' },
        documentMetadata: null,
        errorMessage: null
      })
      .mockResolvedValueOnce({
        kind: 'document',
        sourcePath: 'F:/demo/b.pdf',
        sourceName: 'b.pdf',
        imageMetadata: null,
        documentMetadata: { pageCount: 3, extension: 'pdf' },
        errorMessage: null
      });
    vi.mocked(convertImageFile).mockResolvedValue(['F:/out/a.jpg']);
    vi.mocked(renderDocumentToImages).mockResolvedValue(['F:/out/b_001.jpg', 'F:/out/b_002.jpg', 'F:/out/b_003.jpg']);

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '导入文件' }));
    await user.click(await screen.findByRole('button', { name: '开始转换' }));

    const status = await screen.findByRole('contentinfo');
    await waitFor(() => {
      expect(within(status).getByText('成功 2')).toBeInTheDocument();
      expect(within(status).getByText('失败 0')).toBeInTheDocument();
    });
  });

  it('blocks document conversion when the custom page range is invalid', async () => {
    const user = userEvent.setup();
    vi.mocked(openConversionFiles).mockResolvedValue(['F:/demo/b.pdf']);
    vi.mocked(inspectConversionFile).mockResolvedValue({
      kind: 'document',
      sourcePath: 'F:/demo/b.pdf',
      sourceName: 'b.pdf',
      imageMetadata: null,
      documentMetadata: { pageCount: 3, extension: 'pdf' },
      errorMessage: null
    });

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '导入文件' }));
    await user.click(await screen.findByLabelText('指定页码范围'));
    await user.type(screen.getByLabelText('页码范围'), '5');
    await user.click(screen.getByRole('button', { name: '开始转换' }));

    expect(await screen.findByText('页码超出文档总页数')).toBeInTheDocument();
  });

  it('marks only the failing item when one command rejects', async () => {
    const user = userEvent.setup();
    vi.mocked(openConversionFiles).mockResolvedValue(['F:/demo/a.jpg', 'F:/demo/b.pdf']);
    vi.mocked(inspectConversionFile)
      .mockResolvedValueOnce({
        kind: 'image',
        sourcePath: 'F:/demo/a.jpg',
        sourceName: 'a.jpg',
        imageMetadata: { width: 800, height: 600, extension: 'jpg' },
        documentMetadata: null,
        errorMessage: null
      })
      .mockResolvedValueOnce({
        kind: 'document',
        sourcePath: 'F:/demo/b.pdf',
        sourceName: 'b.pdf',
        imageMetadata: null,
        documentMetadata: { pageCount: 3, extension: 'pdf' },
        errorMessage: null
      });
    vi.mocked(convertImageFile).mockResolvedValue(['F:/out/a.jpg']);
    vi.mocked(renderDocumentToImages).mockRejectedValue(new Error('PDF_RENDERER_NOT_AVAILABLE'));

    render(<ConvertImagePage />);
    await user.click(screen.getByRole('button', { name: '导入文件' }));
    await user.click(await screen.findByRole('button', { name: '开始转换' }));

    await waitFor(() => {
      expect(screen.getByText('PDF_RENDERER_NOT_AVAILABLE')).toBeInTheDocument();
      expect(screen.getByText('成功 1')).toBeInTheDocument();
      expect(screen.getByText('失败 1')).toBeInTheDocument();
    });
  });
});
