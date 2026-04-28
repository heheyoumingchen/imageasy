import type { ReactNode } from 'react';
import type { AppPageKey } from '../../app/navItems';
import SideNav from './SideNav';
import TopBar from './TopBar';

type AppShellProps = {
  currentPage: AppPageKey;
  onNavigate: (page: AppPageKey) => void;
  children: ReactNode;
};

const AppShell = ({ currentPage, onNavigate, children }: AppShellProps) => {
  return (
    <div className="flex min-h-screen bg-[#f4f5f9] text-[#2f3440]">
      <SideNav currentPage={currentPage} onSelect={onNavigate} />

      <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden">
        <TopBar currentPage={currentPage} />
        <main className="relative flex-1 overflow-auto px-5 py-4">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppShell;
