import type { ReactNode } from 'react';

interface HeroProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  /**
   * Optional background image URL. Jos annettu, näytetään tausta-kuva
   * gradient-overlay:n alla. Jos ei, käytetään pelkkä gradient.
   */
  backgroundImage?: string;
  /** ALT-teksti tausta-kuvalle (saavutettavuus) */
  imageAlt?: string;
  /** Min-korkeus mobiili/desktop */
  height?: 'sm' | 'md' | 'lg';
}

const heightClass: Record<NonNullable<HeroProps['height']>, string> = {
  sm: 'min-h-[200px] md:min-h-[260px]',
  md: 'min-h-[280px] md:min-h-[360px]',
  lg: 'min-h-[360px] md:min-h-[460px]',
};

export function Hero({
  eyebrow,
  title,
  subtitle,
  backgroundImage,
  imageAlt = '',
  height = 'md',
}: HeroProps) {
  return (
    <header
      className={`relative overflow-hidden rounded-xl border border-navy-600 ${heightClass[height]} flex items-end`}
    >
      {/* Tausta-kuva tai gradient */}
      {backgroundImage ? (
        <>
          <img
            src={backgroundImage}
            alt={imageAlt}
            loading="eager"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Tumma overlay luettavuuden takaamiseksi */}
          <div className="absolute inset-0 bg-gradient-to-t from-navy-900/95 via-navy-800/75 to-navy-700/40" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-navy-600 via-navy-700 to-navy-800" />
      )}

      {/* Dekoratiiviset accent-pisteet */}
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-aurora/10 blur-3xl" />
      <div className="absolute -bottom-16 -left-12 w-56 h-56 rounded-full bg-ice/10 blur-3xl" />

      {/* Sisältö */}
      <div className="relative px-6 md:px-10 py-8 md:py-12">
        {eyebrow && (
          <div className="text-xs uppercase tracking-[0.2em] text-ice mb-3 font-medium">
            {eyebrow}
          </div>
        )}
        <h1 className="text-3xl md:text-5xl font-light tracking-tight leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 text-base md:text-lg text-white/70 max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>
    </header>
  );
}
