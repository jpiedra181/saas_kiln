// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// URL pública: SITE_URL (manual) → URL (la que da Netlify en cada build) → dominio de la marca en Figma.
const site = process.env.SITE_URL || process.env.URL || 'https://kiln.app';

export default defineConfig({
  site,
  trailingSlash: 'always',
  compressHTML: false,
  build: {
    format: 'directory',
    // Una landing de una sola página: el CSS va en línea y no bloquea el render con otra petición.
    inlineStylesheets: 'always',
  },
  i18n: {
    locales: ['es', 'en'],
    defaultLocale: 'es',
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    sitemap({
      i18n: { defaultLocale: 'es', locales: { es: 'es-ES', en: 'en' } },
      filter: (page) => !page.includes('/404'),
    }),
  ],
  // Fuentes del diseño (scripts/build-fonts.ts): se sirven desde el propio sitio con métricas de respaldo ajustadas.
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Fraunces',
      cssVariable: '--font-fraunces',
      fallbacks: ['Georgia', 'serif'],
      options: {
        variants: [
          { src: ['./src/assets/fonts/fraunces-roman.woff2'], weight: '400 600', style: 'normal' },
          { src: ['./src/assets/fonts/fraunces-italic.woff2'], weight: '400', style: 'italic' },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Instrument Sans',
      cssVariable: '--font-instrument-sans',
      fallbacks: ['system-ui', 'sans-serif'],
      options: {
        variants: [{ src: ['./src/assets/fonts/instrument-sans.woff2'], weight: '400 700', style: 'normal' }],
      },
    },
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
