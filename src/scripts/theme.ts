/**
 * Tema claro/oscuro. El script en línea del <head> ya fijó <html data-theme> antes de pintar
 * (preferencia guardada o, si no hay, la del sistema). Aquí se conectan los interruptores,
 * se guarda la elección y se sigue al sistema mientras el usuario no elija.
 */
import { reducedMotion } from './gsap';

type Theme = 'light' | 'dark';
const KEY = 'kiln-theme';
const root = document.documentElement;
const system = window.matchMedia('(prefers-color-scheme: dark)');

function stored(): Theme | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function apply(theme: Theme) {
  root.dataset.theme = theme;
  document.querySelectorAll<HTMLButtonElement>('[data-theme-value]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.themeValue === theme));
  });
  // La barra del navegador en móvil sigue al tema elegido, no solo al del sistema.
  document.querySelectorAll<HTMLMetaElement>('meta[data-theme-color]').forEach((meta) => {
    meta.media = meta.dataset.themeColor === theme ? 'all' : 'not all';
  });
}

function choose(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* almacenamiento bloqueado: el cambio vale para esta visita */
  }
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !reducedMotion() && root.dataset.theme !== theme) {
    doc.startViewTransition(() => apply(theme));
  } else {
    apply(theme);
  }
}

export function initTheme() {
  apply((root.dataset.theme as Theme) || (system.matches ? 'dark' : 'light'));
  document.querySelectorAll<HTMLButtonElement>('[data-theme-value]').forEach((button) => {
    button.addEventListener('click', () => choose(button.dataset.themeValue as Theme));
  });
  system.addEventListener('change', (event) => {
    if (!stored()) apply(event.matches ? 'dark' : 'light');
  });
}
