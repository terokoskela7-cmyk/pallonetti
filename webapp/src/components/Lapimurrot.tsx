// ============================================
// LÄPIMURROT JA DEBYYTIN JÄLKEEN
//
// Luvut tulevat /lapimurrot-rajapinnasta sellaisinaan; selain ei laske
// rajoja eikä luokittele. Määritelmät: functions/src/services/lapimurrot.ts.
//
//   Läpimurto  450 kumulatiivista Veikkausliiga-minuuttia (ECA / Football
//              Benchmark: "successful transition")
//   Vakiintunut ≥ 20 % pääseuran kauden minuuteista — pallonetin oma raja
// ============================================
import { useState } from 'react';
import type {
  DebytoijanPolku,
  DebyyttikausiYhteenveto,
  JalkeenLuokka,
  LapimurtoTulos,
} from '@/services/api';
import { SisainenLinkki } from '@/components/SisainenLinkki';
import { sarjanLyhytNimi } from '@/constants/sarjat';
import { naytaNimi } from '@/utils/nimet';
import { luku } from '@/utils/luvut';

const ECA_URL = 'https://footballbenchmark.com/w/managing-talent-revolutionizing-talent-identification';

/** Luokat järjestyksessä parhaasta heikoimpaan; värit pysyvät samoina kaikkialla. */
const LUOKAT: { luokka: JalkeenLuokka; nimi: string; vari: string }[] = [
  { luokka: 'kasvoi', nimi: 'Minuutit kasvoivat', vari: 'bg-green-500' },
  { luokka: 'pysyi', nimi: 'Pysyivät samoina', vari: 'bg-ice' },
  { luokka: 'laski', nimi: 'Laskivat', vari: 'bg-amber-400' },
  { luokka: 'ei peliaikaa', nimi: 'Kokoonpanossa ilman peliaikaa', vari: 'bg-orange-500' },
  { luokka: 'alempi sarja', nimi: 'Alempi sarja', vari: 'bg-red-500' },
  { luokka: 'täytti 22', nimi: 'Täytti 22 (ei datassa)', vari: 'bg-white/30' },
  { luokka: 'ei datassa', nimi: 'Ei datassa', vari: 'bg-white/15' },
];

const LUOKAN_NIMI: Record<JalkeenLuokka, string> = {
  kasvoi: 'kasvoi',
  pysyi: 'pysyi',
  laski: 'laski',
  'ei peliaikaa': 'ei peliaikaa',
  'alempi sarja': 'alempi sarja',
  'täytti 22': 'täytti 22',
  'ei datassa': 'ei datassa',
  'ei vielä': 'ei vielä',
};

// ---------- Ryhmä: kaikki / Suomen kansalaiset / omat kasvatit ----------

export type Ryhma = 'kaikki' | 'suomi' | 'kasvatit';

const RYHMAT: { arvo: Ryhma; nimi: string }[] = [
  { arvo: 'kaikki', nimi: 'Kaikki' },
  { arvo: 'suomi', nimi: 'Suomen kansalaiset' },
  { arvo: 'kasvatit', nimi: 'Oman akatemiajoukkueen kautta' },
];

function ryhmanYhteenveto(tulos: LapimurtoTulos, ryhma: Ryhma): DebyyttikausiYhteenveto[] {
  if (ryhma === 'suomi') return tulos.yhteenvetoSuomi ?? [];
  if (ryhma === 'kasvatit') return tulos.yhteenvetoKasvatit ?? [];
  return tulos.yhteenveto;
}

function ryhmassa(p: DebytoijanPolku, ryhma: Ryhma): boolean {
  if (ryhma === 'suomi') return p.kansalaisuus === 'suomi';
  if (ryhma === 'kasvatit') return p.akatemianKasvatti;
  return true;
}

