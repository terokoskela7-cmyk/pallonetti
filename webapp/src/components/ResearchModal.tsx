import { useEffect } from 'react';
import { X, BookOpen, Target, TrendingUp, Euro, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ResearchModalProps {
  open: boolean;
  onClose: () => void;
}

const RESEARCH_POINTS = [
  {
    icon: Target,
    stat: '3×',
    title: 'Todennäköisemmin huippuliigaan',
    body: 'CIES / Antwerpenin yliopiston tutkimus: U21-pelaajat jotka saavat ≥1 500 minuuttia yhden kauden aikana siirtyvät 3 kertaa todennäköisemmin huippuliigoihin (Big-5) kuin alle 1 500 minuuttia saavat.',
    source: 'CIES Football Observatory, University of Antwerp',
  },
  {
    icon: Euro,
    stat: '€3,41M',
    title: 'vs €2,02M — ikä ratkaisee siirtosumman',
    body: 'Puolalaistutkimus: 21-vuotiaana tai nuorempana myydyt pelaajat tuottavat keskimäärin €3,41M, kun yli 22-vuotiaiden keskiarvo jää €2,02M:iin. Ero on 69 %. Myyntihetki on yhtä tärkeä kuin pelaajan laatu.',
    source: 'Polish sports economics research',
  },
  {
    icon: TrendingUp,
    stat: '1 500',
    title: 'minuuttia = kriittinen kynnys',
    body: '1 500 minuuttia tarkoittaa noin 16,7 täyttä 90 minuutin ottelua. Tämä on se raja jossa pelaaja on todistetusti valmentajan luottopelaaja — ei vain lupaus vaan tuottava pelaaja.',
    source: 'CIES / Antwerp methodology',
  },
  {
    icon: Users,
    stat: '19,2 %',
    title: 'Suomen U21-peliaika yli pohjoismaisen keskiarvon',
    body: 'Veikkausliigan U21-peliaika-% on 19,2 %, kun pohjoismainen keskiarvo (Tanska 11,7 %, Norja 20,2 %, Ruotsi 22,4 %) on 18,1 %. Kilpailemme samoista pelaajista ja scout-huomiosta.',
    source: 'CIES 2026 / Pallonetti.fi',
  },
];

export function ResearchModal({ open, onClose }: ResearchModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-navy-800 border border-navy-500 rounded-xl shadow-2xl"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-navy-800/95 border-b border-navy-600 backdrop-blur">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-ice" />
                <h2 className="text-lg font-medium text-white">
                  Miksi peliaika ratkaisee — tutkimusperusteet
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-white/50 hover:text-white hover:bg-navy-700 transition-colors"
                aria-label="Sulje"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5">
              <p className="text-sm text-white/70 leading-relaxed">
                Tämä kaavio näyttää kuinka paljon keskimääräistä peliaikaa kunkin joukkueen
                U21-pelaajat saavat. Alla olevat tutkimukset osoittavat, miksi tämä mittari
                on tärkeämpi kuin pelkkä U21-pelaajien määrä tai U21-peliaika-%.
              </p>

              <div className="space-y-4">
                {RESEARCH_POINTS.map((point, i) => (
                  <motion.div
                    key={point.title}
                    className="bg-navy-700/50 border border-navy-600 rounded-lg p-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.08 }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">
                        <point.icon className="w-5 h-5 text-ice" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-2xl font-bold font-mono tabular text-aurora">
                            {point.stat}
                          </span>
                          <span className="text-sm font-medium text-white/90">
                            {point.title}
                          </span>
                        </div>
                        <p className="text-sm text-white/65 leading-relaxed mb-2">
                          {point.body}
                        </p>
                        <span className="text-[11px] text-white/40">{point.source}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="bg-ice/5 border border-ice/20 rounded-lg p-4">
                <p className="text-sm text-white/80 leading-relaxed">
                  <strong className="text-ice">Miksi tämä kaavio on tärkeä?</strong>{' '}
                  U21-% kertoo vain kuinka suuren osan peliajasta nuoret pelaajat saavat.
                  Se ei kerro,{' '}
                  <em>saavatko he riittävästi minuutteja kehittyäkseen</em>. Yksi joukkue
                  voi saavuttaa korkean U21-%:n jakamalla minuutit monen pelaajan kesken
                  niin, ettei kukaan ylitä 1 500 minuutin kynnystä. Tämä kaavio paljastaa
                  sen, mitä pelkkä prosentti peittää.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 px-6 py-3 bg-navy-800/95 border-t border-navy-600 backdrop-blur flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-navy-700 hover:bg-navy-600 border border-navy-500 rounded-md text-sm text-white/90 transition-colors"
              >
                Sulje
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
