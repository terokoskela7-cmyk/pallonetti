# Pallonetti — analyysi ja suunnitelma (19.9.2026)

Perustuu Coden raporttiin + omaan lähdeverifiointiini. Merkitsen erikseen mitä varmistin repoa vasten
ja mikä on Coden raportista.

---

## 1 · Kansalaisuusluku — menetelmä on kunnossa, raportoi VÄLINÄ

Coden kehystys on oikea ja rehellinen. Puran sen ja annan suositukseni.

**Luvut (Code):** 146 pelaajaa · 106 pelannutta · 40 nollaminuuttista. Tallennettu 90 (FIN 61 · ei tietoa
29 · ei 0) · epävarma 16 (ei tallennettu) · ei osumaa 40.

**Mikä on vahvaa:**
- **Alaraja 61** (tallennetut FIN) on kova.
- **"Ei osumaa 40 = tasan nollaminuuttiset."** Tilastotaulukko listaa vain pelanneet → heitä ei ole siellä
  eikä pidäkään olla. Pelanneista 106/106 löytyi. Tämä täsmää täydellisesti — ei aukko.
- **"Ei = 0" on sääntösi suora seuraus, ei virhe.** Veikkausliigan kansalaisuus on yksiarvoinen, joten
  "VL sanoo CIV" ei sulje pois Suomen kaksoiskansalaisuutta. Kukaan ei ole todistettavasti ei-suomalainen
  ennen toista lähdettä. Oikein.

**Yläraja on aitoa epätietoisuutta, ei arvausta.** Siksi luku on väli, ei piste.

**Otsikkoluku:** *"Veikkausliigan 2026 nuorista **61–106 on Suomen kansalaisia**; alaraja on vahva, yläraja
vaatii toisen lähteen tarkentuakseen."* Tämä on rehellinen ja puolustettava.

**16 epävarmaa — suositukseni: tallenna proveninssimerkinnällä, älä pudota.**
Kaikilla sama syy: VL näyttää seuraksi viivan (lähteneet). Nimi ja ikä täsmäävät, seura ei varmennu.
11 sanoo FIN, 5 muu. Ruoppi (myyty Saksaan kesken kauden) tukee tulkintaa. Sääntösi *"epävarma = ei tietoa"*
koskee **väittämistä varmaksi** — mutta merkitty havainto ei ole varmuusväite, se on kirjattu havainto oman
luottamustasonsa kanssa. Tallenna ne merkinnällä **`lahde: 'nimi+ikä', seura_vahvistettu: false`** → et menetä
11 FIN-signaalia etkä valehtele varmuudesta. Tämä kaventaa raportoitavan välin **72–106**:een rehellisesti.
(Päätös sinun — tämä on suositus.)

**Todellinen kaventaminen yhteen lukuun vaatii Palloliiton dataa** (maajoukkuekelpoisuus/valinnat), EI
Transfermarktia (joka on kuollut ja kattoi joka tapauksessa vain 5–20 %). Se on erillinen, tuleva lähde.

---

## 2 · Transfermarkt / markkina-arvot — kolme eri asiaa, joita ei pidä niputtaa

Coden raportti niputti nämä; verifioin ne erikseen ja ne ovat eri kokoluokkaa.

**(a) Ingest-lähde on KUOLLUT — tämä on todellinen ongelma.**
`transfermarkt-api.vercel.app` → **402 DEPLOYMENT_DISABLED** kaikilla reiteillä. Ei esto meille, vaan
Vercel-deployment on poistettu käytöstä — palvelu lakkasi olemasta. Siksi kattavuus jäi ~20–30 pelaajaan.
Markkina-arvot ovat **jäätyneet 30 talletettuun dokumenttiin**; uutta ei tule ennen kuin lähde korvataan.

**(b) Valeonnistumis-reitit — VERIFIOINTINI: matalampi kiireys kuin raportti antoi ymmärtää.**
`/api/transfermarkt/players` ja `/team-values` palauttavat `{success:true,data:[]}`, MUTTA lähteessä ne ovat
**jo merkitty "POISTETTAVAKSI 2026-09-19"** ja kommentti sanoo suoraan: *mikään ei kutsu näitä; frontend
käyttää `getTransfermarktPlayer`/`getTransfermarktLeague`-reittejä jotka lukevat Firestoren
`transfermarkt_players`-kokoelmaa.* → **ne eivät aktiivisesti valehtele tuotanto-UI:lle** — ne ovat kuollutta
koodia odottamassa API-Football-siivousta. Frontend näyttää 30 aitoa talletettua arvoa, ei tyhjää.

