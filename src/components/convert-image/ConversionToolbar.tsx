type ConversionToolbarProps = {
  isRunning: boolean;
  onImportFiles: () => void;
  onImportDirectory: () => void;
  onClear: () => void;
  onStart: () => void;
};

const toolbarButton =
  'inline-flex h-10 items-center justify-center rounded-full border border-[#ececf2] bg-white px-4 text-sm text-[#515867] transition hover:border-[#ff9fbd] hover:text-[#ff5c93] disabled:cursor-not-allowed disabled:opacity-60';

const ConversionToolbar = ({ isRunning, onImportFiles, onImportDirectory, onClear, onStart }: ConversionToolbarProps) => {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className={toolbarButton} onClick={onImportFiles}>
        导入文件
      </button>
      <button type="button" className={toolbarButton} onClick={onImportDirectory}>
        导入文件夹
      </button>
      <button type="button" className={toolbarButton} onClick={onClear}>
        清空列表
      </button>
      <button
        type="button"
        className={`${toolbarButton} border-[#ffc3d7] bg-[#fff3f7] text-[#ff5c93]`}
        onClick={onStart}
        disabled={isRunning}
      >
        开始转换
      </button>
    </div>
  );
};

export default ConversionToolbar;
