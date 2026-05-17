import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  type TooltipProps,
} from 'recharts';
import type {
  ValueType,
  NameType,
} from 'recharts/types/component/DefaultTooltipContent';
import type { YouthStats } from '@/services/api';

const COLORS: Record<string, string> = {
  'U18': '#6366f1',
  '18-19v': '#8b5cf6',
  '19-20v': '#00D4FF',
  '20-21v': '#00FF88',
  '21-23v': '#22c55e',
  'Yli 23v': '#1a2640',
};

const STACK_KEYS = ['U18', '18-19v', '19-20v', '20-21v', '21-23v', 'Yli 23v'];

interface AgeDistributionChartProps {
  teams: YouthStats[];
}

function shortenName(name: string): string {
  // HJK Helsinki → HJK · IFK Mariehamn → IFK Mhn · IF Gnistan → Gnistan
  const trimmed = name.replace(/\s*(Helsinki|Football Club)\s*/gi, '').trim();
  if (trimmed.length <= 9) return trimmed;
  const parts = trimmed.split(' ');
  if (parts.length === 1) return parts[0].slice(0, 8);
  return parts
    .map((p) => (p.length > 5 ? p.slice(0, 3) + '.' : p))
    .join(' ');
}

function CustomTooltip({ active, payload, label }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-navy-800 border border-navy-600 rounded-md shadow-xl px-4 py-3 text-sm">
      <div className="font-medium text-white mb-2">{label}</div>
      <div className="space-y-1">
        {payload
          .slice()
          .reverse()
          .filter((p) => typeof p.value === 'number' && p.value > 0)
          .map((p) => (
            <div key={String(p.dataKey)} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-white/70 w-16">{String(p.name)}</span>
              <span className="tabular text-white/90 ml-auto">
                {Number(p.value).toFixed(1)} %
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

export function AgeDistributionChart({ teams }: AgeDistributionChartProps) {
  const data = [...teams]
    .sort((a, b) => b.youthPercentageU23 - a.youthPercentageU23)
    .map((t) => ({
      team: shortenName(t.teamName),
      fullName: t.teamName,
      'U18': t.youthPercentageU18,
      '18-19v': Math.max(0, t.youthPercentageU19 - t.youthPercentageU18),
      '19-20v': Math.max(0, t.youthPercentageU20 - t.youthPercentageU19),
      '20-21v': Math.max(0, t.youthPercentageU21 - t.youthPercentageU20),
      '21-23v': Math.max(0, t.youthPercentageU23 - t.youthPercentageU21),
      'Yli 23v': Math.max(0, 100 - t.youthPercentageU23),
    }));

  return (
    <div>
      <div className="overflow-x-auto -mx-6 px-6 pb-2">
        <div style={{ minWidth: Math.max(640, data.length * 60) }}>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart
              data={data}
              margin={{ top: 16, right: 8, bottom: 8, left: -16 }}
            >
              <CartesianGrid
                stroke="#1a2640"
                strokeDasharray="2 4"
                vertical={false}
              />
              <XAxis
                dataKey="team"
                stroke="#8899AA"
                tick={{ fontSize: 11, fill: '#A5B4C8' }}
                tickLine={false}
                axisLine={{ stroke: '#243350' }}
                interval={0}
              />
              <YAxis
                stroke="#8899AA"
                tick={{ fontSize: 11, fill: '#A5B4C8' }}
                tickLine={false}
                axisLine={false}
                unit=" %"
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(0, 212, 255, 0.05)' }}
              />
              {STACK_KEYS.map((key, i) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="age"
                  fill={COLORS[key]}
                  radius={i === STACK_KEYS.length - 1 ? [4, 4, 0, 0] : 0}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Selitelegenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-xs">
        {STACK_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: COLORS[key] }}
            />
            <span className="text-white/60">{key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
