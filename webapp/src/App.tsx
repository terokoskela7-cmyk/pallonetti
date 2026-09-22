import { Routes, Route } from 'react-router-dom';
import { KausiProvider, KausiPortti } from '@/hooks/useKausi';
import { Layout } from '@/components/Layout';
import HomePage from '@/pages/HomePage';
import PelaikaPage from '@/pages/PelaikaPage';
import NuoretPage from '@/pages/NuoretPage';
import SeuratPage from '@/pages/SeuratPage';
import PelaajatPage from '@/pages/PelaajatPage';
import PelaajaPage from '@/pages/PelaajaPage';
import AboutPage from '@/pages/AboutPage';
import AdminPage from '@/pages/AdminPage';

export default function App() {
  return (
    <KausiProvider>
      <Layout>
        <KausiPortti>
          <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/nuoret" element={<NuoretPage />} />
          <Route path="/seurat" element={<SeuratPage />} />
          <Route path="/pelaajat" element={<PelaajatPage />} />
          <Route path="/peliaika" element={<PelaikaPage />} />
          <Route path="/pelaaja/:slug" element={<PelaajaPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </KausiPortti>
      </Layout>
    </KausiProvider>
  );
}
