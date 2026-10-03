/**
 * Figma → código.
 *
 * Lee `tokens/figma.json` (exportado con `figma/export-tokens.js`) y genera:
 *   - src/styles/tokens.css          variables CSS (primitivas, tema claro/oscuro, layout fluido)
 *   - src/styles/tailwind.theme.css  tema de Tailwind v4 (@theme + @utility) que consume esas variables
 *   - src/i18n/figma/{es,en}.json    textos de la colección Language
 *
 * Uso:
 *   npm run tokens          genera los archivos
 *   npm run tokens:check    falla si los archivos generados no coinciden con tokens/figma.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Configuración: lo único que no viene de Figma.
// ---------------------------------------------------------------------------
const CONFIG = {
  source: 'tokens/figma.json',
  out: {
    css: 'src/styles/tokens.css',
    theme: 'src/styles/tailwind.theme.css',
    i18nDir: 'src/i18n/figma',
  },
  /** Anchos (px) donde cambia la estructura. Los valores de los tokens son fluidos entre los frames de Figma. */
  breakpoints: { md: 768, lg: 1200 },
  /** Modo de Figma que corresponde a cada tramo de pantalla. */
  layoutModes: { mobile: 'Mobile 390', tablet: 'Tablet 834', desktop: 'Desktop 1440' },
  /** Familia de Figma → variable CSS que crea la Fonts API de Astro (astro.config.mjs). */
  fontVariables: { Fraunces: '--font-fraunces', 'Instrument Sans': '--font-instrument-sans' } as Record<string, string>,
  /** Idioma de cada modo de la colección Language. */
  locales: { ES: 'es', EN: 'en' } as Record<string, string>,
  rootFontSize: 16,
};