export function RyhmaValitsin({
  ryhma,
  onChange,
  tulos,
}: {
  ryhma: Ryhma;
  onChange: (r: Ryhma) => void;
  tulos: LapimurtoTulos;
}) {
  const kk = tulos.kansalaisuusKaudet ?? [];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Pelaajaryhmä">
        {RYHMAT.map((r) => (
          <button
            key={r.arvo}
            type="button"
            aria-pressed={ryhma === r.arvo}
            onClick={() => onChange(r.arvo)}
            className={
              'px-3 py-1.5 rounded-md border text-sm transition-colors ' +
              (ryhma === r.arvo
                ? 'border-ice bg-ice/10 text-white'
                : 'border-navy-600 text-toissijainen hover:text-white hover:border-ice/40')
            }
          >
            {r.nimi}
          </button>
        ))}
      </div>
      {ryhma === 'suomi' && (
        <p className="text-[11px] text-vaimea max-w-3xl">
          Kansalaisuus Veikkausliigan pelaajarekisteristä
          {kk.length > 0 ? ' (kaudet ' + kk.join(', ') + ')' : ''}. Rekisterissä on yksi maakoodi
          per pelaaja, joten kaksoiskansalaisuus ei näy, ja pelaaja, jota rekisteristä ei löydy,
          puuttuu tästä ryhmästä. Luvut ovat siksi alarajoja.
        </p>
      )}
      {ryhma === 'kasvatit' && (
        <p className="text-[11px] text-vaimea max-w-3xl">
          Pelaaja pelasi seuransa akatemiajoukkueessa (HJK Klubi 04, SJK Akatemia, KuPS Akatemia
          I) viimeistään debyyttikaudellaan ja debytoi emoseurassa. Tämä ei ole sama kuin oma
          kasvatti: akatemiajoukkueessa pelaa myös muualta, myös ulkomailta, hankittuja nuoria, ja
          muiden seurojen kasvatit eivät näy tässä. Kasvattiluku tulee, kun juniorivuosien
          seurahistoria tuodaan.
        </p>
      )}
    </div>
  );
}

