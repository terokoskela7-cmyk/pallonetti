# Pallotalentti.fi - Asennusohjeet

## Yleiskatsaus

Tassa on vaiheittaiset ohjeet Firebase-backendin asennukseen ja kayttoonottoon.

## Tarvitset

1. **Firebase-projekti** (ilmainen taso riittaa alkuun)
2. **GitHub-tili** (CI/CD automaatiolle)
3. **Node.js 20+** asennettuna

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

## Vaihe 3: Avaimet

Sivusto ei kayta ulkoisia maksullisia rajapintoja. Ainoa tarvittava avain
on `ADMIN_KEY`, jolla suojataan tuontireitit.

```bash
# GitHub-secret ADMIN_KEY; CI kirjoittaa sen functions/.env-tiedostoon
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
ADMIN_KEY                = tuontireittien avain
```

Haetaan service account:
```bash
firebase init hosting:github
```

## API-päätepisteet (deployauksen jalkeen)

| Päätepiste | Kuvaus |
|------------|--------|
| `GET /api/kaudet` | Saatavilla olevat kaudet |
| `GET /api/trendit` | Kausitrendit, yksi piste per kausi |
| `GET /api/youth-stats/:season` | Nuorten peliaika joukkueittain |
| `GET /api/youth-stats/:season/all` | Sama, kaikki sarjat |
| `GET /api/youth-aggregation/:season` | Koko liigan yhteenveto |
| `GET /api/kansalaisuudet/:season` | Kansalaisuuksien kolmijako |
| `GET /api/season-players/:season` | Kauden pelaajat |
| `GET /api/season-players/:season/:slug` | Yksi pelaaja |
| `GET /api/official-stats/:year` | Veikkausliiga.com-tilastot |
| `POST /api/admin/kausituonti/esikatselu` | Tuonnin esikatselu (x-admin-key) |
| `POST /api/admin/kausituonti/vahvista` | Tuonnin vahvistus (x-admin-key) |

## Datalahteet

| Lahde | Data | Paivitys |
|-------|------|----------|
| Veikkausliigan tilastovienti | Minuutit, ottelut, maalit | Kausituonnissa |
| FBref | xG, xA, yksityiskohtaiset tilastot | Manuaalinen |
| Transfermarkt | Markkina-arvot | Paivittainen |
| Firestore Cache | Valimuisti | Autom. vanheneminen |

## Hinta-arvio (kk)

| Komponentti | Hinta |
|-------------|-------|
| Firebase Spark (ilmainen taso) | 0 EUR |
| **Yhteensa** | **0 EUR/kk** |

## Vianetsinta

### "Permission denied" Firestore
Nain kuuluu olla: `firestore.rules` kieltaa kaiken suoran paasyn
selaimesta. Frontend hakee datan `/api`-reittien kautta, ja backend
kayttaa Admin SDK:ta, joka ohittaa saannot.

### Tyhja data
- Kautta ei ole viela tuotu: tarkista `GET /api/kaudet`
- Vastauksen `dataSaatavilla: false` kertoo, ettei dataa ole

### Cache ei paivity
```bash
curl -X POST https://sinun-url.com/api/admin/refresh/2026
```
