import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { Upload, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { pros, luku } from '@/utils/luvut';

// Sama base kuin services/api.ts — relatiivinen '/api' reititetään
// Hosting-rewriten kautta Cloud Function 'api':lle.
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// Admin-avain säilytetään localStoragessa jotta sitä ei tarvitse joka kerta
// syöttää uudelleen. Avain lähetetään aina otsakkeessa, ei koskaan URL:ssa.
const ADMIN_KEY_STORAGE = 'pn_admin_key';

interface Esikatselu {
  rivit: {
    luettu: number;
    kayttokelpoiset: number;
    ohitetut: Array<{ rivi: number; syy: string }>;
  };
  kaudet: Array<{
    kausi: string;
    pelaajat: number;
    rivit: number;
    osuusKokoKausi: number;
    osuusRunkosarja: number;
    osuusAlle21: number;
    vaiheet: string[];
    seurat: Array<{ joukkue: string; ottelut: number }>;
  }>;
  muutokset: { luodaan: number; paivitetaan: number; vanhentuu: number };
  pienentyneet: Array<{ slug: string; ennen: number; jalkeen: number }>;
  muuttuneet: Array<{ slug: string; ennen: number; jalkeen: number }>;
  kadonneet: Array<{ slug: string; minuutit: number }>;
  tilannekuvat: Array<{ kausi: string; pvm: string; muuttuu: boolean }>;
  varoitukset: string[];
  uusiaIlmanKansalaisuutta: number;
  tiedosto: string;
}

interface Tallennettu {
  tuontiId: string;
  kirjoitettu: {
    suoritukset: number;
    nimittajat: number;
    kaudet: number;
    projektiot: number;
  };
  tilannekuvat: string[];
  tilannekuvatOhitettu: string[];
  vanhentuneet: number;
  kansalaisuus: {
    haettu: number;
    onnistui: number;
    eiTietoa: number;
    jaljella: number;
    ohitettuNollaMinuuttia: number;
  };
  valimuistiTyhjennetty: string[];
}

type Tila =
  | { kind: 'idle' }
  | { kind: 'lataa'; mita: 'esikatselu' | 'tallennus' }
  | { kind: 'esikatselu'; data: Esikatselu }
  | { kind: 'tallennettu'; data: Tallennettu }
  | { kind: 'virhe'; viesti: string };

function Rivi({ label, arvo }: { label: string; arvo: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-white/50">{label}</span>
      <span className="text-white/90 tabular">{arvo}</span>
    </div>
  );
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [tila, setTila] = useState<Tila>({ kind: 'idle' });

  useEffect(() => {
    const saved = localStorage.getItem(ADMIN_KEY_STORAGE);
    if (saved) setAdminKey(saved);
  }, []);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    // Uusi tiedosto mitätöi vanhan esikatselun: vahvistus ei saa koskaan
    // koskea eri tiedostoon kuin se, jonka luvut käyttäjä näki.
    setTila({ kind: 'idle' });
  };

  async function laheta(
    polku: 'esikatselu' | 'vahvista',
    mita: 'esikatselu' | 'tallennus',
  ) {
    if (!file) {
      setTila({ kind: 'virhe', viesti: 'Valitse pelaajatiedosto (.xlsx)' });
      return;
    }
    if (!adminKey.trim()) {
      setTila({ kind: 'virhe', viesti: 'Anna admin-avain' });
      return;
    }
    localStorage.setItem(ADMIN_KEY_STORAGE, adminKey.trim());
    setTila({ kind: 'lataa', mita });

    const body = new FormData();
    body.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/admin/kausituonti/${polku}`, {
        method: 'POST',
        body,
        headers: { 'x-admin-key': adminKey.trim() },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setTila({
          kind: 'virhe',
          viesti: json.error ?? `Palvelin vastasi ${res.status}`,
        });
        return;
      }
      setTila(
        mita === 'esikatselu'
          ? { kind: 'esikatselu', data: json.data }
          : { kind: 'tallennettu', data: json.data },
      );
    } catch (e) {
      setTila({
        kind: 'virhe',
        viesti: e instanceof Error ? e.message : 'Verkkovirhe',
      });
    }
  }

  const lataa = tila.kind === 'lataa';
  const lataaMita = tila.kind === 'lataa' ? tila.mita : null;

  return (
    <div className="px-6 py-10 md:py-14 max-w-3xl mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-light">Kausituonti</h1>
        <p className="text-sm text-white/50">
          Veikkausliigan pelaajavienti (.xlsx). Kausi ja vaiheet luetaan
          tiedostosta. Esikatselu ei kirjoita mitään — tallennus vaatii
          erillisen vahvistuksen.
        </p>
      </header>

      <section className="bg-navy-700/40 border border-navy-600 rounded-lg p-5 space-y-4">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-white/40">
            Admin-avain
          </span>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            className="mt-1 w-full bg-navy-800 border border-navy-600 rounded-md px-3 py-2 text-sm focus:border-ice focus:outline-none"
            autoComplete="off"
          />
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-wider text-white/40">
            Pelaajatiedosto (.xlsx)
          </span>
          <input
            type="file"
            accept=".xlsx"
            onChange={handleFile}
            className="mt-1 block w-full text-sm text-white/70 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-navy-600 file:bg-navy-800 file:text-white/80"
          />
          {file && (
            <span className="text-xs text-white/40 mt-1 block">
              {file.name} · {luku(Math.round(file.size / 1024))} kt
            </span>
          )}
        </label>

        <button
          type="button"
          onClick={() => laheta('esikatselu', 'esikatselu')}
          disabled={lataa || !file}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-ice/15 text-ice border border-ice/40 hover:bg-ice/25 disabled:opacity-40 transition-colors text-sm"
        >
          <Upload className="w-4 h-4" />
          {lataaMita === 'esikatselu' ? 'Luetaan…' : 'Esikatsele'}
        </button>
      </section>

      {tila.kind === 'virhe' && (
        <div className="bg-red-500/10 border border-red-400/40 rounded-lg p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <div className="text-sm text-red-200">{tila.viesti}</div>
        </div>
      )}

      {tila.kind === 'esikatselu' && (
        <section className="space-y-5">
          <div className="bg-navy-700/40 border border-navy-600 rounded-lg p-5 text-sm">
            <h2 className="font-medium mb-3">Rivit</h2>
            <Rivi label="Luettu" arvo={luku(tila.data.rivit.luettu)} />
            <Rivi
              label="Käyttökelpoisia"
              arvo={luku(tila.data.rivit.kayttokelpoiset)}
            />
            <Rivi label="Ohitettu" arvo={luku(tila.data.rivit.ohitetut.length)} />
            {tila.data.rivit.ohitetut.map((o) => (
              <div key={o.rivi} className="text-xs text-white/40 pl-4">
                rivi {o.rivi}: {o.syy}
              </div>
            ))}
          </div>

          {tila.data.kaudet.map((k) => (
            <div
              key={k.kausi}
              className="bg-navy-700/40 border border-navy-600 rounded-lg p-5 text-sm"
            >
              <h2 className="font-medium mb-3">Kausi {k.kausi}</h2>
              <Rivi label="Pelaajia" arvo={luku(k.pelaajat)} />
              <Rivi label="Rivejä" arvo={luku(k.rivit)} />
              <Rivi
                label="Nuorten osuus (17–21 v), koko kausi"
                arvo={pros(k.osuusKokoKausi * 100)}
              />
              <Rivi
                label="Nuorten osuus (17–21 v), runkosarja"
                arvo={pros(k.osuusRunkosarja * 100)}
              />
              <Rivi
                label="Alle 21-vuotiaat"
                arvo={pros(k.osuusAlle21 * 100)}
              />
              <Rivi label="Vaiheet" arvo={k.vaiheet.join(', ')} />
              <div className="mt-2 text-xs text-white/50">
                Ottelut seuroittain:{' '}
                {k.seurat.map((s) => `${s.joukkue} ${s.ottelut}`).join(' · ')}
              </div>
            </div>
          ))}

          <div className="bg-navy-700/40 border border-navy-600 rounded-lg p-5 text-sm">
            <h2 className="font-medium mb-3">Muutokset nykyiseen dataan</h2>
            <Rivi label="Luodaan" arvo={luku(tila.data.muutokset.luodaan)} />
            <Rivi
              label="Päivitetään"
              arvo={luku(tila.data.muutokset.paivitetaan)}
            />
            <Rivi label="Vanhenee" arvo={luku(tila.data.muutokset.vanhentuu)} />
            <Rivi
              label="Pelaajia joiden minuutit muuttuivat"
              arvo={luku(tila.data.muuttuneet.length)}
            />
            <Rivi
              label="Uusia pelaajia ilman kansalaisuustietoa"
              arvo={luku(tila.data.uusiaIlmanKansalaisuutta)}
            />
            {tila.data.muuttuneet.slice(0, 10).map((m) => (
              <div key={m.slug} className="text-xs text-white/40 pl-4">
                {m.slug}: {luku(m.ennen)} → {luku(m.jalkeen)} min
              </div>
            ))}
            {tila.data.muuttuneet.length > 10 && (
              <div className="text-xs text-white/40 pl-4">
                … ja {luku(tila.data.muuttuneet.length - 10)} muuta
              </div>
            )}
          </div>

          {(tila.data.pienentyneet.length > 0 ||
            tila.data.kadonneet.length > 0) && (
            <div className="bg-amber-500/10 border border-amber-400/50 rounded-lg p-5 text-sm">
              <h2 className="font-medium mb-3 flex items-center gap-2 text-amber-300">
                <AlertTriangle className="w-4 h-4" />
                Tarkista nämä ennen tallennusta
              </h2>
              {tila.data.pienentyneet.map((p) => (
                <div key={p.slug} className="text-amber-200">
                  {p.slug}: minuutit pienenivät {luku(p.ennen)} →{' '}
                  {luku(p.jalkeen)}
                </div>
              ))}
              {tila.data.kadonneet.map((p) => (
                <div key={p.slug} className="text-amber-200">
                  {p.slug}: katosi lähteestä ({luku(p.minuutit)} min)
                </div>
              ))}
            </div>
          )}

          <div className="bg-navy-700/40 border border-navy-600 rounded-lg p-5 text-sm">
            <h2 className="font-medium mb-3">Tilannekuva</h2>
            {tila.data.tilannekuvat.map((t) => (
              <Rivi
                key={t.kausi}
                label={`${t.kausi} · ${t.pvm}`}
                arvo={t.muuttuu ? 'uusi tilannekuva' : 'ei muutosta edelliseen'}
              />
            ))}
          </div>

          {tila.data.varoitukset.length > 0 && (
            <div className="bg-navy-700/40 border border-navy-600 rounded-lg p-5 text-sm">
              <h2 className="font-medium mb-3">Varoitukset</h2>
              {tila.data.varoitukset.map((v, i) => (
                <div key={i} className="text-white/60 text-xs">
                  {v}
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => laheta('vahvista', 'tallennus')}
            disabled={lataa}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-aurora/15 text-aurora border border-aurora/50 hover:bg-aurora/25 disabled:opacity-40 transition-colors text-sm font-medium"
          >
            <CheckCircle2 className="w-4 h-4" />
            {lataaMita === 'tallennus'
              ? 'Tallennetaan…'
              : 'Vahvista ja tallenna'}
          </button>
        </section>
      )}

      {tila.kind === 'tallennettu' && (
        <section className="bg-aurora/10 border border-aurora/40 rounded-lg p-5 text-sm space-y-1">
          <h2 className="font-medium mb-3 flex items-center gap-2 text-aurora">
            <CheckCircle2 className="w-4 h-4" />
            Tallennettu
          </h2>
          <Rivi
            label="Suoritukset"
            arvo={luku(tila.data.kirjoitettu.suoritukset)}
          />
          <Rivi label="Nimittäjät" arvo={luku(tila.data.kirjoitettu.nimittajat)} />
          <Rivi label="Kaudet" arvo={luku(tila.data.kirjoitettu.kaudet)} />
          <Rivi label="Projektiot" arvo={luku(tila.data.kirjoitettu.projektiot)} />
          <Rivi
            label="Vanhentuneiksi merkitty"
            arvo={luku(tila.data.vanhentuneet)}
          />
          {tila.data.tilannekuvat.map((t) => (
            <Rivi key={t} label="Tilannekuva" arvo={t} />
          ))}
          {tila.data.tilannekuvatOhitettu.map((t) => (
            <Rivi key={t} label="Tilannekuva" arvo={`${t} — ei muutosta`} />
          ))}
          <div className="pt-3 mt-3 border-t border-aurora/20">
            <Rivi
              label="Kansalaisuus haettu"
              arvo={`${luku(tila.data.kansalaisuus.haettu)} (onnistui ${luku(
                tila.data.kansalaisuus.onnistui,
              )}, ei tietoa ${luku(tila.data.kansalaisuus.eiTietoa)})`}
            />
            {tila.data.kansalaisuus.ohitettuNollaMinuuttia > 0 && (
              <div className="text-xs text-white/50 flex items-start gap-2 mt-1">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {luku(tila.data.kansalaisuus.ohitettuNollaMinuuttia)} pelaajaa
                ohitettiin: 0 minuuttia, joten he eivät ole Veikkausliigan
                tilastolistalla. He tulevat mukaan kun saavat peliaikaa.
              </div>
            )}
            {tila.data.kansalaisuus.jaljella > 0 && (
              <div className="text-xs text-white/50 flex items-start gap-2 mt-1">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {luku(tila.data.kansalaisuus.jaljella)} pelaajaa jäi hakematta
                tämän ajon budjetista. Seuraava tuonti jatkaa heistä
                automaattisesti — haku kohdistuu aina vain pelaajiin, joilla
                ei vielä ole kansalaisuustietoa.
              </div>
            )}
            {tila.data.kansalaisuus.jaljella === -1 && (
              <div className="text-xs text-amber-300 mt-1">
                Kansalaisuushaku ohitettiin kokonaan (yhteysvirhe). Tuonti
                tallentui silti.
              </div>
            )}
          </div>
          <Rivi
            label="Välimuisti tyhjennetty"
            arvo={tila.data.valimuistiTyhjennetty.join(', ') || 'ei mitään'}
          />
        </section>
      )}
    </div>
  );
}