// ---------------------------------------------------------------------------
// Tipos del JSON exportado
// ---------------------------------------------------------------------------
type Alias = { alias: string };
type Value = string | number | boolean | Alias;
interface Variable {
  name: string;
  collection: string;
  type: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  scopes: string[];
  codeSyntax: string | null;
  description?: string;
  values: Record<string, Value>;
}
interface TextStyle {
  name: string;
  fontFamily: Alias | string;
  fontWeight: number;
  italic: boolean;
  fontSize: Alias | number;
  lineHeight: Alias | { unit: 'PIXELS' | 'PERCENT' | 'AUTO'; value?: number };
  letterSpacing: Alias | { unit: 'PIXELS' | 'PERCENT'; value: number };
  textCase: string;
}
interface EffectStyle {
  name: string;
  effects: { type: string; x: number; y: number; radius: number; spread: number; color?: Alias | string }[];
}
interface Export {
  meta: Record<string, string>;
  collections: { name: string; modes: string[]; defaultMode: string }[];
  variables: Variable[];
  textStyles: TextStyle[];
  effectStyles: EffectStyle[];
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const data: Export = JSON.parse(readFileSync(resolve(root, CONFIG.source), 'utf8'));
const byName = new Map(data.variables.map((v) => [v.name, v]));

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const isAlias = (v: unknown): v is Alias => typeof v === 'object' && v !== null && 'alias' in v;

/** `var(--bg-canvas)` → `--bg-canvas`; `t('hero.title')` → `hero.title` */
function cssName(v: Variable): string {
  const m = v.codeSyntax?.match(/^var\((--[\w-]+)\)$/);
  if (!m) throw new Error(`La variable "${v.name}" no tiene code syntax WEB del tipo var(--nombre)`);
  return m[1];
}
function i18nKey(v: Variable): string {
  const m = v.codeSyntax?.match(/^t\('([\w.-]+)'\)$/);
  if (!m) throw new Error(`La variable de texto "${v.name}" no tiene code syntax t('clave')`);
  return m[1];
}
function target(alias: Alias): Variable {
  const v = byName.get(alias.alias);
  if (!v) throw new Error(`Alias roto: ${alias.alias}`);
  return v;
}
/** Valor numérico final de un alias (para interpolar). */
function resolveNumber(value: Value): number {
  if (typeof value === 'number') return value;
  if (isAlias(value)) {
    const t = target(value);
    return resolveNumber(Object.values(t.values)[0]);
  }
  throw new Error(`Se esperaba un número y llegó ${JSON.stringify(value)}`);
}
const round = (n: number, d = 4) => Number(n.toFixed(d)).toString();
const rem = (px: number) => (px === 0 ? '0' : `${round(px / CONFIG.rootFontSize)}rem`);
const ref = (alias: Alias) => `var(${cssName(target(alias))})`;
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function formatPrimitive(v: Variable, value: Value): string {
  if (isAlias(value)) return ref(value);
  switch (v.type) {
    case 'COLOR':
      return String(value);
    case 'FLOAT':
      if (v.scopes.includes('CORNER_RADIUS') && (value as number) >= 999) return '9999px';
      return rem(value as number);
    case 'STRING':
      if (v.scopes.includes('FONT_FAMILY')) {
        const fontVar = CONFIG.fontVariables[value as string];
        if (!fontVar) throw new Error(`Falta la variable de fuente para "${value}" en CONFIG.fontVariables`);
        return `var(${fontVar})`;
      }
      return JSON.stringify(value);
    default:
      return String(value);
  }
}

/** Interpolación lineal entre dos frames: clamp(min, a + b·vw, max) en rem. */
function fluid(w1: number, v1: number, w2: number, v2: number): string {
  if (v1 === v2) return rem(v1);
  const slope = (v2 - v1) / (w2 - w1);
  const intercept = v1 - slope * w1;
  const lo = Math.min(v1, v2);
  const hi = Math.max(v1, v2);
  const sign = intercept < 0 ? '-' : '+';
  return `clamp(${rem(lo)}, ${slope >= 0 ? '' : '-'}${round(Math.abs(slope) * 100)}vw ${sign} ${rem(Math.abs(intercept))}, ${rem(hi)})`;
}

const header = (what: string) =>
  `/* GENERADO por scripts/build-tokens.ts desde ${CONFIG.source} — no editar a mano.\n   ${what}\n   Para actualizar: exporta de nuevo desde Figma y ejecuta \`npm run tokens\`. */\n`;

// ---------------------------------------------------------------------------
// Colecciones
// ---------------------------------------------------------------------------
const collection = (name: string) => {
  const c = data.collections.find((c) => c.name === name);
  if (!c) throw new Error(`Falta la colección "${name}" en ${CONFIG.source}`);
  return { ...c, vars: data.variables.filter((v) => v.collection === name) };
};
const primitives = collection('Primitives');
const theme = collection('Theme');
const layout = collection('Layout');
const language = collection('Language');

/** Tailwind reserva estos espacios de nombres; se declaran en @theme static para no duplicar variables. */
const inTailwindTheme = (v: Variable) => v.scopes.includes('CORNER_RADIUS') || v.scopes.includes('FONT_FAMILY');

const { mobile: M, tablet: T, desktop: D } = CONFIG.layoutModes;
const frameWidth = byName.get('layout/frame-width');
if (!frameWidth) throw new Error('Falta layout/frame-width');
const W = {
  m: resolveNumber(frameWidth.values[M]),
  t: resolveNumber(frameWidth.values[T]),
  d: resolveNumber(frameWidth.values[D]),
};
const pagePadding = byName.get('layout/page-padding')!;
const contentWidth = (mode: string, w: number) => w - 2 * resolveNumber(pagePadding.values[mode]);

// ---------------------------------------------------------------------------
// tokens.css
// ---------------------------------------------------------------------------
function buildCss(): string {
  const out: string[] = [
    header('Variables de Figma: Primitives, Theme (Light/Dark) y Layout (fluido entre 390, 834 y 1440).'),
  ];

  out.push(':root {');
  out.push('  /* Primitives (radios y familias tipográficas: ver tailwind.theme.css) */');
  for (const v of primitives.vars) {
    if (inTailwindTheme(v)) continue;
    out.push(`  ${cssName(v)}: ${formatPrimitive(v, v.values[primitives.defaultMode])};`);
  }
  out.push('}', '');

  const themeBlock = (mode: string, indent = '  ') =>
    theme.vars.map((v) => `${indent}${cssName(v)}: ${formatPrimitive(v, v.values[mode])};`).join('\n');
  out.push('/* Theme · Light (por defecto) */');
  out.push(':root,\n[data-theme="light"] {\n  color-scheme: light;\n' + themeBlock('Light') + '\n}', '');
  out.push('/* Theme · Dark (elegido a mano) */');
  out.push('[data-theme="dark"] {\n  color-scheme: dark;\n' + themeBlock('Dark') + '\n}', '');
  out.push('/* Theme · Dark (preferencia del sistema, si no se eligió otro) */');
  out.push(
    '@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n    color-scheme: dark;\n' +
      themeBlock('Dark', '    ') +
      '\n  }\n}',
    '',
  );

  // Layout
  const fluidVars = layout.vars.filter((v) => v.type === 'FLOAT' && !v.scopes.includes('WIDTH_HEIGHT'));
  const widthVars = layout.vars.filter(
    (v) => v.type === 'FLOAT' && v.scopes.includes('WIDTH_HEIGHT') && v.name !== 'layout/frame-width',
  );
  const num = (v: Variable, mode: string) => resolveNumber(v.values[mode]);
  /** En móvil y tablet, un ancho igual al área de contenido del frame significa "ocupa todo". */
  const width = (v: Variable, mode: string, frame: number) => {
    const px = num(v, mode);
    return mode !== D && px === contentWidth(mode, frame) ? '100%' : rem(px);
  };
  const aliasNote = (v: Variable, a: string, b: string) => {
    const name = (mode: string) =>
      isAlias(v.values[mode]) ? cssName(target(v.values[mode] as Alias)) : String(v.values[mode]);
    return ` /* ${name(a)} → ${name(b)} */`;
  };

  out.push(`/* Layout · espaciados y tipografía fluidos (${W.m} → ${W.t} px) y anchos máximos en móvil */`);
  out.push(':root {');
  out.push(`  --layout-frame-width: ${rem(W.d)};`);
  for (const v of fluidVars)
    out.push(`  ${cssName(v)}: ${fluid(W.m, num(v, M), W.t, num(v, T))};${aliasNote(v, M, T)}`);
  for (const v of widthVars) out.push(`  ${cssName(v)}: ${width(v, M, W.m)};`);
  out.push('}', '');
  out.push(`/* Layout · fluido ${W.t} → ${W.d} px */`);
  out.push(`@media (min-width: ${W.t}px) {\n  :root {`);
  for (const v of fluidVars)
    out.push(`    ${cssName(v)}: ${fluid(W.t, num(v, T), W.d, num(v, D))};${aliasNote(v, T, D)}`);
  out.push('  }\n}', '');
  out.push(`/* Layout · anchos en diseño de tablet (≥ ${CONFIG.breakpoints.md}px) */`);
  out.push(`@media (min-width: ${CONFIG.breakpoints.md}px) {\n  :root {`);
  for (const v of widthVars) out.push(`    ${cssName(v)}: ${width(v, T, W.t)};`);
  out.push('  }\n}', '');
  out.push(`/* Layout · anchos en diseño de escritorio (≥ ${CONFIG.breakpoints.lg}px) */`);
  out.push(`@media (min-width: ${CONFIG.breakpoints.lg}px) {\n  :root {`);
  for (const v of widthVars) out.push(`    ${cssName(v)}: ${width(v, D, W.d)};`);
  out.push('  }\n}');

  return out.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// tailwind.theme.css
// ---------------------------------------------------------------------------
const layoutShortName = (v: Variable) => v.name.replace(/^layout\//, '').replace(/-(padding-top|padding|gap)$/, '');

function buildTheme(): string {
  const out: string[] = [
    header('Tema de Tailwind v4: solo existen utilidades basadas en los tokens de Figma.'),
    '/* Se desactivan las escalas por defecto de Tailwind: nada de colores ni espaciados sueltos. */',
    '@theme {',
    '  --color-*: initial;',
    '  --spacing: initial;',
    '  --spacing-*: initial;',
    '  --radius-*: initial;',
    '  --shadow-*: initial;',
    '  --inset-shadow-*: initial;',
    '  --drop-shadow-*: initial;',
    '  --text-shadow-*: initial;',
    '  --text-*: initial;',
    '  --font-*: initial;',
    '  --leading-*: initial;',
    '  --tracking-*: initial;',
    '  --container-*: initial;',
    '  --breakpoint-*: initial;',
    '}',
    '',
    '/* Primitivas cuyo nombre coincide con un espacio de nombres de Tailwind (radios y familias). */',
    '@theme static {',
  ];
  for (const [name, px] of Object.entries(CONFIG.breakpoints)) out.push(`  --breakpoint-${name}: ${rem(px)};`);
  for (const v of primitives.vars.filter(inTailwindTheme))
    out.push(`  ${cssName(v)}: ${formatPrimitive(v, v.values[primitives.defaultMode])};`);
  out.push('}', '');

  out.push('@theme inline {');
  out.push('  /* Espaciado: p-16 = space/16 */');
  for (const v of primitives.vars.filter((v) => v.name.startsWith('space/'))) {
    out.push(`  --spacing-${cssName(v).replace('--space-', '')}: var(${cssName(v)});`);
  }
  out.push('  /* Espaciado de Layout (fluido): px-page, py-section-padding, gap-grid… */');
  const layoutSpacing = layout.vars.filter((v) => v.type === 'FLOAT' && v.scopes.includes('GAP'));
  const shorts = layoutSpacing.map(layoutShortName);
  for (const v of layoutSpacing) {
    // layout/grid-gap → grid; si dos variables quedarían igual (section-padding/section-gap) se usa el nombre completo
    const short = layoutShortName(v);
    const name = shorts.filter((s) => s === short).length > 1 ? v.name.replace(/^layout\//, '') : short;
    out.push(`  --spacing-${name}: var(${cssName(v)});`);
  }
  out.push('  /* Anchos de Layout: max-w-hero-text, w-plan… */');
  for (const v of layout.vars.filter((v) => v.type === 'FLOAT' && v.scopes.includes('WIDTH_HEIGHT'))) {
    const name = v.name.replace(/^layout\//, '').replace(/-width$/, '');
    out.push(`  --container-${name}: var(${cssName(v)});`);
  }
  out.push('  /* Sombras (estilos de efecto de Figma) */');
  for (const s of data.effectStyles.filter((s) => s.name.startsWith('Shadow/'))) {
    const size =
      { small: 'sm', medium: 'md', large: 'lg' }[s.name.split('/')[1].toLowerCase()] ?? slugify(s.name.split('/')[1]);
    const value = s.effects
      .map(
        (e) => `${rem(e.x)} ${rem(e.y)} ${rem(e.radius)} ${rem(e.spread)} ${isAlias(e.color) ? ref(e.color) : e.color}`,
      )
      .join(', ');
    out.push(`  --shadow-${size}: ${value};`);
  }
  out.push('}', '');

  // Colores semánticos → utilidades con el mismo nombre que en Figma
  out.push('/* Colores del tema: la clase coincide con el nombre de la variable en Figma (bg/canvas → bg-canvas). */');
  for (const v of theme.vars) {
    const name = cssName(v).slice(2);
    const [group] = v.name.split('/');
    const rules: [string, string][] = [];
    if (group === 'bg') rules.push([name, `background-color: var(--${name})`]);
    if (group === 'text') rules.push([name, `color: var(--${name})`]);
    if (group === 'border') {
      rules.push([name, `border-color: var(--${name})`]);
      rules.push([name.replace(/^border-/, 'outline-'), `outline-color: var(--${name})`]);
      rules.push([name.replace(/^border-/, 'divide-'), `& > :not(:last-child) { border-color: var(--${name}); }`]);
    }
    if (group === 'icon') rules.push([name, `color: var(--${name})`]);
    if (group === 'status') {
      const kind = name.endsWith('-bg') ? 'bg' : 'text';
      const prop = kind === 'bg' ? 'background-color' : 'color';
      rules.push([`${kind}-${name.replace(/-(bg|fg)$/, '')}`, `${prop}: var(--${name})`]);
    }
    if (group === 'decor') {
      rules.push([`bg-${name}`, `background-color: var(--${name})`]);
      rules.push([`fill-${name}`, `fill: var(--${name})`]);
    }
    for (const [cls, body] of rules) out.push(`@utility ${cls} { ${body.endsWith('}') ? body : body + ';'} }`);
  }
  out.push('');

  // Estilos de texto
  out.push('/* Estilos de texto de Figma: type-display, type-h2, type-body-lg… */');
  for (const s of data.textStyles) {
    const name =
      'type-' +
      slugify(
        s.name
          .replace(/^Heading\//, '')
          .replace(/^Body\/Large$/, 'body-lg')
          .replace(/^Body\/Medium$/, 'body-md')
          .replace(/^Body\/Small$/, 'body-sm')
          .replace(/^Label\/Large$/, 'label-lg')
          .replace(/^Label\/Medium$/, 'label-md')
          .replace(/^Label\/Small$/, 'label-sm')
          .replace(/^Logo\/Wordmark$/, 'logo'),
      );
    const decl: string[] = [];
    decl.push(`font-family: ${isAlias(s.fontFamily) ? ref(s.fontFamily) : JSON.stringify(s.fontFamily)}`);
    decl.push(`font-size: ${isAlias(s.fontSize) ? ref(s.fontSize) : rem(s.fontSize)}`);
    if (isAlias(s.lineHeight)) decl.push(`line-height: ${ref(s.lineHeight)}`);
    else if (s.lineHeight.unit === 'PIXELS') decl.push(`line-height: ${rem(s.lineHeight.value!)}`);
    else if (s.lineHeight.unit === 'PERCENT') decl.push(`line-height: ${round(s.lineHeight.value! / 100)}`);
    decl.push(`font-weight: ${s.fontWeight}`);
    if (s.italic) decl.push('font-style: italic');
    if (!isAlias(s.letterSpacing) && s.letterSpacing.value !== 0) {
      decl.push(
        `letter-spacing: ${s.letterSpacing.unit === 'PERCENT' ? round(s.letterSpacing.value / 100) + 'em' : rem(s.letterSpacing.value)}`,
      );
    }
    if (s.textCase === 'UPPER') decl.push('text-transform: uppercase');
    out.push(`@utility ${name} {\n  ${decl.join(';\n  ')};\n}`);
  }
  out.push('');

  // Visibilidad (booleanos de Layout)
  out.push('/* Visibilidad por tramo (booleanos de Layout): visible-desktop, visible-tablet-up… */');
  const ranges = {
    [M]: `(width < ${rem(CONFIG.breakpoints.md)})`,
    [T]: `(${rem(CONFIG.breakpoints.md)} <= width < ${rem(CONFIG.breakpoints.lg)})`,
    [D]: `(width >= ${rem(CONFIG.breakpoints.lg)})`,
  };
  for (const v of layout.vars.filter((v) => v.type === 'BOOLEAN')) {
    const hidden = Object.entries(v.values)
      .filter(([, on]) => on === false)
      .map(([mode]) => ranges[mode]);
    const name = v.name.replace(/^layout\//, '');
    out.push(`@utility ${name} {\n  @media ${hidden.join(', ')} {\n    display: none !important;\n  }\n}`);
  }
  out.push('');
  out.push(`/* Foco visible: contorno sólido border/focus + halo de Focus/Ring (ver global.css). */`);
  const ring = data.effectStyles.find((s) => s.name === 'Focus/Ring')?.effects[0];
  if (ring) {
    out.push(':root {');
    out.push(`  --focus-ring-halo: 0 0 0 ${rem(ring.spread)} ${isAlias(ring.color) ? ref(ring.color) : ring.color};`);
    out.push('}');
  }
  return out.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------
function buildI18n(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [mode, locale] of Object.entries(CONFIG.locales)) {
    const dict: Record<string, string> = {};
    for (const v of language.vars) {
      const value = v.values[mode];
      if (typeof value !== 'string') throw new Error(`Texto sin valor en ${mode}: ${v.name}`);
      dict[i18nKey(v)] = value;
    }
    const sorted = Object.fromEntries(Object.entries(dict).sort(([a], [b]) => a.localeCompare(b)));
    files[`${CONFIG.out.i18nDir}/${locale}.json`] = JSON.stringify(sorted, null, 2) + '\n';
  }
  return files;
}

// ---------------------------------------------------------------------------
// Auditoría de contraste (solo informa)
// ---------------------------------------------------------------------------
function resolveColor(value: Value): string {
  if (isAlias(value)) return resolveColor(Object.values(target(value).values)[0]);
  return String(value);
}
function luminance(hex: string): number {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
function audit(): string[] {
  const pairs: [string, string, number][] = [
    ['text/primary', 'bg/canvas', 4.5],
    ['text/secondary', 'bg/canvas', 4.5],
    ['text/tertiary', 'bg/canvas', 4.5],
    ['text/secondary', 'bg/subtle', 4.5],
    ['text/tertiary', 'bg/subtle', 4.5],
    ['text/tertiary', 'bg/surface', 4.5],
    ['text/brand', 'bg/canvas', 4.5],
    ['text/brand', 'bg/surface', 4.5],
    ['text/on-brand', 'bg/brand', 4.5],
    ['text/on-emphasis-secondary', 'bg/emphasis', 4.5],
    ['status/success-fg', 'status/success-bg', 4.5],
    ['status/warning-fg', 'status/warning-bg', 4.5],
    ['status/danger-fg', 'status/danger-bg', 4.5],
    ['status/neutral-fg', 'status/neutral-bg', 4.5],
    ['bg/toggle-off', 'bg/surface', 3],
    ['border/focus', 'bg/canvas', 3],
  ];
  const problems: string[] = [];
  for (const mode of theme.modes) {
    for (const [fg, bg, min] of pairs) {
      const ratio = contrast(resolveColor(byName.get(fg)!.values[mode]), resolveColor(byName.get(bg)!.values[mode]));
      if (ratio < min) problems.push(`${mode}: ${fg} sobre ${bg} = ${ratio.toFixed(2)}:1 (mín. ${min}:1)`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Escritura / comprobación
// ---------------------------------------------------------------------------
const outputs: Record<string, string> = {
  [CONFIG.out.css]: buildCss(),
  [CONFIG.out.theme]: buildTheme(),
  ...buildI18n(),
};

const check = process.argv.includes('--check');
const stale: string[] = [];
for (const [file, content] of Object.entries(outputs)) {
  const path = resolve(root, file);
  const current = existsSync(path) ? readFileSync(path, 'utf8').replace(/\r\n/g, '\n') : null;
  if (check) {
    if (current !== content) stale.push(file);
  } else if (current !== content) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    console.log(`  escrito  ${file}`);
  } else {
    console.log(`  sin cambios  ${file}`);
  }
}

const problems = audit();
if (problems.length) {
  console.warn('\nContraste por debajo de WCAG AA:\n  ' + problems.join('\n  '));
} else {
  console.log('\nContraste: todos los pares revisados cumplen WCAG AA.');
}

if (check) {
  if (stale.length) {
    console.error(
      `\nLos tokens generados no coinciden con ${CONFIG.source}:\n  ${stale.join('\n  ')}\nEjecuta \`npm run tokens\`.`,
    );
    process.exit(1);
  }
  console.log(`Tokens al día con ${CONFIG.source} (${data.variables.length} variables).`);
}
