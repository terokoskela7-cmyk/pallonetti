// ============================================
// KAUSITUONTI — Veikkausliigan kausi- ja vaihekohtainen Excel-tuonti
//
// Laajentaa excelImport.ts:n (Vaihe A) yhden kauden / yhden kierroksen
// tuonnin monikautiseksi ja vaihetietoiseksi.
//
// KESKEINEN ERO VANHAAN: rivi ei ole pelaaja × kausi vaan
// pelaaja × kausi × vaihe × joukkue. Vaiheita EI aggregoida pois
// parsinnassa — ne ovat dokumenttiavaimen osa. Kausisumma syntyy vasta
// projektiossa, kun vaiheet ja seurat lasketaan yhteen.
//
// Tämä tiedosto on tarkoituksella puhdas: ei firebase-admin-importtia
// eikä kirjoituksia, jotta esikatselun (dry-run) voi ajaa ilman Firestorea.
// Kirjoitus on omassa moduulissaan.
//
// Projektin invariantit: päivämäärät Date.UTC(), ei sisäkkäisiä template
// literaaleja (käytetään +-ketjutusta).
// ============================================
import * as XLSX from 'xlsx';
import { toSlug } from './excelImport';

// ---------- Sarakkeet ----------

/** Sarakkeet joita ilman tuontia ei voi tehdä. Puuttuva sarake → tiedosto hylätään. */
export const PAKOLLISET_SARAKKEET = [
  'Etunimi',
  'Sukunimi',
  'Kausi',
  'Sarjan vaihe',
  'Joukkue',
  'Pelatut minuutit (min)',
  'Joukkueen ottelut sarjassa',
] as const;

const VALINNAISET_SARAKKEET = [
  'Pelaajan ikä kaudella',
  'Sarja',
  'Pelatut minuutit (%)',
  'Ottelut aloituksessa',
  'Pelatut ottelut',
  'Ottelut kokoonpanossa',
  'Maalit',
] as const;

// ---------- Sarjarajaus ----------

/**
 * Ainoa tuettu sarja. Sivusto laskee Veikkausliigan lukuja, ja nimittajat
 * (joukkueen ottelut) ovat sarjakohtaisia: toisen sarjan rivit sekoittuisivat
 * samoihin avaimiin ja vaarentaisivat osuudet. Ykkosliiga tulee omana
 * tyonaan, jolloin sarja lisataan avaimiin.
 */
export const TUETTU_SARJA = 'Veikkausliiga';

/** Kayttajalle nakyva viesti vaaran sarjan tiedostosta. */
export const VIESTI_VAARA_SARJA =
  'Tiedostossa on muun sarjan rivejä (esim. Ykkösliiga). ' +
  'Vain Veikkausliiga on tuettu.';

// ---------- Tyypit ----------

/** Yksi lähderivi = pelaaja × kausi × vaihe × joukkue. */
export interface SuoritusRivi {
  /** Excel-rivinumero (1-pohjainen) raportointia varten. */
  rivi: number;
  kausi: string;
  vaihe: string;
  joukkue: string;
  sarja: string;
  /** Dokumenttiavaimen pelaajaosa: skandit säilytetään. */
  pelaajaAvain: string;
  /** Linkki olemassa oleviin pelaajasivuihin (/pelaaja/:slug). */
  slug: string;
  etunimi: string;
  sukunimi: string;
  ika: number;
  minuutit: number;
  minuutit_pros: number;
  aloitukset: number;
  ottelut: number;
  kokoonpanossa: number;
  maalit: number;
  joukkueen_ottelut: number;
}

export interface OhitettuRivi {
  rivi: number;
  syy: string;
}

export interface Varoitus {
  tyyppi:
    | 'nimittaja_ristiriita'
    | 'vaihe_puuttuu_seuralta'
    | 'minuutit_ylittavat_ottelut'
    | 'siirto_kesken_kauden'
    | 'duplikaatti_identtinen';
  viesti: string;
  kausi?: string;
}

/** nimittajat/{kausi}_{vaihe}_{joukkue} */
export interface Nimittaja {
  kausi: string;
  vaihe: string;
  joukkue: string;
  ottelut: number;
  kapasiteetti_min: number;
}

