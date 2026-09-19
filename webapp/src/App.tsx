import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Layout } from '@/components/Layout';
import { PageTransition } from '@/components/animations';
import { analytics, logEvent } from '@/firebase';
import HomePage from '@/pages/HomePage';
import PelaikaPage from '@/pages/PelaikaPage';
import NuoretPage from '@/pages/NuoretPage';
import PelaajatPage from '@/pages/PelaajatPage';
import PelaajaPage from '@/pages/PelaajaPage';
import AboutPage from '@/pages/AboutPage';

export default function App() {
  const location = useLocation();

  useEffect(() => {
    if (analytics) {
      logEvent(analytics, 'page_view', {
        page_path: location.pathname + location.search,
        page_location: window.location.href,
      });
    }
  }, [location]);

  return (
    <Layout>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route
            path="/"
            element={
              <PageTransition>
                <HomePage />
              </PageTransition>
            }
          />
          <Route
            path="/nuoret"
            element={
              <PageTransition>
                <NuoretPage />
              </PageTransition>
            }
          />
          <Route
            path="/pelaajat"
            element={
              <PageTransition>
                <PelaajatPage />
              </PageTransition>
            }
          />
          <Route
            path="/peliaika"
            element={
              <PageTransition>
                <PelaikaPage />
              </PageTransition>
            }
          />
          <Route
            path="/pelaaja/:slug"
            element={
              <PageTransition>
                <PelaajaPage />
              </PageTransition>
            }
          />
          <Route
            path="/about"
            element={
              <PageTransition>
                <AboutPage />
              </PageTransition>
            }
          />
        </Routes>
      </AnimatePresence>
    </Layout>
  );
}
