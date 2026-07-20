import type { ReactNode } from 'react';

type AboutCardProps = {
  copy: {
    aboutApp: string;
    appName: string;
    appVersion: string;
    contact: string;
  };
  onOpenContact: () => void;
};

const ArrowIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
  </svg>
);

const ActionButton = ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
  <button type="button" onClick={onClick} className="flex items-center gap-1 text-sm text-[#5D6472] hover:text-meitu transition-colors">
    <span>{children}</span>
    <ArrowIcon />
  </button>
);

export const AboutCard = ({ copy, onOpenContact }: AboutCardProps) => (
  <section className="px-8 py-5">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-title-2 mb-2 flex items-center gap-3">
          <div className="w-1.5 h-6 bg-meitu rounded-full" />
          {copy.aboutApp}
        </h2>
        <div data-testid="about-app-identity" className="flex items-center gap-3 text-left">
          <img src="/brand/logo.png" alt="imageasy logo" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-[#1A1D23] tracking-tight">{copy.appName}</h3>
            <p className="mt-1.5 inline-flex rounded-full bg-meitu-light px-3 py-0.5 text-sm font-bold text-meitu">{copy.appVersion}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 items-end">
        <ActionButton onClick={onOpenContact}>{copy.contact}</ActionButton>
      </div>
    </div>
  </section>
);
