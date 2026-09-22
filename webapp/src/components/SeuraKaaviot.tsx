// ============================================
// PIENET KAAVIOT — yksi seura, yksi kaavio
//
// KOLME SÄÄNTÖÄ, JOTKA TEKEVÄT VERTAILUSTA REHELLISEN
//
// 1. Sama y-akseli kaikissa. Yläraja lasketaan datasta (suurin arvo
//    kaikissa seuroissa ja kausissa), ei kovakoodata. Jos jokainen
//    kaavio skaalautuisi omaan maksimiinsa, 5 %:n ja 50 %:n seura
//    näyttäisivät samalta — ja juuri vertailu on tämän sivun idea.
// 2. Puuttuva kausi on katko, ei nolla. `connectNulls={false}` jättää
//    välin auki. Nolla väittäisi, ettei nuorille mennyt minuuttia;
//    totuus on, ettei seura ollut sarjassa.
// 3. Kaksi vertailuviivaa: sarjan taso kaikkine joukkueineen ja ilman
//    akatemiajoukkueita. Ykkösliigassa ero on moninkertainen, joten
//    yksi viiva antaisi väärän kuvan muiden seurojen käytännöstä.
// ============================================
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
} from 'recharts';
import type {
  ValueType,
  NameType,
} from 'recharts/types/component/DefaultTooltipContent';
import type { Seuratrendi, Vertailuviiva } from '@/services/api';
import { desimaali } from '@/utils/luvut';
import { AKATEMIA_SELITE } from '@/constants/akatemiat';

interface Piste {
  kausi: number;
  osuus: number | null;
  liukuva: number | null;
}

