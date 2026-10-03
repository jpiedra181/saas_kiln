/**
 * Destinos externos de la landing. La app (login, alta, demo) vive en otro sitio:
 * cambia PUBLIC_APP_URL o estas rutas cuando existan las URLs definitivas.
 */
const app = (import.meta.env.PUBLIC_APP_URL as string | undefined) ?? 'https://app.kiln.app';
const web = 'https://kiln.app';

export const links = {
  login: `${app}/login`,
  signup: `${app}/signup`,
  trial: `${app}/signup?plan=studio`,
  demo: `${web}/demo`,
  sales: `${web}/contact-sales`,
  contact: 'mailto:hola@kiln.app',
  footer: {
    product: ['#features', '#pricing', `${web}/changelog`, `${web}/integrations`],
    company: [`${web}/about`, `${web}/blog`, `${web}/careers`, `${web}/contact`],
    resources: [`${web}/guides`, `${web}/templates`, `${web}/help`, 'https://status.kiln.app'],
    legal: [`${web}/privacy`, `${web}/terms`, `${web}/cookies`],
  },
} as const;

/** Anclas de las secciones: iguales en todos los idiomas para que el selector de idioma mantenga la posición. */
export const sections = {
  features: 'features',
  how: 'how-it-works',
  pricing: 'pricing',
  faq: 'faq',
} as const;
