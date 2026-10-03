/**
 * Kiln · Export tokens
 *
 * Vuelca a JSON las variables locales (colecciones, modos, alias, scopes y code syntax),
 * los estilos de texto y los estilos de efecto del archivo de Figma abierto.
 * El resultado se guarda en `tokens/figma.json` y `npm run tokens` genera el CSS,
 * el tema de Tailwind y los archivos de traducción a partir de él.
 *
 * Se puede ejecutar de dos formas:
 *  1. Como plugin local: Figma desktop → Plugins → Development → Import plugin from manifest…
 *     → `figma/manifest.json`. Al abrirlo muestra el JSON con botones para copiar o descargar.
 *  2. Por MCP (`use_figma`): enviar este archivo seguido de `return await exportTokens();`.
 *
 * Solo lee; no modifica el documento.
 */

const STYLE_WEIGHTS = {
  thin: 100,
  hairline: 100,
  extralight: 200,
  ultralight: 200,
  light: 300,
  regular: 400,
  normal: 400,
  book: 400,
  medium: 500,
  semibold: 600,
  demibold: 600,
  bold: 700,
  extrabold: 800,
  ultrabold: 800,
  black: 900,
  heavy: 900,
};

function parseFontStyle(style) {
  const key = style.toLowerCase().replace(/[\s_-]+/g, '');
  const italic = key.includes('italic') || key.includes('oblique');
  const weightKey = key.replace('italic', '').replace('oblique', '') || 'regular';
  return { weight: STYLE_WEIGHTS[weightKey] ?? 400, italic };
}

function toHex({ r, g, b, a = 1 }) {
  const h = (x) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0');
  return '#' + h(r) + h(g) + h(b) + (a < 1 ? h(a) : '');
}

async function exportTokens() {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = await figma.variables.getLocalVariablesAsync();
  const byId = new Map(variables.map((v) => [v.id, v]));
  const collectionById = new Map(collections.map((c) => [c.id, c]));

  const serializeValue = (value) => {
    if (value && typeof value === 'object' && value.type === 'VARIABLE_ALIAS') {
      const target = byId.get(value.id);
      return { alias: target ? target.name : value.id };
    }
    if (value && typeof value === 'object' && 'r' in value) return toHex(value);
    return value;
  };
  const bound = (alias) => (alias && byId.get(alias.id) ? { alias: byId.get(alias.id).name } : undefined);

  const out = {
    meta: {
      fileName: figma.root.name,
      exporter: 'figma/export-tokens.js',
      exportedAt: new Date().toISOString(),
    },
    collections: collections.map((c) => ({
      name: c.name,
      modes: c.modes.map((m) => m.name),
      defaultMode: c.modes.find((m) => m.modeId === c.defaultModeId)?.name ?? c.modes[0].name,
    })),
    variables: [],
    textStyles: [],
    effectStyles: [],
  };

  for (const c of collections) {
    for (const id of c.variableIds) {
      const v = byId.get(id);
      if (!v) continue;
      const values = {};
      for (const m of c.modes) values[m.name] = serializeValue(v.valuesByMode[m.modeId]);
      out.variables.push({
        name: v.name,
        collection: collectionById.get(v.variableCollectionId).name,
        type: v.resolvedType,
        scopes: v.scopes,
        codeSyntax: v.codeSyntax.WEB ?? null,
        description: v.description || undefined,
        values,
      });
    }
  }

  for (const s of await figma.getLocalTextStylesAsync()) {
    const b = s.boundVariables ?? {};
    const { weight, italic } = parseFontStyle(s.fontName.style);
    out.textStyles.push({
      name: s.name,
      description: s.description || undefined,
      fontFamily: bound(b.fontFamily) ?? s.fontName.family,
      fontStyle: s.fontName.style,
      fontWeight: weight,
      italic,
      fontSize: bound(b.fontSize) ?? s.fontSize,
      lineHeight: bound(b.lineHeight) ?? s.lineHeight,
      letterSpacing: bound(b.letterSpacing) ?? s.letterSpacing,
      textCase: s.textCase,
      textDecoration: s.textDecoration,
    });
  }

  for (const s of await figma.getLocalEffectStylesAsync()) {
    out.effectStyles.push({
      name: s.name,
      description: s.description || undefined,
      effects: s.effects
        .filter((e) => e.visible !== false)
        .map((e) => ({
          type: e.type,
          x: e.offset?.x ?? 0,
          y: e.offset?.y ?? 0,
          radius: e.radius,
          spread: e.spread ?? 0,
          color: bound(e.boundVariables?.color) ?? (e.color ? toHex(e.color) : undefined),
        })),
    });
  }

  return out;
}

// Contexto de plugin: `__html__` solo existe cuando se ejecuta desde figma/manifest.json.
if (typeof __html__ !== 'undefined') {
  figma.showUI(__html__, { width: 480, height: 360, title: 'Kiln · Export tokens' });
  exportTokens()
    .then((data) => figma.ui.postMessage({ type: 'tokens', data }))
    .catch((error) => figma.ui.postMessage({ type: 'error', message: String(error) }));
  figma.ui.onmessage = (msg) => {
    if (msg && msg.type === 'close') figma.closePlugin();
  };
}
