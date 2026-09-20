// ============================================
// PALLOTALENTTI.FI - Firebase Backend
// API endpoints + scheduled functions
// ============================================
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import Busboy from 'busboy';
import { cacheService } from './services/cacheService';
import { fbrefApi } from './api/fbrefApi';
import {
  scrapeVeikkausliigaPlayers,
  saveVeikkausliigaPlayers,
  scrapeAndSave,
  getOfficialStats,
} from './scrapers/veikkausliiga';
import {
  getOrFetchPlayer as tmGetOrFetchPlayer,
  scrapeAllYouthPlayers,
  getAllIndexEntries,
} from './scrapers/transfermarkt';
import { debugSofascore } from './scrapers/sofascore';
import {
  lueKausi,
  laskeJoukkueidenOsuudet,
  laskeKaudenPelaajat,
  laskeJoukkueet,
  laskeLiigaYhteenveto,
  laskeTopPelaajat,
  paatteleIkahaarukka,
} from './services/kausiData';
import { haeSiirto } from './services/siirrot';
import {
  laskeTrendit,
  laskeKolmijako,
  luokitteleKansalaisuudet,
} from './services/trendit';
import { ALLE_21_MAX, NUORET_MAX } from './services/ikarajat';
import { parseExcelBuffer, writeRoundData } from './services/excelImport';
import {
  parsiKausiExcel,
  VIESTI_TUNTEMATON_SARJA,
  VIESTI_MONTA_SARJAA,
  sarjaAvain,
  sarjaAvaimesta,
  projektioId,
  OLETUSSARJA,
  TUETUT_SARJAT,
} from './services/kausiImport';
import {
  esikatseleKausituonti,
  kirjoitaKausituonti,
} from './services/kausiImportKirjoitus';
import {
  luoAgent,
  asetaAgent,
  haeLista,
  haeProfiili,
  nimetTasmaavat,
  vahvistaSeura,
} from './services/kansalaisuus';

// Region: kaikki funktiot deployataan europe-west1:een (sama kuin TalentMaster-sisarprojekti)
const REGION = 'europe-west1';

/**
 * Markkina-arvojen paivitys pois kaytosta. Lahde on kuollut
 * (transfermarkt-api.vercel.app -> 402 DEPLOYMENT_DISABLED) ja suora
 * Transfermarkt-haku rikkoo kayttoehtoja. Kokoelmaa transfermarkt_players
 * EI poisteta, joten palautus ei vaadi datan uudelleenhakua.
 */
const MARKKINA_ARVOJEN_PAIVITYS_KAYTOSSA = false;

// Initialize Firebase Admin (guard prevents double-init when container reuses module)
if (!admin.apps.length) {
  admin.initializeApp();
}

// API_VERSION: muuta tätä joka deployssa, jotta Firebase tunnistaa muutoksen.
const API_VERSION = '2.0.0'; // tyo 4: ulkoinen tilastorajapinta poistettu

// ============================================
// Sarjaparametri
//
// Jokainen kausikysely koskee yhta sarjaa. Oletus on Veikkausliiga,
// jotta vanhat osoitteet toimivat muuttumattomina. Arvo "kaikki"
// tarkoittaa kaikkia sarjoja; sita kayttaa vain trendinakyma.
//
// Tuntematonta sarjaa ei tulkita oletukseksi: se olisi hiljainen
// vaarinymmarrys, jossa kayttaja luulee katsovansa toista sarjaa.
// ============================================
const KAIKKI_SARJAT = 'kaikki';

function pyydettySarja(arvo: unknown): string | null {
  const teksti = typeof arvo === 'string' ? arvo.trim() : '';
  if (teksti === '') return OLETUSSARJA;
  if (sarjaAvain(teksti) === KAIKKI_SARJAT) return KAIKKI_SARJAT;
  return sarjaAvaimesta(teksti);
}

/** Virhevastaus tuntemattomalle sarjalle. */
function sarjaVirhe(res: Response, arvo: unknown): void {
  res.status(400).json({
    success: false,
    error:
      'Tuntematon sarja: ' + String(arvo) + '. Tuetut: ' +
      TUETUT_SARJAT.join(', ') + ', ' + KAIKKI_SARJAT + '.',
  });
}

