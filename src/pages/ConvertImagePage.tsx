import { useState } from 'react';
import ConversionBatchStatus from '../components/convert-image/ConversionBatchStatus';
import ConversionItemList from '../components/convert-image/ConversionItemList';
import ConversionSettingsPanel from '../components/convert-image/ConversionSettingsPanel';
import ConversionToolbar from '../components/convert-image/ConversionToolbar';
import {
  convertImageFile,
  inspectConversionDirectory,
  inspectConversionFile,
  renderDocumentToImages
} from '../services/conversionCommands';
import { openConversionDirectory, openConversionFiles } from '../services/fileDialog';
import { useConversionStore } from '../stores/conversionStore';
import type { ConversionItem, InspectConversionFileResult } from '../types/conversion';

const toItem = (result: InspectConversionFileResult): ConversionItem => ({
  id: `${result.sourcePath}:${result.kind}`,
  sourcePath: result.sourcePath,
  sourceName: result.sourceName,
  kind: result.kind,
  status: result.kind === 'unsupported' ? 'unsupported' : 'ready',
  errorMessage: result.errorMessage,
  outputSuffix: '',
  outputSettingsOverride: {},
  imageMetadata: result.imageMetadata,
  documentMetadata: result.documentMetadata,
  outputPaths: []
});

const ConvertImagePage = () => {
  const {
    items,
    selectedItemId,
    globalSettings,
    stats,
    setItems,
    selectItem,
    updateGlobalSettings,
    buildItemSummary,
    markItemRunning,
    markItemSucceeded,
    markItemFailed,
    buildEffectiveDocumentPages,
    reset
  } = useConversionStore();
  const [isRunning, setIsRunning] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const importFiles = async () => {
    const paths = await openConversionFiles();
    const next = await Promise.all(paths.map((path) => inspectConversionFile(path)));
    setItems(next.map(toItem));
  };

  const importDirectory = async () => {
    const path = await openConversionDirectory();
    if (!path) {
      return;
    }

    const next = await inspectConversionDirectory(path);
    setItems(next.map(toItem));
  };

  const startConversion = async () => {
    setPageError(null);

    for (const item of items.filter((entry) => entry.kind === 'document' && entry.status === 'ready')) {
      try {
        buildEffectiveDocumentPages(item.id);
      } catch (error) {
        setPageError(error instanceof Error ? error.message : String(error));
        return;
      }
    }

    setIsRunning(true);

    for (const item of items.filter((entry) => entry.status === 'ready')) {
      try {
        markItemRunning(item.id);

        if (item.kind === 'image') {
          const paths = await convertImageFile({
            sourcePath: item.sourcePath,
            outputPath: `${globalSettings.outputDirectory}/${item.sourceName}.${globalSettings.outputFormat}`,
            outputFormat: globalSettings.outputFormat,
            colorMode: globalSettings.colorMode,
            quality: globalSettings.outputFormat === 'png' ? undefined : globalSettings.quality
          });
          markItemSucceeded(item.id, paths);
        } else if (item.kind === 'document') {
          const paths = await renderDocumentToImages({
            sourcePath: item.sourcePath,
            outputDirectory: globalSettings.outputDirectory,
            outputFormat: globalSettings.outputFormat,
            colorMode: globalSettings.colorMode,
            pageNumbers: buildEffectiveDocumentPages(item.id),
            renderDensity: globalSettings.renderDensity,
            namingPattern: globalSettings.namingPattern
          });
          markItemSucceeded(item.id, paths);
        }
      } catch (error) {
        markItemFailed(item.id, error instanceof Error ? error.message : String(error));
      }
    }

    setIsRunning(false);
  };

  return (
    <section className="min-h-full rounded-[24px] border border-[#ececf2] bg-[#f8f8fb] p-4 text-[#2f3440]">
      <ConversionToolbar
        isRunning={isRunning}
        onImportFiles={importFiles}
        onImportDirectory={importDirectory}
        onClear={reset}
        onStart={startConversion}
      />
      {pageError ? (
        <p className="mt-4 rounded-[18px] border border-[#ffd3df] bg-[#fff3f7] px-4 py-3 text-sm text-[#d94d80]">
          {pageError}
        </p>
      ) : null}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <ConversionItemList
          items={items}
          selectedItemId={selectedItemId}
          buildSummary={buildItemSummary}
          onSelect={selectItem}
        />
        <ConversionSettingsPanel settings={globalSettings} onChange={updateGlobalSettings} />
      </div>
      <div className="mt-4">
        <ConversionBatchStatus
          total={stats.total}
          success={stats.success}
          failed={stats.failed}
          lastError={items.find((item) => item.status === 'failed')?.errorMessage ?? null}
        />
      </div>
    </section>
  );
};

export default ConvertImagePage;
