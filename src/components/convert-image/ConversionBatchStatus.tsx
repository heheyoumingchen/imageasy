type ConversionBatchStatusProps = {
  total: number;
  success: number;
  failed: number;
  lastError?: string | null;
};

const ConversionBatchStatus = ({ total, success, failed, lastError }: ConversionBatchStatusProps) => {
  return (
    <footer role="contentinfo" className="rounded-[20px] border border-[#ececf2] bg-white px-4 py-3 text-sm text-[#5d6472]">
      <div className="flex flex-wrap items-center gap-5">
        <span>总文件 {total}</span>
        <span>成功 {success}</span>
        <span>失败 {failed}</span>
      </div>
      {lastError ? <p className="mt-2 text-[#d94d80]">{lastError}</p> : null}
    </footer>
  );
};

export default ConversionBatchStatus;
