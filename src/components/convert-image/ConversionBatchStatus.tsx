import { CheckCircle2, XCircle, Clock, ListChecks } from 'lucide-react';
import type { ReactNode } from 'react';

type ConversionBatchStatusCopy = {
  totalLabel: string;
  successLabel: string;
  failedLabel: string;
  runningLabel: string;
  progressTitle: string;
  openOutputDirectory: string;
  toggleFailedDetails: string;
  retryFailedItems: string;
};

type ConversionBatchStatusProps = {
  copy: ConversionBatchStatusCopy;
  total: number;
  success: number;
  failed: number;
  running: number;
  onOpenOutputDirectory?: () => void;
  onRetryFailed?: () => void;
  onToggleDetails?: () => void;
  canOpenOutputDirectory?: boolean;
  canRetryFailed?: boolean;
  failedDetailsOpen?: boolean;
  failedDetailsAriaControls?: string;
};

const actionButtonClass =
  'inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded border border-border-light bg-white px-3 text-[12px] font-bold text-[#515867] transition-all hover:border-meitu hover:text-meitu disabled:cursor-not-allowed disabled:border-border-light disabled:bg-[#FAFBFD] disabled:text-[#B5BBC7]';

const StatCard = ({
  icon,
  label,
  value,
  colorClass,
  bgClass,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  colorClass: string;
  bgClass: string;
}) => (
  <div className="flex items-center gap-3 px-4 py-2 bg-white rounded border border-border-light">
    <div className={`flex h-9 w-9 items-center justify-center rounded ${bgClass} ${colorClass}`}>
      {icon}
    </div>
    <div>
      <div className="text-xs font-medium text-[#8D93A1]">{label}</div>
      <div className={`text-xl font-bold ${colorClass}`}>{value}</div>
    </div>
  </div>
);

const ConversionBatchStatus = ({
  copy,
  total,
  success,
  failed,
  running,
  onOpenOutputDirectory,
  onRetryFailed,
  onToggleDetails,
  canOpenOutputDirectory = true,
  canRetryFailed = true,
  failedDetailsOpen = false,
  failedDetailsAriaControls
}: ConversionBatchStatusProps) => {
  const progress = total === 0 ? 0 : Math.round(((success + failed) / total) * 100);

  return (
    <div className="flex flex-col lg:flex-row items-stretch gap-3">
      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 w-full">
        <StatCard
          icon={<ListChecks size={18} />}
          label={copy.totalLabel}
          value={total}
          colorClass="text-[#3B82F6]"
          bgClass="bg-blue-50"
        />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label={copy.successLabel}
          value={success}
          colorClass="text-[#22C55E]"
          bgClass="bg-green-50"
        />
        <StatCard
          icon={<XCircle size={18} />}
          label={copy.failedLabel}
          value={failed}
          colorClass="text-meitu"
          bgClass="bg-meitu-light"
        />
        <StatCard
          icon={<Clock size={18} />}
          label={copy.runningLabel}
          value={running}
          colorClass="text-[#F59E0B]"
          bgClass="bg-amber-50"
        />
      </div>

      <div data-testid="batch-progress-panel" className="w-full lg:w-[560px] bg-white rounded border border-border-light p-4 flex flex-col justify-between gap-3">
        <div className="space-y-2">
          <div className="relative h-2 w-full bg-[#F1F3F8] rounded-full overflow-hidden">
            <div
              className="h-full bg-meitu transition-all duration-700 ease-in-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div data-testid="batch-progress-footer" className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-[#1A1D23]">{copy.progressTitle}</h2>
            <span className="text-sm font-bold text-meitu">{progress}%</span>
          </div>
          <div data-testid="batch-progress-actions-scroll" className="min-w-0 overflow-x-auto">
            <div className="flex min-w-max flex-nowrap items-center justify-end gap-2 text-[11px] font-bold">
              <button type="button" disabled={!canOpenOutputDirectory} onClick={onOpenOutputDirectory} className={actionButtonClass}>
                {copy.openOutputDirectory}
              </button>
              <button
                type="button"
                aria-expanded={failedDetailsOpen}
                aria-controls={failedDetailsAriaControls}
                onClick={onToggleDetails}
                className={actionButtonClass}
              >
                {copy.toggleFailedDetails}
              </button>
              <button type="button" disabled={!canRetryFailed} onClick={onRetryFailed} className={actionButtonClass}>
                {copy.retryFailedItems}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversionBatchStatus;
