import navItems, { type AppPageKey } from '../../app/navItems';

type TopBarProps = {
  currentPage: AppPageKey;
};

const TopBar = ({ currentPage }: TopBarProps) => {
  const item = navItems.find((entry) => entry.key === currentPage)!;

  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-6 py-4 backdrop-blur">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Workspace</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-50">{item.label}</h2>
        <p className="mt-1 text-sm text-slate-400">{item.description}</p>
      </div>

      <div className="flex items-center gap-3 text-sm text-slate-400">
        <div className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1.5">Tauri v2</div>
        <div className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1.5">React 19</div>
      </div>
    </header>
  );
};

export default TopBar;
