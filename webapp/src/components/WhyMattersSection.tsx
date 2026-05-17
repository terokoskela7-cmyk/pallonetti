import { TrendingUp, Calendar, Globe, type LucideIcon } from 'lucide-react';

interface InsightCard {
  icon: LucideIcon;
  title: string;
  body: string;
  source: string;
}

const cards: InsightCard[] = [
  {
    icon: TrendingUp,
    title: 'Akatemiakasvatus = korkeampi arvo',
    body: 'Tutkimus 13 akatemiasta osoittaa: laadukas nuorisokasvatus kasvattaa pelaajan markkina-arvoa tilastollisesti merkitsevästi. Seura, joka antaa peliaikaa nuorille, kasvattaa omaisuuttaan.',
    source: 'Balliauw et al., 2022 — Sport, Business & Management',
  },
  {
    icon: Calendar,
    title: '22–27v on markkina-arvon huippu',
    body: 'Pelaajan arvo huipentuu 22–27 vuoden iässä. Tähän huippuun pääseminen vaatii varhaiset peliminuutit — polku alkaa jo 18–20-vuotiaana Veikkausliigassa.',
    source: 'Transfermarkt-data, 2024',
  },
  {
    icon: Globe,
    title: 'Suomi voi kasvaa pelaajatehtaaksi',
    body: 'Portugal, Hollanti ja Tanska ovat rakentaneet kansainvälisen maineen kasvattamalla ja myymällä nuoria pelaajia. Veikkausliigan seurat, jotka antavat nuorille peliaikaa nyt, voivat olla huomisen siirtotoimiston arvokkaimpia kohteita.',
    source: 'Pallonetti.fi-analyysi, 2026',
  },
];

export function WhyMattersSection() {
  return (
    <section>
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-medium">
          Miksi tämä on tärkeää?
        </h2>
        <p className="text-sm text-white/50 mt-1">
          Tiede ja data puhuvat selvästi
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.title}
              className="bg-navy-700 border border-white/10 border-l-2 border-l-ice rounded-r-md p-5 flex flex-col"
            >
              <div className="w-9 h-9 rounded-md bg-ice/10 flex items-center justify-center mb-4">
                <Icon className="w-4 h-4 text-ice" />
              </div>
              <h3 className="font-medium text-white/95 mb-2 leading-tight">
                {card.title}
              </h3>
              <p className="text-sm text-white/60 leading-relaxed mb-5">
                {card.body}
              </p>
              <div className="mt-auto pt-3 border-t border-white/5 text-xs text-white/30">
                {card.source}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
