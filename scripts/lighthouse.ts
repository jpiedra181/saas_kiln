/**
 * Lighthouse móvil sobre el build: compila con SITE_URL local (para que canonical y hreflang apunten al mismo
 * origen que se audita), usa el Chromium de Playwright y ejecuta Lighthouse CI con las aserciones de lighthouserc.cjs:
 * ≥ 95 en las cuatro categorías y CLS = 0. Informes en .lighthouseci/.
 *
 *   npm run lighthouse
 *
 * Después vuelve a ejecutar `npm run build` si vas a revisar dist/ (Netlify compila por su cuenta).
 */
import { execSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const env = { ...process.env, SITE_URL: 'http://127.0.0.1:4322', CHROME_PATH: chromium.executablePath() };
execSync('npx astro build', { stdio: 'inherit', env });
// Un preview anterior podría seguir vivo y responder antes que el nuevo.
execSync('npx astro preview stop', { stdio: 'ignore', env });
execSync('npx lhci autorun --config=./lighthouserc.cjs', { stdio: 'inherit', env });
