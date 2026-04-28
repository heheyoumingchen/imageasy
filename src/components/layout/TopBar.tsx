import type { AppPageKey } from '../../app/navItems';

type TopBarProps = {
  currentPage: AppPageKey;
};

const chipClassName = 'inline-flex h-6 items-center rounded-full border border-[#ececf2] bg-white px-2.5 text-[10px] text-[#717887]';

const TopBar = (_props: TopBarProps) => {
  return (
    <header className="relative z-10 border-b border-[#e9eaf0] bg-[#fbfbfd] px-4 py-2" role="banner">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,#ff6da8_0%,#8e7cff_100%)] text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(255,105,160,0.22)]">
            C
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-[#333946]">美图秀秀</h2>
            <p className="text-[10px] text-[#9aa0ad]">图片编辑工作区</p>
          </div>
          <div className={`${chipClassName} ml-1 text-[#9298a5]`}>1175</div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className={chipClassName}>Tauri v2</div>
          <div className={chipClassName}>React 19</div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
