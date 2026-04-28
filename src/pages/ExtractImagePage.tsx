import { useState } from 'react';
import { extractDocumentImages, inspectExtractionDocument } from '../services/extractionCommands';
import { chooseOutputDirectory, openExtractionDocuments } from '../services/fileDialog';
import type { ExtractionDocumentInfo, ExtractionOutputFormat } from '../types/extraction';

type ExtractionItem = ExtractionDocumentInfo & {
  status: 'ready' | 'running' | 'success' | 'failed';
  extractedCount: number;
  skippedCount: number;
  outputPaths: string[];
  errorMessage: string | null;
};

const sourceName = (path: string) => path.replace(/\\/g, '/').split('/').pop() ?? path;

const fallbackDocumentInfo = (path: string): ExtractionDocumentInfo => ({
  sourcePath: path,
  sourceName: sourceName(path),
  extension: sourceName(path).split('.').pop()?.toLowerCase() ?? '',
  embeddedImageCount: 0,
  pageCount: 0
});

const ExtractImagePage = () => {
  const [items, setItems] = useState<ExtractionItem[]>([]);
  const [outputDirectory, setOutputDirectory] = useState('');
  const [outputFormat, setOutputFormat] = useState<ExtractionOutputFormat>('png');
  const [pageError, setPageError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const readyItems = items.filter((item) => item.status === 'ready');
  const totalExpected = items.reduce((sum, item) => sum + item.embeddedImageCount, 0);
  const totalExtracted = items.reduce((sum, item) => sum + item.extractedCount, 0);

  const importDocuments = async () => {
    setPageError(null);
    const paths = await openExtractionDocuments();

    for (const path of paths) {
      try {
        const documentInfo = await inspectExtractionDocument(path);
        setItems((current) => [
          ...current,
          { ...documentInfo, status: 'ready', extractedCount: 0, skippedCount: 0, outputPaths: [], errorMessage: null }
        ]);
      } catch (error) {
        const documentInfo = fallbackDocumentInfo(path);
        setItems((current) => [
          ...current,
          {
            ...documentInfo,
            status: 'failed',
            extractedCount: 0,
            skippedCount: 0,
            outputPaths: [],
            errorMessage: error instanceof Error ? error.message : String(error)
          }
        ]);
      }
    }
  };

  const selectOutputDirectory = async () => {
    const selected = await chooseOutputDirectory();

    if (selected) {
      setOutputDirectory(selected);
    }
  };

  const startExtraction = async () => {
    if (!outputDirectory) {
      setPageError('请先选择输出目录');
      return;
    }

    setPageError(null);
    setIsRunning(true);

    for (const item of readyItems) {
      setItems((current) => current.map((entry) => (entry.sourcePath === item.sourcePath ? { ...entry, status: 'running' } : entry)));

      try {
        const result = await extractDocumentImages({
          sourcePath: item.sourcePath,
          outputDirectory,
          outputFormat,
          namingPattern: 'source-name-index'
        });
        setItems((current) =>
          current.map((entry) =>
            entry.sourcePath === item.sourcePath
              ? {
                  ...entry,
                  status: 'success',
                  extractedCount: result.extractedCount,
                  skippedCount: result.skippedCount,
                  outputPaths: result.outputPaths,
                  errorMessage: null
                }
              : entry
          )
        );
      } catch (error) {
        setItems((current) =>
          current.map((entry) =>
            entry.sourcePath === item.sourcePath
              ? { ...entry, status: 'failed', errorMessage: error instanceof Error ? error.message : String(error) }
              : entry
          )
        );
      }
    }

    setIsRunning(false);
  };

  return (
    <section className="min-h-[calc(100vh-112px)] rounded-[28px] border border-[#ececf4] bg-[#f7f8fc] p-5 text-[#2f3440] shadow-[0_18px_60px_rgba(46,52,64,0.08)]">
      <div className="flex items-start justify-between gap-5">
        <div>
          <div className="inline-flex rounded-full bg-[#ffe7f0] px-3 py-1 text-xs font-semibold text-[#ff5c93]">Extract</div>
          <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.02em] text-[#252a36]">图片提取</h1>
          <p className="mt-2 text-sm text-[#848a98]">从 Word / PDF 文档中批量提取图片素材</p>
        </div>
        <button
          type="button"
          onClick={importDocuments}
          className="rounded-[18px] bg-[#ff6f9f] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(255,111,159,0.26)]"
        >
          导入文档
        </button>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.3fr_0.9fr]">
        <section className="rounded-[26px] border border-[#ececf4] bg-white p-5 shadow-[0_12px_30px_rgba(46,52,64,0.05)]">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#252a36]">文档导入区</h2>
            <span className="rounded-full bg-[#f3f4f8] px-3 py-1 text-xs text-[#8a90a0]">{items.length} 个文档</span>
          </div>

          <button
            type="button"
            onClick={importDocuments}
            className="mt-4 flex min-h-[170px] w-full flex-col items-center justify-center rounded-[24px] border border-dashed border-[#ffd0df] bg-[#fff6fa] px-6 text-center"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-white text-xl text-[#ff6f9f] shadow-[0_10px_24px_rgba(255,111,159,0.14)]">+</span>
            <span className="mt-4 text-base font-semibold text-[#343a46]">拖拽或点击导入文档</span>
            <span className="mt-2 text-sm text-[#9aa0ad]">支持 DOCX、PDF，自动统计可提取图片</span>
          </button>

          <div role="region" aria-label="待提取文档" className="mt-5 grid gap-3">
            {items.length === 0 ? (
              <div className="rounded-[20px] border border-[#eef0f5] bg-[#fbfcfe] px-4 py-5 text-sm text-[#9aa0ad]">
                暂无文档，导入后将在这里显示文件和图片数量。
              </div>
            ) : (
              items.map((item) => (
                <article key={item.sourcePath} className="flex items-center justify-between gap-4 rounded-[20px] border border-[#eef0f5] bg-[#fbfcfe] p-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-[#343a46]">{item.sourceName}</h3>
                    <p className="mt-1 text-xs text-[#9aa0ad]">
                      {item.extension.toUpperCase()} · {item.pageCount || '-'} 页
                    </p>
                    <p className="mt-1 text-xs text-[#9aa0ad]">预计 {item.embeddedImageCount} 张图片</p>
                    {item.errorMessage ? <p className="mt-1 text-xs text-[#ff5c7f]">{item.errorMessage}</p> : null}
                  </div>
                  <span className="rounded-full bg-[#effaf5] px-3 py-1 text-xs font-medium text-[#34a36f]">
                    {item.status === 'success' ? `完成 ${item.extractedCount} 张` : item.status === 'running' ? '提取中' : item.status === 'failed' ? '失败' : '待处理'}
                  </span>
                </article>
              ))
            )}
          </div>
        </section>

        <div className="grid gap-5">
          <section className="rounded-[26px] border border-[#ececf4] bg-white p-5 shadow-[0_12px_30px_rgba(46,52,64,0.05)]">
            <h2 className="text-base font-semibold text-[#252a36]">输出设置</h2>
            <div className="mt-4 grid gap-4">
              <label className="text-sm font-medium text-[#5b6270]">
                导出格式
                <select
                  value={outputFormat}
                  onChange={(event) => setOutputFormat(event.target.value as ExtractionOutputFormat)}
                  className="mt-2 w-full rounded-[16px] border border-[#e6e8f0] bg-[#fbfcfe] px-3 py-2.5 text-sm text-[#343a46] outline-none"
                >
                  <option value="png">PNG</option>
                  <option value="jpg">JPG</option>
                </select>
              </label>

              <div>
                <div className="text-sm font-medium text-[#5b6270]">输出目录</div>
                <button
                  type="button"
                  onClick={selectOutputDirectory}
                  className="mt-2 w-full rounded-[16px] border border-[#e6e8f0] bg-[#fbfcfe] px-3 py-2.5 text-left text-sm text-[#343a46]"
                >
                  {outputDirectory || '选择目录'}
                </button>
              </div>

              <button
                type="button"
                disabled={isRunning || readyItems.length === 0}
                onClick={startExtraction}
                className="rounded-[18px] bg-[#6f7dff] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(111,125,255,0.22)] disabled:cursor-not-allowed disabled:bg-[#c9cde2] disabled:shadow-none"
              >
                开始提取
              </button>
              {pageError ? <p className="text-sm text-[#ff5c7f]">{pageError}</p> : null}
            </div>
          </section>

          <section className="rounded-[26px] border border-[#ececf4] bg-white p-5 shadow-[0_12px_30px_rgba(46,52,64,0.05)]">
            <h2 className="text-base font-semibold text-[#252a36]">提取结果</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-[20px] bg-[#f7f8fc] p-4">
                <div className="text-2xl font-semibold text-[#252a36]">{totalExpected}</div>
                <div className="mt-1 text-xs text-[#9aa0ad]">预计图片</div>
              </div>
              <div className="rounded-[20px] bg-[#f7f8fc] p-4">
                <div className="text-2xl font-semibold text-[#252a36]">{totalExtracted}</div>
                <div className="mt-1 text-xs text-[#9aa0ad]">已完成</div>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {items.filter((item) => item.status === 'success').map((item) => (
                <div key={item.sourcePath} className="rounded-[16px] bg-[#f8fff9] px-3 py-2 text-sm text-[#34a36f]">
                  <span>已提取 {item.extractedCount} 张</span>
                  <span className="ml-2">跳过 {item.skippedCount} 张</span>
                </div>
              ))}
              {items.some((item) => item.status === 'success') ? null : <p className="text-sm text-[#9aa0ad]">完成提取后将在这里汇总输出结果。</p>}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
};

export default ExtractImagePage;
