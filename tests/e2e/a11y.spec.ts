import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** Auditoría automática WCAG 2.2 AA con axe-core en todas las combinaciones de idioma, tema y tamaño. */
const cases = [
  { path: '/', theme: 'light' },
  { path: '/', theme: 'dark' },
  { path: '/en/', theme: 'light' },
  { path: '/en/', theme: 'dark' },
] as const;
const viewports = [
  { name: 'móvil', width: 390, height: 844 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'escritorio', width: 1440, height: 900 },
];

for (const { path, theme } of cases) {
  for (const viewport of viewports) {
    test(`axe sin infracciones · ${path} · ${theme} · ${viewport.name}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
      await page.setViewportSize(viewport);
      await page.addInitScript((t) => localStorage.setItem('kiln-theme', t), theme);
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .analyze();
      const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
      expect(summary).toEqual([]);
    });
  }
}

test('axe sin infracciones con el menú móvil abierto', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  const results = await new AxeBuilder({ page })
    .include('#mobile-menu')
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});
