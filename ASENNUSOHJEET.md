# Pallotalentti.fi - Asennusohjeet

## Yleiskatsaus

Tassa on vaiheittaiset ohjeet Firebase-backendin asennukseen ja kayttoonottoon.

## Tarvitset

1. **Firebase-projekti** (ilmainen taso riittaa alkuun)
2. **RapidAPI-tili** (API-Football, ilmainen 100 req/paiva)
3. **GitHub-tili** (CI/CD automaatiolle)
4. **Node.js 20+** asennettuna

---

## Vaihe 1: Firebase-projektin luonti

```bash
# Asenna Firebase CLI
npm install -g firebase-tools

# Kirjaudu sisään
firebase login

# Luo uusi projekti
firebase projects:create pallotalentti-fi

# Tai kayta olemassa olevaa
firebase use --add
```

## Vaihe 2: Firebase konfigurointi

### 2a. Paivita .firebaserc

```json
{
  "projects": {
    "default": "sinun-projekti-id"
  }
}
```

### 2b. Ota Firestore kayttoon

```bash
firebase init firestore
```

### 2c. Ota Functions kayttoon

```bash
firebase init functions
# Valitse: TypeScript
# Valitse: Y
```

### 2d. Ota Hosting kayttoon

```bash
firebase init hosting
# Valitse: webapp/dist (build-kansio)
# Valitse: Y (SPA)
```

## Vaihe 3: API-avaimet

### 3a. RapidAPI (API-Football)

1. Mene [rapidapi.com](https://rapidapi.com) ja luo tili
2. Etsi "API-Football"
3. Tilaa **ilmainen** taso (100 requestia/paiva)
4. Kopioi X-RapidAPI-Key

### 3b. Aseta Firebase Functions config

```bash
cd functions
firebase functions:config:set rapidapi.key="SINUN_RAPIDAPI_KEY"
```

## Vaihe 4: Asenna ja deployaa

```bash
# Backend
npm install
npm run build

# Frontend (webapp-kansiossa)
cd ../webapp
npm install
npm run build

# Deploy kaikki
cd ..
firebase deploy --only functions,hosting,firestore
```

## Vaihe 5: GitHub Actions CI/CD (valinnainen)

Lisaa GitHub-secrets:

```
FIREBASE_SERVICE_ACCOUNT = (service account JSON key)
FIREBASE_PROJECT_ID      = sinun-projekti-id
RAPIDAPI_KEY             = sinun-rapidapi-key
```

Haetaan service account:
```bash
firebase init hosting:github
```

## API-päätepisteet (deployauksen jalkeen)

| Päätepiste | Kuvaus |
|------------|--------|
| `GET /api/seasons` | Kaikki kaudet |
| `GET /api/seasons/:year` | Yhden kauden tiedot |
| `GET /api/standings/:season` | Sarjataulukko |
| `GET /api/teams/:season` | Joukkueet |
| `GET /api/teams/:season/:id/players` | Joukkueen pelaajat |
| `GET /api/players/:season` | Kaikki pelaajat + tilastot |
| `GET /api/players/:season/market-values` | Markkina-arvot |
| `GET /api/youth-stats/:season` | Nuorten peliaika |
| `GET /api/youth-aggregation/:season` | Koko liigan yhteenveto |
| `GET /api/matches/:season` | Ottelut |
| `GET /api/matches/:season/upcoming` | Tulevat ottelut |
| `GET /api/matches/:season/recent` | Viimeisimmät tulokset |
| `GET /api/team-market-values` | Joukkueiden markkina-arvot |

## Datalahteet

| Lahde | Data | Paivitys |
|-------|------|----------|
| API-Football (RapidAPI) | Ottelut, kokoonpanot, tilastot | 2 tunnin valein |
| FBref | xG, xA, yksityiskohtaiset tilastot | Manuaalinen |
| Transfermarkt | Markkina-arvot | Paivittainen |
| Firestore Cache | Valimuisti | Autom. vanheneminen |

## Hinta-arvio (kk)

| Komponentti | Hinta |
|-------------|-------|
| Firebase Spark (ilmainen taso) | 0 EUR |
| API-Football Pro (tarvittaessa) | ~17 EUR |
| API-Football ilmainen | 0 EUR |
| **Yhteensa** | **0-17 EUR/kk** |

## Vianetsinta

### "RAPIDAPI_KEY not set"
```bash
firebase functions:config:set rapidapi.key="API-AVAimesi"
firebase deploy --only functions
```

### "Permission denied" Firestore
Tarkista `firestore.rules` - pitaa olla `allow read: if true`

### Tyhja data
- API-Football ilmainen taso: vain 10 liigaa
- Kausi 2026 ei ole viela alkanut (alkaa 4.4.2026)
- Tarkista RapidAPI-dashboard: onko requesteja jaljella

### Cache ei paivity
```bash
curl -X POST https://sinun-url.com/api/admin/refresh/2026
```
