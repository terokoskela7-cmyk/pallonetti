# PALLONETTI.FI — Claude Code Briefing
> Liitä tämä tiedosto Claude Code -sessioon kun aloitat kehityksen.
> Viimeksi päivitetty: 2026-09-22

---

## 1. PROJEKTI LYHYESTI

**Pallonetti.fi** on suomalaisen jalkapallon nuorten pelaajien peliaikaa visualisoiva julkinen data-alusta. Malli on ruotsalainen bolldata.se — ei AI-tuote, ei fantasy-peli, ei marketplace. Pelkkä data selkeästi esitettynä.

**Ydinkysymys:** *"Kuka alle 23-vuotias suomalainen pelaaja saa peliaikaa Veikkausliigassa?"*

**Brändi:** Itsenäinen ja nimetön. Sivuston missään osassa ei mainita tekijää, TalentMasteria eikä Palloliittoa: ei footerissa, ei Tietoa-sivulla, ei metatiedoissa eikä yhteystiedoissa. Ei "Pohjoismaiden johtava alusta", ei "AI scouting".

---

## 1.5. TUOTANTO

| Asia | Arvo |
|---|---|
| **Frontend** | `https://pallonetti-fi.web.app` (Firebase Hosting) |
| **Backend** | `https://europe-west1-pallonetti-fi.cloudfunctions.net/api` |
| **Region** | europe-west1 (kaikki Functions) |
| **Firebase-projekti** | `pallonetti-fi` |
| **GitHub-repo** | https://github.com/terokoskela7-cmyk/pallonetti |

---

## 3. TIEDOSSA OLEVAT KESKENERÄISYYDET

> Aiemmat 🔴-bugit (BUG 1–5, .firebaserc, indexes.json) korjattu sprintin 2026-05-16…17 aikana. Alla on jäljellä oleva tekninen velka.

### `rateLimiter.ts` on in-memory
Cloud Functions on stateless → Map-pohjainen rate limiter nollautuu jokaisen kutsun välillä. Tiedosto on tällä hetkellä turha. Joko poistettava tai korvattava Firestore-pohjaisella.

---

## 3.4. COMMITOINTI — PAKOLLINEN SÄÄNTÖ

**Ei `git add -A` eikä `git add .`.** Tiedostot lisätään nimeltä.

Ennen jokaista commitia ajetaan `git diff --cached --stat`, ja listan on
vastattava PR:n aihetta. Jos listalla on tiedosto, joka ei kuulu aiheeseen,
sitä ei commitoida mukaan.

**Jokaisen PR:n kuvaukseen liitetään `git diff --stat origin/main...HEAD`,**
ja jokainen listan tiedosto perustellaan PR:n aiheella. Jos tiedostoa ei voi
perustella, se ei kuulu tähän PR:ään.

**Ei force-pushia.** Julkaistua haaraa ei kirjoiteta uusiksi: ei
`--force`, ei `--force-with-lease`, eikä rebasea jo pushatulle haaralle.
Konflikti ratkaistaan `git merge`llä. Force-push hävittää katselmoidun
historian, ja katselmoija katsoo silloin eri koodia kuin mitä mainiin
päätyy.

**Työpuussa commitoimatta olevaa muutosta ei jätetä roikkumaan.** Se joko
commitoidaan omaan haaraansa tai siitä raportoidaan käyttäjälle. Roikkuva
muutos päätyy seuraavaan committiin riippumatta siitä, mihin se kuuluu.

**Miksi:** 2026-09-19 commit `fdb379d` ("markkina-arvot piiloon") vei mainiin
109 riviä `haeKansalaisuudet.ts`:ään — maakoodien normalisoinnin, raporttitilan
ja minuuttiluokittelun — koska ne olivat työpuussa committoimatta ja
`git add -A` pyyhkäisi ne mukaan. Seuraukset: PR:n kuvaus ei vastannut sen
sisältöä, katselmointi kohdistui väärään asiaan, ja seuraava haara joutui
konfliktiin muutoksesta, jota sen ei pitänyt koskea.

---

## 3.45. PR:T JA MERGE — PAKOLLINEN SÄÄNTÖ

