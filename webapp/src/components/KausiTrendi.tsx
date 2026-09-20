// ============================================
// KAUSITREND — nuorten peliaika kausittain
//
// Kaksi viivaa samassa kuvassa: paamittari 17–21 ja kansainvalisen
// vertailun alle 21. Ne eivat ole vaihtoehtoisia esitystapoja samasta
// asiasta, joten molemmat nimetaan auki.
//
// Puuttuva kausi on null, ei 0: viiva katkeaa eika putoa nollaan, koska
// nolla vaittaisi ettei nuorille mennyt yhtaan minuuttia.
//
// Kesken oleva kausi merkitaan ontolla pisteella ja tekstilla pisteen
// kohdalla. Lukua ei piiloteta, mutta sita ei myoskaan esiteta
// lopullisena.
//
// Tanskan CIES-luku on YKSI merkitty piste kaudella 2025, ei vaakaviiva:
// se on yhden kauden mittaus yhdesta sarjasta, ei tavoitetaso.
// ============================================
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  type TooltipProps,
} from 'recharts';
import type {
  ValueType,
  NameType,
} from 'recharts/types/component/DefaultTooltipContent';
import type { TrendiKausi } from '@/services/api';
import { pros, luku } from '@/utils/luvut';
import {
  ALLE_21_LABEL,
  CIES_TANSKA_PCT,
  NUORET_LABEL_PITKA,
} from '@/constants/ika';

const VARI_1721 = '#8FA3BF';
const VARI_ALLE21 = '#00C8FF';
const VARI_TANSKA = '#E4E9F0';
// Kolmijaon viivat erottuvat toisistaan vaaleusasteella, eivat varilla:
// FIN ei saa nayttaa samalta kuin alle 21 -paaviiva.
const VARI_FIN = '#BFD3E6';
const VARI_MUU = '#6E8BB0';
const VARI_EI_TIETOA = '#4A5A73';

const NIMET = {
  osuus1721: NUORET_LABEL_PITKA,
  osuusAlle21: ALLE_21_LABEL,
  tanska: 'Tanska (CIES 2025)',
  fin: 'Suomen kansalaiset',
  muu: 'muu maakoodi',
  eiTietoa: 'ei tietoa',
} as const;

interface Piste {
  kausi: number;
  osuus1721: number | null;
  osuusAlle21: number | null;
  tanska: number | null;
  fin: number | null;
  muu: number | null;
  eiTietoa: number | null;
  kesken: boolean;
  otteluitaPelattu: number | null;
}

/** Tanskan vertailuluku kuuluu kaudelle 2025 eika mihinkaan muuhun. */
const TANSKAN_KAUSI = 2025;

function pisteiksi(trendit: TrendiKausi[]): Piste[] {
  return trendit.map((t) => ({
    kausi: t.kausi,
    osuus1721: t.osuus1721,
    osuusAlle21: t.osuusAlle21,
    tanska: t.kausi === TANSKAN_KAUSI ? CIES_TANSKA_PCT : null,
    fin: t.alle21Jako ? t.alle21Jako.fin : null,
    muu: t.alle21Jako ? t.alle21Jako.muu : null,
    eiTietoa: t.alle21Jako ? t.alle21Jako.eiTietoa : null,
    kesken: t.kesken,
    otteluitaPelattu: t.otteluitaPelattu,
  }));
}

/** Kesken olevan kauden piste on ontto — sama muoto kummallakin viivalla. */
function Piste({
  cx,
  cy,
  payload,
  vari,
}: {
  cx?: number;
  cy?: number;
  payload?: Piste;
  vari: string;
}) {
  if (cx === undefined || cy === undefined) return null;
  const kesken = payload?.kesken === true;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={kesken ? 4.5 : 3.5}
      fill={kesken ? '#0B1220' : vari}
      stroke={vari}
      strokeWidth={kesken ? 2 : 1}
    />
  );
}

