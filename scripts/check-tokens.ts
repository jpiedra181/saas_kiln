/**
 * Guardián de tokens: falla si en src/ hay colores o espaciados escritos a mano.
 *  - colores literales: #hex, rgb(), rgba(), hsl(), hsla(), oklch()…
 *  - valores arbitrarios de Tailwind que no usan un token: p-[13px], bg-[#fff]… (sí se permite p-[var(--token)])
 *  - medidas en px/rem en propiedades de espaciado o tamaño (margin, padding, gap, inset, width, height…)
 * Se excluyen los archivos generados desde Figma y src/styles/dimensions.css (medidas fijas documentadas).
 *
 *   npm run lint:tokens
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'src');
const ignored = new Set(['src/styles/tokens.css', 'src/styles/tailwind.theme.css', 'src/styles/dimensions.css']);
const ignoredDirs = ['src/assets/', 'src/i18n/figma/'];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const COLOR =
  /(?<![\w&])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/g;
const ARBITRARY = /(?:^|\s|["'`])(!?-?[\w:-]*?-\[[^\]\s]+\])(?!:)/g;
const SPACING_DECL =
  /(?:^|[;{\s])((?:margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left|width|height|min-width|min-height|max-width|max-height|translate)[\w-]*)\s*:\s*([^;}]+)/g;
const LITERAL_LENGTH = /(?<![\w-])-?\d*\.?\d+(?:px|rem)\b/;

type Problem = { file: string; line: number; message: string };
const problems: Problem[] = [];
const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length;

for (const path of walk(src)) {
  const file = relative(root, path).replaceAll('\\', '/');
  if (!/\.(astro|ts|css|js)$/.test(file) || ignored.has(file) || ignoredDirs.some((d) => file.startsWith(d))) continue;
  const text = readFileSync(path, 'utf8');
  // Comentarios fuera para no avisar por ejemplos en la documentación.
  const code = text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));

  for (const m of code.matchAll(COLOR)) {
    problems.push({
      file,
      line: lineOf(code, m.index!),
      message: `color literal "${m[0]}": usa un token (bg-*, text-*, var(--…))`,
    });
  }
  for (const m of code.matchAll(ARBITRARY)) {
    const value = m[1];
    const outsideTokens = value.replace(/var\(--[\w-]+\)/g, '');
    COLOR.lastIndex = 0;
    if (COLOR.test(outsideTokens) || /\d(?:px|rem)/.test(outsideTokens)) {
      problems.push({
        file,
        line: lineOf(code, m.index!),
        message: `valor arbitrario "${value}": usa una utilidad de token o [var(--token)]`,
      });
    }
    COLOR.lastIndex = 0;
  }
  const styles = file.endsWith('.css')
    ? [code]
    : [...code.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
  for (const style of styles) {
    for (const m of style.matchAll(SPACING_DECL)) {
      if (LITERAL_LENGTH.test(m[2].replace(/var\(--[\w-]+\)/g, ''))) {
        problems.push({
          file,
          line: lineOf(code, code.indexOf(m[0].trim())),
          message: `medida escrita a mano "${m[1]}: ${m[2].trim()}": usa var(--space-*) o un token de Layout`,
        });
      }
    }
  }
}

if (problems.length) {
  console.error(`✗ ${problems.length} valor(es) fuera del sistema de tokens:\n`);
  for (const p of problems) console.error(`  ${p.file}:${p.line}  ${p.message}`);
  process.exit(1);
}
console.log('✓ Sin colores ni espaciados escritos a mano en src/ (fuera de los archivos generados y dimensions.css).');