**Code ei mergeä PR:ää.** Merge on käyttäjän tehtävä, koska se on viimeinen
tarkistuspiste ennen tuotantoa: mainiin menevä commit deployataan
automaattisesti. Sisällön hyväksyntä ei ole lupa mergeen, eikä lupa yhteen
PR:ään koske seuraavaa. Jos PR on valmis, se kerrotaan ja jäädään
odottamaan.

**Merge-lupa koskee tiettyä commitia.** Lupa annetaan SHA:lle, ei
haaralle. Jokaisessa raportissa kerrotaan PR:n tila ja uusimman commitin
SHA, ja käyttäjä mergeää vain jos ne täsmäävät siihen, mihin lupa
annettiin. Jos haaraan tulee uusi commit luvan jälkeen, lupa raukeaa ja
se pyydetään uudelleen.

**PR:n tila tarkistetaan ennen jokaista pushia:**
`gh pr view <n> --json state,headRefOid`. Suljettuun tai mergettyyn
PR:ään pushaaminen ei käynnistä CI:tä eikä päädy mainiin — työ jää
haaralle huomaamatta. Näin kävi 21.9.2026: PR #38 oli jo mergetty, ja
kaksi hyväksyttyä committia jäi julkaisematta.

**Ei pinottuja PR:iä.** Jokainen PR tehdään suoraan `main`ia vasten. Jos
työ riippuu edellisestä, odotetaan että edellinen on mainissa ja
haaroitetaan uusi siitä. Pinotut PR:t mergeytyvät toisiinsa eivätkä
mainiin, jolloin hyväksytty työ jää huomaamatta julkaisematta.

---

## 3.5. TUOTANTOON KIRJOITTAMINEN — PAKOLLINEN SÄÄNTÖ

**Tuotannon Firestoreen kirjoitetaan vain kahdella ehdolla yhtä aikaa:**

1. **Kahden lipun skriptillä.** Kirjoitus vaatii `--vahvista` ja lisäksi
   `--tuotanto`. Oikeisiin kokoelmanimiin kirjoittaminen vaatii vielä
   kolmannen, tahallisen lipun `--oikeat-kokoelmat`; ilman sitä kohde on
   `--etuliite`-kokoelma. Lippuja ei ohiteta eikä vartijoita löysätä.
2. **Käyttäjän chatissa antamalla hyväksynnällä.** Luvut näytetään ennen
   jokaista kirjoitusvaihetta, ja kirjoitus tehdään vasta kun käyttäjä on
   hyväksynyt ne. Aiempi hyväksyntä ei kata seuraavaa ajoa.

Poistot ovat aina ihmisen päätös. Tuonti merkitsee lähteestä poistuneet
vanhentuneiksi, ei poista niitä. Poistettavan dokumentin sisältö kirjataan
ennen poistoa (commit-viesti tai loki), jotta poisto on jäljitettävissä.

Sama koskee ad hoc -skriptejä: jos skripti kirjoittaa tuotantoon, sillä on
oltava sama kahden lipun vartija ja sama esikatselu kuin kausituonnilla.

### Sarja on osa avainta — ja miksi kausidokumentti ei ole

Sarja (Veikkausliiga / Ykkösliiga) on osa jokaista avainta, koska
nimittäjä on sarjakohtainen:

```
suoritukset/{sarja}_{kausi}_{vaihe}_{joukkue}_{pelaajaAvain}
nimittajat/{sarja}_{kausi}_{vaihe}_{joukkue}
kaudet/{sarja}_{kausi}
seasons/{kausi}/players/{sarja}_{slug}
seasons/{kausi}/tilannekuvat/{sarja}_{pvm}
```

**Kausidokumentti `seasons/{kausi}` on tarkoituksella sarjaton.** Sen alla
ovat myös `kansalaisuudet` ja `tilannekuvat`, jotka on kerätty ennen
sarjajakoa. Sarjallinen kausidokumentti (`seasons/{sarja}_{kausi}`) olisi
orpouttanut ne ja vaatinut oman siirtonsa. Sarja on sen sijaan
pelaajadokumentin avaimessa, mikä riittää: sama pelaaja voi olla samalla
kaudella molemmissa sarjoissa ilman että dokumentit osuvat toisiinsa.