function Vihje({ active, payload, label }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;
  const piste = payload[0].payload as Piste;
  return (
    <div className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-xs shadow-lg">
      <div className="text-white/90 font-medium mb-1">
        Kausi {label}
        {piste.kesken ? ' · kesken' : ''}
      </div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-white/60">{p.name}</span>
          <span className="text-white/90 tabular ml-auto">
            {pros(typeof p.value === 'number' ? p.value : null)}
          </span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  trendit: TrendiKausi[];
  /** Laaja: kolmijaon viivat ja lukutaulukko mukaan (/peliaika). */
  laaja?: boolean;
}

export function KausiTrendi({ trendit, laaja = false }: Props) {
  const data = pisteiksi(trendit);
  const kesken = data.find((d) => d.kesken);
  const korkeus = laaja ? 380 : 280;

  if (data.length === 0) {
    return (
      <div className="text-sm text-white/60">
        Kausitrendiä ei voitu ladata.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm uppercase tracking-wider text-white/60">
          Nuorten peliaika kausittain
        </h2>
        <span className="text-[11px] text-white/40">
          {data[0].kausi}–{data[data.length - 1].kausi}
        </span>
      </div>

      <div style={{ width: '100%', height: korkeus }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 24, right: 16, bottom: 8, left: 0 }}
          >
            <CartesianGrid stroke="#1a2640" strokeDasharray="2 4" />
            <XAxis
              dataKey="kausi"
              stroke="#8899AA"
              tick={{ fontSize: 11, fill: '#A5B4C8' }}
              tickLine={false}
              axisLine={{ stroke: '#243350' }}
            />
            <YAxis
              stroke="#8899AA"
              tick={{ fontSize: 11, fill: '#A5B4C8' }}
              tickLine={false}
              axisLine={false}
              width={58}
              domain={[0, 'auto']}
              tickFormatter={(v: number) => pros(v, 0)}
              label={{
                value: '% liigan minuuttikapasiteetista',
                angle: -90,
                position: 'insideLeft',
                style: { fill: '#8899AA', fontSize: 10, textAnchor: 'middle' },
              }}
            />
            <Tooltip content={<Vihje />} cursor={{ stroke: '#243350' }} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#A5B4C8' }}
              iconType="plainline"
            />
            {kesken && (
              <ReferenceLine
                x={kesken.kausi}
                stroke="#3A4A63"
                strokeDasharray="3 3"
                label={{
                  value:
                    kesken.kausi +
                    ' kesken' +
                    (kesken.otteluitaPelattu !== null
                      ? ' (' + luku(kesken.otteluitaPelattu) + ' ottelua pelattu)'
                      : ''),
                  // Viimeisen kauden kohdalla "top" leikkautuisi kuvan
                  // reunaan, joten teksti asetetaan viivan vasemmalle.
                  position: 'insideTopLeft',
                  style: { fill: '#A5B4C8', fontSize: 10, textAnchor: 'end' },
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="osuus1721"
              name={NIMET.osuus1721}
              stroke={VARI_1721}
              strokeWidth={2}
              dot={<Piste vari={VARI_1721} />}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="osuusAlle21"
              name={NIMET.osuusAlle21}
              stroke={VARI_ALLE21}
              strokeWidth={2}
              dot={<Piste vari={VARI_ALLE21} />}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
              connectNulls={false}
            />
            {laaja && (
              <>
                <Line
                  type="monotone"
                  dataKey="fin"
                  name={NIMET.fin}
                  stroke={VARI_FIN}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="muu"
                  name={NIMET.muu}
                  stroke={VARI_MUU}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="eiTietoa"
                  name={NIMET.eiTietoa}
                  stroke={VARI_EI_TIETOA}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              </>
            )}
            {/* Tanska: yksi merkitty piste kaudella 2025, ei vaakaviivaa. */}
            <Scatter
              dataKey="tanska"
              name={NIMET.tanska}
              fill={VARI_TANSKA}
              shape="diamond"
              legendType="diamond"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {laaja && <TrendiTaulukko trendit={trendit} />}
    </div>
  );
}

/** Sama data lukuina: kaavio ei ole ainoa tapa lukea sivua. */
function TrendiTaulukko({ trendit }: { trendit: TrendiKausi[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Nuorten peliaika kausittain, osuus liigan minuuttikapasiteetista
        </caption>
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-white/40">
            <th className="text-left font-normal py-2 pr-3">Kausi</th>
            <th className="text-right font-normal py-2 px-3">
              {NIMET.osuus1721}
            </th>
            <th className="text-right font-normal py-2 px-3">
              {NIMET.osuusAlle21}
            </th>
            <th className="text-right font-normal py-2 px-3">{NIMET.fin}</th>
            <th className="text-right font-normal py-2 px-3">{NIMET.muu}</th>
            <th className="text-right font-normal py-2 pl-3">
              {NIMET.eiTietoa}
            </th>
          </tr>
        </thead>
        <tbody>
          {trendit.map((t) => (
            <tr key={t.kausi} className="border-t border-navy-700">
              <td className="py-2 pr-3 text-white/80">
                {t.kausi}
                {t.kesken && (
                  <span className="text-white/40">
                    {' '}
                    kesken
                    {t.otteluitaPelattu !== null
                      ? ' (' + luku(t.otteluitaPelattu) + ' ottelua pelattu)'
                      : ''}
                  </span>
                )}
              </td>
              <td className="py-2 px-3 text-right tabular text-white/80">
                {pros(t.osuus1721)}
              </td>
              <td className="py-2 px-3 text-right tabular text-white/80">
                {pros(t.osuusAlle21)}
              </td>
              <td className="py-2 px-3 text-right tabular text-white/60">
                {pros(t.alle21Jako ? t.alle21Jako.fin : null)}
              </td>
              <td className="py-2 px-3 text-right tabular text-white/60">
                {pros(t.alle21Jako ? t.alle21Jako.muu : null)}
              </td>
              <td className="py-2 pl-3 text-right tabular text-white/60">
                {pros(t.alle21Jako ? t.alle21Jako.eiTietoa : null)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
