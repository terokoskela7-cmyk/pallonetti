// ============================================
// SISÄISEN LINKIN KOMPONENTIT
//
// Koko sivusto käyttää näitä react-router-domin Linkin ja NavLinkin
// sijaan, jotta valittu sarja ja kausi kulkevat jokaisesta linkistä
// eteenpäin. Sääntö on utils/linkit.ts:ssä ja testattu; nämä ovat vain
// kääreet, joissa ei ole omaa logiikkaa.
//
// Testi webapp/testit/linkit.testi.ts kaatuu, jos jokin komponentti
// tuo Linkin tai NavLinkin suoraan react-router-domista.
// ============================================
import { forwardRef } from 'react';
import {
  Link,
  NavLink,
  useSearchParams,
  type LinkProps,
  type NavLinkProps,
} from 'react-router-dom';
import { sailytaValinta } from '@/utils/linkit';

export const SisainenLinkki = forwardRef<HTMLAnchorElement, LinkProps>(
  function SisainenLinkki({ to, ...rest }, ref) {
    const [params] = useSearchParams();
    const kohde = typeof to === 'string' ? sailytaValinta(to, params) : to;
    return <Link ref={ref} to={kohde} {...rest} />;
  },
);

export const SisainenNavLinkki = forwardRef<HTMLAnchorElement, NavLinkProps>(
  function SisainenNavLinkki({ to, ...rest }, ref) {
    const [params] = useSearchParams();
    const kohde = typeof to === 'string' ? sailytaValinta(to, params) : to;
    return <NavLink ref={ref} to={kohde} {...rest} />;
  },
);
