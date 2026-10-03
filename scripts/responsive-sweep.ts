/**
 * Barrido responsive: carga la landing en muchos anchos (no solo los de Figma) y comprueba
 * que no hay scroll horizontal ni elementos que se salgan de la pantalla. Guarda capturas en tests/visual/output/sweep/.
 *   npm run build && npx tsx scripts/responsive-sweep.ts
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const widths = [320, 360, 390, 430, 600, 768, 834, 1024, 1180, 1200, 1280, 1366, 1440, 1680, 1920, 2560];
const PORT = 4331;
const out = resolve('tests/visual/output/sweep');
mkdirSync(out, { recursive: true });

const server = spawn('npx', ['astro', 'preview', '--force', '--host', '127.0.0.1', '--port', String(PORT)], {
  shell: true,
  stdio: 'ignore',
});
let failures = 0;
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  const browser = await chromium.launch();
  for (const path of ['/', '/en/']) {
    for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await page.goto(`http://127.0.0.1:${PORT}${path}`);
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      const result = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const offenders = Array.from(document.querySelectorAll<HTMLElement>('body *'))
          .filter((el) => {
            if (el.closest('dialog:not([open])') || el.closest('[hidden]')) return false;
            const r = el.getBoundingClientRect();
            if (!r.width || getComputedStyle(el).visibility === 'hidden') return false;
            // Elementos decorativos recortados a propósito por un contenedor con overflow.
            let p = el.parentElement;
            while (p) {
              const o = getComputedStyle(p).overflowX;
              if (o === 'hidden' || o === 'clip') {
                const pr = p.getBoundingClientRect();
                if (pr.left >= -1 && pr.right <= vw + 1) return false;
              }
              p = p.parentElement;
            }
            return r.right > vw + 1 || r.left < -1;
          })
          .slice(0, 5)
          .map(
            (el) =>
              `${el.tagName.toLowerCase()}.${(el.className && typeof el.className === 'string' ? el.className : '').split(' ').slice(0, 4).join('.')}`,
          );
        return { scrollWidth: document.documentElement.scrollWidth, vw, offenders };
      });
      const ok = result.scrollWidth <= result.vw && result.offenders.length === 0;
      if (!ok) failures++;
      console.log(
        `${ok ? '✓' : '✗'} ${path.padEnd(4)} ${String(width).padStart(4)} px  scrollWidth=${result.scrollWidth}${ok ? '' : '  ' + result.offenders.join(' | ')}`,
      );
      if (path === '/') await page.screenshot({ path: resolve(out, `${width}.png`), fullPage: true });
      await page.close();
    }
  }
  await browser.close();
} finally {
  if (process.platform === 'win32' && server.pid)
    spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  else server.kill();
}
process.exit(failures ? 1 : 0);
