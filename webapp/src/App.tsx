import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import HomePage from '@/pages/HomePage';

function Placeholder({ title }: { title: string }) {
  return (
    <section className="px-6 py-20">
      <h1 className="text-3xl font-medium tracking-tight mb-3">{title}</h1>
      <p className="text-white/60 text-lg">Tulossa pian.</p>
    </section>
  );
}

function PelaikaPage() {
  return <Placeholder title="Peliaika" />;
}

function JoukkueetPage() {
  return <Placeholder title="Joukkueet" />;
}

function PelaajatPage() {
  return <Placeholder title="Pelaajat" />;
}

function PelaajaPage() {
  return <Placeholder title="Pelaaja" />;
}

function AboutPage() {
  return <Placeholder title="About" />;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/peliaika" element={<PelaikaPage />} />
        <Route path="/joukkueet" element={<JoukkueetPage />} />
        <Route path="/pelaajat" element={<PelaajatPage />} />
        <Route path="/pelaaja/:id" element={<PelaajaPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </Layout>
  );
}
