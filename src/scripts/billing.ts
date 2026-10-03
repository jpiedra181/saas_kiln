/**
 * Facturación mensual/anual: alterna los precios y las notas de las tarjetas (price-monthly / price-annual
 * de Figma) y lo anuncia a los lectores de pantalla. Las etiquetas "Mensual" y "Anual" también son clicables.
 */
import { gsapNow } from './gsap';

export function initBilling() {
  const root = document.querySelector<HTMLElement>('[data-billing]');
  if (!root) return;
  const toggle = root.querySelector<HTMLButtonElement>('[data-billing-switch]')!;
  const status = root.querySelector<HTMLElement>('[data-billing-status]')!;
  const prices = Array.from(document.querySelectorAll<HTMLElement>('[data-price]'));

  function set(annual: boolean) {
    if (toggle.getAttribute('aria-checked') === String(annual)) return;
    toggle.setAttribute('aria-checked', String(annual));
    status.textContent = (annual ? status.dataset.annual : status.dataset.monthly) ?? '';
    const gsap = gsapNow();
    for (const el of prices) {
      const next = (annual ? el.dataset.annual : el.dataset.monthly) ?? '';
      if (el.textContent?.trim() === next) continue;
      if (gsap) {
        gsap
          .timeline()
          .to(el, { yPercent: -30, autoAlpha: 0, duration: 0.15, ease: 'power2.in' })
          .add(() => {
            el.textContent = next;
          })
          .fromTo(el, { yPercent: 30 }, { yPercent: 0, autoAlpha: 1, duration: 0.25, ease: 'power2.out' });
      } else {
        el.textContent = next;
      }
    }
  }

  toggle.addEventListener('click', () => set(toggle.getAttribute('aria-checked') !== 'true'));
  root.querySelector('[data-billing-period="monthly"]')?.addEventListener('click', () => set(false));
  root.querySelector('[data-billing-period="annual"]')?.addEventListener('click', () => set(true));
}