export function DebyytinJalkeen({ tulos, ryhma = 'kaikki' }: { tulos: LapimurtoTulos; ryhma?: Ryhma }) {
  const rivit = ryhmanYhteenveto(tulos, ryhma).filter((y) => y.debytoineet > 0);
  if (rivit.length === 0) {
    return (
      <section className="bg-navy-700/40 border border-navy-600 rounded-lg p-5">
        <h2 className="text-sm uppercase tracking-wider text-toissijainen">Debyytin jälkeen</h2>
        <p className="text-sm text-vaimea mt-2">Tässä ryhmässä ei ole debyyttejä.</p>
      </section>
    );
  }
  const pros = Math.round(tulos.maaritelmat.vakiintunutOsuus * 100);

  return (
    <section className="bg-navy-700/40 border border-navy-600 rounded-lg p-5 space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm uppercase tracking-wider text-toissijainen">Debyytin jälkeen</h2>
        <p className="text-sm text-toissijainen max-w-3xl">
          Veikkausliigassa debytoineet nuoret debyyttikausittain: montako ylitti{' '}
          {luku(tulos.maaritelmat.lapimurtoMin)} minuutin läpimurtorajan, montako sai vähintään{' '}
          {pros} % seuransa kauden minuuteista, ja mitä seuraavalla kaudella tapahtui.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Veikkausliigassa debytoineet debyyttikausittain</caption>
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-vaimea">
              <th scope="col" className="text-left font-normal py-2 pr-3">Debyyttikausi</th>
              <th scope="col" className="text-right font-normal py-2 px-3">Debytoi</th>
              <th scope="col" className="text-right font-normal py-2 px-3">Min debyyttikaudella</th>
              <th scope="col" className="text-right font-normal py-2 px-3">Alemmalta tasolta</th>
              <th scope="col" className="text-right font-normal py-2 px-3">Läpimurto</th>
              <th scope="col" className="text-right font-normal py-2 px-3">Vakiintui</th>
              <th scope="col" className="text-left font-normal py-2 pl-3 min-w-[16rem]">
                Seuraava kausi
              </th>
            </tr>
          </thead>
          <tbody>
            {rivit.map((y) => {
              const tiedossa = y.debytoineet - y.jalkeen['ei vielä'];
              return (
                <tr key={y.kausi} className="border-t border-navy-700">
                  <td className="py-2 pr-3 font-mono text-white/80">{y.kausi}</td>
                  <td className="py-2 px-3 text-right tabular text-white/80">
                    {y.debytoineet}
                  </td>
                  <td className="py-2 px-3 text-right tabular text-toissijainen">
                    {luku(y.debyyttiMinuutit ?? 0)}
                  </td>
                  <td className="py-2 px-3 text-right tabular text-toissijainen">{y.alemmaltaTasolta}</td>
                  <td className="py-2 px-3 text-right tabular text-white/80">{y.lapimurto}</td>
                  <td className="py-2 px-3 text-right tabular text-white/80">{y.vakiintunut}</td>
                  <td className="py-2 pl-3">
                    {tiedossa === 0 ? (
                      <span className="text-xs text-vaimea">seuraavaa kautta ei vielä pelattu</span>
                    ) : (
                      <span
                        className="flex h-3 rounded-sm overflow-hidden bg-navy-900/60"
                        role="img"
                        aria-label={LUOKAT.map((l) => l.nimi + ' ' + y.jalkeen[l.luokka]).join(', ')}
                      >
                        {LUOKAT.map((l) =>
                          y.jalkeen[l.luokka] > 0 ? (
                            <span
                              key={l.luokka}
                              className={l.vari}
                              style={{ width: (y.jalkeen[l.luokka] / tiedossa) * 100 + '%' }}
                              title={l.nimi + ': ' + y.jalkeen[l.luokka]}
                            />
                          ) : null,
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-vaimea">
        {LUOKAT.map((l) => (
          <li key={l.luokka} className="inline-flex items-center gap-1.5">
            <span className={'inline-block w-2.5 h-2.5 rounded-sm ' + l.vari} aria-hidden="true" />
            {l.nimi}
          </li>
        ))}
      </ul>

      <div className="border-t border-navy-600 pt-3 text-[11px] text-vaimea leading-relaxed space-y-1 max-w-3xl">
        <p>
          <span className="text-toissijainen">Läpimurto</span> = {luku(tulos.maaritelmat.lapimurtoMin)}{' '}
          kumulatiivista Veikkausliiga-minuuttia. Raja on ECA:n ja Football Benchmarkin
          määritelmä onnistuneelle siirtymälle edustusjoukkueeseen (
          <a href={ECA_URL} target="_blank" rel="noopener noreferrer" className="text-ice hover:text-white">
            lähde
          </a>
          ). <span className="text-toissijainen">Vakiintui</span> = vähintään {pros} % pääseuran kauden
          minuuteista jollain kaudella; tämä on pallonetin oma raja.
        </p>
        <p>
          Aineiston ensimmäinen Veikkausliiga-kausi ({tulos.vlKaudet[0]}) ei ole mukana: sillä
          debyyttiä ei voi erottaa aiemmin pelanneesta. Minuutit kertyvät vain 17–21-vuotiaana,
          ja &quot;ei datassa&quot; voi tarkoittaa ulkomaita, Ykköstä alempaa sarjaa tai
          lopettamista — niitä ei voi erottaa toisistaan.
        </p>
      </div>
    </section>
  );
}

export function Lapimurrot({ tulos, ryhma = 'kaikki' }: { tulos: LapimurtoTulos; ryhma?: Ryhma }) {
  const kaudet = ryhmanYhteenveto(tulos, ryhma)
    .filter((y) => y.lapimurto > 0)
    .map((y) => y.kausi);
  const [valittu, setValittu] = useState<number | 'kaikki'>('kaikki');
  const lista = tulos.pelaajat.filter(
    (p) =>
      p.debyyttiTiedossa &&
      p.lapimurtoKausi !== null &&
      ryhmassa(p, ryhma) &&
      (valittu === 'kaikki' || p.debyyttiKausi === valittu),
  );
  if (kaudet.length === 0) {
    return (
      <section className="bg-navy-700/40 border border-navy-600 rounded-lg p-5">
        <h2 className="text-sm uppercase tracking-wider text-toissijainen">Läpimurrot</h2>
        <p className="text-sm text-vaimea mt-2">Tässä ryhmässä ei ole läpimurtoja.</p>
      </section>
    );
  }

  const nappi = (arvo: number | 'kaikki', teksti: string) => (
    <button
      key={String(arvo)}
      type="button"
      aria-pressed={valittu === arvo}
      onClick={() => setValittu(arvo)}
      className={
        'px-3 py-1 rounded-md border text-xs font-mono transition-colors ' +
        (valittu === arvo
          ? 'border-ice bg-ice/10 text-white'
          : 'border-navy-600 text-toissijainen hover:text-white hover:border-ice/40')
      }
    >
      {teksti}
    </button>
  );

  return (
    <section className="bg-navy-700/40 border border-navy-600 rounded-lg p-5 space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm uppercase tracking-wider text-toissijainen">Läpimurrot</h2>
        <p className="text-sm text-toissijainen max-w-3xl">
          Nuoret, jotka ylittivät {luku(tulos.maaritelmat.lapimurtoMin)} Veikkausliiga-minuutin
          rajan: mistä he tulivat, milloin debyytti ja läpimurto tapahtuivat.
        </p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Debyyttikausi">
        {nappi('kaikki', 'Kaikki')}
        {kaudet.map((k) => nappi(k, 'Debyytti ' + k))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Veikkausliigan läpimurrot</caption>
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-vaimea">
              <th scope="col" className="text-left font-normal py-2 pr-3">Pelaaja</th>
              <th scope="col" className="text-left font-normal py-2 px-3">Tuli</th>
              <th scope="col" className="text-left font-normal py-2 px-3">Debyytti</th>
              <th scope="col" className="text-right font-normal py-2 px-3">Läpimurto</th>
              <th scope="col" className="text-right font-normal py-2 px-3">VL-min</th>
              <th scope="col" className="text-left font-normal py-2 pl-3">Seuraava kausi</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.slug + p.debyyttiKausi} className="border-t border-navy-700">
                <td className="py-2 pr-3">
                  <SisainenLinkki
                    to={`/pelaaja/${p.slug}?sarja=veikkausliiga&kausi=${p.debyyttiKausi}`}
                    className="text-white/90 hover:text-ice transition-colors"
                  >
                    {naytaNimi(p.nimi)}
                  </SisainenLinkki>
                  {p.akatemianKasvatti && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-ice" title="Seuran akatemiajoukkueen kautta">
                      akatemia
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-toissijainen">
                  {p.ennen ? (
                    <>
                      {sarjanLyhytNimi(p.ennen.sarja)} {p.debyyttiKausi - 1}
                      <span className="text-vaimea"> · {p.ennen.seura}</span>
                    </>
                  ) : (
                    <span className="text-white/30">–</span>
                  )}
                </td>
                <td className="py-2 px-3 text-toissijainen">
                  <span className="font-mono">{p.debyyttiKausi}</span>
                  <span className="text-vaimea">
                    {' · '}
                    {p.debyyttiSeura}
                    {p.debyyttiIka > 0 && ' · ' + p.debyyttiIka + ' v'}
                  </span>
                </td>
                <td className="py-2 px-3 text-right font-mono text-white/80">{p.lapimurtoKausi}</td>
                <td className="py-2 px-3 text-right tabular text-toissijainen">{luku(p.vlMinYhteensa)}</td>
                <td className="py-2 pl-3 text-toissijainen">
                  {LUOKAN_NIMI[p.jalkeen.luokka]}
                  {p.jalkeen.luokka === 'alempi sarja' && p.jalkeen.sarja && (
                    <span className="text-vaimea"> · {sarjanLyhytNimi(p.jalkeen.sarja)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-vaimea">
        &quot;Tuli&quot; = debyyttiä edeltävä kausi alemmalla tasolla, jos se on datassa. Tyhjä voi
        tarkoittaa akatemiaa, junioreita, ulkomaita tai alle 17-vuotiaana pelattua kautta.
      </p>
    </section>
  );
}