**Sarja suodatetaan aina muistissa, ei `where`-ehdolla.** Vanhoissa
dokumenteissa kenttää ei ole, ja `where` jättäisi ne pois — jolloin
Veikkausliigan luvut muuttuisivat äänettömästi. Puuttuva kenttä tarkoittaa
Veikkausliigaa. Sama periaate kuin `vanhentunut`-kentällä.

**Vanhentuneiden merkintä on sarjakohtainen.** Ilman sitä toisen sarjan
tuonti merkitsisi saman kauden toisen sarjan rivit vanhentuneiksi. Merkintä
koskee suorituksia, nimittäjiä, projektioita JA kausidokumentteja: vanha
nimittäjä kasvattaa kapasiteettia ja pienentää osuutta, vanha
kausidokumentti näkyy kautena kahdesti.

### Tilannekuvat ja kehityskäyrä (B3)

Tilannekuva on `seasons/{kausi}/tilannekuvat/{sarja}_{pvm}`, ja sen alla
`pelaajat/{sarja}_{slug}`. Kehityskäyrä lasketaan peräkkäisten
tilannekuvien erotuksesta, joten se **valitsee tilannekuvat kolmella
ehdolla**:

1. **vain kuluva kausi** — päättyneen kauden tilannekuva on lopputila, ei
   havainto kauden kulusta
2. **suodatus sarjalla** — puuttuva `sarja`-kenttä tarkoittaa
   Veikkausliigaa
3. **`lahde`-kentällä merkityt jätetään pois** — `"migraatio"` syntyi
   avainmuutoksen yhteydessä 20.9.2026, `"tuonti (päättynyt kausi)"` on
   päättyneen kauden lopputila. Kumpikaan ei kerro pelatuista otteluista
   mitään. Kuluvan kauden tilannekuvissa kenttää ei ole.

`seasons/{kausi}` on **olematon dokumentti**: sillä ei ole kenttiä, vain
alikokoelmat. Siksi `collection('seasons').get()` palauttaa tyhjän ja
kausien läpikäynti tehdään `listDocuments()`-kutsulla. Kysely näyttäisi
onnistuvan ja tekisi äänettömästi ei mitään.

Kaksoiskappaleen esto vertaa sisältöä (seurojen ottelumäärät ja pelaajien
minuutit seuroittain), ei aikaleimaa. Vanhin tilannekuva `2026-09-19` on
vanhemmasta muodosta, josta puuttuu pelaajakohtainen seuraerittely — sen
tiiviste eroaa uudesta, vaikka minuutit ovat samat.

### Tuotannon päätepisteen kutsuminen on tuotantotoimenpide

Tuotannon päätepistettä ei kutsuta sen selvittämiseksi, mitä se tekee.
Kutsu on sallittu vasta, kun **koodista on luettu**, että reitti on pelkkä
luku. **HTTP-metodi ei riitä perusteeksi:** GET-reitti voi tyhjentää
välimuistin, käynnistää uudelleenhaun tai kirjoittaa Firestoreen — näin
kävi `refreshData`-funktiolla 20.9.2026, jolloin varmistuskutsu tyhjensi
`cache`-kokoelman.

Jos reitin vaikutus on epäselvä, testi ajetaan emulaattoria vasten, ei
tuotantoa vasten.

### Tuotantodatan lukeminen vaatii luvan

Myös pelkkä lukeminen ilmoitetaan **etukäteen** ja tehdään vasta
chatissa annetun luvan jälkeen. Lupa koskee yhtä ajoa kerrallaan, ei
skriptiä tai istuntoa. Selain- ja regressiotarkistukset tehdään
ensisijaisesti emulaattoriin kylvetyllä aineistolla, jolloin lupaa ei
tarvita lainkaan.

---

## 3.6. TÄMÄN TIEDOSTON YLLÄPITO — PAKOLLINEN SÄÄNTÖ

**Poistettuja kuvausosioita ei lisätä takaisin.** Repo-rakenne,
komponentti- ja sivuluettelot, endpointtitaulukot, cache-taulukot ja
stack-listat on poistettu tarkoituksella: ne ovat luettavissa koodista,
ja kopiona ne vanhenevat äänettömästi ja ohjaavat väärään suuntaan.

