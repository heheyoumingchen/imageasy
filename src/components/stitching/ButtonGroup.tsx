type Option<T> = {
  label: string;
  value: T;
};

type Props<T extends string | number> = {
  label: string;
  value: T;
  options: Option<T>[];
  columns?: number;
  disabled?: boolean;
  onChange: (value: T) => void;
};

const ButtonGroup = <T extends string | number>({ label, value, options, columns = 2, disabled = false, onChange }: Props<T>) => {
  return (
    <div className="block">
      <span className="text-[13px] font-bold text-[#5D6472] uppercase tracking-wider opacity-60">{label}</span>
      <div className={`mt-2 grid gap-2`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`h-10 rounded-lg text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
              value === option.value
                ? 'bg-meitu text-white'
                : 'bg-[#FAFBFD] border border-border-light text-[#515867] hover:border-meitu hover:text-meitu'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ButtonGroup;
