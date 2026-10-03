/**
 * Carga diferida de GSAP: solo se descarga si el usuario no pide movimiento reducido.
 * Las interacciones (menú, FAQ, precios) funcionan igual sin GSAP; con él, se animan.
 */
import type { gsap as GsapInstance } from 'gsap';

export type Gsap = typeof GsapInstance;

export const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let instance: Gsap | null = null;
let loading: Promise<Gsap | null> | null = null;

export function loadGsap(): Promise<Gsap | null> {
  if (reducedMotion()) return Promise.resolve(null);
  loading ??= import('gsap').then((m) => (instance = m.gsap)).catch(() => null);
  return loading;
}

/** GSAP si ya está cargado y se permite movimiento; para decidir en un evento sin esperar. */
export function gsapNow(): Gsap | null {
  return reducedMotion() ? null : instance;
}
