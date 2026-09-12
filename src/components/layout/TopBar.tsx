import { Minus, Square, X } from 'lucide-react';
import { closeWindow, minimizeWindow, toggleMaximizeWindow } from '../../services/windowCommands';

const TopBar = () => {
  const handleMinimize = () => {
    void minimizeWindow();
  };

  const handleMaximize = () => {
    void toggleMaximizeWindow();
  };

  const handleClose = () => {
    void closeWindow();
  };

  return (
    <header
      className="relative z-50 flex h-12 items-center justify-between border-b border-border-light bg-white px-6"
      role="banner"
      data-tauri-drag-region
    >
      <div className="flex flex-1 items-center gap-3 select-none pointer-events-none">
        <img src="/brand/logo.png" alt="imageasy logo" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
        <h2 className="text-2xl font-bold text-[#1A1D23] tracking-tight">imageasy</h2>
      </div>

      <div className="flex items-center -mr-6 shrink-0 pointer-events-auto">
        <button aria-label="最小化" onClick={handleMinimize} className="flex h-12 w-12 items-center justify-center text-[#8D93A1] hover:bg-bg-main hover:text-[#1A1D23] transition-colors">
          <Minus size={16} />
        </button>
        <button aria-label="最大化" onClick={handleMaximize} className="flex h-12 w-12 items-center justify-center text-[#8D93A1] hover:bg-bg-main hover:text-[#1A1D23] transition-colors">
          <Square size={14} />
        </button>
        <button aria-label="关闭" onClick={handleClose} className="flex h-12 w-12 items-center justify-center text-[#8D93A1] hover:bg-[#F8F9FB] hover:text-[#1A1D23] transition-colors">
          <X size={18} />
        </button>
      </div>
    </header>
  );
};

export default TopBar;
