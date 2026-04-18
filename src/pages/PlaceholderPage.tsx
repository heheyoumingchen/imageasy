type PlaceholderPageProps = {
  title: string;
  description: string;
  points: string[];
};

const PlaceholderPage = ({ title, description, points }: PlaceholderPageProps) => {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="max-w-3xl">
        <div className="inline-flex rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1 text-xs text-slate-400">
          稳定入口已就绪
        </div>
        <h3 className="mt-4 text-2xl font-semibold text-slate-50">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {points.map((point) => (
            <div key={point} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
              {point}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PlaceholderPage;
