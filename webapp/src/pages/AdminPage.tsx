import { useState, useEffect } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { Upload } from 'lucide-react';

// Sama base kuin services/api.ts — relatiivinen '/api' reititetään Hosting-rewriten
// kautta Cloud Function 'api':lle.
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// Admin-avain säilytetään localStoragessa jotta sitä ei tarvitse joka kerta
// syöttää uudelleen. Ei arkaluontoista dataa muille kuin admin-koneelle.
const ADMIN_KEY_STORAGE = 'pn_admin_key';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

export default function AdminPage() {
  const [round, setRound] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    const saved = localStorage.getItem(ADMIN_KEY_STORAGE);
    if (saved) setAdminKey(saved);
  }, []);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const roundNum = parseInt(round, 10);
    if (isNaN(roundNum) || roundNum < 1 || roundNum > 27) {
      setStatus({ kind: 'error', message: '❌ Anna kelvollinen kierrosnumero (1–27)' });
      return;
    }
    if (!file) {
      setStatus({ kind: 'error', message: '❌ Valitse .xlsx-tiedosto' });
      return;
    }
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setStatus({ kind: 'error', message: '❌ Tiedoston tulee olla .xlsx' });
      return;
    }
    if (!adminKey.trim()) {
      setStatus({ kind: 'error', message: '❌ Anna admin-avain' });
      return;
    }

    localStorage.setItem(ADMIN_KEY_STORAGE, adminKey.trim());
    setStatus({ kind: 'loading' });

    try {
      const fd = new FormData();
      fd.append('round', String(roundNum));
      fd.append('file', file);

      const res = await fetch(`${API_BASE}/admin/import-excel`, {
        method: 'POST',
        // Content-Typea EI aseteta — selain lisää multipart-boundaryn itse.
        headers: { 'x-admin-key': adminKey.trim() },
        body: fd,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Virhe ${res.status}`);
      }

      setStatus({
        kind: 'success',
        message: `✅ Tuotu ${json.imported} pelaajaa, kierros ${json.round}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'tuntematon virhe';
      setStatus({ kind: 'error', message: `❌ Virhe: ${message}` });
    }
  };

  const loading = status.kind === 'loading';
  const inputClass =
    'w-full bg-navy-900 border border-navy-700 rounded-md px-3 py-2 text-white ' +
    'placeholder-white/30 focus:outline-none focus:border-ice/60 transition-colors';

  return (
    <div className="px-6 py-10 max-w-lg mx-auto">
      <h1 className="text-2xl font-medium tracking-tight mb-1">
        Admin <span className="text-aurora">—</span> Datanhallinta
      </h1>
      <p className="text-sm text-white/40 mb-8">
        Tuo Veikkausliigan kumulatiivinen pelaaja-Excel (.xlsx) yhdelle kierrokselle.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-white/70">Kierrosnumero (1–27)</span>
          <input
            type="number"
            min={1}
            max={27}
            value={round}
            onChange={(e) => setRound(e.target.value)}
            placeholder="esim. 22"
            className={inputClass}
            disabled={loading}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-white/70">Admin-avain</span>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="x-admin-key"
            autoComplete="off"
            className={inputClass}
            disabled={loading}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-white/70">Excel-tiedosto (.xlsx)</span>
          <input
            type="file"
            accept=".xlsx"
            onChange={handleFile}
            disabled={loading}
            className="w-full text-sm text-white/70 file:mr-3 file:rounded-md file:border-0
              file:bg-ice/10 file:text-ice file:px-3 file:py-2 file:cursor-pointer
              hover:file:bg-ice/20 transition-colors"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 bg-ice text-navy-900
            font-medium rounded-md px-4 py-2.5 hover:bg-ice/90 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload className="w-4 h-4" />
          {loading ? 'Tuodaan dataa…' : 'Tuo data'}
        </button>
      </form>

      {status.kind !== 'idle' && (
        <div
          className={`mt-6 rounded-md px-4 py-3 text-sm border ${
            status.kind === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-300'
              : status.kind === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-300'
              : 'bg-navy-800 border-navy-700 text-white/70'
          }`}
        >
          {status.kind === 'loading' ? 'Tuodaan dataa…' : status.message}
        </div>
      )}
    </div>
  );
}
