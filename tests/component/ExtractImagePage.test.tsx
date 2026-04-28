import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExtractImagePage from '../../src/pages/ExtractImagePage';

vi.mock('../../src/services/fileDialog', () => ({
  openExtractionDocuments: vi.fn(),
  chooseOutputDirectory: vi.fn()
}));

vi.mock('../../src/services/extractionCommands', () => ({
  inspectExtractionDocument: vi.fn(),
  extractDocumentImages: vi.fn()
}));

const { openExtractionDocuments, chooseOutputDirectory } = await import('../../src/services/fileDialog');
const { inspectExtractionDocument, extractDocumentImages } = await import('../../src/services/extractionCommands');

describe('ExtractImagePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(inspectExtractionDocument).mockResolvedValue({
      sourcePath: 'F:/Demo/产品手册.docx',
      sourceName: '产品手册.docx',
      extension: 'docx',
      embeddedImageCount: 3,
      pageCount: 8
    });
    vi.mocked(extractDocumentImages).mockResolvedValue({
      outputPaths: ['F:/Demo/out/产品手册_001.png', 'F:/Demo/out/产品手册_002.png'],
      extractedCount: 2,
      skippedCount: 1
    });
  });

  it('renders the image extraction workspace from the design', () => {
    render(<ExtractImagePage />);

    expect(screen.getByText('图片提取')).toBeInTheDocument();
    expect(screen.getByText('从 Word / PDF 文档中批量提取图片素材')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导入文档' })).toBeInTheDocument();
    expect(screen.getByText('拖拽或点击导入文档')).toBeInTheDocument();
    expect(screen.getByText('输出设置')).toBeInTheDocument();
    expect(screen.getByText('提取结果')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始提取' })).toBeDisabled();
  });

  it('imports documents and extracts images with selected output settings', async () => {
    const user = userEvent.setup();
    vi.mocked(openExtractionDocuments).mockResolvedValue(['F:/Demo/产品手册.docx']);
    vi.mocked(chooseOutputDirectory).mockResolvedValue('F:/Demo/out');

    render(<ExtractImagePage />);

    await user.click(screen.getByRole('button', { name: '导入文档' }));

    const documentList = await screen.findByRole('region', { name: '待提取文档' });
    expect(within(documentList).getByText('产品手册.docx')).toBeInTheDocument();
    expect(within(documentList).getByText('预计 3 张图片')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '选择目录' }));
    await user.selectOptions(screen.getByLabelText('导出格式'), 'jpg');
    await user.click(screen.getByRole('button', { name: '开始提取' }));

    await waitFor(() => {
      expect(extractDocumentImages).toHaveBeenCalledWith({
        sourcePath: 'F:/Demo/产品手册.docx',
        outputDirectory: 'F:/Demo/out',
        outputFormat: 'jpg',
        namingPattern: 'source-name-index'
      });
    });

    expect(await screen.findByText('已提取 2 张')).toBeInTheDocument();
    expect(screen.getByText('跳过 1 张')).toBeInTheDocument();
  });
});
