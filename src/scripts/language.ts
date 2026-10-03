/**
 * Selector de idioma: abre/cierra la lista, se cierra con Escape, clic fuera o al salir del foco,
 * y al cambiar de idioma conserva el ancla en la que estabas (p. ej. /en/#pricing).
 */
import { gsapNow } from './gsap';

function setOpen(root: HTMLElement, open: boolean, focusButton = false) {
  const button = root.querySelector<HTMLButtonElement>('[data-lang-toggle]')!;
  const list = root.querySelector<HTMLElement>('[data-lang-list]')!;
  if (open === (button.getAttribute('aria-expanded') === 'true')) return;
  button.setAttribute('aria-expanded', String(open));
  list.hidden = !open;
  const gsap = gsapNow();
  if (open && gsap)
    gsap.fromTo(list, { autoAlpha: 0, y: -6 }, { autoAlpha: 1, y: 0, duration: 0.2, ease: 'power2.out' });
  if (!open && focusButton) button.focus();
}

export function initLanguage() {
  const switchers = Array.from(document.querySelectorAll<HTMLElement>('[data-lang-switcher]'));
  for (const root of switchers) {
    const button = root.querySelector<HTMLButtonElement>('[data-lang-toggle]')!;
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      switchers.forEach((other) => other !== root && setOpen(other, false));
      setOpen(root, open);
    });
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
        event.stopPropagation(); // no cerrar también el menú móvil
        event.preventDefault();
        setOpen(root, false, true);
      }
    });
    root.addEventListener('focusout', (event) => {
      if (!root.contains(event.relatedTarget as Node | null)) setOpen(root, false);
    });
    root.querySelectorAll<HTMLAnchorElement>('[data-lang-link]').forEach((link) => {
      link.addEventListener('click', () => {
        if (location.hash) link.href = link.href.split('#')[0] + location.hash;
      });
    });
  }
  document.addEventListener('click', (event) => {
    switchers.forEach((root) => {
      if (!root.contains(event.target as Node)) setOpen(root, false);
    });
  });
}