function KaavionVihje({ active, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload as Piste;
  return (
    <div className="bg-navy-800 border border-navy-600 rounded-md shadow-xl px-3 py-2 text-xs">
      <div className="text-white/90 font-medium">{d.kausi}</div>
      {d.osuus === null ? (
        <div className="text-white/50">ei tässä sarjassa</div>
      ) : (
        <div className="text-ice tabular">{desimaali(d.osuus)} %</div>
      )}
      {d.liukuva !== null && (
        <div className="text-white/50 tabular">
          liukuva {desimaali(d.liukuva)} %
        </div>
      )}
    </div>
  );
}

interface PieniKaavioProps {
  seura: Seuratrendi;
  kaudet: number[];
  ylaraja: number;
  /** Sarjan taso viimeisimmältä kaudelta — harmaa vertailuviiva. */
  viiva: Vertailuviiva | null;
  liukuvaIkkuna: number;
}

function PieniKaavio({
  seura,
  kaudet,
  ylaraja,
  viiva,
  liukuvaIkkuna,
}: PieniKaavioProps) {
  const data: Piste[] = kaudet.map((kausi, i) => ({
    kausi,
    osuus: seura.pisteet[i],
    liukuva: seura.liukuva[i],
  }));

  const viimeisin = seura.pisteet[seura.pisteet.length - 1];
  const katkoja = seura.pisteet.some((p) => p === null);

  return (
    <div className="bg-navy-700/30 border border-navy-600 rounded-lg p-3">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-sm text-white/90 truncate">{seura.nimi}</span>
        <span className="text-sm text-ice font-mono tabular shrink-0">
          {viimeisin === null ? '–' : desimaali(viimeisin) + ' %'}
        </span>
      </div>

      {seura.akatemia && (
        <span
          className="inline-block rounded border border-navy-500 bg-navy-700/60 px-1.5 text-[10px] text-white/50 mb-1"
          title={AKATEMIA_SELITE}
        >
          akatemiajoukkue
        </span>
      )}

      <div style={{ width: '100%', height: 96 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
            <XAxis
              dataKey="kausi"
              stroke="#8899AA"
              tick={{ fontSize: 9, fill: '#6b7c93' }}
              tickLine={false}
              axisLine={{ stroke: '#243350' }}
              interval="preserveStartEnd"
            />
            <YAxis
              // Sama domain kaikissa kaavioissa — tämä on koko vertailun ehto.
              domain={[0, ylaraja]}
              stroke="#8899AA"
              tick={{ fontSize: 9, fill: '#6b7c93' }}
              tickLine={false}
              axisLine={false}
              width={34}
              unit=" %"
            />
            <Tooltip content={<KaavionVihje />} cursor={{ stroke: '#00C8FF', strokeOpacity: 0.2 }} />
            {viiva?.kaikki !== null && viiva !== null && (
              <ReferenceLine y={viiva.kaikki!} stroke="#8899AA" strokeDasharray="3 3" strokeOpacity={0.5} />
            )}
            {viiva?.ilmanAkatemioita !== null && viiva !== null && (
              <ReferenceLine
                y={viiva.ilmanAkatemioita!}
                stroke="#8899AA"
                strokeDasharray="1 4"
                strokeOpacity={0.7}
              />
            )}
            {/* Liukuva keskiarvo taustalle, mittaus päälle. */}
            <Line
              type="monotone"
              dataKey="liukuva"
              stroke="#8899AA"
              strokeWidth={1.5}
              strokeOpacity={0.55}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="osuus"
              stroke="#00C8FF"
              strokeWidth={2}
              dot={{ fill: '#00C8FF', r: 2 }}
              isAnimationActive={false}
              // Katko jätetään auki: puuttuva kausi ei ole nolla.
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {katkoja && (
        <div className="text-[10px] text-white/35 mt-0.5">
          katko = ei tässä sarjassa
        </div>
      )}
      {!katkoja && seura.liukuva.some((x) => x !== null) && (
        <div className="text-[10px] text-white/35 mt-0.5">
          harmaa = {liukuvaIkkuna} kauden liukuva
        </div>
      )}
    </div>
  );
}

interface Props {
  seurat: Seuratrendi[];
  kaudet: number[];
  vertailuviivat: Vertailuviiva[];
  liukuvaIkkuna: number;
  /**
   * Yhteinen yläraja rajapinnasta. EI lasketa täällä: seuran oma sivu
   * käyttää samaa lukua, ja kaksi sääntöä ehtisi eriytyä.
   */
  ylaraja: number;
}

export function SeuraKaaviot({
  seurat,
  kaudet,
  vertailuviivat,
  liukuvaIkkuna,
  ylaraja,
}: Props) {
  if (seurat.length === 0 || kaudet.length === 0) return null;

  const viimeisin =
    vertailuviivat.length > 0 ? vertailuviivat[vertailuviivat.length - 1] : null;

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-white/40 leading-relaxed max-w-3xl">
        Kaikilla kaavioilla on sama pystyakseli (0–{ylaraja} %), joten ne ovat
        vertailukelpoisia keskenään.
        {/* Toinen katkoviiva piirretään vain, jos sarjassa on
            akatemiajoukkueita — muuten viivoja olisi kaksi päällekkäin. */}
        {viimeisin === null || viimeisin.kaikki === null
          ? ''
          : viimeisin.ilmanAkatemioita === null
            ? ' Katkoviiva on sarjan taso viimeisimmältä kaudelta (' +
              desimaali(viimeisin.kaikki) +
              ' %).'
            : ' Katkoviivat ovat sarjan taso viimeisimmältä kaudelta: tiheämpi' +
              ' kaikki joukkueet (' +
              desimaali(viimeisin.kaikki) +
              ' %), harvempi ilman akatemiajoukkueita (' +
              desimaali(viimeisin.ilmanAkatemioita) +
              ' %).'}
      </p>
      {/* Mobiilissa kaksi saraketta. */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {seurat.map((s) => (
          <PieniKaavio
            key={s.tunniste}
            seura={s}
            kaudet={kaudet}
            ylaraja={ylaraja}
            viiva={viimeisin}
            liukuvaIkkuna={liukuvaIkkuna}
          />
        ))}
      </div>
    </div>
  );
}
