import { useEffect, useMemo, useState } from 'react';
import type { AppPageKey } from './app/navItems';
import AppShell from './components/layout/AppShell';
import ConvertImagePage from './pages/ConvertImagePage';
import ExtractImagePage from './pages/ExtractImagePage';
import SplitImagePage from './pages/SplitImagePage';
import StitchImagePage from './pages/StitchImagePage';
import ImageDownloadPage from './pages/ImageDownloadPage';
import ImageEditorPage from './pages/ImageEditorPage';
import SettingsPage from './pages/SettingsPage';
import { useAppSettings } from './hooks/useAppSettings';
import { getSettingsStore } from './hooks/useSettingsStore';

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
      {page}
    </AppShell>
  );
};

export default App;
