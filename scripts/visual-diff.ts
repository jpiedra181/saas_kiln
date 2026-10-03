/**
 * Fidelidad con Figma: renderiza la landing en los tamaños de los frames (1440 / 834 / 390, claro y oscuro)
 * y compara cada sección con su captura de Figma (tests/visual/reference/):
 *   - diferencia de altura de la sección (px),
 *   - porcentaje de píxeles distintos (pixelmatch) en la zona común.
 * Genera tests/visual/output/<variante>/<sección>.png (Figma | código | diferencias) y tests/visual/output/report.md.
 *
 *   npm run build && npm run visual            informe
 *   npm run visual -- --strict                 falla si alguna sección se desvía más de lo tolerado
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(resolve(root, 'tests/visual/figma-sections.json'), 'utf8'));
const outDir = resolve(root, 'tests/visual/output');
const PORT = 4329;
const BASE = `http://127.0.0.1:${PORT}`;
const HEIGHT_TOLERANCE = 4; // px
const PIXEL_TOLERANCE = 6; // % de píxeles distintos (antialiasing, render de fuentes)
const strict = process.argv.includes('--strict');
const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];

type Variant = { name: string; width: number; path: string; theme: 'light' | 'dark'; sections: Record<string, number> };
type Result = { variant: string; section: string; figmaH: number; codeH: number; delta: number; mismatch: number };

function crop(src: PNG, y: number, h: number): PNG {
  const out = new PNG({ width: src.width, height: Math.max(0, h) });
  PNG.bitblt(src, out, 0, Math.max(0, y), src.width, Math.min(h, src.height - y), 0, 0);
  return out;
}

function sideBySide(images: PNG[], gap = 16): PNG {
  const width = images.reduce((w, i) => w + i.width, 0) + gap * (images.length - 1);
  const height = Math.max(...images.map((i) => i.height));
  const out = new PNG({ width, height });
  out.data.fill(0xff);
  for (let p = 0; p < out.data.length; p += 4) {
    out.data[p] = 255;
    out.data[p + 1] = 0;
    out.data[p + 2] = 255;
  }
  let x = 0;
  for (const img of images) {
    PNG.bitblt(img, out, 0, 0, img.width, img.height, x, 0);
    x += img.width + gap;
  }
  return out;
}

async function startServer(): Promise<ChildProcess> {
  const server = spawn('npx', ['astro', 'preview', '--force', '--host', '127.0.0.1', '--port', String(PORT)], {
    cwd: root,
    shell: true,
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return server;
    } catch {
      /* todavía arrancando */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  stopServer(server);
  throw new Error('No se pudo arrancar astro preview (¿has ejecutado npm run build?)');
}

function stopServer(server: ChildProcess) {
  if (process.platform === 'win32' && server.pid)
    spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  else server.kill();
}

async function preparePage(page: Page, theme: 'light' | 'dark') {
  await page.addInitScript((t) => localStorage.setItem('kiln-theme', t), theme);
}

