import { useMemo, useState } from 'react';
import type { AppPageKey } from './app/navItems';
import AppShell from './components/layout/AppShell';
import ConvertImagePage from './pages/ConvertImagePage';
import ExtractImagePage from './pages/ExtractImagePage';
import ImageEditorPage from './pages/ImageEditorPage';
import SettingsPage from './pages/SettingsPage';
import TaskCenterPage from './pages/TaskCenterPage';

const App = () => {
  const [currentPage, setCurrentPage] = useState<AppPageKey>('image-editor');

  const page = useMemo(() => {
    switch (currentPage) {
      case 'convert-image':
        return <ConvertImagePage />;
      case 'extract-image':
        return <ExtractImagePage />;
      case 'task-center':
        return <TaskCenterPage />;
      case 'settings':
        return <SettingsPage />;
      case 'image-editor':
      default:
        return <ImageEditorPage />;
    }
  }, [currentPage]);

  return (
    <AppShell currentPage={currentPage} onNavigate={setCurrentPage}>
      {page}
    </AppShell>
  );
};

export default App;
