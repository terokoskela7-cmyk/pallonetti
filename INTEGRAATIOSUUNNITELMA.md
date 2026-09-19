# Pallonetti.fi × TalentMasterID (Kimi-versio) — Integrointisuunnitelma

> Päivämäärä: 2026-06-06
> Tekijä: Kimi Code CLI

---

## 1. Yhteenveto: Mitä Kimi-versio oikeasti on

### Kriittinen havainto: **100 % mock data**

Kimi-versiossa (`Kimi_Agent_Suomalaiset nuoret Veikkausliigassa/app`) on **36 sivua**, mutta **yksikään niistä ei käytä oikeaa dataa**. Jokainen sivu lataa sisältönsä `src/data/*.ts` -mock-tiedostoista. Backend (`pallotalentti-backend/`) on olemassa, mutta frontend ei ole kytketty siihen lainkaan.

**Mitä tämä tarkoittaa:**
- Kimi-versio on **UI-prototyyppi / konseptinäyttely**, ei tuotantovalmis sovellus
- Sivut ovat visuaalisesti hienoja (framer-motion-animaatiot, shadcn/ui-komponentit)
- Mutta: tilastot, pelaajat, ottelut, siirrot — kaikki on keksittyä dataa
- **Ei voi suoraan yhdistää** — jokainen sivu pitää kirjoittaa uudelleen käyttämään oikeaa API:a

### Brändi-ero
| | Virallinen pallonetti | Kimi-versio |
|---|---|---|
| Nimi | pallonetti.fi | TalentMasterID |
| Fokus | Nuorten peliaika-analytiikka | Laaja jalkapalloalusta |
| Data | Oikea (API-Football, TM, FBref) | Mock data |
| Sivuja | 6 | 36 |
| Bundle | ~660 KB | ~? (sis. shadcn/ui + framer-motion) |

---

## 2. Sivujen priorisointi: Mitä ottaa, mitä jättää

### 🟢 TASO 1 — Ota mukaan (reaalidataa, korkea arvo)

Nämä sivut voidaan rakentaa olemassaolevilla backend-endpointeilla.

| Sivu | Kimi-reitti | Arvio | Tarvittava työ |
|------|-------------|-------|----------------|
| **Sarjataulukko** | Uusi | ⭐⭐⭐⭐⭐ | Backend palauttaa jo `/api/standings/:season`. Ei näy missään UI:ssa! |
| **Ottelukalenteri** | `/ottelukalenteri` | ⭐⭐⭐⭐⭐ | Backend: `/api/matches/:season/upcoming` + `/recent`. Näyttää tulevat & päättyneet. |
| **Globaali haku** | `/haku` | ⭐⭐⭐⭐ | Backend: `/api/players/:season`, `/api/teams/:season`. Haku pelaajista & joukkueista. |

### 🟡 TASO 2 — Konsepti hyvä, vaatii työtä (osa mock→reaali)

| Sivu | Kimi-reitti | Arvio | Tarvittava työ |
|------|-------------|-------|----------------|
| **Pelaajan rikkaampi profiili** | `/pelaaja/:playerId` | ⭐⭐⭐⭐ | Kimi-versiossa hieno layout. Virallisessa `/pelaaja/:slug` on data mutta karkea UI. Yhdistä: ota Kimin layout, täytä oikealla datalla. |
| **Markkina-arvo-analyysi** | `/markkina-arvo` | ⭐⭐⭐ | Backend: `/api/transfermarkt/players` + `/api/transfermarkt/team-values`. Kimi-versiossa hienot visualisoinnit mutta mock data. |
| **Pelaajien ulkomaat** | `/ulkomaat` | ⭐⭐⭐ | Ei olemassa backendissä. Vaatisi uuden data-lähteen (Transfermarkt-maajoukkueet?). Voi tehdä manuaalisesti ylläpidetyksi. |
| **Allsvenskan-vertailu** | `/allsvenskan-ero` | ⭐⭐⭐ | Staattinen analyysisivu (kuten nykyinen About). Sisältö hyvä, siirrä About-sivulle tai omaksi sivukseen. |