/** Yhden kauden laskettu yhteenveto esikatselua varten. */
export interface KausiYhteenveto {
  kausi: string;
  vaiheet: string[];
  joukkueet: number;
  rivit: number;
  pelaajat: number;
  /** Nuorten minuutit / kapasiteetti, koko kausi. */
  osuus_koko_kausi: number;
  /** Sama vain vaiheelle Runkosarja. */
  osuus_runkosarja: number;
  minuutit_yhteensa: number;
  kapasiteetti_yhteensa: number;
  /** Ottelut per joukkue kauden yli, vaihteluväli. */
  ottelut_min: number;
  ottelut_max: number;
}

/** Projektio seasons/{kausi}/players/{slug} — pelaajan kausisumma yli vaiheiden JA seurojen. */
export interface KausiProjektio {
  kausi: string;
  slug: string;
  pelaajaAvain: string;
  etunimi: string;
  sukunimi: string;
  ika: number;
  /** Seura jossa eniten minuutteja kyseisellä kaudella. */
  joukkue: string;
  /** Kaikki seurat joissa pelasi kaudella (1 = ei siirtoa). */
  joukkueet: string[];
  minTotal: number;
  ottelutTotal: number;
  aloituksetTotal: number;
  maaliTotal: number;
}

export interface TuontiTulos {
  /** Tyhjä = tiedosto kelpaa. Ei-tyhjä = tiedosto hylätään, mitään ei kirjoiteta. */
  virheet: string[];
  rivitLuettu: number;
  suoritukset: SuoritusRivi[];
  ohitetut: OhitettuRivi[];
  varoitukset: Varoitus[];
  nimittajat: Nimittaja[];
  kaudet: KausiYhteenveto[];
  projektiot: KausiProjektio[];
  /** Deterministinen dokumentti-ID per suoritus, samassa järjestyksessä. */
  suoritusIdt: string[];
}

// ---------- Apurit ----------

/**
 * pelaajaAvain: trimmaus, pienet kirjaimet, peräkkäiset välilyönnit yhdeksi.
 * Skandit SÄILYTETÄÄN — ä/å/ö:n poisto yhdistäisi eri pelaajia.
 */
