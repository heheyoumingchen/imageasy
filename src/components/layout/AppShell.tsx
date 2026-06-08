import type { ReactNode } from 'react';
import type { AppLanguage, AppPageKey } from '../../app/navItems';
import SideNav from './SideNav';
import TopBar from './TopBar';

type AppShellProps = {
  currentPage: AppPageKey;
  theme: 'dark' | 'light';
  language: AppLanguage;
  onNavigate: (page: AppPageKey) => void;
  children: ReactNode;
};

const AppShell = ({ currentPage, theme, language, onNavigate, children }: AppShellProps) => {
  return (
    <div data-theme={theme} className="flex h-screen flex-col overflow-hidden bg-bg-main text-[#2F3440]">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <SideNav currentPage={currentPage} language={language} onSelect={onNavigate} />

        <main className="relative flex-1 overflow-auto bg-bg-main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppShell;