**(c) Kuvio jota kannattaa vartioida.** Juurisyy `(b)`:ssä on että `getAllVeikkausliigaPlayers` nielaisee
ylävirran virheen `[]`:ksi, ja reitti kääri sen `success:true`:ksi. Tämä on sama luokka kuin kierrosdatan
valeonnistuminen. **Periaate korjaukseen: ylävirran virhe pinnataan virheenä tai eksplisiittisenä
"lähde poissa" -tilana, EI tyhjänä onnistumisena.** Missä se on kuolleella reitillä → poisto korjaa ilmaiseksi.

---

## 3 · Frontend B2/B3/B4 — luonnollinen portitus

- **B2 (Vaihe 2):** ainoa täysin auki oleva — etenee heti.
- **B3 (kehityskäyrä tilannekuvien erotuksista):** vaatii ≥2 tilannekuvaa; ensimmäinen on 2026-09-19. → 
  **aikaportitettu**: käyrä ei näytä mitään ennen toista tuontia. Voi rakentaa nyt, mutta hyväksyntä odottaa
  2. tilannekuvaa (seuraava tuonti).
- **B4 (markkina-arvot):** riippuu `transfermarkt_players`-kokoelmasta (jäätynyt 30:een). → **portitettu
  lähteen korvaukseen** (kohta 2a). Toimii 30:n osalta, ei näytä uutta.

---

## 4 · Sivuhuomio (roolini): tuotantokirjoitus

Code raportoi ajaneensa 2026-tuonnin **tuotantoon** (idempotentti 0/221/0). Suunnittelu (deterministinen
ID + set(), snapshot, vanhentuneiden merkintä ei poisto) tekee siitä matalariskisen. Silti: koska-koodiagentti
kirjoittaa tuotantoon on syytä olla **tietoinen päätös**, ei sivutuote. Tämä on sinun linjasi asetettavaksi
tässä repossa (talentmasterissa tuotantokirjoitukset ovat sinun).

---

## Suunnitelma — suositeltu järjestys

1. **Nyt (auki):** Frontend **Vaihe 2 (B2)**. Etenee heti, ei riippuvuuksia.
2. **Halpa oikeellisuusvoitto — niputa API-Football-siivoukseen:** poista kuolleet `/api/transfermarkt/
   players` + `/team-values` -reitit (jo merkitty). Samalla **auditoi kierrosdatan/elävät reitit samasta
   tyhjä-onnistuminen-virheellä -kuviosta** → ylävirran virhe pinnataan, ei kääritä `success:true`:ksi.
   Tämä on observability-korjaus, ei kosmetiikka.
3. **Kansalaisuusraportti:** ota käyttöön otsikko **61–106**; päätä 16 epävarmasta (suositus: tallenna
   proveninssimerkinnällä → **72–106**). Todellinen kaventaminen = **Palloliiton lähde**, oma tuleva tehtävä.
4. **Markkina-arvojen lähde:** erillinen päätös — korvataanko kuollut Transfermarkt-polku (uusi
   scraper/lähde) vai hyväksytäänkö jäätynyt 30. **B4 frontend on portitettu tähän.** Sinä priorisoit.
5. **B3 käyrä:** rakenna kun sopii, mutta hyväksyntä odottaa 2. tilannekuvaa (seuraava tuonti).

**Yksi luku jää sinulle päätettäväksi ensin:** hyväksytkö 16 epävarman tallennuksen proveninssimerkinnällä
(→ 72–106), vai pidetäänkö tiukka 61–106. Se ei blokkaa mitään muuta, mutta ratkaisee raportoitavan luvun.

---

*Ydin: kansalaisuusluku on rehellinen väli (61–106; 72–106 jos 16 epävarmaa merkitään) — piste vaatii
Palloliiton. Transfermarktin ingest-lähde on kuollut (402), markkina-arvot jäätyneet 30:een; valeonnistumis-
reitit ovat jo kuolleita/poistettavia eivätkä valehtele UI:lle, mutta tyhjä-onnistuminen-kuvio korjataan
periaatteena. Frontend: B2 auki nyt, B3 aikaportitettu (2. tilannekuva), B4 lähdeportitettu.*