### 🔴 TASO 3 — Konsepti hyvä, mutta vaatii paljon työtä

| Sivu | Kimi-reitti | Arvio | Tarvittava työ |
|------|-------------|-------|----------------|
| **TalentDraft** (fantasy-peli) | `/talentdraft` | ⭐⭐⭐⭐ | TODELLA hieno konsepti: "Draftaa U21-joukkue budjetilla". Mutta: vaatisi täysin uuden backendin (pelaajien hinnat, draft-logiikka, pisteiden lasku). **Ei nykyisellä backendillä.** |
| **Otteluennusteet** | `/ennusteet` | ⭐⭐⭐ | Hieno UI. Vaatisi ML-mallin tai edes forma-tilastojen integroinnin. Mock data nyt. |
| **Siirrot / Transfer Radar** | `/siirrot`, `/transfer-radar` | ⭐⭐⭐ | Ei reaaliaikaista siirtodataa Suomessa. Transfermarkt-API:lla osittain mahdollista. |

### ⚫ TASO 4 — Jätä pois (liian laaja/mock/community)

| Sivu | Kimi-reitti | Syy jättää pois |
|------|-------------|-----------------|
| AI Agentit | `/ai-agentit`, `/agenthub` | Ei oikeaa AI-backendia. Konsepti, ei toiminnallisuutta. |
| AI Työkalut | `/ai-tyokalut` | Sama kuin yllä. |
| Fan äänestykset | `/aanestykset` | Vaatisi käyttäjäjärjestelmän + tietokannan. |
| Fan pisteet | `/fanipisteet` | Sama kuin yllä. |
| WhatsApp-hälytykset | `/halytykset` | Vaatisi WhatsApp Business API -integraation. |
| Virtuaalisiirrot | `/virtual-transfer` | Peli, ei analytiikkaa. |
| Naiset | `/naiset` | Ei dataa (Kansallinen Liiga puuttuu API-Footballista). |
| Ykkösliiga | `/ykkosliiga` | Dataa haetaan mutta ei näy UI:ssa. Voi tehdä myöhemmin. |
| Alemmat sarjat | `/alemmat-sarjat` | Ei dataa. |
| Maajoukkue | `/maajoukkue` | Ei dataa. |
| Nuorten maajoukkueet | `/nuorten-maajoukkueet` | Ei dataa. |
| Innovations | `/innovations` | Markkinointisivu, ei dataa. |
| Pre-launch | `/pre-launch` | Sisäinen checklist, ei julkinen. |
| Login | `/kirjautuminen` | Vaatisi auth-järjestelmän. |

---

## 3. Tekninen integrointistrategia

### 3.1 Mitä kopioida Kimi-versiosta

| Resurssi | Kopioidaanko? | Mihin |
|----------|---------------|-------|
| **Framer-motion** -animaatiot | ✅ Kyllä | KPI-korttien, taulukoiden ja sivutransitioiden animointiin |
| **PlayerRadar** -komponentti | ✅ Kyllä | Pelaajaprofiiliin (jos saadaan oikeat data-kentät) |
| **HeatMap** -komponentti | ⚠️ Harkiten | Vaatisi event-dataa (ei olemassa) |
| **StatCard** -komponentti | ✅ Kyllä | Uudelleenkäytettävä KPI-kortti (korvaa nykyisen) |
| **shadcn/ui -kirjasto** | ❌ Ei | Liian raskas (~40 komponenttia). Nykyiset omat komponentit riittävät. |
| **Sidebar-layout** | ❌ Ei | Nykyinen ylänavigaatio on parempi yksinkertaisuudessaan |
| **Mock-data -tiedostot** | ❌ Ei | Ei hyödyllisiä — data on keksittyä |

### 3.2 Asennukset nykyiseen projektiin

```bash
cd webapp
npm install framer-motion
```

