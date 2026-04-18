import navItems, { type AppPageKey } from '../../app/navItems';

type SideNavProps = {
  currentPage: AppPageKey;
  onSelect: (page: AppPageKey) => void;
};

const SideNav = ({ currentPage, onSelect }: SideNavProps) => {
  return (
    <aside className="flex h-full w-72 flex-col border-r border-slate-800 bg-slate-950/90 px-4 py-5">
      <div className="mb-6 px-3">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-400">Image Batch Helper</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-50">图片批量处理助手</h1>
        <p className="mt-2 text-sm text-slate-400">先完成应用壳与图片编辑主链路，再向批量任务域扩展。</p>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const active = item.key === currentPage;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                active
                  ? 'border-cyan-400/40 bg-cyan-500/10 text-slate-50 shadow-[0_0_0_1px_rgba(34,211,238,0.08)]'
                  : 'border-transparent bg-slate-900/70 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div className="text-sm font-semibold">{item.label}</div>
              <div className="mt-1 text-xs text-slate-400">{item.description}</div>
            </button>
          );
        })}
      </nav>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-xs text-slate-400">
        当前阶段：P0 应用壳 + 图片编辑页
      </div>
    </aside>
  );
};

export default SideNav;
