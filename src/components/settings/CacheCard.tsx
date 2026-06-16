type CacheCardProps = {
  copy: {
    cacheTitle: string;
    cacheDescription: string;
    cacheSizeLabel: string;
    cleanCache: string;
  };
  cacheSizeText: string;
  isLoading: boolean;
  onClear: () => void;
};

export const CacheCard = ({ copy, cacheSizeText, isLoading, onClear }: CacheCardProps) => (
  <section data-testid="settings-cache-card" className="px-8 py-5">
    <h2 className="text-xl font-bold text-[#1A1D23] mb-2 flex items-center gap-3">
      <div className="w-1.5 h-6 bg-meitu rounded-full" />
      {copy.cacheTitle}
    </h2>
    <div className="flex items-center gap-4">
      <div className="h-10 w-10 shrink-0 rounded-lg bg-meitu-light flex items-center justify-center">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-meitu">
          <path d="M3.75 3A1.75 1.75 0 002 4.75v3.26a3.235 3.235 0 011.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75zM3.75 9A1.75 1.75 0 002 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-4.5A1.75 1.75 0 0016.25 9H3.75z" />
        </svg>
      </div>
      <p className="flex-1 text-sm text-[#8D93A1] leading-6">{copy.cacheDescription}</p>
      <div className="flex items-center gap-5 shrink-0">
        <div className="text-right">
          <div className="text-xs font-bold text-[#8D93A1]">{copy.cacheSizeLabel}</div>
          <div className="text-lg font-bold text-meitu tabular-nums">{cacheSizeText}</div>
        </div>
        <button
          type="button"
          className="h-9 px-5 rounded border border-meitu bg-white text-sm font-bold text-meitu transition-all hover:bg-meitu-light active:scale-95 disabled:opacity-40"
          disabled={isLoading}
          onClick={onClear}
        >
          {copy.cleanCache}
        </button>
      </div>
    </div>
  </section>
);