> **Huom:** `framer-motion` lisää ~30–40 KB bundleen. Vaihtoehto: käytä CSS-transitions (ei lisäystä) tai `react-spring` (kevyempi).

### 3.3 Tyylien yhdistäminen

Kimi-versio käyttää omaa väripalettia (`#0F1D32`, `#00C8FF`, `#162544`). Virallinen käyttää (`navy-700`, `ice`, `aurora`, `#0F1D32`). Paletit ovat **lähes identtisiä** — yhdistäminen onnistuu pienellä Tailwind-säädöllä.

---

## 4. Vaiheistettu toteutussuunnitelma

### VAIHE 1: Nopeat voitot (2–4 h)
**Tavoite:** Lisää sivut jotka toimivat jo olemassaolevalla datalla.

1. **Sarjataulukko-sivu** (`/sarjataulukko`)
   - Käyttää `GET /api/standings/:season`
   - Taulukko: sija, joukkue, O, V, T, H, TM, PM, ME, P
   - Korosta U21-pelaajien määrä per joukkue (jos saatavilla)
   - Lisää navigaatioon

2. **Ottelukalenteri-sivu** (`/ottelukalenteri`)
   - Käyttää `GET /api/matches/:season/upcoming` + `/recent`
   - Kaksi välilehteä: "Tulevat" / "Päättyneet"
   - Näytä: päivämäärä, kellonaika, kotijoukkue, vierasjoukkue, tulos (päättyneille)
   - Lisää navigaatioon

3. **Globaali haku** (navigaatiopalkkiin)
   - Haku pelaajista ja joukkueista
   - Dropdown-tulokset, navigoi suoraan pelaaja/joukkue-sivulle

### VAIHE 2: UI-parannukset (4–8 h)
**Tavoite:** Porttaa Kimi-version parhaat UI-konseptit.

4. **Framer-motion -animaatiot**
   - KPI-korttien fade-in + stagger (kuten Kimi Dashboardissa)
   - Taulukkorivien hover-animaatiot
   - Sivukohtaiset fade-in transitiot

5. **Pelaajaprofiilin rikastus**
   - Ota Kimi-version `PlayerProfile.tsx` layout-rakenne
   - Täytä oikealla datalla (`/api/player/:id/season/:season`, `/api/transfermarkt/player/:name`)
   - Lisää: pelaajakuva, markkina-arvo, sopimusinfo, ikä/minuutit/maalit grid

6. **StatCard-komponentti**
   - Uudelleenkäytettävä KPI-kortti Kimi-versiosta
   - Korvaa nykyiset `KpiCard`-toteutukset yhtenäisellä komponentilla

### VAIHE 3: Uudet konseptit (8–16 h)
**Tavoite:** Lisää Kimi-version uniikkeja toiminnallisuuksia.

7. **Markkina-arvo-sivu** (`/markkina-arvo`)
   - Käyttää `GET /api/transfermarkt/players` + `/api/transfermarkt/team-values`
   - Joukkueiden markkina-arvojen vertailu (pylväsdiagrammi)
   - U21-pelaajien markkina-arvojen top-lista
   - Arvon kehitys ajan kuluessa (jos historiadataa saatavilla)

8. **Allsvenskan-vertailu** (`/allsvenskan-ero` tai `/about`)
   - Staattinen analyysisivu Kimi-versiosta
   - Siirrä osaksi About-sivua tai tee omaksi sivukseen

9. **Pelaajien ulkomaat** (`/ulkomaat`)
   - Manuaalisesti ylläpidetty lista (ei API-dataa)
   - Taulukko: pelaaja, ikä, maa, seura, liiga, peliaika
   - Päivitetään kausittain

### VAIHE 4: Isot ominaisuudet (20–40 h)
**Tavoite:** Pelillistäminen ja ennusteet.

