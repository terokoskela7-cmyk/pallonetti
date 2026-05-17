import { BarChart, Bar, ResponsiveContainer } from 'recharts';

interface KPICardProps {
  label: string;
  value: string | number;
  suffix?: string;
  accent?: 'ice' | 'aurora' | 'white';
  /** Sparkline-data — 5 historiallista arvoa visuaaliseksi trendiksi */
  sparkline?: number[];
  /** Esim. "vs 2025" — näkyy lasketun trendi-indikaattorin vieressä */
  trendLabel?: string;
  /** Neutraali trendi-teksti — yliajaa lasketun trendin, näytetään "— teksti" white/40 */
  neutralTrendText?: string;
}

const ACCENT_TEXT: Record<NonNullable<KPICardProps['accent']>, string> = {
  ice: 'text-ice',
  aurora: 'text-aurora',
  white: 'text-white',
};

const ACCENT_HEX: Record<NonNullable<KPICardProps['accent']>, string> = {
  ice: '#00D4FF',
  aurora: '#00FF88',
  white: '#A5B4C8',
};

export function KPICard({
  label,
  value,
  suffix,
  accent = 'ice',
  sparkline,
  trendLabel,
  neutralTrendText,
}: KPICardProps) {
  const accentClass = ACCENT_TEXT[accent];
  const sparklineColor = ACCENT_HEX[accent];

  const trend =
    sparkline && sparkline.length >= 2
      ? sparkline[sparkline.length - 1] - sparkline[sparkline.length - 2]
      : undefined;

  return (
    <div className="bg-navy-700 border border-navy-600 rounded-lg p-5 transition-transform duration-200 hover:scale-[1.02] hover:border-navy-500 flex flex-col">
      {/* Otsikko */}
      <div className="text-xs uppercase tracking-wider text-white/50 mb-3 font-medium">
        {label}
      </div>

      {/* Iso numero + suffix */}
      <div className="flex items-baseline gap-1">
        <span className={`text-4xl md:text-5xl font-medium tabular ${accentClass}`}>
          {value}
        </span>
        {suffix && (
          <span className="text-xl md:text-2xl text-white/40 tabular">{suffix}</span>
        )}
      </div>

      {/* Trendi-rivi — kiinteä korkeus jotta kortit ovat saman korkuisia */}
      <div className="mt-2 flex items-center gap-1.5 text-xs h-4">
        {neutralTrendText ? (
          <>
            <span className="text-white/40 font-medium">—</span>
            <span className="text-white/40">{neutralTrendText}</span>
          </>
        ) : trend !== undefined && trendLabel ? (
          <>
            <span
              className={`tabular font-medium ${
                trend >= 0 ? 'text-aurora' : 'text-red-400'
              }`}
            >
              {trend >= 0 ? '↑' : '↓'} {trend >= 0 ? '+' : ''}
              {trend.toFixed(1)}pp
            </span>
            <span className="text-white/40">{trendLabel}</span>
          </>
        ) : null}
      </div>

      {/* Sparkline — kiinteä korkeus 32px (Recharts vaatii explicit height) */}
      <div
        className="mt-3 -mx-1"
        style={{ height: '32px' }}
      >
        {sparkline && sparkline.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sparkline.map((v, i) => ({ i, v }))}
              margin={{ top: 1, right: 1, bottom: 0, left: 1 }}
              barCategoryGap={3}
            >
              <Bar
                dataKey="v"
                fill={sparklineColor}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
