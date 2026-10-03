/**
 * Acordeón del FAQ: <details> nativo (teclado, lector de pantalla y búsqueda en la página funcionan solos).
 * Con GSAP disponible, la respuesta se despliega y se recoge animando la altura.
 */
import { gsapNow } from './gsap';

export function initFaq() {
  document.querySelectorAll<HTMLDetailsElement>('details[data-faq]').forEach((details) => {
    const summary = details.querySelector('summary')!;
    const answer = details.querySelector<HTMLElement>('[data-faq-answer]')!;
    let animating = false;

    summary.addEventListener('click', (event) => {
      const gsap = gsapNow();
      if (!gsap) return; // sin animación: comportamiento nativo
      event.preventDefault();
      if (animating) return;
      animating = true;
      if (details.open) {
        gsap.to(answer, {
          height: 0,
          autoAlpha: 0,
          duration: 0.3,
          ease: 'power2.inOut',
          onComplete: () => {
            details.open = false;
            gsap.set(answer, { clearProps: 'height,opacity,visibility' });
            animating = false;
          },
        });
      } else {
        details.open = true;
        gsap.fromTo(
          answer,
          { height: 0, autoAlpha: 0 },
          {
            height: 'auto',
            autoAlpha: 1,
            duration: 0.35,
            ease: 'power2.out',
            onComplete: () => {
              gsap.set(answer, { clearProps: 'height,opacity,visibility' });
              animating = false;
            },
          },
        );
      }
    });
  });
}
