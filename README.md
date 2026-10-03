# Kiln · landing

Landing de Kiln construida desde su archivo de Figma con **Astro 7 + Tailwind CSS 4 + TypeScript**, con GSAP para las animaciones.
Todos los colores, espaciados, radios, sombras, estilos de texto y textos salen de las variables de Figma mediante un script que se puede volver a ejecutar.

- Archivo de diseño: [Figma · kiln](https://www.figma.com/design/alzYXnsPzEWTUOX02Xn3Mf/kiln) (páginas Foundations, Components, Desktop, Tablet y Mobile).
- Idiomas: español en `/` e inglés en `/en/`.
- Tema claro/oscuro: sigue al sistema, con interruptor manual que se recuerda.
- Despliegue: sitio estático en Netlify (sin servidor ni adaptador).

## Puesta en marcha

Requisitos: Node 22 (ver `.nvmrc`).

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # comprueba tokens + tipos y genera dist/
npm run preview    # sirve dist/
```

| Script               | Qué hace                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run tokens`     | Genera CSS, tema de Tailwind y traducciones desde `tokens/figma.json`                             |
| `npm run check`      | `tokens:check` (los generados están al día) + `lint:tokens` (nada escrito a mano) + `astro check` |
| `npm run build`      | `check` + `astro build`. Es lo que ejecuta Netlify                                                |
| `npm test`           | Pruebas de Playwright: accesibilidad con axe e interacciones con teclado (requiere `build`)       |
| `npm run visual`     | Compara cada sección con su captura de Figma y genera `tests/visual/output/report.md`             |
| `npm run sweep`      | Comprueba que no hay scroll horizontal en 16 anchos, de 320 a 2560 px                             |
| `npm run lighthouse` | Lighthouse móvil con aserciones: ≥ 95 en las cuatro categorías y CLS = 0                          |
| `npm run fonts`      | Regenera las fuentes optimizadas (solo si cambian las familias)                                   |

La primera vez que ejecutes las pruebas: `npx playwright install chromium`.

## De Figma a tokens

```
Figma (variables + estilos)
   │  figma/export-tokens.js   ← plugin local o MCP de Figma
   ▼
tokens/figma.json              ← copia versionada: la fuente de verdad en el repo
   │  npm run tokens  (scripts/build-tokens.ts)
   ▼
src/styles/tokens.css          variables CSS: primitivas, tema claro/oscuro, layout fluido
src/styles/tailwind.theme.css  tema de Tailwind: solo existen utilidades basadas en tokens
src/i18n/figma/{es,en}.json    los 265 textos de la colección Language
```

### 1. Exportar desde Figma

La API REST de variables de Figma es exclusiva de los planes Enterprise, así que la exportación se hace desde dentro de Figma con `figma/export-tokens.js`. El mismo código funciona de dos formas:

- **Plugin local (sin depender de nadie):** Figma desktop → _Plugins → Development → Import plugin from manifest…_ → elige `figma/manifest.json`. Al ejecutar «Kiln · Export tokens» aparece el JSON con un botón para descargarlo: guárdalo como `tokens/figma.json`.
- **Por MCP (Claude Code):** se ejecuta el script con `use_figma` y se guarda la respuesta en `tokens/figma.json`.

Después:

```bash
npm run tokens      # regenera los archivos
npm run build       # falla si algo del código no cuadra con los tokens nuevos
```

El exportador guarda las cuatro colecciones con sus modos, alias, ámbitos (_scopes_) y el _code syntax_ de cada variable, además de los 20 estilos de texto y los 4 de efecto.

### 2. Qué genera `build-tokens`

Los nombres no se inventan: salen del _code syntax_ que ya tiene Figma (`bg/canvas` → `var(--bg-canvas)`, `hero/title` → `t('hero.title')`). Lo que se ve en Dev Mode es lo que aparece en el código.

| Colección de Figma         | Resultado en CSS                                                                                             | En Tailwind                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **Primitives** (123)       | `--clay-600`, `--space-16`, `--font-size-13`…                                                                | Sin colores primitivos expuestos. `p-16`, `gap-24`… (= `space/16`, `space/24`); `rounded-12`; `font-display`                  |
| **Theme** (63, Light/Dark) | Tema claro en `:root` y tema oscuro con `[data-theme=dark]`, más `prefers-color-scheme` como respaldo sin JS | La clase coincide con el nombre en Figma: `bg-canvas`, `text-secondary`, `border-default`, `icon-brand`, `bg-status-success`… |
| **Layout** (42, 3 modos)   | Espaciados y tipografía **fluidos** con `clamp()`                                                            | `px-page`, `py-section-padding`, `gap-section-gap`, `gap-grid`, `p-card`, `max-w-header`, `w-plan`…                           |
| **Language** (265, ES/EN)  | `src/i18n/figma/es.json` y `en.json`                                                                         | `t('pricing.studio.price-annual')`                                                                                            |
| Estilos de texto (20)      | —                                                                                                            | `type-display`, `type-h2`, `type-body-lg`, `type-label-md`, `type-overline`, `type-app-body`…                                 |
| Estilos de efecto (4)      | Sombras con `--effect-shadow-*` (cambian con el tema) y el halo de `Focus/Ring`                              | `shadow-sm`, `shadow-md`, `shadow-lg`                                                                                         |

**Responsive fluido.** Los frames de Figma miden 390, 834 y 1440 px. Cada token de espaciado y de tipografía de la colección Layout se interpola en línea recta entre esos anchos con `clamp()` en `rem`, que respeta el zoom del navegador. El resultado es exacto en 390, 834 y 1440 y continuo entre medias. Los anchos máximos (`hero-text-width`, `plan-width`…) no se interpolan: cuando en Figma ocupan todo el contenido del frame se convierten en `100%`.

**Breakpoints.** Indican dónde cambia la estructura (por ejemplo, los planes pasan de columna a fila); los valores siguen siendo fluidos. Son el único ajuste que no viene de Figma y están en `CONFIG.breakpoints` de `scripts/build-tokens.ts`:

- `md` (768 px): diseño de tablet.
- `lg` (1200 px): diseño de escritorio.

Los booleanos de Layout se convierten en utilidades con el mismo nombre: `visible-desktop`, `visible-tablet-up`, `visible-tablet-down` y `visible-mobile`.

**Escalas por defecto desactivadas.** `bg-red-500`, `p-4` o `text-sm` no existen en este proyecto. Además, `npm run lint:tokens` hace fallar el build si en `src/` aparece un color literal, un valor arbitrario sin token (`p-[13px]`) o una medida en px/rem en propiedades de espaciado.

La única excepción documentada es `src/styles/dimensions.css`: guarda medidas fijas de piezas de los mockups que en Figma no son variables, como la barra lateral de 220 px o los arcos del CTA.

**Contraste.** Cada `npm run tokens` revisa los pares texto/fondo principales en los dos temas y avisa si alguno no llega a WCAG AA.

## De tokens a código

```
src/
├─ components/
│  ├─ ui/         Button, TextLink, Badge, Avatar, ListItem, IconButton, Icon, Logo, ClientLogo, SectionHeader
│  ├─ controls/   ThemeSwitch, LanguageSwitcher, BillingToggle, FaqItem
│  ├─ mockups/    AppWindow, StatCard, TableRow, SidebarItem, Toast, MockupProposal, MockupFiles, MockupInvoice
│  ├─ sections/   Navbar, Hero, Logos, HowItWorks, Features, Testimonials, Pricing, Faq, Cta, Footer
│  └─ Landing.astro
├─ layouts/Base.astro   <head>: tema sin parpadeo, hreflang, canonical, fuentes
├─ i18n/                textos de Figma (generados) + site/{es,en}.json (accesibilidad, 404)
├─ scripts/             tema, idioma, menú, precios, FAQ y animaciones (GSAP)
├─ styles/              global.css + tokens.css y tailwind.theme.css (generados) + dimensions.css
├─ assets/              iconos y logos SVG exportados de Figma, y fuentes optimizadas
└─ pages/               index.astro (ES), en/index.astro (EN), 404.astro, robots.txt.ts
```

- **Componentes = componentes de Figma.** Mismos nombres y mismas variantes (`Button variant/size`, `Badge tone`, `Plan card featured`…). Los estados _Hover / Focus / Pressed / Disabled_ de cada variante se traducen a `hover:` / `focus-visible:` / `active:` / `disabled:` con los mismos tokens que usa Figma.
- **Mockups en HTML, no en imágenes.** Cambian con el tema y el idioma y se ven nítidos en cualquier pantalla. Para los lectores de pantalla cada mockup es una imagen (`role="img"`) con una descripción.
- **Iconos.** Los SVG de Figma se guardan sin modificar y se insertan en línea para que hereden `currentColor`; así funcionan en los dos temas.
- **Textos.** Todo el copy viene de la colección Language de Figma. Lo que no existe en Figma va en `src/i18n/site/`: etiquetas de accesibilidad, mensajes para lectores de pantalla y la página 404. TypeScript comprueba que el inglés tiene todas las claves del español.
- **Fuentes.** Fraunces e Instrument Sans se sirven desde el propio sitio mediante la Fonts API de Astro, con fuente de respaldo de métricas ajustadas (CLS 0). `scripts/build-fonts.ts` fija los ejes que usa Figma (`SOFT 0`, `WONK 1`, ancho 100) y deja solo los caracteres latinos: Fraunces pasa de 118 KB a 56 KB.

### Interacciones

| Pieza         | Implementación                                                                                                                                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tema          | Un script en el `<head>` fija `data-theme` antes de pintar (preferencia guardada o la del sistema). El interruptor la guarda en `localStorage` y, sin elección, sigue los cambios del sistema                     |
| Idioma        | Rutas `/` y `/en/` con `hreflang` (es, en, x-default), canonical y sitemap con alternativas. El selector usa enlaces reales y conserva el ancla (`/#pricing` → `/en/#pricing`)                                    |
| Mensual/anual | `role="switch"`: cambia `price-monthly` ↔ `price-annual` y lo anuncia con `aria-live`. Las etiquetas también son clicables                                                                                        |
| FAQ           | `<details>/<summary>` nativo (funciona sin JS y con la búsqueda del navegador); GSAP anima la altura                                                                                                              |
| Menú móvil    | `<dialog>` modal con trampa de foco explícita. Se cierra con Escape, el botón de cerrar o un clic en el fondo, y devuelve el foco al botón que lo abrió                                                           |
| Animaciones   | GSAP + ScrollTrigger, cargados de forma diferida: entrada del hero, apariciones al hacer scroll, mockups (arco, tarjeta, avisos y parallax suave), contador de KPIs, arcos del CTA, cambio de precios, menú y FAQ |

Las animaciones usan solo `transform` y `opacity`, de modo que no mueven el layout. El titular del hero nunca se oculta, para no retrasar el LCP.

Con `prefers-reduced-motion: reduce` no se descarga GSAP y todo el contenido es visible desde el principio. Sin JavaScript también se ve todo.

## Calidad

| Comprobación                            | Resultado                                                                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Lighthouse móvil (`/` y `/en/`)         | Rendimiento 99 · Accesibilidad 100 · Buenas prácticas 100 · SEO 100 · **CLS 0** · TBT 0–10 ms                                 |
| axe-core (WCAG 2.2 AA + best practices) | 0 infracciones en ES/EN × claro/oscuro × 390/834/1440 y con el menú abierto                                                   |
| Pruebas de teclado e interacción        | 28/28 (tema sin parpadeo, idioma con ancla, precios, FAQ, trampa de foco y Escape, enlace para saltar, movimiento reducido)   |
| Fidelidad con Figma                     | 49/51 secciones con la misma altura que Figma y < 2,5 % de píxeles distintos. Las 2 restantes son el pie en móvil (ver abajo) |
| Barrido responsive                      | Sin scroll horizontal en 16 anchos (320–2560 px) en los dos idiomas                                                           |

`npm run visual` guarda en `tests/visual/output/<variante>/<sección>.png` una imagen con Figma, el código y las diferencias para cada sección. Las capturas de referencia de Figma están en `tests/visual/reference/`.

## Diferencias conscientes con Figma

- **Contraste.** En Figma se añadió la primitiva `color/sand/550` y se reasignaron `text/tertiary` (claro) y `bg/toggle-off` (y su hover) para cumplir WCAG AA. El foco usa un contorno sólido de `border/focus` además del halo de `Focus/Ring`, porque el halo solo (al 32 %) no llega a 3:1.
- **Pie en móvil.** En el frame de 390 px la columna «Recursos» queda recortada por el `overflow` del contenedor. En código las columnas pasan a la línea siguiente para que no se pierda contenido (+180 px de alto).
- **Factura del mockup.** En Figma su sombra queda cortada por el contenedor. En código se ve completa.
- **Barra del navegador del hero.** Mide 124 px porque en Figma tiene dos espaciadores de 100 px de alto. Se ha mantenido igual; si es un error de diseño, basta con corregir el frame en Figma y cambiar `--spacing-chrome-spacer` en `dimensions.css`.
- **Lista de idiomas.** Figma define el botón («Opens the ES/EN menu»), pero no la lista desplegable. Se ha diseñado con tokens existentes (`bg-surface-raised`, `border-default`, `shadow-md`, `radius-12`).

## Despliegue en Netlify

1. Sube el repositorio a GitHub.
2. En Netlify: _Add new site → Import an existing project_ → elige el repositorio. `netlify.toml` ya define el comando (`npm run build`), la carpeta (`dist`), Node 22, la caché de `/_astro/*` y las cabeceras de seguridad.
3. Variables de entorno (opcionales):
   - `SITE_URL`: dominio definitivo para canonical, hreflang y sitemap. Sin ella se usa la URL que asigna Netlify.
   - `PUBLIC_APP_URL`: dirección de la app para «Iniciar sesión» y «Empieza gratis». Por defecto, `https://app.kiln.app`.

Los demás destinos de enlaces (demo, ventas, pie) están en `src/config/site.ts`.
