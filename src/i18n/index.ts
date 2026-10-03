import esFigma from './figma/es.json';
import enFigma from './figma/en.json';
import esSite from './site/es.json';
import enSite from './site/en.json';
import { defaultLocale, type Locale } from './locales';

export { defaultLocale, htmlLang, intlLocale, locales, type Locale } from './locales';

/** Textos de Figma (colección Language, generados) + textos propios del sitio (accesibilidad, 404…). */
const dictionaries = {
  es: { ...esFigma, ...esSite },
  en: { ...enFigma, ...enSite } satisfies Record<keyof typeof esFigma | keyof typeof esSite, string>,
};

export type TranslationKey = keyof (typeof dictionaries)['es'];

export function useTranslations(locale: Locale) {
  return (key: TranslationKey): string => dictionaries[locale][key];
}

/** Ruta de una página en otro idioma: ES en la raíz, el resto con prefijo (/en/…). */
export function localizedPath(path: string, locale: Locale): string {
  const clean = path.replace(/^\/(en)(?=\/|$)/, '') || '/';
  const withSlash = clean.endsWith('/') ? clean : `${clean}/`;
  return locale === defaultLocale ? withSlash : `/${locale}${withSlash}`;
}
