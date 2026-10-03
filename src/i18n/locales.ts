/** Datos de idioma sin diccionarios: se pueden importar desde el navegador sin arrastrar los textos. */
export const locales = ['es', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'es';

/** Locale BCP 47 para <html lang> y para Intl. */
export const htmlLang: Record<Locale, string> = { es: 'es', en: 'en' };
export const intlLocale: Record<Locale, string> = { es: 'es-ES', en: 'en-GB' };