10. **TalentDraft** (fantasy-peli)
    - **Backend:** Uusi collection Firestoreen: `draft_players` (pelaaja, hinta, pisteet)
    - **Pelaajien hinnat:** Perustuu Transfermarkt-arvoihin (skaalattu draft-budjettiin)
    - **Pisteiden lasku:** Minuutit × 0.1 + maalit × 5 + syötöt × 3 + clean sheet × 2
    - **UI:** Kimi-version `TalentDraft.tsx` layout, mutta oikealla datalla
    - **Tallennus:** LocalStorage (ei authia) tai Firestore (jos auth)

11. **Otteluennusteet** (kevyt versio)
    - Käytä sarjataulukon dataa: sijoitus + viiden ottelun forma
    - Yksinkertainen piste-algoritmi (ei ML)
    - Näytä todennäköisyydet: kotivoitto / tasapeli / vierasvoitto

---

## 5. Mitä EI kannata tehdä

| Älä tee | Miksi |
|---------|-------|
| Kopioi kaikki 36 Kimi-sivua | Suurin osa on mock-dataa, ei hyödyllisiä |
| Asenna shadcn/ui | Lisää ~100+ KB bundleen, nykyiset komponentit riittävät |
| Tee auth-järjestelmää | Lisää monimutkaisuutta, ei liiketoimintatarvetta vielä |
| Tee WhatsApp-integraatiota | Vaatisi Business API -sopimuksen, ei MVP |
| Tee naisten liigaa | Ei dataa API-Footballissa |
| Tee AI-agentteja | Ei oikeaa AI-backendia, olisi feikkiä |

---

## 6. Arvioitu työmäärä

| Vaihe | Sisältö | Arvio |
|-------|---------|-------|
| **Vaihe 1** | Sarjataulukko + Ottelukalenteri + Haku | 2–4 h |
| **Vaihe 2** | Animaatiot + Pelaajaprofiili + StatCard | 4–8 h |
| **Vaihe 3** | Markkina-arvo + Allsvenskan + Ulkomaat | 8–16 h |
| **Vaihe 4** | TalentDraft + Ennusteet | 20–40 h |
| **Yhteensä** | | **34–68 h** |

---

## 7. Suositus: Mistä aloittaa

**Jos haluat maksimaalisen vaikutuksen minimityöllä:**

1. **Aloita Vaihe 1** — Sarjataulukko ja ottelukalenteri ovat nopeita ja näkyviä
2. **Sitten Vaihe 2** — Framer-motion-animaatiot tekevät sivustosta "premiumin"
3. **Harkitse TalentDraftia** — Tämä erottaa pallonetin kaikesta muusta. Mutta: vaatii eniten työtä.

**Jos resurssit ovat rajalliset:**
- Tee vain Vaihe 1 (2–4 h)
- Lisää Vaihe 2 UI-animaatiot (4–8 h lisää)
- Jätä Vaiheet 3–4 myöhemmäksi

---

## 8. Vertailu: Nykyinen vs Integroitu

| Ominaisuus | Nykyinen | Integroitu (Vaiheet 1–2) | Integroitu (kaikki) |
|------------|----------|--------------------------|---------------------|
| Etusivu | ✅ | ✅ + animaatiot | ✅ + animaatiot |
| U21-pelaajat | ✅ | ✅ | ✅ |
| Peliaika-analyysi | ✅ | ✅ + animaatiot | ✅ + animaatiot |
| Kaikki pelaajat | ✅ | ✅ | ✅ |
| Pelaajaprofiili | ✅ (karkea) | ✅ (rikas) | ✅ (rikas) |
| Sarjataulukko | ❌ | ✅ | ✅ |
| Ottelukalenteri | ❌ | ✅ | ✅ |
| Haku | ❌ | ✅ | ✅ |
| Markkina-arvo | ❌ | ❌ | ✅ |
| Ulkomaat | ❌ | ❌ | ✅ |
| Allsvenskan-vertailu | Osittain (About) | Osittain | ✅ |
| TalentDraft | ❌ | ❌ | ✅ |
| Ennusteet | ❌ | ❌ | ✅ |

---

*Suunnitelman voi päivittää sitä mukaa kun toteutus etenee.*
