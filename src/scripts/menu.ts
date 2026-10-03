/**
 * Menú móvil ("Mobile open" en Figma) sobre un <dialog> modal:
 * - el resto de la página queda inerte y el foco no puede salir del menú (trampa de foco explícita),
 * - Escape, el botón de cerrar o un clic en el fondo lo cierran,
 * - al cerrar, el foco vuelve al botón que lo abrió.
 */
import { gsapNow } from './gsap';

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function initMenu() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-menu]');
  const opener = document.querySelector<HTMLButtonElement>('[data-menu-open]');
  if (!dialog || !opener) return;
  const panel = dialog.querySelector<HTMLElement>('[data-menu-panel]')!;
  const closer = dialog.querySelector<HTMLButtonElement>('[data-menu-close]')!;
  // Mismo breakpoint que Tailwind (--breakpoint-lg, generado desde tokens).
  const lg = getComputedStyle(document.documentElement).getPropertyValue('--breakpoint-lg').trim() || '75rem';
  const desktop = window.matchMedia(`(min-width: ${lg})`);
  let closing = false;

  const focusables = () =>
    Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );

  function open() {
    if (dialog!.open) return;
    dialog!.showModal();
    document.documentElement.style.overflow = 'hidden';
    opener!.setAttribute('aria-expanded', 'true');
    closer.focus();
    const gsap = gsapNow();
    if (gsap) {
      gsap.fromTo(
        panel,
        { yPercent: -8, autoAlpha: 0 },
        { yPercent: 0, autoAlpha: 1, duration: 0.35, ease: 'power3.out' },
      );
      gsap.fromTo(
        dialog!.querySelectorAll('[data-menu-item]'),
        { y: -8, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.3, stagger: 0.04, delay: 0.08, ease: 'power2.out' },
      );
    }
  }

  function finish(afterClose?: () => void) {
    dialog!.close();
    document.documentElement.style.overflow = '';
    opener!.setAttribute('aria-expanded', 'false');
    closing = false;
    if (afterClose) afterClose();
    else opener!.focus();
  }

  function close(afterClose?: () => void) {
    if (!dialog!.open || closing) return;
    closing = true;
    const gsap = gsapNow();
    if (gsap && !afterClose) {
      gsap.to(panel, { yPercent: -6, autoAlpha: 0, duration: 0.22, ease: 'power2.in', onComplete: () => finish() });
    } else {
      finish(afterClose);
    }
  }

  opener.addEventListener('click', open);
  closer.addEventListener('click', () => close());

  // Escape: el evento "cancel" del diálogo; se anima el cierre en lugar del cierre instantáneo.
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });

  // Clic en el fondo (fuera del panel).
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  // Trampa de foco: Tab y Mayús+Tab dan la vuelta dentro del menú.
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const items = focusables();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  // Enlaces a secciones: cerrar y luego ir al ancla (con el foco en la sección de destino).
  dialog.querySelectorAll<HTMLAnchorElement>('[data-menu-link]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const hash = link.hash;
      const target = hash ? document.querySelector<HTMLElement>(hash) : null;
      if (!target) return;
      event.preventDefault();
      close(() => {
        history.pushState(null, '', hash);
        target.scrollIntoView({ behavior: gsapNow() ? 'smooth' : 'auto' });
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      });
    });
  });

  // Si la ventana pasa a escritorio con el menú abierto, se cierra.
  desktop.addEventListener('change', (event) => {
    if (event.matches) close(() => opener!.blur());
  });
}
