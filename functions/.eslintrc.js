// ============================================
// ESLINT — functions/
//
// Konfiguraatio puuttui kokonaan, vaikka eslint ja typescript-eslint
// olivat riippuvuuksissa: `npm run lint` kaatui virheeseen "No files
// matching the pattern". Lint ei siis ollut ajossa kertaakaan.
//
// Saannot on pidetty suppeina tarkoituksella. Tarkoitus on napata
// virheet, jotka tuotanto nayttaa vasta ajossa (kayttamaton muuttuja
// kertoo yleensa keskenjaaneesta muutoksesta, ja odottamaton await
// silmukassa on tahallinen valinta), ei muotoilla koodia uusiksi.
// ============================================
module.exports = {
  root: true,
  env: { es2020: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2020, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  ignorePatterns: ['lib/**', 'node_modules/**'],
  rules: {
    // Kaannos kaataa jo tyyppivirheet; lint keskittyy muuhun.
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'no-console': 'off',
  },
};
