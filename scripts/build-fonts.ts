/**
 * Prepara las fuentes del diseño a partir de los archivos variables de Fontsource:
 *  - Fraunces: Figma usa "SOFT" 0 y "WONK" 1, así que esos ejes se fijan en el archivo.
 *    Se conserva el eje opsz (tamaño óptico automático) y el peso 400–600.
 *  - Instrument Sans: ancho fijo en 100 y peso 400–700.
 *  - Solo los caracteres latinos que necesitan ES y EN.
 *
 * Resultado en src/assets/fonts/ (versionado). Volver a ejecutar solo si cambian las familias:
 *   npm run fonts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'src/assets/fonts');

const ranges: [number, number][] = [
  [0x20, 0x7e], // ASCII
  [0xa0, 0xff], // Latin-1: á é í ó ú ñ ü ¿ ¡ « » ·
  [0x152, 0x153], // Œ œ
  [0x2013, 0x2014], // – —
  [0x2018, 0x201e], // ‘ ’ “ ” „
  [0x2022, 0x2022], // •
  [0x2026, 0x2026], // …
  [0x2032, 0x2033], // ′ ″
  [0x20ac, 0x20ac], // €
  [0x2122, 0x2122], // ™
  [0x2190, 0x2193], // ← ↑ → ↓
  [0x2212, 0x2212], // −
];
const text = ranges
  .map(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCodePoint(a + i)).join(''))
  .join('');

const fontsource = (pkg: string, file: string) =>
  resolve(dirname(require.resolve(`${pkg}/package.json`)), 'files', file);

type Axis = number | { min: number; max: number };
const jobs: { src: string; out: string; axes: Record<string, Axis> }[] = [
  {
    src: fontsource('@fontsource-variable/fraunces', 'fraunces-latin-full-normal.woff2'),
    out: 'fraunces-roman.woff2',
    axes: { SOFT: 0, WONK: 1, wght: { min: 400, max: 600 } },
  },
  {
    src: fontsource('@fontsource-variable/fraunces', 'fraunces-latin-full-italic.woff2'),
    out: 'fraunces-italic.woff2',
    axes: { SOFT: 0, WONK: 1, wght: 400 },
  },
  {
    src: fontsource('@fontsource-variable/instrument-sans', 'instrument-sans-latin-standard-normal.woff2'),
    out: 'instrument-sans.woff2',
    axes: { wdth: 100, wght: { min: 400, max: 700 } },
  },
];

mkdirSync(outDir, { recursive: true });
for (const job of jobs) {
  const input = readFileSync(job.src);
  const output = await subsetFont(input, text, { targetFormat: 'woff2', variationAxes: job.axes });
  writeFileSync(resolve(outDir, job.out), output);
  console.log(
    `  ${job.out.padEnd(24)} ${(input.length / 1024).toFixed(1)} KB → ${(output.length / 1024).toFixed(1)} KB`,
  );
}
