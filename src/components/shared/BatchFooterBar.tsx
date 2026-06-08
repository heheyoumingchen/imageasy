type BatchFooterBarProps = {
  regionLabel: string;
  currentTaskLabel: string;
  queuedFilesLabel: string;
  outputDirectoryLabel: string;
  completedLabel: string;
  failedLabel: string;
  versionLabel: string;
  currentTaskValue: string;
  queuedFilesValue: number;
  outputDirectoryValue: string;
  completedValue: number;
  failedValue: number;
  versionValue: string;
};

const BatchFooterBar = ({
  regionLabel,
  currentTaskLabel,
  queuedFilesLabel,
  outputDirectoryLabel,
  completedLabel,
  failedLabel,
  versionLabel,
  currentTaskValue,
  queuedFilesValue,
  outputDirectoryValue,
  completedValue,
  failedValue,
  versionValue,
}: BatchFooterBarProps) => {
  return (
    <footer
      role="contentinfo"
      aria-label={regionLabel}
      className="mt-3 flex items-center justify-between text-[12px] text-[#8D93A1]"
    >
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span>{currentTaskLabel}: <span className="text-[#313744] font-medium">{currentTaskValue}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <span>{queuedFilesLabel}: <span className="text-[#313744] font-medium">{queuedFilesValue}</span></span>
        </div>
        <div className="flex items-center gap-2 truncate max-w-[300px]">
          <span>{outputDirectoryLabel}: <span className="text-[#313744] font-medium">{outputDirectoryValue}</span></span>
        </div>
      </div>
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-4">
          <span>{completedLabel}: <span className="text-green-500 font-bold">{completedValue}</span></span>
          <span>{failedLabel}: <span className="text-red-500 font-bold">{failedValue}</span></span>
        </div>
        <span>{versionLabel}: {versionValue}</span>
      </div>
    </footer>
  );
};

export default BatchFooterBar;