export function pelaajaAvaimeksi(etunimi: string, sukunimi: string): string {
  const koko = String(etunimi || '').trim() + ' ' + String(sukunimi || '').trim();
  return koko.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Firestore-dokumentti-ID ei saa sisältää kauttaviivaa. Muu säilytetään luettavana. */
function turvallinenOsa(arvo: string): string {
  return String(arvo).replace(/\//g, '-').trim();
}

/** suoritukset/{kausi}_{vaihe}_{joukkue}_{pelaajaAvain} */
export function suoritusId(r: {
  kausi: string;
  vaihe: string;
  joukkue: string;
  pelaajaAvain: string;
}): string {
  return (
    turvallinenOsa(r.kausi) +
    '_' +
    turvallinenOsa(r.vaihe) +
    '_' +
    turvallinenOsa(r.joukkue) +
    '_' +
    turvallinenOsa(r.pelaajaAvain)
  );
}

/** nimittajat/{kausi}_{vaihe}_{joukkue} */
export function nimittajaId(n: {
  kausi: string;
  vaihe: string;
  joukkue: string;
}): string {
  return (
    turvallinenOsa(n.kausi) +
    '_' +
    turvallinenOsa(n.vaihe) +
    '_' +
    turvallinenOsa(n.joukkue)
  );
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/** Palauttaa null jos solu on tyhjä tai ei-numeerinen — erotettava nollasta. */
function toNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const siivottu = String(v).replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d*\.?\d+$/.test(siivottu)) return null;
  const n = parseFloat(siivottu);
  return Number.isFinite(n) ? n : null;
}

function toNum(v: unknown): number {
  const n = toNumOrNull(v);
  return n === null ? 0 : n;
}

// ---------- Parsinta ----------

/**
 * Excelin todelliset rivinumerot parsituille riveille.
 *
 * Veikkausliigan vienti kirjoittaa rivit ILMAN r-attribuuttia, jolloin
 * rivinumero on pelkkä järjestys. SheetJS pudottaa tällaisesta tiedostosta
 * tyhjät <row/>-elementit, jolloin kaikki niiden jälkeiset rivit siirtyvät
 * yhdellä ylöspäin. Raportoitu "rivi N" osoittaisi silloin väärään riviin
 * siinä tiedostossa jota ihminen katsoo Excelissä.
 *
 * Tämä lukee rivien todellisen järjestyksen taulukon raaka-XML:stä.
 * Palauttaa null jos kartta ei ole luotettava — silloin käytetään
 * parsittua indeksiä sellaisenaan.
 */
interface Rivikartta {
  /** numerot[i] = Excel-rivinumero parsitulle riville i (0-pohjainen). */
  numerot: number[];
  /** Excel-rivinumerot jotka SheetJS pudotti kokonaan pois. */
  pudotetutTyhjat: number[];
}

function laskeRivikartta(
  wb: XLSX.WorkBook,
  sheetName: string,
  parsittujaRiveja: number,
): Rivikartta | null {
  const files = (wb as unknown as { files?: Record<string, { content?: unknown }> })
    .files;
  if (!files) return null;

  const idx = wb.SheetNames.indexOf(sheetName);
  if (idx < 0) return null;
  const tiedosto = files['xl/worksheets/sheet' + (idx + 1) + '.xml'];
  if (!tiedosto || tiedosto.content === undefined) return null;

  const xml =
    typeof tiedosto.content === 'string'
      ? tiedosto.content
      : Buffer.from(tiedosto.content as Uint8Array).toString('utf8');

  // Jos rivit on numeroitu r-attribuutilla, SheetJS kunnioittaa niitä eikä
  // siirtymää synny — karttaa ei tarvita.
  if (/<(?:\w+:)?row\b[^>]*\sr=/.test(xml)) return null;

  const rivit = xml.match(
    /<(?:\w+:)?row\b[^>]*\/>|<(?:\w+:)?row\b[^>]*>[\s\S]*?<\/(?:\w+:)?row>/g,
  );
  if (!rivit || rivit.length === 0) return null;

  const numerot: number[] = [];
  const pudotetutTyhjat: number[] = [];
  rivit.forEach((r, i) => {
    const excelRivi = i + 1;
    const onSoluja = /<(?:\w+:)?c[\s>/]/.test(r);
    if (onSoluja) numerot.push(excelRivi);
    else pudotetutTyhjat.push(excelRivi);
  });

  // Varmistus: kartan on täsmättävä siihen mitä SheetJS tosiasiassa antoi.
  // Jos ei täsmää, karttaan ei voi luottaa → parempi olla käyttämättä.
  if (numerot.length !== parsittujaRiveja) return null;

  return { numerot, pudotetutTyhjat };
}

/**
 * Lukee taulukon rivit sellaisenaan taulukon alueelta.
 * Tyhjät rivit alueen sisällä säilyvät taulukossa tyhjinä.
 */
function lueRivitAlueelta(sheet: XLSX.WorkSheet): unknown[][] {
  const ref = sheet['!ref'];
  if (!ref) return [];
  const alue = XLSX.utils.decode_range(ref);
  const ulos: unknown[][] = [];

  for (let r = alue.s.r; r <= alue.e.r; r++) {
    const rivi: unknown[] = [];
    for (let c = alue.s.c; c <= alue.e.c; c++) {
      const solu = sheet[XLSX.utils.encode_cell({ r, c })] as
        | { v?: unknown }
        | undefined;
      rivi.push(solu && solu.v !== undefined ? solu.v : null);
    }
    ulos.push(rivi);
  }
  return ulos;
}

/**
 * Lukee xlsx-bufferin ja palauttaa täyden esikatselutuloksen.
 * EI kirjoita mitään. Jos `virheet` on ei-tyhjä, tiedosto on hylättävä.
 */
export function parsiKausiExcel(buffer: Buffer): TuontiTulos {
  const virheet: string[] = [];
  /** Muun sarjan rivit: sarjan nimi -> Excel-rivinumerot. */
  const muutSarjat = new Map<string, number[]>();
  const suoritukset: SuoritusRivi[] = [];
  const ohitetut: OhitettuRivi[] = [];
  const varoitukset: Varoitus[] = [];

  // bookFiles:true säilyttää taulukoiden raaka-XML:n, jota rivikartta tarvitsee.
  const wb = XLSX.read(buffer, { type: 'buffer', bookFiles: true });
  const sheetName = wb.SheetNames.includes('Export')
    ? 'Export'
    : wb.SheetNames[0];
  if (!sheetName) {
    return tyhjaTulos(['Excel-tiedostossa ei ole yhtään välilehteä']);
  }

  // Rivit luetaan suoraan taulukon alueelta eikä sheet_to_json:lla, koska
  // se karsii tyhjiä rivejä. Karsittu tyhjä rivi siirtäisi kaikkia sen
  // jälkeisiä rivinumeroita yhdellä, jolloin raportoitu "rivi N" ei osoita
  // enää siihen riviin jota ihminen katsoo Excelissä.
  const rivit = lueRivitAlueelta(wb.Sheets[sheetName]);
  const rivikartta = laskeRivikartta(wb, sheetName, rivit.length);

  // Excel-rivinumero parsitulle indeksille. Ilman karttaa indeksi kelpaa
  // sellaisenaan (tiedostossa on r-attribuutit tai se on yhtenäinen).
  const excelRivinumero = (indeksi: number): number =>
    rivikartta ? rivikartta.numerot[indeksi] : indeksi + 1;

  if (rivit.length < 2) {
    return tyhjaTulos(['Tiedostossa ei ole yhtään datariviä']);
  }

  // Sarakkeet luetaan NIMELLÄ, ei kiinteällä indeksillä — lähteen
  // sarakejärjestys ei ole sopimus.
  const otsikot = (rivit[0] as unknown[]).map((h) => toStr(h));
  const sar: Record<string, number> = {};
  otsikot.forEach((h, i) => {
    if (h && !(h in sar)) sar[h] = i;
  });

  const puuttuvatSarakkeet = PAKOLLISET_SARAKKEET.filter((s) => !(s in sar));
  if (puuttuvatSarakkeet.length > 0) {
    return tyhjaTulos([
      'Pakollisia sarakkeita puuttuu: ' + puuttuvatSarakkeet.join(', '),
    ]);
  }
  const puuttuvatValinnaiset = VALINNAISET_SARAKKEET.filter((s) => !(s in sar));

  const kentta = (rivi: unknown[], nimi: string): unknown =>
    nimi in sar ? rivi[sar[nimi]] : null;

  for (let i = 1; i < rivit.length; i++) {
    const rivi = (rivit[i] || []) as unknown[];
    const excelRivi = excelRivinumero(i);

    // 1) Täysin tyhjä rivi
    const tyhja = rivi.every((v) => v === null || v === undefined || toStr(v) === '');
    if (tyhja) {
      ohitetut.push({ rivi: excelRivi, syy: 'tyhjä rivi' });
      continue;
    }

    // 2) Veikkausliigan vienti päättyy suodatinselosteeseen: tekstiä vain
    //    ensimmäisessä sarakkeessa. Se ei ole dataa.
    const muutTyhjat = rivi
      .slice(1)
      .every((v) => v === null || v === undefined || toStr(v) === '');
    if (toStr(rivi[0]) !== '' && muutTyhjat) {
      ohitetut.push({ rivi: excelRivi, syy: 'footer/suodatinseloste, ei datariviä' });
      continue;
    }

    // 3) Pakollisia arvoja puuttuu → ohitetaan ja raportoidaan
    const puuttuvatArvot = PAKOLLISET_SARAKKEET.filter(
      (s) => toStr(kentta(rivi, s)) === '',
    );
    if (puuttuvatArvot.length > 0) {
      ohitetut.push({
        rivi: excelRivi,
        syy: 'puuttuvat arvot: ' + puuttuvatArvot.join(', '),
      });
      continue;
    }

    // 4) Sarja: vain Veikkausliiga. Muun sarjan rivi ei ole virhe rivissa
    //    vaan vaara tiedosto, joten se hylataan kokonaan silmukan jalkeen.
    //    Tyhja sarja-arvo kelpaa: sarake on valinnainen.
    const rivinSarja = toStr(kentta(rivi, 'Sarja'));
    if (rivinSarja !== '' && rivinSarja.toLowerCase() !== TUETTU_SARJA.toLowerCase()) {
      const rivitSarjalle = muutSarjat.get(rivinSarja) ?? [];
      rivitSarjalle.push(excelRivi);
      muutSarjat.set(rivinSarja, rivitSarjalle);
      continue;
    }

    // 5) Kausi on oltava nelinumeroinen vuosi → muuten koko tiedosto hylätään
    const kausi = toStr(kentta(rivi, 'Kausi'));
    if (!/^\d{4}$/.test(kausi)) {
      virheet.push(
        'Rivi ' + excelRivi + ': Kausi ei ole nelinumeroinen vuosi (' + kausi + ')',
      );
      continue;
    }

    // 6) Nimittäjää ei saa arvata → 0 tai ei-numeerinen hylkää tiedoston
    const joukkueenOttelut = toNumOrNull(kentta(rivi, 'Joukkueen ottelut sarjassa'));
    if (joukkueenOttelut === null || joukkueenOttelut <= 0) {
      virheet.push(
        'Rivi ' +
          excelRivi +
          ': Joukkueen ottelut sarjassa on 0 tai virheellinen — nimittäjää ei saa arvata',
      );
      continue;
    }

    // 7) Minuutit: puuttuva tai negatiivinen → ohitetaan ja raportoidaan
    const minuutit = toNumOrNull(kentta(rivi, 'Pelatut minuutit (min)'));
    if (minuutit === null || minuutit < 0) {
      ohitetut.push({
        rivi: excelRivi,
        syy: 'minuutit puuttuvat tai ovat negatiiviset',
      });
      continue;
    }

    const etunimi = toStr(kentta(rivi, 'Etunimi'));
    const sukunimi = toStr(kentta(rivi, 'Sukunimi'));
    const ottelut = toNum(kentta(rivi, 'Pelatut ottelut'));

    suoritukset.push({
      rivi: excelRivi,
      kausi,
      vaihe: toStr(kentta(rivi, 'Sarjan vaihe')),
      joukkue: toStr(kentta(rivi, 'Joukkue')),
      sarja: toStr(kentta(rivi, 'Sarja')),
      pelaajaAvain: pelaajaAvaimeksi(etunimi, sukunimi),
      slug: toSlug(etunimi, sukunimi),
      etunimi,
      sukunimi,
      ika: toNum(kentta(rivi, 'Pelaajan ikä kaudella')),
      minuutit,
      minuutit_pros: toNum(kentta(rivi, 'Pelatut minuutit (%)')),
      aloitukset: toNum(kentta(rivi, 'Ottelut aloituksessa')),
      ottelut,
      kokoonpanossa: toNum(kentta(rivi, 'Ottelut kokoonpanossa')),
      maalit: toNum(kentta(rivi, 'Maalit')),
      joukkueen_ottelut: joukkueenOttelut,
    });

    // Varoitus: minuutit eivät mahdu pelattuihin otteluihin
    if (ottelut > 0 && minuutit > ottelut * 90 + 15) {
      varoitukset.push({
        tyyppi: 'minuutit_ylittavat_ottelut',
        kausi,
        viesti:
          'Rivi ' +
          excelRivi +
          ': ' +
          etunimi +
          ' ' +
          sukunimi +
          ' — ' +
          minuutit +
          ' min / ' +
          ottelut +
          ' ottelua',
      });
    }
  }

  // Muun sarjan rivit hylkaavat koko tiedoston. Viesti on yksi ja sama
  // riippumatta rivimaarasta; toinen rivi kertoo mita loytyi ja mista.
  if (muutSarjat.size > 0) {
    virheet.push(VIESTI_VAARA_SARJA);
    for (const [sarjanNimi, rivinumerot] of muutSarjat) {
      const nayta = rivinumerot.slice(0, 5).join(', ');
      virheet.push(
        'Sarja "' +
          sarjanNimi +
          '": ' +
          rivinumerot.length +
          ' riviä (rivit ' +
          nayta +
          (rivinumerot.length > 5 ? ', …' : '') +
          ')',
      );
    }
  }

  // SheetJS pudotti nämä rivit kokonaan; ne ovat tyhjiä, joten dataa ei
  // menetetä — mutta ne kuuluvat ohitettujen raporttiin.
  if (rivikartta) {
    for (const tyhjaRivi of rivikartta.pudotetutTyhjat) {
      if (tyhjaRivi === 1) continue; // otsikkorivi ei voi olla tyhjä ohitus
      ohitetut.push({ rivi: tyhjaRivi, syy: 'tyhjä rivi' });
    }
  }
  ohitetut.sort((a, b) => a.rivi - b.rivi);

  if (puuttuvatValinnaiset.length > 0) {
    varoitukset.push({
      tyyppi: 'nimittaja_ristiriita',
      viesti:
        'Valinnaisia sarakkeita puuttuu, arvoiksi tulee 0: ' +
        puuttuvatValinnaiset.join(', '),
    });
  }

  // ---------- Duplikaattiavaimet ----------
  const avainRyhmat = new Map<string, SuoritusRivi[]>();
  for (const s of suoritukset) {
    const id = suoritusId(s);
    const lista = avainRyhmat.get(id);
    if (lista) lista.push(s);
    else avainRyhmat.set(id, [s]);
  }
  const uniikit: SuoritusRivi[] = [];
  for (const [id, ryhma] of avainRyhmat) {
    if (ryhma.length === 1) {
      uniikit.push(ryhma[0]);
      continue;
    }
    const identtinen = ryhma.every((r) => samatLuvut(r, ryhma[0]));
    if (identtinen) {
      varoitukset.push({
        tyyppi: 'duplikaatti_identtinen',
        kausi: ryhma[0].kausi,
        viesti:
          'Avain ' +
          id +
          ' esiintyy ' +
          ryhma.length +
          ' kertaa identtisin luvuin (rivit ' +
          ryhma.map((r) => r.rivi).join(', ') +
          ') — käytetään yhtä',
      });
      uniikit.push(ryhma[0]);
    } else {
      virheet.push(
        'Avain ' +
          id +
          ' esiintyy tiedostossa kahdesti ristiriitaisin luvuin (rivit ' +
          ryhma.map((r) => r.rivi).join(', ') +
          ')',
      );
    }
  }

  // ---------- Nimittäjät ----------
  const nimMap = new Map<string, { n: Nimittaja; ottelutNahty: Set<number> }>();
  for (const s of uniikit) {
    const id = nimittajaId(s);
    const olemassa = nimMap.get(id);
    if (olemassa) {
      olemassa.ottelutNahty.add(s.joukkueen_ottelut);
    } else {
      nimMap.set(id, {
        n: {
          kausi: s.kausi,
          vaihe: s.vaihe,
          joukkue: s.joukkue,
          ottelut: s.joukkueen_ottelut,
          kapasiteetti_min: s.joukkueen_ottelut * 90 * 11,
        },
        ottelutNahty: new Set([s.joukkueen_ottelut]),
      });
    }
  }
  for (const [id, v] of nimMap) {
    if (v.ottelutNahty.size > 1) {
      // Varoitetaan mutta jatketaan; suurin arvo on turvallisin nimittäjä,
      // koska liian pieni nimittäjä paisuttaisi seuran osuutta.
      const arvot = Array.from(v.ottelutNahty).sort((a, b) => a - b);
      const suurin = arvot[arvot.length - 1];
      v.n.ottelut = suurin;
      v.n.kapasiteetti_min = suurin * 90 * 11;
      varoitukset.push({
        tyyppi: 'nimittaja_ristiriita',
        kausi: v.n.kausi,
        viesti:
          'Nimittäjä ' +
          id +
          ': eri riveillä eri ottelumäärä (' +
          arvot.join(', ') +
          ') — käytetään suurinta ' +
          suurin,
      });
    }
  }
  const nimittajat = Array.from(nimMap.values()).map((v) => v.n);

  // ---------- Vaiheen puuttuminen seuralta ----------
  const kaudenVaiheet = new Map<string, Set<string>>();
  const kaudenJoukkueet = new Map<string, Set<string>>();
  for (const n of nimittajat) {
    if (!kaudenVaiheet.has(n.kausi)) kaudenVaiheet.set(n.kausi, new Set());
    if (!kaudenJoukkueet.has(n.kausi)) kaudenJoukkueet.set(n.kausi, new Set());
    kaudenVaiheet.get(n.kausi)!.add(n.vaihe);
    kaudenJoukkueet.get(n.kausi)!.add(n.joukkue);
  }
  // Runkosarja on ainoa vaihe jonka kaikki seurat pelaavat — loppuvaiheissa
  // osallistujajoukko on aito osajoukko, joten vain runkosarjaa voi vaatia.
  for (const [kausi, joukkueet] of kaudenJoukkueet) {
    const vaiheet = kaudenVaiheet.get(kausi)!;
    if (!vaiheet.has('Runkosarja')) continue;
    const runkosarjassa = new Set(
      nimittajat
        .filter((n) => n.kausi === kausi && n.vaihe === 'Runkosarja')
        .map((n) => n.joukkue),
    );
    for (const j of joukkueet) {
      if (!runkosarjassa.has(j)) {
        varoitukset.push({
          tyyppi: 'vaihe_puuttuu_seuralta',
          kausi,
          viesti:
            'Kausi ' +
            kausi +
            ': seuralla ' +
            j +
            ' ei ole yhtään riviä vaiheesta Runkosarja — nimittäjä jää liian ' +
            'pieneksi ja seuran osuus näyttää liian suurelta',
        });
      }
    }
  }

  // ---------- Siirrot kesken kauden ----------
  const pelaajanSeurat = new Map<string, Set<string>>();
  for (const s of uniikit) {
    const avain = s.kausi + '|' + s.pelaajaAvain;
    if (!pelaajanSeurat.has(avain)) pelaajanSeurat.set(avain, new Set());
    pelaajanSeurat.get(avain)!.add(s.joukkue);
  }
  for (const [avain, seurat] of pelaajanSeurat) {
    if (seurat.size > 1) {
      const osat = avain.split('|');
      varoitukset.push({
        tyyppi: 'siirto_kesken_kauden',
        kausi: osat[0],
        viesti:
          'Kausi ' +
          osat[0] +
          ': ' +
          osat[1] +
          ' pelasi seuroissa ' +
          Array.from(seurat).sort().join(' + '),
      });
    }
  }

  return {
    virheet,
    rivitLuettu: rivikartta
      ? rivikartta.numerot.length + rivikartta.pudotetutTyhjat.length - 1
      : rivit.length - 1,
    suoritukset: uniikit,
    ohitetut,
    varoitukset,
    nimittajat,
    kaudet: laskeKaudet(uniikit, nimittajat),
    projektiot: laskeProjektiot(uniikit),
    suoritusIdt: uniikit.map((s) => suoritusId(s)),
  };
}

function samatLuvut(a: SuoritusRivi, b: SuoritusRivi): boolean {
  return (
    a.minuutit === b.minuutit &&
    a.ottelut === b.ottelut &&
    a.aloitukset === b.aloitukset &&
    a.maalit === b.maalit &&
    a.joukkueen_ottelut === b.joukkueen_ottelut
  );
}

/**
 * Kauden osuus = Σ nuorten minuutit / Σ (joukkueen ottelut vaiheessa × 90 × 11),
 * summattuna kauden kaikkien seurojen ja vaiheiden yli.
 */
export function laskeKaudet(
  suoritukset: SuoritusRivi[],
  nimittajat: Nimittaja[],
): KausiYhteenveto[] {
  const kaudet = Array.from(new Set(suoritukset.map((s) => s.kausi))).sort();

  return kaudet.map((kausi) => {
    const kaudenRivit = suoritukset.filter((s) => s.kausi === kausi);
    const kaudenNim = nimittajat.filter((n) => n.kausi === kausi);

    const min = kaudenRivit.reduce((a, s) => a + s.minuutit, 0);
    const kap = kaudenNim.reduce((a, n) => a + n.kapasiteetti_min, 0);

    const rsRivit = kaudenRivit.filter((s) => s.vaihe === 'Runkosarja');
    const rsNim = kaudenNim.filter((n) => n.vaihe === 'Runkosarja');
    const rsMin = rsRivit.reduce((a, s) => a + s.minuutit, 0);
    const rsKap = rsNim.reduce((a, n) => a + n.kapasiteetti_min, 0);

    // Ottelut per joukkue = summa joukkueen vaiheista
    const perJoukkue = new Map<string, number>();
    for (const n of kaudenNim) {
      perJoukkue.set(n.joukkue, (perJoukkue.get(n.joukkue) || 0) + n.ottelut);
    }
    const ottelumaarat = Array.from(perJoukkue.values()).sort((a, b) => a - b);

    return {
      kausi,
      vaiheet: Array.from(new Set(kaudenNim.map((n) => n.vaihe))).sort(),
      joukkueet: perJoukkue.size,
      rivit: kaudenRivit.length,
      pelaajat: new Set(kaudenRivit.map((s) => s.pelaajaAvain)).size,
      osuus_koko_kausi: kap > 0 ? min / kap : 0,
      osuus_runkosarja: rsKap > 0 ? rsMin / rsKap : 0,
      minuutit_yhteensa: min,
      kapasiteetti_yhteensa: kap,
      ottelut_min: ottelumaarat.length > 0 ? ottelumaarat[0] : 0,
      ottelut_max:
        ottelumaarat.length > 0 ? ottelumaarat[ottelumaarat.length - 1] : 0,
    };
  });
}

/**
 * Projektio seasons/{kausi}/players/{slug}: pelaajan kausisumma yli vaiheiden
 * JA seurojen. Projektiota ei koskaan kirjoiteta erikseen, vaan se johdetaan
 * aina samasta tuontiajosta kuin suoritukset ja nimittäjät.
 */
export function laskeProjektiot(suoritukset: SuoritusRivi[]): KausiProjektio[] {
  const kartta = new Map<string, KausiProjektio & { minPerSeura: Map<string, number> }>();

  for (const s of suoritukset) {
    const avain = s.kausi + '|' + s.slug;
    let p = kartta.get(avain);
    if (!p) {
      p = {
        kausi: s.kausi,
        slug: s.slug,
        pelaajaAvain: s.pelaajaAvain,
        etunimi: s.etunimi,
        sukunimi: s.sukunimi,
        ika: s.ika,
        joukkue: s.joukkue,
        joukkueet: [],
        minTotal: 0,
        ottelutTotal: 0,
        aloituksetTotal: 0,
        maaliTotal: 0,
        minPerSeura: new Map(),
      };
      kartta.set(avain, p);
    }
    p.minTotal += s.minuutit;
    p.ottelutTotal += s.ottelut;
    p.aloituksetTotal += s.aloitukset;
    p.maaliTotal += s.maalit;
    if (!p.ika && s.ika) p.ika = s.ika;
    p.minPerSeura.set(s.joukkue, (p.minPerSeura.get(s.joukkue) || 0) + s.minuutit);
  }

  return Array.from(kartta.values()).map((p) => {
    // Siirtotapauksessa "joukkue" = seura jossa eniten minuutteja; koko lista
    // säilytetään erikseen, jotta tieto siirrosta ei katoa.
    let paras = p.joukkue;
    let parasMin = -1;
    for (const [seura, min] of p.minPerSeura) {
      if (min > parasMin) {
        parasMin = min;
        paras = seura;
      }
    }
    const { minPerSeura, ...rest } = p;
    return {
      ...rest,
      joukkue: paras,
      joukkueet: Array.from(minPerSeura.keys()).sort(),
    };
  });
}

function tyhjaTulos(virheet: string[]): TuontiTulos {
  return {
    virheet,
    rivitLuettu: 0,
    suoritukset: [],
    ohitetut: [],
    varoitukset: [],
    nimittajat: [],
    kaudet: [],
    projektiot: [],
    suoritusIdt: [],
  };
}
