// ============================================
// POLKU VEIKKAUSLIIGAAN
//
// Sulkee ketjun peliaika → seuraava taso: kuinka moni Ykkosliigassa
// pelannut nuori pelasi seuraavalla kaudella Veikkausliigassa.
//
// Luvut tulevat rajapinnasta sellaisenaan. Selain ei laske mitaan, jottei
// sama saanto paase eriytymaan kahteen paikkaan — ja jotta luvut ovat
// samat kuin tarkistusajossa.
//
// Kolme tapausta erotetaan, koska pelkka "nousi Veikkausliigaan" -luku
// sisaltaisi kolme eri ilmiota: pelaaja vaihtoi seuraa, pelaajan seura
// nousi sarjassa, tai pelaaja siirtyi akatemiajoukkueesta emoseuraansa.
// ============================================
import type { PolkuTulos } from '@/services/api';
import { luku } from '@/utils/luvut';
import { naytaNimi } from '@/utils/nimet';

/** Sama merkki kuin joukkuekaaviossa. */
const AKATEMIA_MERKKI = '*';

function Rivi({
  teksti,
  arvo,
  lisa,
  sisennetty = false,
}: {
  teksti: string;
  arvo: number;
  lisa?: string;
  sisennetty?: boolean;
}) {
  return (
    <div
      className={
        'flex items-baseline gap-3 py-1.5 ' +
        (sisennetty ? 'pl-6 text-white/60' : 'text-white/80')
      }
    >
      <span className="flex-1">{teksti}</span>
      <span className="tabular text-right w-10">{luku(arvo)}</span>
      <span className="text-[11px] text-white/40 w-40 truncate">
        {lisa ?? ''}
      </span>
    </div>
  );
}

export function PolkuVeikkausliigaan({ polku }: { polku: PolkuTulos }) {
  if (!polku.saatavilla) return null;

  const { kausiN, kausiN1 } = polku;
  // Alle 17-vuotiaita ei nayteta nimella. Lahde kattaa 17–21-vuotiaat,
  // joten lista on kaytannossa aina taysi — mutta sääntö on koodissa,
  // ei oletuksessa lahteen sisallosta.
  const listattavat = polku.pelaajat.filter((p) => p.ika >= 17);
  const piilotettu = polku.pelaajat.length - listattavat.length;

  return (
    <section className="bg-navy-700/40 border border-navy-600 rounded-lg p-5 space-y-5">
      <h2 className="text-sm uppercase tracking-wider text-white/60">
        Polku Veikkausliigaan
      </h2>

      <p className="text-sm text-white/80 leading-relaxed">
        Kaudella {kausiN} Ykkösliigassa pelanneista{' '}
        <span className="tabular text-white">{luku(polku.nousseet)}</span>{' '}
        pelasi kaudella {kausiN1} Veikkausliigassa. Heistä{' '}
        <span className="tabular text-white">{luku(polku.debytoi)}</span> teki
        Veikkausliiga-debyyttinsä.
      </p>

      <div className="border-t border-navy-600 pt-3 text-sm">
        <Rivi
          teksti="Seura nousi sarjassa"
          arvo={polku.seuraNousi}
          lisa={polku.nousseetSeurat.join(', ')}
        />
        <Rivi teksti="Vaihtoi seuraa" arvo={polku.vaihtoiSeuraa} />
        <Rivi
          teksti="joista akatemiasta emoseuraan"
          arvo={polku.akatemiastaEmoseuraan}
          sisennetty
        />
        <Rivi
          teksti="joista akatemiasta muualle"
          arvo={polku.akatemiastaMuualle}
          sisennetty
        />
      </div>

      <p className="text-[11px] text-white/40 leading-relaxed max-w-3xl">
        Mukana vain pelaajat, joilla on peliminuutteja molemmissa sarjoissa.
        Lisäksi {luku(polku.vainKokoonpanossa)} pelaajaa oli molempien kausien
        kokoonpanoissa ilman peliaikaa ainakin toisessa sarjassa.
      </p>

      <p className="text-sm text-white/70">
        Toiseen suuntaan:{' '}
        <span className="tabular text-white/90">
          {luku(polku.toiseenSuuntaan)}
        </span>{' '}
        kaudella {kausiN} Veikkausliigassa pelannutta pelasi kaudella {kausiN1}{' '}
        Ykkösliigassa.
      </p>

      {listattavat.length > 0 && (
        <div className="overflow-x-auto border-t border-navy-600 pt-3">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Pelaajat, jotka pelasivat kaudella {kausiN} Ykkösliigassa ja
              kaudella {kausiN1} Veikkausliigassa
            </caption>
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-white/40">
                <th className="text-left font-normal py-2 pr-3">Pelaaja</th>
                <th className="text-left font-normal py-2 px-3">
                  Ykkösliiga {kausiN}
                </th>
                <th className="text-right font-normal py-2 px-3">min</th>
                <th className="text-left font-normal py-2 px-3">
                  Veikkausliiga {kausiN1}
                </th>
                <th className="text-right font-normal py-2 pl-3">min</th>
              </tr>
            </thead>
            <tbody>
              {listattavat.map((p) => (
                <tr key={p.slug} className="border-t border-navy-700">
                  <td className="py-2 pr-3 text-white/80">
                    {naytaNimi(p.nimi)}
                    {p.debytoi && (
                      <span className="text-[10px] text-ice ml-2 uppercase tracking-wider">
                        debyytti
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-white/60">
                    {p.ylSeura}
                    {p.akatemiasta !== null && (
                      <span className="text-white/40"> {AKATEMIA_MERKKI}</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right tabular text-white/60">
                    {luku(p.ylMinuutit)}
                  </td>
                  <td className="py-2 px-3 text-white/60">{p.vlSeura}</td>
                  <td className="py-2 pl-3 text-right tabular text-white/60">
                    {luku(p.vlMinuutit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {piilotettu > 0 && (
            <p className="text-[11px] text-white/40 mt-2">
              {luku(piilotettu)} alle 17-vuotiasta jätetty listalta pois.
            </p>
          )}
        </div>
      )}

      <div className="border-t border-navy-600 pt-3">
        <p className="text-[11px] uppercase tracking-wider text-white/40 mb-2">
          Rajoitukset
        </p>
        <ul className="text-[11px] text-white/40 leading-relaxed space-y-1 list-disc list-inside max-w-3xl">
          <li>
            Data kattaa vain 17–21-vuotiaat. 22-vuotiaana noussut ei näy, eikä
            pelaaja näy enää täytettyään 22.
          </li>
          <li>
            Ykkösliiga alkoi 2024, joten siirtymiä on toistaiseksi kaksi.
          </li>
          <li>
            Ykkönen, muut sarjat ja ulkomaat eivät ole datassa, joten &quot;mistä
            pelaaja tuli&quot; ei ole koko kuva.
          </li>
          <li>
            Kesken kauden tapahtuneet siirrot näkyvät saman kauden kahtena
            sarjana, ei seuraavan kauden nousuna.
          </li>
          <li>
            {AKATEMIA_MERKKI} merkitsee akatemiajoukkuetta, sama merkki kuin
            joukkuekaaviossa.
          </li>
        </ul>
      </div>
    </section>
  );
}
