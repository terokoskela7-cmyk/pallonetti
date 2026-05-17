interface KPICardProps {
  label: string;
  value: string | number;
  suffix?: string;
  accent?: 'ice' | 'aurora' | 'white';
}

export function KPICard({ label, value, suffix, accent = 'ice' }: KPICardProps) {
  const accentClass =
    accent === 'aurora'
      ? 'text-aurora'
      : accent === 'white'
        ? 'text-white'
        : 'text-ice';

  return (
    <div className="bg-navy-700/40 border border-navy-600 rounded-lg p-5">
      <div className="text-xs uppercase tracking-wider text-white/50 mb-3 font-medium">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-4xl md:text-5xl font-medium tabular ${accentClass}`}>
          {value}
        </span>
        {suffix && (
          <span className="text-xl md:text-2xl text-white/40 tabular">{suffix}</span>
        )}
      </div>
    </div>
  );
}
