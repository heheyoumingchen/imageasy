import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { AppPageKey } from './app/navItems';
import AppShell from './components/layout/AppShell';
import { useAppSettings } from './hooks/useAppSettings';
import { getSettingsStore } from './hooks/useSettingsStore';

const ConvertImagePage = lazy(() => import('./pages/ConvertImagePage'));
const ExtractImagePage = lazy(() => import('./pages/ExtractImagePage'));
const SplitImagePage = lazy(() => import('./pages/SplitImagePage'));
const StitchImagePage = lazy(() => import('./pages/StitchImagePage'));
const ImageDownloadPage = lazy(() => import('./pages/ImageDownloadPage'));
const ImageEditorPage = lazy(() => import('./pages/ImageEditorPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

const normalizeCurrentPage = (page: string): AppPageKey => {
  switch (page) {
    case 'convert-image':
    case 'extract-image':
    case 'split-image':
    case 'stitch-image':
    case 'image-download':
    case 'settings':
    case 'image-editor':
      return page;
    default:
      return 'image-editor';
  }
};

const PageFallback = () => (
  <div className="flex h-full items-center justify-center text-sm text-[#8D93A1]" data-testid="page-loading">
    加载中…
  </div>
);

const App = () => {
  const [currentPage, setCurrentPage] = useState<AppPageKey>('image-editor');
  const { theme, language } = useAppSettings();
  const settingsStore = getSettingsStore();

  useEffect(() => {
    void settingsStore.getState().load();
  }, [settingsStore]);

  const page = useMemo(() => {
    switch (normalizeCurrentPage(currentPage)) {
      case 'convert-image':
        return <ConvertImagePage />;
      case 'extract-image':
        return <ExtractImagePage />;
      case 'split-image':
        return <SplitImagePage />;
      case 'stitch-image':
        return <StitchImagePage />;
      case 'image-download':
        return <ImageDownloadPage />;
      case 'settings':
        return <SettingsPage />;
      case 'image-editor':
      default:
        return <ImageEditorPage />;
    }
  }, [currentPage]);

  return (
    <AppShell currentPage={normalizeCurrentPage(currentPage)} theme={theme} language={language} onNavigate={setCurrentPage}>
      <Suspense fallback={<PageFallback />}>{page}</Suspense>
    </AppShell>
  );
};

export default App;
