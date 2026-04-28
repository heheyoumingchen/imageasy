import navItems, { type AppPageKey } from '../../app/navItems';

type SideNavProps = {
  currentPage: AppPageKey;
  onSelect: (page: AppPageKey) => void;
};

const SideNav = ({ currentPage, onSelect }: SideNavProps) => {
  return (
    <aside className="flex w-[104px] shrink-0 flex-col border-r border-[#e7e8ef] bg-[#fbfbfd] px-3 py-4">
      <div className="mb-5 flex justify-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ff77aa_0%,#8d7bff_100%)] text-lg font-semibold text-white shadow-[0_10px_24px_rgba(255,105,160,0.28)]">
          美
        </div>
      </div>

      <nav aria-label="主导航" className="flex-1 space-y-2">
        {navItems.filter((item) => item.key !== 'task-center').map((item) => {
          const active = item.key === currentPage;

          return (
            <button
              key={item.key}
              type="button"
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              onClick={() => onSelect(item.key)}
              className={`flex w-full flex-col items-center gap-1.5 rounded-[16px] px-2 py-3 text-center transition ${
                active
                  ? 'bg-[#fff0f5] text-[#ff5c93] shadow-[inset_0_0_0_1px_rgba(255,92,147,0.18)]'
                  : 'text-[#656b78] hover:bg-[#f3f4f8] hover:text-[#3a4050]'
              }`}
            >
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-[11px] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ${active ? 'border-[#ffc4d8] bg-[#ffe1ec] text-[#ff5c93]' : 'border-[#eceef4] bg-[#f7f8fb] text-[#8d93a1]'}`}>
                {item.label.slice(0, 1)}
              </span>
              <span className="text-[10px] font-medium leading-[1.35] text-current">{item.label}</span>
              <span aria-hidden="true" className="hidden">{item.description}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-4 flex items-center justify-center rounded-[16px] border border-[#f0f1f5] bg-[#fcfcfe] px-2 py-2.5 text-[10px] text-[#adb2bd]">
        设置
      </div>
    </aside>
  );
};

export default SideNav;
