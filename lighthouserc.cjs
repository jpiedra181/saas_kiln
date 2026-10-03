/**
 * Lighthouse CI (móvil, la configuración por defecto de Lighthouse).
 * Lo lanza scripts/lighthouse.ts, que compila con SITE_URL local para que el canonical coincida.
 */
const PORT = 4322;

module.exports = {
  ci: {
    collect: {
      startServerCommand: `npx astro preview --force --host 127.0.0.1 --port ${PORT}`,
      startServerReadyPattern: 'Local',
      startServerReadyTimeout: 60000,
      url: [`http://127.0.0.1:${PORT}/`, `http://127.0.0.1:${PORT}/en/`],
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--headless=new --no-sandbox',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.95 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci',
    },
  },
};
