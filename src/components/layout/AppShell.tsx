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
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <SideNav currentPage={currentPage} onSelect={onNavigate} />

      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar currentPage={currentPage} />
        <main className="flex-1 overflow-auto bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.08),_transparent_30%),linear-gradient(180deg,_rgba(15,23,42,0.9),_rgba(2,6,23,1))] p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppShell;
