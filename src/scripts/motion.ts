/**
 * Animaciones de entrada con GSAP + ScrollTrigger. Solo se carga si no se pide movimiento reducido.
 * Todo usa transform/opacity: no mueve el layout (CLS 0) y el titular del hero no se oculta (no retrasa el LCP).
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { intlLocale, type Locale } from '../i18n/locales';

declare global {
  interface Window {
    __kilnMotion?: boolean;
  }
}

const ease = 'power3.out';

/** Cuenta desde 0 hasta el valor de un KPI respetando el formato del idioma ("12.480 €" / "€12,480"). */
function countUp(el: HTMLElement, locale: Locale) {
  const original = el.textContent ?? '';
  const digits = original.replace(/[^\d]/g, '');
  if (!digits) return;
  const target = Number(digits);
  const format = new Intl.NumberFormat(intlLocale[locale], { useGrouping: true });
  const pattern = original.replace(/[\d.,]+/, '#');
  const state = { value: 0 };
  gsap.to(state, {
    value: target,
    duration: 1.4,
    ease: 'power2.out',
    onUpdate: () => {
      el.textContent = pattern.replace('#', format.format(Math.round(state.value)));
    },
    onComplete: () => {
      el.textContent = original;
    },
  });
}

export function initMotion() {
  gsap.registerPlugin(ScrollTrigger);
  window.__kilnMotion = true;
  const locale = (document.documentElement.lang === 'en' ? 'en' : 'es') as Locale;

  // Hero: entrada al cargar.
  const hero = gsap.timeline({ defaults: { ease, duration: 0.8 } });
  hero
    .from('[data-hero-title]', { y: 24, duration: 1 }, 0)
    .fromTo('[data-hero-item]', { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, stagger: 0.08 }, 0.1)
    .fromTo(
      '[data-hero-arch]',
      { autoAlpha: 0, scale: 0.85, transformOrigin: '50% 100%' },
      { autoAlpha: 1, scale: 1, duration: 1.2 },
      0.2,
    )
    .fromTo('[data-hero-media] > [role="img"]', { autoAlpha: 0, y: 48 }, { autoAlpha: 1, y: 0, duration: 1.1 }, 0.35)
    .add(
      () =>
        document
          .querySelectorAll<HTMLElement>('[data-hero-media] [data-count-up]')
          .forEach((el) => countUp(el, locale)),
      0.6,
    )
    .fromTo(
      '[data-hero-toast]',
      { autoAlpha: 0, y: 16, scale: 0.94 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: 'back.out(1.6)' },
      1.1,
    );

  // Apariciones al hacer scroll: cabeceras, tarjetas, textos.
  gsap.set('[data-reveal]', { y: 24 });
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%',
    once: true,
    onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08, ease, overwrite: true }),
  });

  // Mockups de Funciones: el arco crece, la tarjeta sube y los avisos aparecen; ligero parallax al hacer scroll.
  gsap.utils.toArray<HTMLElement>('[data-mockup]').forEach((frame) => {
    const card = frame.querySelector<HTMLElement>('.mockup-card');
    const pops = frame.querySelectorAll<HTMLElement>('[data-mockup-pop]');
    const tl = gsap.timeline({ scrollTrigger: { trigger: frame, start: 'top 85%', once: true }, defaults: { ease } });
    tl.from(frame, { autoAlpha: 0, scale: 0.94, transformOrigin: '50% 100%', duration: 1 });
    if (card) tl.from(card, { autoAlpha: 0, y: 56, duration: 0.9 }, 0.15);
    if (pops.length)
      tl.from(pops, { autoAlpha: 0, y: 12, scale: 0.95, duration: 0.5, stagger: 0.15, ease: 'back.out(1.7)' }, 0.7);
    if (card) {
      gsap.to(card, {
        yPercent: -4,
        ease: 'none',
        scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    }
  });

  // CTA: los arcos suben desde el borde del panel.
  gsap.from('[data-cta-arch]', {
    yPercent: 45,
    duration: 1.2,
    stagger: 0.15,
    ease,
    scrollTrigger: { trigger: '[data-cta-panel]', start: 'top 80%', once: true },
  });

  // Si las fuentes cambian alturas tras cargar, se recalculan los disparadores.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