// ============================================
// Express API App
// ============================================
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Health check. Kaksi polkua tarkoituksella: Hosting-rewrite valittaa
// pyynnon muodossa /api/health (rewrite ei riisu etuliitetta), kun taas
// funktiota suoraan kutsuttaessa polku on /health.
app.get(['/health', '/api/health'], (_req, res) => {
  res.json({
    status: 'ok',
    service: 'pallotalentti-api',
    version: API_VERSION,
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// SEASONS
// ============================================



// ============================================
// STANDINGS
// ============================================


// ============================================
// TEAMS
// ============================================

/** GET /api/teams/:season - List teams */
app.get('/api/teams/:season', async (req, res) => {
  const season = parseInt(req.params.season, 10);
  if (isNaN(season)) {
    res.status(400).json({ success: false, error: 'season on virheellinen' });
    return;
  }
  const sarja = pyydettySarja(req.query.sarja);
  if (sarja === null || sarja === KAIKKI_SARJAT) {
    sarjaVirhe(res, req.query.sarja);
    return;
  }
  try {
    const { suoritukset, nimittajat } = await lueKausi(admin.firestore(), season, sarja);
    const teams = laskeJoukkueet(season, suoritukset, nimittajat);
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      success: true,
      data: teams,
      // Tyhjä ei ole nolla: frontend näyttää "ei dataa" eikä laske 0 %.
      dataSaatavilla: teams.length > 0,
      count: teams.length,
      source: 'kausituonti',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[teams] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});


// ============================================
// PLAYERS
// ============================================

/** GET /api/players/:season — kauden pelaajat kausituonnin datasta.
 *  Kausisumma lasketaan yli vaiheiden JA seurojen; siirtyneen pelaajan
 *  joukkueet[] säilyttää molemmat seurat. */
app.get('/api/players/:season', async (req, res) => {
  const season = parseInt(req.params.season, 10);
  if (isNaN(season)) {
    res.status(400).json({ success: false, error: 'season on virheellinen' });
    return;
  }
  const sarja = pyydettySarja(req.query.sarja);
  if (sarja === null || sarja === KAIKKI_SARJAT) {
    sarjaVirhe(res, req.query.sarja);
    return;
  }
  try {
    const { teamId, minAge, maxAge, minMinutes, limit } = req.query;
    const { suoritukset } = await lueKausi(admin.firestore(), season, sarja);
    const kaikki = laskeKaudenPelaajat(suoritukset);

    let players = kaikki;
    if (teamId) {
      const haettu = String(teamId).toLowerCase();
      players = players.filter(
        (p) =>
          p.joukkue.toLowerCase() === haettu ||
          p.joukkueet.some((j) => j.toLowerCase() === haettu),
      );
    }
    if (minAge) players = players.filter((p) => p.ika >= parseInt(String(minAge), 10));
    if (maxAge) players = players.filter((p) => p.ika <= parseInt(String(maxAge), 10));
    if (minMinutes) {
      players = players.filter((p) => p.minTotal >= parseInt(String(minMinutes), 10));
    }
    // laskeKaudenPelaajat palauttaa jo minuuttijärjestyksessä.
    const result = limit ? players.slice(0, parseInt(String(limit), 10)) : players;

    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      success: true,
      data: result,
      dataSaatavilla: kaikki.length > 0,
      count: result.length,
      ikahaarukka: paatteleIkahaarukka(suoritukset),
      source: 'kausituonti',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[players] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});





// ============================================
// YOUTH STATS (Core feature - like Bolldata)
// ============================================

/** GET /api/youth-stats/:season - Youth playing time by team */
app.get('/api/youth-stats/:season', async (req, res) => {
  const season = parseInt(req.params.season, 10);
  if (isNaN(season)) {
    res.status(400).json({ success: false, error: 'season on virheellinen' });
    return;
  }
  const sarja = pyydettySarja(req.query.sarja);
  if (sarja === null || sarja === KAIKKI_SARJAT) {
    sarjaVirhe(res, req.query.sarja);
    return;
  }
  try {
    const db = admin.firestore();
    const { suoritukset, nimittajat } = await lueKausi(db, season, sarja);
    const stats = laskeJoukkueidenOsuudet(
      season,
      suoritukset,
      nimittajat,
      new Date().toISOString(),
    );
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      success: true,
      data: stats,
      // Tyhjä lista EI tarkoita nollaa vaan puuttuvaa dataa. Frontend
      // näyttää tällöin "ei dataa" eikä laske osuudeksi 0,0 %.
      dataSaatavilla: stats.length > 0,
      // Lähde on suodatettu 17-21-vuotiaisiin, joten U23-lukua ei ole.
      // Se palaa sellaisenaan jos vienti tehdään haarukalla 17-23.
      ikahaarukka: paatteleIkahaarukka(suoritukset),
      source: 'kausituonti',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[youth-stats] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/youth-stats/:season/all
 *
 * Molemmat tuetut sarjat samassa vastauksessa. Ykkonen ei ole tuonnissa
 * mukana, joten se palautetaan tyhjana JA merkitaan erikseen puuttuvaksi,
 * jottei tyhjaa listaa lueta nollaksi.
 *
 * Sarjat luetaan erikseen, koska nimittaja on sarjakohtainen: yhteinen
 * laskenta sekoittaisi kapasiteetit.
 */
app.get('/api/youth-stats/:season/all', async (req, res) => {
  const season = parseInt(req.params.season, 10);
  if (isNaN(season)) {
    res.status(400).json({ success: false, error: 'season on virheellinen' });
    return;
  }
  try {
    const db = admin.firestore();
    const paivitetty = new Date().toISOString();
    const [vl, yl] = await Promise.all([
      lueKausi(db, season, 'Veikkausliiga'),
      lueKausi(db, season, 'Ykkösliiga'),
    ]);
    const veikkausliiga = laskeJoukkueidenOsuudet(
      season,
      vl.suoritukset,
      vl.nimittajat,
      paivitetty,
    );
    const ykkosliiga = laskeJoukkueidenOsuudet(
      season,
      yl.suoritukset,
      yl.nimittajat,
      paivitetty,
    );
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      success: true,
      data: { veikkausliiga, ykkosliiga, ykkonen: [] },
      dataSaatavilla: {
        veikkausliiga: veikkausliiga.length > 0,
        ykkosliiga: ykkosliiga.length > 0,
        ykkonen: false,
      },
      ikahaarukka: paatteleIkahaarukka(vl.suoritukset),
      ikahaarukkaYkkosliiga: paatteleIkahaarukka(yl.suoritukset),
      source: 'kausituonti',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[youth-stats/all] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});

/** GET /api/youth-aggregation/:season — liigatason yhteenveto kausituonnista. */
app.get('/api/youth-aggregation/:season', async (req, res) => {
  const season = parseInt(req.params.season, 10);
  if (isNaN(season)) {
    res.status(400).json({ success: false, error: 'season on virheellinen' });
    return;
  }
  const sarja = pyydettySarja(req.query.sarja);
  if (sarja === null || sarja === KAIKKI_SARJAT) {
    sarjaVirhe(res, req.query.sarja);
    return;
  }
  try {
    const { suoritukset, nimittajat } = await lueKausi(admin.firestore(), season, sarja);
    const yhteenveto = laskeLiigaYhteenveto(season, suoritukset, nimittajat);
    const teamBreakdown = laskeJoukkueidenOsuudet(
      season,
      suoritukset,
      nimittajat,
      new Date().toISOString(),
    );
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      success: true,
      // Sailytetaan YouthAggregation-sopimus: etusivu lukee topYouthPlayers-
      // ja teamBreakdown-kentat. U23-kentat jatetaan pois, koska lahde on
      // suodatettu 17-21-vuotiaisiin — ks. ikahaarukka.
      data: {
        season,
        league: 'Veikkausliiga',
        totalPlayersAnalyzed: yhteenveto.pelaajia,
        pelaajatNuoret: yhteenveto.pelaajia,
        totalMinutesPlayed: yhteenveto.kapasiteettiMinuutit,
        minuutitNuoret: yhteenveto.nuortenMinuutit,
        osuusNuoret: yhteenveto.nuortenOsuus,
        osuusNuoretRunkosarja: yhteenveto.nuortenOsuusRunkosarja,
        teamBreakdown,
        topYouthPlayers: laskeTopPelaajat(season, suoritukset, 20),
        vaiheet: yhteenveto.vaiheet,
        ikahaarukka: yhteenveto.ikahaarukka,
        updatedAt: new Date().toISOString(),
      },
      dataSaatavilla: nimittajat.length > 0,
      source: 'kausituonti',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[youth-aggregation] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});


// ============================================
// SEASON PLAYERS (Firestore Excel-import data, Vaihe B)
// Lähde: seasons/{season}/players ja seasons/{season}/rounds/*/players
// Julkisia endpointteja (ei admin-key). Cache 1 h.
// ============================================

/** Firestore-dokumentti → SeasonPlayer-muoto. doc.id on slug. */
function toSeasonPlayer(id: string, data: admin.firestore.DocumentData | undefined) {
  const d = data ?? {};
  return {
    // Dokumentin tunniste on {sarja}_{slug}, joten slug luetaan kentasta.
    // Vanhoissa dokumenteissa kenttaa ei ole ja tunniste on pelkka slug.
    slug: (d.slug as string) ?? id,
    sarja: (d.sarja as string) ?? OLETUSSARJA,
    etunimi: (d.etunimi as string) ?? '',
    sukunimi: (d.sukunimi as string) ?? '',
    ika: (d.ika as number) ?? 0,
    joukkue: (d.joukkue as string) ?? '',
    minTotal: (d.minTotal as number) ?? 0,
    ottelutTotal: (d.ottelutTotal as number) ?? 0,
    aloituksetTotal: (d.aloituksetTotal as number) ?? 0,
    maaliTotal: (d.maaliTotal as number) ?? 0,
    lastUpdatedRound: (d.lastUpdatedRound as number) ?? 0,
  };
}

/**
 * GET /api/kaudet — saatavilla olevat kaudet, uusin ensin.
 *
 * Lähde on kaudet-kokoelma, jonka kausituonti kirjoittaa. Näin uusi kausi
 * ilmestyy valitsimeen tuonnin jälkeen ilman koodimuutosta, eikä listaa
 * tarvitse kovakoodata frontendiin.
 */
/**
 * GET /api/kansalaisuudet/:season — minuuteilla painotettu osuus, joka meni
 * Suomen kansalaisille.
 *
 * Lähde on seasons/{kausi}/kansalaisuudet, jonka haeKansalaisuudet-skripti
 * kirjoittaa Veikkausliigan rekisteristä. Kaikilla kausilla sitä ei ole:
 * silloin saatavilla on false eikä lukuja esitetä.
 *
 * Mukaan lasketaan kaikki joilla suomalainen === 'kylla', myös ne joilla
 * seura jäi vahvistamatta. Luku on ALARAJA: 'ei tietoa' -pelaajat voivat
 * myös olla Suomen kansalaisia, eikä yksiarvoinen lähde kerro
 * kaksoiskansalaisuutta.
 */
app.get('/api/kansalaisuudet/:season', async (req, res) => {
  const season = parseInt(req.params.season, 10);
  if (isNaN(season)) {
    res.status(400).json({ success: false, error: 'season on virheellinen' });
    return;
  }
  try {
    const db = admin.firestore();
    const kansSnap = await db
      .collection('seasons')
      .doc(String(season))
      .collection('kansalaisuudet')
      .get();

    if (kansSnap.empty) {
      res.set('Cache-Control', 'public, max-age=600');
      res.json({
        success: true,
        data: { saatavilla: false, kausi: season },
        source: 'veikkausliiga-rekisteri',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Sama luokittelu kuin trendinakymassa: rekisterin koodi ja seuran
    // vahvistus. Yksi saanto, jottei sivusto nayta kahta eri lukua samasta
    // asiasta. (Tarkistettu kaikilla kausilla: tama ja vanha
    // suomalainen === 'kylla' -saanto antavat saman prosentin.)
    const luokat = luokitteleKansalaisuudet(kansSnap.docs);

    const { suoritukset, nimittajat } = await lueKausi(db, season);
    const kapasiteetti = nimittajat.reduce(
      (a, n) => a + n.kapasiteetti_min,
      0,
    );
    const minuutit = (ikaRaja: number, vainSuomalaiset: boolean): number =>
      suoritukset
        .filter(
          (s) =>
            s.ika <= ikaRaja &&
            (!vainSuomalaiset || luokat.fin.has(s.slug)),
        )
        .reduce((a, s) => a + s.minuutit, 0);

    const osuus = (osa: number): number | null =>
      kapasiteetti > 0 ? Math.round((osa / kapasiteetti) * 1000) / 10 : null;

    // Kolmijako lasketaan ensin, jotta Suomen kansalaisten osuus voidaan
    // ottaa siita: muuten sama luku pyoristyisi kahdella eri tavalla ja
    // Tietoa-sivu nayttaisi eri prosentin kuin /peliaika-sivun taulukko.
    const jako = laskeKolmijako(suoritukset, kapasiteetti, luokat, ALLE_21_MAX);

    res.set('Cache-Control', 'public, max-age=600');
    res.json({
      success: true,
      data: {
        saatavilla: true,
        kausi: season,
        pelaajia: kansSnap.size,
        suomalaisia: luokat.fin.size,
        /** 17–21-vuotiaiden osuus kapasiteetista, kaikki pelaajat. */
        osuus1721: osuus(minuutit(NUORET_MAX, false)),
        /** Sama, vain Suomen kansalaisille menneet minuutit. */
        osuus1721Suomalaiset: osuus(minuutit(NUORET_MAX, true)),
        /** Alle 21 (ikä ≤ 20) — CIES-vertailun luku, kaikki pelaajat. */
        osuusAlle21: osuus(minuutit(ALLE_21_MAX, false)),
        /** Sama, vain Suomen kansalaisille — sama luku kuin kolmijaon FIN. */
        osuusAlle21Suomalaiset:
          jako !== null ? jako.fin : osuus(minuutit(ALLE_21_MAX, true)),
        /** Alle 21 -osuuden kolmijako: FIN / muu maakoodi / ei tietoa. */
        alle21Jako: jako,
      },
      source: 'veikkausliiga-rekisteri',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[kansalaisuudet] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/trendit — yksi piste per kausi, vanhin ensin.
 *
 * Luvut lasketaan samalla koodilla kuin kauden omassa nakymassa, jotta
 * trendipiste ja kausinakyman luku ovat aina sama luku. Laskenta tehdaan
 * palvelimella: selain ei laske osuuksia.
 *
 * Puuttuva arvo on null eika 0 — nolla vaittaisi, ettei nuorille mennyt
 * yhtaan minuuttia.
 */
app.get('/api/trendit', async (req, res) => {
  const sarja = pyydettySarja(req.query.sarja);
  if (sarja === null) {
    sarjaVirhe(res, req.query.sarja);
    return;
  }
  try {
    // "kaikki" palauttaa molempien sarjojen pisteet samassa listassa;
    // jokainen piste kertoo sarjansa, joten muoto on sama kummassakin
    // tapauksessa eika kutsujan tarvitse haarautua.
    const trendit = await laskeTrendit(
      admin.firestore(),
      new Date().getFullYear(),
      sarja === KAIKKI_SARJAT ? null : sarja,
    );
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      success: true,
      data: trendit,
      dataSaatavilla: trendit.length > 0,
      source: 'firestore',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[trendit] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});

app.get('/api/kaudet', async (req, res) => {
  const sarja = pyydettySarja(req.query.sarja);
  if (sarja === null) {
    sarjaVirhe(res, req.query.sarja);
    return;
  }
  try {
    const snap = await admin.firestore().collection('kaudet').get();
    const kaudet = snap.docs
      .filter((doc) => doc.data().vanhentunut !== true)
      .map((doc) => {
        const d = doc.data();
        // tuotu_pvm on Firestore-Timestamp. Ilman muunnosta se serialisoituu
        // muodossa {_seconds, _nanoseconds}, jota frontend ei osaa lukea.
        const tuotu = d.tuotu_pvm;
        const tuotuPvm =
          tuotu && typeof tuotu.toDate === 'function'
            ? (tuotu.toDate() as Date).toISOString()
            : typeof tuotu === 'string'
              ? tuotu
              : null;
        return {
          kausi: (d.vuosi as number) ?? parseInt(doc.id, 10),
          sarja: (d.sarja as string) ?? 'Veikkausliiga',
          pelaajat: (d.pelaajat as number) ?? null,
          joukkueet: (d.joukkueet as number) ?? null,
          tuotuPvm,
        };
      })
      .filter((k) => !isNaN(k.kausi))
      .filter((k) => sarja === KAIKKI_SARJAT || k.sarja === sarja)
      .sort((a, b) => b.kausi - a.kausi || a.sarja.localeCompare(b.sarja));

    res.set('Cache-Control', 'public, max-age=300');
    res.json({
      success: true,
      data: kaudet,
      dataSaatavilla: kaudet.length > 0,
      oletus: kaudet.length > 0 ? kaudet[0].kausi : null,
      source: 'kausituonti',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[kaudet] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});

/** GET /api/season-players/:season — kaikki kauden pelaajat. */
app.get('/api/season-players/:season', async (req, res) => {
  const season = parseInt(req.params.season, 10);
  if (isNaN(season)) {
    res.status(400).json({ success: false, error: 'season on virheellinen' });
    return;
  }
  const sarja = pyydettySarja(req.query.sarja);
  if (sarja === null || sarja === KAIKKI_SARJAT) {
    sarjaVirhe(res, req.query.sarja);
    return;
  }
  try {
    const snap = await admin
      .firestore()
      .collection('seasons')
      .doc(String(season))
      .collection('players')
      .get();
    // Vanhentuneiksi merkityt projektiot on tuotu aiemmin mutta ne eivät
    // enää ole lähdeaineistossa. Suodatus tehdään muistissa, ei where-
    // kyselyllä: valtaosalta dokumenteista kenttä puuttuu kokonaan, ja
    // puuttuva kenttä tarkoittaa "ei vanhentunut".
    const players = snap.docs
      .filter((doc) => doc.data().vanhentunut !== true)
      // Sarja muistissa samasta syysta kuin vanhentunut: vanhoista
      // dokumenteista kentta puuttuu ja tarkoittaa oletussarjaa.
      .filter((doc) => (doc.data().sarja || OLETUSSARJA) === sarja)
      .map((doc) => toSeasonPlayer(doc.id, doc.data()));
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      success: true,
      data: players,
      dataSaatavilla: players.length > 0,
      count: players.length,
      source: 'firestore',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[season-players] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});

/** GET /api/season-players/:season/:slug/rounds — pelaajan kierrosdata
 *  kaikilta kierroksilta (kehityskäyrä). Järjestetty round-nousevasti. */
app.get('/api/season-players/:season/:slug/rounds', async (req, res) => {
  const season = parseInt(req.params.season, 10);
  const slug = req.params.slug;
  if (isNaN(season) || !slug) {
    res
      .status(400)
      .json({ success: false, error: 'season tai slug puuttuu/virheellinen' });
    return;
  }
  try {
    const roundsSnap = await admin
      .firestore()
      .collection('seasons')
      .doc(String(season))
      .collection('rounds')
      .get();

    const entries = await Promise.all(
      roundsSnap.docs.map(async (rdoc) => {
        const round = parseInt(rdoc.id, 10);
        if (isNaN(round)) return null;
        const pdoc = await rdoc.ref.collection('players').doc(slug).get();
        if (!pdoc.exists) return null;
        const d = pdoc.data() ?? {};
        return {
          round,
          cumMin: (d.cumMin as number) ?? (d.min as number) ?? 0,
          cumMaalit: (d.cumMaalit as number) ?? (d.maalit as number) ?? 0,
          cumOttelut: (d.cumOttelut as number) ?? (d.ottelut as number) ?? 0,
        };
      }),
    );

    const rounds = entries
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => a.round - b.round);

    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      success: true,
      data: rounds,
      dataSaatavilla: rounds.length > 0,
      source: 'firestore',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[season-players/rounds] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});

/** GET /api/season-players/:season/:slug — yksittäinen pelaaja tai 404. */
app.get('/api/season-players/:season/:slug', async (req, res) => {
  const season = parseInt(req.params.season, 10);
  const slug = req.params.slug;
  if (isNaN(season) || !slug) {
    res
      .status(400)
      .json({ success: false, error: 'season tai slug puuttuu/virheellinen' });
    return;
  }
  const sarja = pyydettySarja(req.query.sarja);
  if (sarja === null || sarja === KAIKKI_SARJAT) {
    sarjaVirhe(res, req.query.sarja);
    return;
  }
  try {
    const pelaajat = admin
      .firestore()
      .collection('seasons')
      .doc(String(season))
      .collection('players');
    // Ensisijaisesti sarjallinen tunniste. Ennen migraatiota
    // Veikkausliigan dokumentit ovat viela vanhalla tunnisteella, joten
    // oletussarjalla kokeillaan sita toisena — nain sivu toimii ennen ja
    // jalkeen migraation.
    let doc = await pelaajat.doc(projektioId({ sarja, slug })).get();
    if (!doc.exists && sarja === OLETUSSARJA) {
      doc = await pelaajat.doc(slug).get();
    }
    // Vanhentunut projektio käsitellään kuin puuttuvaa: pelaaja ei ole
    // tämän kauden aineistossa, jolloin käyttöliittymä kertoo sen.
    if (!doc.exists || doc.data()?.vanhentunut === true) {
      res.status(404).json({ success: false, error: 'Pelaajaa ei löytynyt' });
      return;
    }
    // Siirto tai laina kesken kauden (B5). Lahde on repon datatiedosto,
    // jossa jokaisella rivilla on julkinen lahde-URL. Jos pelaajalle ei
    // loydy rivia, kentta on null eika sivulla nay merkintaa.
    const d = doc.data() ?? {};
    const siirto = haeSiirto(
      season,
      (d.etunimi as string) ?? '',
      (d.sukunimi as string) ?? '',
      [...((d.joukkueet as string[]) ?? []), (d.joukkue as string) ?? ''],
    );
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      success: true,
      data: { ...toSeasonPlayer(doc.id, d), siirto },
      source: 'firestore',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[season-players/:slug] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});

// ============================================
// MATCHES
// ============================================




// ============================================
// FBref ADVANCED STATS
// ============================================

/** GET /api/fbref/:season/players - FBref detailed stats */
app.get('/api/fbref/:season/players', async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    const stats = await fbrefApi.scrapePlayerStats(season);
    const transformed = fbrefApi.transformToPlayerStats(stats, season);
    res.json({
      success: true,
      data: transformed,
      // Tyhja lista ei kerro itsestaan, onko lahde hiljaa vai onko dataa
      // aidosti nolla. Lippu sanoo sen auki.
      dataSaatavilla: transformed.length > 0,
      cached: false,
      source: 'fbref',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('FBref error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch FBref stats',
      timestamp: new Date().toISOString(),
    });
  }
});

/** GET /api/fbref/:season/standings - FBref standings */
app.get('/api/fbref/:season/standings', async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    const standings = await fbrefApi.scrapeStandings(season);
    res.json({
      success: true,
      data: standings || [],
      dataSaatavilla: (standings || []).length > 0,
      cached: false,
      source: 'fbref',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('FBref standings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch FBref standings',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// TRANSFERMARKT
// ============================================



// ============================================
// ADMIN / MAINTENANCE
// ============================================


/** GET /api/admin/cache-stats - Cache statistics */
app.get('/api/admin/cache-stats', async (_req, res) => {
  try {
    const stats = await cacheService.getStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache stats',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// VEIKKAUSLIIGA.COM SCRAPER
// ============================================

/** Admin-key middleware. Vaadi process.env.ADMIN_KEY ja x-admin-key -header. */
function requireAdminKey(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    console.warn('[admin] ADMIN_KEY ei ole konfiguroitu — admin-endpointit pois käytöstä');
    res.status(503).json({
      success: false,
      error: 'Admin-endpoint ei ole konfiguroitu palvelimelle',
    });
    return;
  }
  const provided = req.header('x-admin-key');
  if (provided !== expected) {
    res.status(401).json({ success: false, error: 'Virheellinen tai puuttuva x-admin-key' });
    return;
  }
  next();
}

/** GET /api/scrape/veikkausliiga?year=2026 - Käynnistä scrape, tallenna Firestoreen */
app.get('/api/scrape/veikkausliiga', requireAdminKey, async (req, res) => {
  try {
    const year = parseInt(String(req.query.year ?? ''), 10);
    if (isNaN(year) || year < 2000 || year > 2100) {
      res.status(400).json({ success: false, error: 'year-parametri puuttuu tai on virheellinen' });
      return;
    }
    const players = await scrapeVeikkausliigaPlayers(year);
    const result = await saveVeikkausliigaPlayers(year, players);
    res.json({
      success: true,
      count: result.count,
      updatedAt: result.updatedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[scrape/veikkausliiga] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});

/** GET /api/official-stats/:year - Julkinen: Veikkausliiga.com:n tallennetut tilastot */
app.get('/api/official-stats/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year, 10);
    if (isNaN(year)) {
      res.status(400).json({ success: false, error: 'year-parametri on virheellinen' });
      return;
    }
    const { players, meta } = await getOfficialStats(year);
    res.json({
      success: true,
      data: players,
      dataSaatavilla: players.length > 0,
      meta,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[official-stats] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});

// ============================================
// TRANSFERMARKT SCRAPER (v2 — U23-fokus, name-index)
// ============================================

/** GET /api/transfermarkt/player/:name — julkinen, cache-first.
 *  Etsii transfermarkt_index/{season}/names/{slug} → tmId, lukee
 *  transfermarkt_players/{tmId}. Jos ei cachessa, tekee live-haun.
 *  season-query (oletus nykyvuosi). */
app.get('/api/transfermarkt/player/:name', async (req, res) => {
  const name = req.params.name?.trim();
  const season = parseInt(
    String(req.query.season ?? new Date().getFullYear()),
    10,
  );
  if (!name) {
    return res
      .status(400)
      .json({ success: false, error: 'name-parametri puuttuu URL-polusta' });
  }
  if (isNaN(season)) {
    return res
      .status(400)
      .json({ success: false, error: 'season-parametri on virheellinen' });
  }
  try {
    const profile = await tmGetOrFetchPlayer({ name, season });
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Pelaajaa ei löytynyt Transfermarktista',
      });
    }
    return res.json({
      success: true,
      data: profile,
      source: 'transfermarkt.com',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[tm/player] failed:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

/** POST /api/transfermarkt/refresh — admin: ajaa scrapeAllYouthPlayers.
 *  Query/body: season (oletus nykyvuosi), limit (esim. 5), offset (esim. 0).
 *  Batchaa työn pieniin osiin jotta Cloud Functions -timeout (60 s) ei osu:
 *    POST /api/transfermarkt/refresh?season=2026&limit=5&offset=0
 *    POST /api/transfermarkt/refresh?season=2026&limit=5&offset=5  ...
 *  Ilman limit/offset käsittelee koko U23-listan (max 20). */
app.post('/api/transfermarkt/refresh', requireAdminKey, async (req, res) => {
  // Runko ohitetaan, funktiota ei poisteta — sama malli kuin
  // AJASTETTU_REFRESH_KAYTOSSA. Markkina-arvojen haku on pysaytetty:
  // transfermarkt-api.vercel.app on kuollut (402 DEPLOYMENT_DISABLED) ja
  // suora haku rikkoo Transfermarktin kayttoehtoja (403). Palautetaan
  // kun luvallinen lahde loytyy.
  if (!MARKKINA_ARVOJEN_PAIVITYS_KAYTOSSA) {
    console.log(
      '[transfermarkt/refresh] ohitettu — kytketty pois 2026-09-20, ' +
        'ks. MARKKINA_ARVOJEN_PAIVITYS_KAYTOSSA',
    );
    return res.status(503).json({
      success: false,
      error:
        'Markkina-arvojen paivitys on pysaytetty: lahteelle ei ole lupaa. ' +
        'Ks. MARKKINA_ARVOJEN_PAIVITYS_KAYTOSSA.',
    });
  }
  const seasonRaw =
    (req.body && req.body.season) ?? req.query.season ?? new Date().getFullYear();
  const season = parseInt(String(seasonRaw), 10);
  if (isNaN(season)) {
    return res
      .status(400)
      .json({ success: false, error: 'season-parametri on virheellinen' });
  }

  const limitRaw =
    (req.body && req.body.limit) ?? req.query.limit ?? undefined;
  const offsetRaw =
    (req.body && req.body.offset) ?? req.query.offset ?? undefined;
  const limit =
    limitRaw !== undefined ? parseInt(String(limitRaw), 10) : undefined;
  const offset =
    offsetRaw !== undefined ? parseInt(String(offsetRaw), 10) : undefined;
  if (
    (limit !== undefined && (isNaN(limit) || limit < 1)) ||
    (offset !== undefined && (isNaN(offset) || offset < 0))
  ) {
    return res.status(400).json({
      success: false,
      error: 'limit/offset on virheellinen (limit >= 1, offset >= 0)',
    });
  }

  try {
    const players = await scrapeAllYouthPlayers(season, limit, offset);
    return res.json({
      success: true,
      count: players.length,
      offset: offset ?? 0,
      limit: limit ?? null,
      players,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[tm/refresh] failed:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

/** GET /api/transfermarkt/league/:season — julkinen, palauttaa kauden
 *  kaikki indeksoidut U23-pelaajat (name, tmId, marketValue). */
app.get('/api/transfermarkt/league/:season', async (req, res) => {
  const season = parseInt(req.params.season, 10);
  if (isNaN(season)) {
    return res
      .status(400)
      .json({ success: false, error: 'season on virheellinen' });
  }
  try {
    const entries = await getAllIndexEntries(season);
    return res.json({
      success: true,
      data: entries,
      dataSaatavilla: entries.length > 0,
      count: entries.length,
      source: 'transfermarkt.com',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[tm/league] failed:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

// ============================================
// DEBUG / DIAGNOSTIIKKA
// ============================================

/** GET /api/debug/sofascore?name=Otto+Ruoppi — admin: testaa toimiiko
 *  Sofascore-haku Cloud Functions -ympäristöstä. Hakee pelaajan ID:n
 *  nimellä ja per-ottelu tilastot, palauttaa raakadatan tai virheviestin
 *  per vaihe. Ei cachea — aina live-kutsu diagnostiikkaa varten. */
app.get('/api/debug/sofascore', requireAdminKey, async (req, res) => {
  const name = String(req.query.name ?? '').trim();
  if (!name) {
    res.status(400).json({
      success: false,
      error: 'name-query puuttuu (esim. ?name=Otto+Ruoppi)',
    });
    return;
  }
  try {
    const result = await debugSofascore(name);
    res.status(result.ok ? 200 : 502).json({
      success: result.ok,
      data: result,
      source: 'sofascore.com',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[debug/sofascore] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});


/**
 * Hakee kansalaisuuden vain pelaajille, joilla ei ole dokumenttia.
 *
 * Budjetoitu: Cloud Functions -aikaraja on 60 s, joten haku tekee
 * enintaan RAJA pelaajaa kerralla ja kertoo montako jai jaljelle.
 * Epaonnistunut haku EI kaada tuontia - pelaaja jaa "ei tietoa" -tilaan
 * ja nakyy yhteenvedossa.
 *
 * Seura varmennetaan profiilin kauden rivilta, sama saanto kuin
 * komentoriviskriptissa (jaettu moduuli services/kansalaisuus.ts).
 */
async function haeUusienKansalaisuudet(
  db: admin.firestore.Firestore,
  tulos: { kaudet: Array<{ kausi: string }>; projektiot: Array<{ kausi: string; slug: string; pelaajaAvain: string; joukkue: string; joukkueet: string[]; ika: number; etunimi: string; sukunimi: string; minTotal: number }> },
): Promise<{
  haettu: number;
  onnistui: number;
  eiTietoa: number;
  jaljella: number;
  ohitettuNollaMinuuttia: number;
}> {
  const RAJA = 15;
  const VIIVE_MS = 1200;
  let haettu = 0;
  let onnistui = 0;
  let eiTietoa = 0;
  let jaljella = 0;
  let ohitettuNollaMinuuttia = 0;

  try {
    asetaAgent(await luoAgent());
  } catch (e) {
    console.error('[kansalaisuus] agentin luonti epaonnistui:', e);
    // Koko haku ohitetaan; tuonti on jo kirjoitettu.
    return {
      haettu: 0,
      onnistui: 0,
      eiTietoa: 0,
      jaljella: -1,
      ohitettuNollaMinuuttia: 0,
    };
  }

  for (const k of tulos.kaudet) {
    const kansKok = db
      .collection('seasons')
      .doc(k.kausi)
      .collection('kansalaisuudet');
    const on = new Set((await kansKok.get()).docs.map((d) => d.id));
    // Pelaaja jolla on 0 minuuttia EI ole Veikkausliigan tilastolistalla,
    // koska lista sisaltaa vain pelanneet. Hanta ei siis voi varmentaa, ja
    // ilman tata rajausta han kuluttaisi hakubudjettia joka tuonnilla
    // ikuisesti - kaudella 2026 heita on 40 / 146.
    //
    // Kun pelaaja saa minuutteja, han tulee mukaan seuraavassa tuonnissa.
    const kaikkiUudet = tulos.projektiot.filter(
      (p) => p.kausi === k.kausi && !on.has(p.slug),
    );
    ohitettuNollaMinuuttia += kaikkiUudet.filter((p) => p.minTotal === 0).length;

    // Eniten pelanneet ensin: budjetti kannattaa kayttaa niihin, joiden
    // minuutit painavat eniten kolmijaossa.
    const uudet = kaikkiUudet
      .filter((p) => p.minTotal > 0)
      .sort((a, b) => b.minTotal - a.minTotal);
    if (uudet.length === 0) continue;

    let lista: Awaited<ReturnType<typeof haeLista>>;
    try {
      lista = await haeLista(k.kausi);
    } catch (e) {
      console.error('[kansalaisuus] listan haku epaonnistui:', e);
      jaljella += uudet.length;
      continue;
    }

    for (const p of uudet) {
      if (haettu >= RAJA) {
        jaljella++;
        continue;
      }
      haettu++;
      const nimi = (p.etunimi + ' ' + p.sukunimi).trim();
      try {
        const ehdokkaat = lista.filter((r) => nimetTasmaavat(nimi, r.nimi));
        let tallennettu = false;
        for (const e of ehdokkaat) {
          const prof = await haeProfiili(e.polku, e.vlId);
          await new Promise((r) => setTimeout(r, VIIVE_MS));
          // Sama hybridisaanto kuin komentoriviskriptissa: yksi funktio,
          // yksi saanto (services/kansalaisuus.ts).
          const vahvistus = vahvistaSeura(
            [p.joukkue, ...(p.joukkueet || [])],
            e.seura,
            prof.kaudenSeurat?.[k.kausi] ?? [],
          );
          const ikaProfiilista =
            prof.syntymavuosi !== null
              ? parseInt(k.kausi, 10) - prof.syntymavuosi
              : null;
          if (
            vahvistus.vahvistettu &&
            ikaProfiilista === p.ika &&
            prof.kansalaisuudet.length > 0
          ) {
            const koodi = prof.kansalaisuudet[0];
            await kansKok.doc(p.slug).set({
              slug: p.slug,
              nimi,
              joukkue: p.joukkue,
              ika: p.ika,
              vlKansalaisuus: koodi,
              suomalainen: koodi === 'FIN' ? 'kylla' : 'ei tietoa',
              varmuus: 'yksi lahde',
              ristiriita: false,
              lahteet: [
                { lahde: 'veikkausliiga.com', id: e.vlId, arvo: koodi },
              ],
              seura_vahvistettu: true,
              seura_vahvistus_lahde: vahvistus.lahde,
              varmennus: 'nimi+seura+ika',
              // Pelipaikka on NYKYTIETO, ei kauden aikainen - sama varauma
              // kuin kansalaisuudella. Puuttuva arvo on null, ei arvaus:
              // pelipaikkaa ei paatella tilastoista.
              pelipaikka: prof.pelipaikka ?? null,
              pelipaikka_lahde:
                prof.pelipaikka !== null ? 'veikkausliiga.com profiili' : null,
              syntynyt: prof.syntynyt,
              paivitetty: new Date().toISOString(),
            });
            onnistui++;
            tallennettu = true;
            break;
          }
        }
        if (!tallennettu) eiTietoa++;
      } catch (e) {
        // Yksittainen epaonnistuminen ei kaada tuontia.
        console.error('[kansalaisuus] ' + p.slug + ' epaonnistui:', e);
        eiTietoa++;
      }
    }
  }
  return { haettu, onnistui, eiTietoa, jaljella, ohitettuNollaMinuuttia };
}

// ============================================
// KAUSITUONTI — esikatselu ja vahvistus (admin)
//
// Kaksi reittia: esikatselu ei kirjoita mitaan, vahvistus kirjoittaa.
// Molemmat kayttavat samaa kausiImport-koodia kuin komentoriviskriptit,
// joten toista toteutusta ei ole.
//
// Kayttoliittymassa annettu vahvistus vastaa CLAUDE.md 3.5:n vaatimaa
// kayttajan hyvaksyntaa.
// ============================================

/** Tiedoston kokoraja. Veikkausliigan vienti on kymmenia kilotavuja. */
const TUONTI_MAX_TAVUA = 5 * 1024 * 1024;

/** Yksinkertainen rajoitus admin-avaimen vaarille yrityksille. */
const adminYritykset = new Map<string, { n: number; eka: number }>();
const ADMIN_IKKUNA_MS = 10 * 60 * 1000;
const ADMIN_MAX_YRITYSTA = 5;

function adminRajoitus(req: Request, res: Response, next: NextFunction): void {
  const ip = String(req.ip || req.header('x-forwarded-for') || 'tuntematon');
  const nyt = Date.now();
  const tila = adminYritykset.get(ip);
  if (tila && nyt - tila.eka < ADMIN_IKKUNA_MS && tila.n >= ADMIN_MAX_YRITYSTA) {
    res.status(429).json({
      success: false,
      error: 'Liian monta virheellista yritysta. Odota 10 minuuttia.',
    });
    return;
  }
  const annettu = req.header('x-admin-key');
  if (annettu !== process.env.ADMIN_KEY) {
    if (!tila || nyt - tila.eka >= ADMIN_IKKUNA_MS) {
      adminYritykset.set(ip, { n: 1, eka: nyt });
    } else {
      tila.n++;
    }
  } else {
    adminYritykset.delete(ip);
  }
  next();
}

/** Lukee multipart-pyynnon: tiedosto + kentat. */
async function lueTuontiTiedosto(
  req: Request,
): Promise<{ buffer: Buffer; nimi: string; kentat: Record<string, string> }> {
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    throw new Error('Odotettiin multipart/form-data -pyyntoa');
  }
  if (rawBody.length > TUONTI_MAX_TAVUA) {
    throw new Error(
      'Tiedosto on liian suuri (' +
        Math.round(rawBody.length / 1024) +
        ' kt, raja ' +
        Math.round(TUONTI_MAX_TAVUA / 1024) +
        ' kt)',
    );
  }
  const bb = Busboy({ headers: req.headers });
  const kentat: Record<string, string> = {};
  const palat: Buffer[] = [];
  let nimi = '';
  bb.on('field', (k, v) => {
    kentat[k] = v;
  });
  bb.on('file', (_k, stream, info) => {
    nimi = info.filename ?? '';
    stream.on('data', (d: Buffer) => palat.push(d));
  });
  await new Promise<void>((resolve, reject) => {
    bb.on('close', resolve);
    bb.on('finish', resolve);
    bb.on('error', reject);
    bb.end(rawBody);
  });
  const buffer = Buffer.concat(palat);
  if (buffer.length === 0 || !nimi.toLowerCase().endsWith('.xlsx')) {
    throw new Error('Tiedosto puuttuu tai ei ole .xlsx-muotoinen');
  }
  return { buffer, nimi, kentat };
}

/**
 * Parsii tiedoston ja antaa selkean virheen vaarasta tiedostosta.
 * Seurayhteenveto pelaajatiedoston sijaan on tavallisin erehdys.
 */
function parsiTuonti(buffer: Buffer): ReturnType<typeof parsiKausiExcel> {
  const tulos = parsiKausiExcel(buffer);
  // Sarjavirhe on oma tilanteensa: kayttaja on lahettanyt oikean
  // muotoisen tiedoston, jossa on vaara tai useampi sarja. Viesti kertoo
  // sen sellaisenaan eika seurayhteenvetoarvauksen takaa.
  for (const sarjaViesti of [VIESTI_TUNTEMATON_SARJA, VIESTI_MONTA_SARJAA]) {
    if (tulos.virheet.includes(sarjaViesti)) throw new Error(sarjaViesti);
  }
  if (tulos.virheet.length > 0) {
    const puuttuvat = tulos.virheet.slice(0, 5).join('; ');
    throw new Error(
      'Tiedosto ei kelpaa pelaajatiedostoksi. ' +
        'Tarkista ettet lahettanyt seurayhteenvetoa. Virheet: ' +
        puuttuvat,
    );
  }
  return tulos;
}

/** POST /api/admin/kausituonti/esikatselu — ei kirjoita mitaan. */
app.post(
  '/api/admin/kausituonti/esikatselu',
  adminRajoitus,
  requireAdminKey,
  async (req, res) => {
    try {
      const { buffer, nimi } = await lueTuontiTiedosto(req);
      const tulos = parsiTuonti(buffer);
      const db = admin.firestore();
      const esikatselu = await esikatseleKausituonti(db, tulos, {
        tuontiId: 'esikatselu',
        lahdeTiedosto: nimi,
      });

      // Montako uutta pelaajaa on ilman kansalaisuustietoa.
      let uusiaIlmanKansalaisuutta = 0;
      for (const k of tulos.kaudet) {
        const kans = await db
          .collection('seasons')
          .doc(k.kausi)
          .collection('kansalaisuudet')
          .get();
        const on = new Set(kans.docs.map((d) => d.id));
        uusiaIlmanKansalaisuutta += tulos.projektiot.filter(
          (p) => p.kausi === k.kausi && !on.has(p.slug),
        ).length;
      }

      res.json({
        success: true,
        data: { ...esikatselu, uusiaIlmanKansalaisuutta, tiedosto: nimi },
        kirjoitettu: false,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const viesti = error instanceof Error ? error.message : 'Tuntematon virhe';
      console.error('[kausituonti/esikatselu] failed:', viesti);
      res.status(400).json({ success: false, error: viesti });
    }
  },
);

/** POST /api/admin/kausituonti/vahvista — kirjoittaa. */
app.post(
  '/api/admin/kausituonti/vahvista',
  adminRajoitus,
  requireAdminKey,
  async (req, res) => {
    try {
      const { buffer, nimi } = await lueTuontiTiedosto(req);
      const tulos = parsiTuonti(buffer);
      const db = admin.firestore();
      const tuontiId =
        new Date().toISOString().replace(/[:.]/g, '-') + '_' + nimi;

      const yhteenveto = await kirjoitaKausituonti(db, tulos, {
        tuontiId,
        lahdeTiedosto: nimi,
      });

      // Kansalaisuushaku vain pelaajille joilla ei ole dokumenttia.
      // Ei saa kaataa tuontia: epaonnistuminen jaa "ei tietoa" -tilaan.
      const kansalaisuus = await haeUusienKansalaisuudet(db, tulos);

      // Valimuistin tyhjennys: kausi- ja trendinakymat lukevat naita, ja
      // data muuttuu vain tuonnin yhteydessa. Ilman tyhjennysta uusi
      // kierros nakyisi vasta TTL:n umpeuduttua.
      const tyhjennetyt: string[] = [];
      for (const tyyppi of ['youth_stats', 'players', 'standings']) {
        try {
          await cacheService.clearType(tyyppi);
          tyhjennetyt.push(tyyppi);
        } catch (e) {
          console.error('[kausituonti] valimuistin tyhjennys ' + tyyppi + ':', e);
        }
      }

      res.json({
        success: true,
        data: {
          tuontiId,
          kirjoitettu: yhteenveto.kirjoitettu,
          tilannekuvat: yhteenveto.tilannekuvat,
          tilannekuvatOhitettu: yhteenveto.tilannekuvatOhitettu,
          vanhentuneet: yhteenveto.vanhentuneet.length,
          kansalaisuus,
          valimuistiTyhjennetty: tyhjennetyt,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const viesti = error instanceof Error ? error.message : 'Tuntematon virhe';
      console.error('[kausituonti/vahvista] failed:', viesti);
      res.status(400).json({ success: false, error: viesti });
    }
  },
);

// ============================================
// EXCEL-IMPORT (Veikkausliiga kumulatiivinen data)
// ============================================

/** POST /api/admin/import-excel — admin: tuo .xlsx (multipart/form-data).
 *  Kentät: file (.xlsx), round (1–27). Parsii + aggregoi sarjan vaiheet ja
 *  kirjoittaa Firestoreen (seasons/2026/players + seasons/2026/rounds/{round}).
 *  Idempotentti — saman kierroksen uudelleenajo ylikirjoittaa. */
app.post('/api/admin/import-excel', requireAdminKey, async (req, res) => {
  // Cloud Functions on jo lukenut request-bodyn → busboy syötetään
  // req.rawBody-Bufferista (raakastreamiä ei enää voi lukea).
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    res.status(400).json({
      success: false,
      error: 'rawBody puuttuu — odotettiin multipart/form-data -pyyntöä',
    });
    return;
  }

  let bb: ReturnType<typeof Busboy>;
  try {
    bb = Busboy({ headers: req.headers });
  } catch {
    res
      .status(400)
      .json({ success: false, error: 'Virheellinen multipart/form-data' });
    return;
  }

  const fields: Record<string, string> = {};
  const chunks: Buffer[] = [];
  let fileBuffer: Buffer | null = null;
  let fileName = '';

  bb.on('field', (name, val) => {
    fields[name] = val;
  });
  bb.on('file', (_name, stream, info) => {
    fileName = info.filename ?? '';
    stream.on('data', (d: Buffer) => chunks.push(d));
    stream.on('end', () => {
      fileBuffer = Buffer.concat(chunks);
    });
  });

  // busboy v1 emittoi 'close' kun kaikki kentät+tiedostot on käsitelty.
  // 'finish' kuunnellaan varmuuden vuoksi (vanhemmat versiot).
  await new Promise<void>((resolve, reject) => {
    bb.on('close', resolve);
    bb.on('finish', resolve);
    bb.on('error', reject);
    bb.end(rawBody);
  }).catch((err) => {
    console.error('[import-excel] busboy error:', err);
  });

  // Validoi round (1–27)
  const round = parseInt(String(fields.round ?? ''), 10);
  if (isNaN(round) || round < 1 || round > 27) {
    res.status(400).json({
      success: false,
      error: 'round puuttuu tai on virheellinen (sallittu 1–27)',
    });
    return;
  }

  // Validoi tiedosto (.xlsx)
  if (!fileBuffer || !fileName.toLowerCase().endsWith('.xlsx')) {
    res.status(400).json({
      success: false,
      error: 'Tiedosto puuttuu tai ei ole .xlsx-muotoinen',
    });
    return;
  }

  try {
    const aggMap = parseExcelBuffer(fileBuffer);
    const players = Array.from(aggMap.values());
    const { imported, players: summary } = await writeRoundData(
      2026,
      round,
      players,
    );
    res.json({
      success: true,
      round,
      imported,
      players: summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tuntematon virhe';
    console.error('[import-excel] failed:', message);
    res.status(500).json({ success: false, error: message });
  }
});

/** POST /api/admin/cache-cleanup - Clean expired cache */
app.post('/api/admin/cache-cleanup', async (_req, res) => {
  try {
    const deleted = await cacheService.cleanup();
    res.json({
      success: true,
      data: { deleted },
      message: `Cleaned up ${deleted} expired cache entries`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cache cleanup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup cache',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// Firebase Functions Export
// ============================================

/**
 * Main API function - handles all /api/* routes.
 *
 * Muistia ja aikaa on enemman kuin oletus (256 MB / 60 s): trendireitti
 * lukee seitseman kauden suoritukset ja nimittajat, ja kylmakaynnistyksen
 * kanssa oletusraja tuli vastaan. Nama arvot koskevat koko API-funktiota,
 * joten ne eivat ole reittikohtainen kiertotie vaan yhteinen varmuusvara.
 */
export const api = functions
  .region(REGION)
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .https.onRequest(app);

// scheduledDataRefresh poistettu tyossa 4: se haki datat ulkoisesta
// tilastorajapinnasta, jota ei enaa kayteta. Kausidata tulee
// kausituonnista.

/** Scheduled: Cache cleanup daily */
export const scheduledCacheCleanup = functions.region(REGION).pubsub
  .schedule('0 3 * * *') // Daily at 3 AM Helsinki
  .timeZone('Europe/Helsinki')
  .onRun(async () => {
    console.log('Starting cache cleanup');
    try {
      const deleted = await cacheService.cleanup();
      console.log(`Cache cleanup completed: ${deleted} entries removed`);
    } catch (error) {
      console.error('Cache cleanup failed:', error);
    }
  });

/** Scheduled: Ajaa kerran päivässä yöllä — virallinen Veikkausliiga.com data */
export const scheduledVeikkausliigaScrape = functions
  .region(REGION)
  .pubsub.schedule('0 1 * * *') // klo 01:00 Helsingin aikaa (timeZone alla muuntaa)
  .timeZone('Europe/Helsinki')
  .onRun(async () => {
    const year = new Date().getFullYear();
    console.log(`[scheduledVeikkausliigaScrape] starting for year=${year}`);
    try {
      const result = await scrapeAndSave(year);
      console.log(
        `[scheduledVeikkausliigaScrape] saved ${result.count} players @ ${result.updatedAt}`,
      );
    } catch (error) {
      console.error('[scheduledVeikkausliigaScrape] failed:', error);
    }
  });

// Transfermarkt-cron poistettu — ajetaan manuaalisesti admin-endpointilla
// POST /api/transfermarkt/refresh (x-admin-key). Cron palautetaan kun Cloud
// Scheduler -oikeudet on konfiguroitu Firebase Consolessa.

/** HTTP: Manual trigger for data refresh */
// refreshData poistettu tietoturvasyysta: se oli julkinen,
// tunnistautumaton HTTPS-funktio, joka tyhjensi valimuistityypit ja haki
// datat uudelleen ulkoisesta lahteesta. Kuka tahansa pystyi kutsumaan
// sita. Kirjoittava reitti ilman tunnistautumista ei kuulu julkiseen
// APIin.
