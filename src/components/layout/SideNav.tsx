import { Download, Image, Repeat, FileSearch, Settings, Scissors, Grid3x3 } from 'lucide-react';
import { getNavItems, type AppLanguage, type AppPageKey } from '../../app/navItems';

type SideNavProps = {
  currentPage: AppPageKey;
  language: AppLanguage;
  onSelect: (page: AppPageKey) => void;
};

const SideNav = ({ currentPage, language, onSelect }: SideNavProps) => {
  const navItems = getNavItems(language);
  const settingsLabel = language === 'en-US' ? 'Settings' : '设置';
  const settingsActive = currentPage === 'settings';

  const getIcon = (key: AppPageKey, active: boolean) => {
    const size = 24;
    const color = active ? 'var(--color-meitu)' : '#656B78';

    switch (key) {
      case 'image-editor':
        return <Image size={size} color={color} />;
      case 'convert-image':
        return <Repeat size={size} color={color} />;
      case 'extract-image':
        return <FileSearch size={size} color={color} />;
      case 'split-image':
        return <Scissors size={size} color={color} />;
      case 'stitch-image':
        return <Grid3x3 size={size} color={color} />;
      case 'image-download':
        return <Download size={size} color={color} />;
      case 'settings':
        return <Settings size={size} color={color} />;
      default:
        return null;
    }
  };

  return (
    <aside className="flex w-[112px] shrink-0 flex-col border-r border-border-light bg-white px-3 py-4">
      <nav aria-label="主导航" className="flex-1 space-y-2">
        {navItems.map((item) => {
          const active = item.key === currentPage;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={`group relative flex w-full flex-col items-center gap-1.5 rounded px-2 py-4 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-meitu/30 ${
                active
                  ? 'bg-meitu-light text-meitu'
                  : 'text-[#656B78] hover:bg-[#F8F9FB] hover:text-[#2F3440]'
              }`}
            >
              <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'scale-100 group-hover:scale-105'}`}>
                {getIcon(item.key, active)}
              </div>
              <span className={`text-[11px] font-semibold tracking-[0.06em] transition-colors duration-300 ${active ? 'text-meitu' : 'text-[#8D93A1]'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-4 border-t border-border-light/60 pt-4">
        <button
          type="button"
          onClick={() => onSelect('settings')}
          className={`group relative flex w-full flex-col items-center gap-1.5 rounded px-2 py-4 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-meitu/30 ${
            settingsActive
              ? 'bg-meitu-light text-meitu'
              : 'text-[#656B78] hover:bg-[#F8F9FB] hover:text-[#2F3440]'
          }`}
        >
          <div className={`transition-transform duration-300 ${settingsActive ? 'scale-110' : 'scale-100 group-hover:scale-105'}`}>
            {getIcon('settings', settingsActive)}
          </div>
          <span className={`text-[11px] font-semibold tracking-[0.06em] transition-colors duration-300 ${settingsActive ? 'text-meitu' : 'text-[#8D93A1]'}`}>
            {settingsLabel}
          </span>
        </button>
      </div>
    </aside>
  );
};

export default SideNav;