**Tiedostoon ei kirjoiteta lukuja eikä tilatietoja, jotka vanhenevat.**
Ei commit-tunnisteita, ei endpointtien tai komponenttien lukumääriä, ei
versionumeroita, ei "viimeksi tuotu" -päiviä. Jos luku on tarpeen, se
haetaan ajossa lähteestä.

Tänne kuuluu vain se, mitä koodista ei voi lukea: säännöt, kiellot,
sudenkuopat, perustelut ja sopimukset.

---

## 4. DEPLOY

### Manuaalinen deploy (paikalliselta koneelta)
```
cd webapp ; npm run build
cd ..\functions ; npm run build
firebase deploy --only functions,hosting,firestore
```

### CI/CD
`.github/workflows/deploy.yml` ajaa kaikki push:t `main`-haaraan. Vaatii GitHub Secretit:

| Secret | Arvo |
|---|---|
| `FIREBASE_PROJECT_ID` | `pallonetti-fi` |
| `FIREBASE_SERVICE_ACCOUNT` | Service account JSON base64-koodattuna |
| `FIREBASE_API_URL` | `https://europe-west1-pallonetti-fi.cloudfunctions.net/api` |

### Smoke-testit deployn jälkeen
```
BASE=https://europe-west1-pallonetti-fi.cloudfunctions.net/api
curl $BASE/health
curl $BASE/youth-stats/2026
curl $BASE/youth-stats/2026/all
curl $BASE/youth-aggregation/2026
```

---

## 7. FRONTEND — VÄRIT

### Väripaletti (PAKOLLINEN)
```css
--navy:    #0F1D32;  /* Tausta */
--ice:     #00C8FF;  /* Pääväri, aksentti */
--aurora:  (gradientti — ks. tailwind.config) /* Otsikkoaksentti */
--white:   #FFFFFF;
--gray:    #8899AA;
--green:   #22C55E;  /* Positiivinen trendi */
--red:     #EF4444;  /* Negatiivinen trendi */
```

---

## 8. DATALÄHTEET

### Veikkausliigan tilastovienti — päälähde
- Kauden Excel-vienti → `suoritukset`, `nimittajat`, `kaudet`, `seasons/{kausi}/players`
- Kaikki peliaikaluvut lasketaan tästä
- Tuonti tehdään admin-sivulta tai kahden lipun skriptillä (ks. 3.5)

### Veikkausliigan pelaajarekisteri
- Kansalaisuus ja pelipaikka pelaajan profiilisivulta
- Yksi koodi per pelaaja: ei kerro kaksoiskansalaisuutta

### FBref (scraper)
- xG / xA -tiedot
- FBref piilottaa taulukot HTML-kommentteihin — käsitellään `fbrefApi.ts`:ssä
- Hauras: voi hajota jos FBref muuttaa rakennetta

### Suomalaiset ulkomailla — EI vielä backendissä
- Tarvitaan oma toteutus, ei MVP:ssä
- Tämä on pallonetti.fi:n uniikki lisäarvo bolldata.se:hen verrattuna

---

## 9. MITÄ EI RAKENNETA (scope freeze)

- ClubOS, AgentHub, TalentDraft Fantasy — Kimi-agentin ideointia
- AI scouting, match predictor, virtual transfer simulator
- Käyttäjärekisteröinti / kirjautuminen
- Maksullinen Pro-tilaus
- Push-notifikaatiot
- Naisten Kansallinen Liiga (Sprint 6+)
- Pohjoismainen vertailu (vaatii Allsvenskan/Eliteserien-datan)

---

## 10. YHTEYS TALENTMASTER-SISARPROJEKTIIN

Erilliset Firebase-projektit, ei jaettua dataa MVP:ssä.

| Projekti | Firebase-projekti |
|---|---|
| TalentMaster (junior-SaaS) | `talentmaster-pilot` |
| Pallonetti.fi (julkinen U23) | `pallonetti-fi` |

Mahdollinen linkitys (Q4 2026, ei nyt):
TalentMaster-pilottiseuran juniori → näkyy pallonetti.fi /pelaaja/:slug:ssä normaalisti kausituonnin datasta → (manuaalinen) "Kehittyi [Seura]-akatemiassa" -merkintä. Ei automaattista Firebase-integraatiota.

---

*Päivitetty 2026-09-22 — vain se, mitä koodista ei voi lukea.*
