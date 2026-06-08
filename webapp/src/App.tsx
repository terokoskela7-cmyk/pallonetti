import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import HomePage from '@/pages/HomePage';
import PelaikaPage from '@/pages/PelaikaPage';
import NuoretPage from '@/pages/NuoretPage';
import PelaajatPage from '@/pages/PelaajatPage';
import PelaajaPage from '@/pages/PelaajaPage';
import AboutPage from '@/pages/AboutPage';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/nuoret" element={<NuoretPage />} />
        <Route path="/pelaajat" element={<PelaajatPage />} />
        <Route path="/peliaika" element={<PelaikaPage />} />
        <Route path="/pelaaja/:slug" element={<PelaajaPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </Layout>
  );
}