async function render(page: Page, path: string) {
  await page.goto(BASE + path, { waitUntil: 'load', timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(200);
}

async function sectionBoxes(page: Page) {
  return page.evaluate(() =>
    Object.fromEntries(
      Array.from(document.querySelectorAll<HTMLElement>('[data-section]')).map((el) => {
        const r = el.getBoundingClientRect();
        return [el.dataset.section!, { y: Math.round(r.top + window.scrollY), h: Math.round(r.height) }];
      }),
    ),
  );
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch();
  const results: Result[] = [];
  try {
    for (const variant of config.variants as Variant[]) {
      if (only && !variant.name.includes(only)) continue;
      const context = await browser.newContext({
        viewport: { width: variant.width, height: 900 },
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
        colorScheme: variant.theme,
      });
      const page = await context.newPage();
      console.log(`→ ${variant.name}`);
      await preparePage(page, variant.theme);
      await render(page, variant.path);
      const boxes = await sectionBoxes(page);
      const shot = PNG.sync.read(await page.screenshot({ fullPage: true }));
      const ref = PNG.sync.read(readFileSync(resolve(root, `tests/visual/reference/${variant.name}.png`)));
      mkdirSync(resolve(outDir, variant.name), { recursive: true });

      let refY = 0;
      for (const [section, figmaH] of Object.entries(variant.sections)) {
        const box = boxes[section];
        if (!box) {
          console.warn(`  ${variant.name}: falta [data-section="${section}"]`);
          refY += figmaH;
          continue;
        }
        const a = crop(ref, refY, figmaH);
        const b = crop(shot, box.y, box.h);
        const h = Math.min(a.height, b.height);
        const diff = new PNG({ width: variant.width, height: h });
        const changed = pixelmatch(crop(a, 0, h).data, crop(b, 0, h).data, diff.data, variant.width, h, {
          threshold: 0.12,
        });
        const mismatch = (changed / (variant.width * h)) * 100;
        results.push({ variant: variant.name, section, figmaH, codeH: box.h, delta: box.h - figmaH, mismatch });
        writeFileSync(resolve(outDir, variant.name, `${section}.png`), PNG.sync.write(sideBySide([a, b, diff])));
        refY += figmaH;
      }
      await context.close();
    }

    // Menú móvil abierto (comparación del viewport).
    const menu = config.menu;
    if (!only || menu.name.includes(only)) {
      const context = await browser.newContext({
        viewport: { width: menu.width, height: menu.height },
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
        colorScheme: menu.theme,
      });
      const page = await context.newPage();
      await preparePage(page, menu.theme);
      await render(page, menu.path);
      await page.click('[data-menu-open]');
      await page.waitForTimeout(300);
      const shot = PNG.sync.read(await page.screenshot());
      const ref = PNG.sync.read(readFileSync(resolve(root, `tests/visual/reference/${menu.name}.png`)));
      const panelH = await page.evaluate(() =>
        Math.round(document.querySelector('[data-menu-panel]')!.getBoundingClientRect().height),
      );
      // Solo el panel del menú: la página de fondo del frame de Figma está colocada de otra forma.
      const figmaPanelH = menu.panelHeight as number;
      const h = Math.min(panelH, figmaPanelH);
      const diff = new PNG({ width: menu.width, height: h });
      const changed = pixelmatch(crop(ref, 0, h).data, crop(shot, 0, h).data, diff.data, menu.width, h, {
        threshold: 0.12,
      });
      mkdirSync(resolve(outDir, menu.name), { recursive: true });
      writeFileSync(resolve(outDir, menu.name, 'viewport.png'), PNG.sync.write(sideBySide([ref, shot, diff])));
      results.push({
        variant: menu.name,
        section: 'menu',
        figmaH: figmaPanelH,
        codeH: panelH,
        delta: panelH - figmaPanelH,
        mismatch: (changed / (menu.width * h)) * 100,
      });
      await context.close();
    }
  } finally {
    await browser.close();
    stopServer(server);
  }

  const rows = results.map((r) => {
    const ok = Math.abs(r.delta) <= HEIGHT_TOLERANCE && r.mismatch <= PIXEL_TOLERANCE;
    return { ...r, ok };
  });
  const table = [
    '| Variante | Sección | Alto Figma | Alto código | Δ px | Píxeles distintos | |',
    '|---|---|---:|---:|---:|---:|---|',
    ...rows.map(
      (r) =>
        `| ${r.variant} | ${r.section} | ${r.figmaH} | ${r.codeH} | ${r.delta > 0 ? '+' : ''}${r.delta} | ${r.mismatch.toFixed(2)} % | ${r.ok ? '✅' : '⚠️'} |`,
    ),
  ].join('\n');
  writeFileSync(
    resolve(outDir, 'report.md'),
    `# Fidelidad con Figma\n\nTolerancia: ±${HEIGHT_TOLERANCE} px de alto y ${PIXEL_TOLERANCE} % de píxeles por sección.\n\n${table}\n`,
  );
  console.log(table);
  const failing = rows.filter((r) => !r.ok);
  console.log(
    `\n${rows.length - failing.length}/${rows.length} secciones dentro de tolerancia. Informe: tests/visual/output/report.md`,
  );
  if (strict && failing.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
