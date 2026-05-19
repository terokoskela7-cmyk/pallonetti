import { TrendingUp, ArrowUpRight, Globe, type LucideIcon } from 'lucide-react';

interface InsightCard {
  icon: LucideIcon;
  stat: string;
  title: string;
  body: string;
  source: string;
}

const cards: InsightCard[] = [
  {
    icon: TrendingUp,
    stat: '14 % → 23 %',
    title: 'Suomi jää pohjoismaisesta kärjestä',
    body: 'Veikkausliigan pelaajalla on vain 14 % todennäköisyys siirtyä ulkomaille — Tanskassa luku on 23 %. Peliaika kotiliigassa on suurin yksittäinen selittäjä.',
    source: 'Wirén, 2026 — Aalto-yliopisto / Suomen Palloliitto',
  },
  {
    icon: ArrowUpRight,
    stat: '+4,3 pp / 10 pp',
    title: 'Jokainen peliminuutti kasvattaa siirtotodennäköisyyttä',
    body: '10 prosenttiyksikön nousu käyttöasteessa kasvattaa siirtotodennäköisyyttä jopa 4,3 prosenttiyksikköä. Valmentajan päätös pelata nuori mies on konkreettisesti mitattava investointi.',
    source: 'Wirén, 2026 — 58 886 pelaaja-kausi-havaintoa 2010–2024',
  },
  {
    icon: Globe,
    stat: '13,7 % arvokkaampi seura',
    title: 'Peliaika ohjaa parempiin seuroihin',
    body: 'Kun käyttöaste nousee 10 pp, pelaaja päätyy siirron jälkeen seuraan jonka arvo on 13,7 % korkeampi. Vaikutus kasvaa ajan myötä — Y4–5:ssä jo 15,5 %.',
    source: 'Wirén, 2026 — Transfermarkt + UEFA data',
  },
];

export function WhyMattersSection() {
  return (
    <section>
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-medium">
          Miksi peliaika ratkaisee?
        </h2>
        <p className="text-sm text-white/50 mt-1">
          Wirén (2026) — tutkimus pohjoismaisista siirtokaupoista 2010–2024
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
              <div className="text-2xl font-bold text-ice mb-1 font-mono tracking-tight">
                {card.stat}
              </div>
              <h3 className="font-medium text-white/95 mb-2 leading-tight">
                {card.title}
              </h3>
              <p className="text-sm text-white/60 leading-relaxed mb-5">
                {card.body}
              </p>
              <div className="mt-auto pt-3 border-t border-white/5 text-xs text-white/30 flex items-center gap-1">
                <Icon className="w-3 h-3 text-ice/50 shrink-0" />
                {card.source}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
