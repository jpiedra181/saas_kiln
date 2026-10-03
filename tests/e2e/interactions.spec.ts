import { expect, test, type Page } from '@playwright/test';

const desktop = { width: 1440, height: 900 };
const mobile = { width: 390, height: 844 };

async function open(page: Page, path = '/', viewport = desktop) {
  await page.setViewportSize(viewport);
  await page.goto(path);
}

test.describe('Tema claro/oscuro', () => {
  test('sigue a prefers-color-scheme si no hay elección', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await open(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('el interruptor cambia el tema, lo recuerda y no parpadea al recargar', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await open(page);
    const dark = page.locator('header').getByRole('button', { name: 'Tema oscuro' });
    await dark.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(dark).toHaveAttribute('aria-pressed', 'true');

    // Al recargar, el tema ya está aplicado en el primer instante del documento (script en el <head>).
    await page.addInitScript(() => {
      document.addEventListener('readystatechange', () => {
        if (document.readyState === 'interactive')
          (window as unknown as { __early: string }).__early = document.documentElement.dataset.theme ?? '';
      });
    });
    await page.reload();
    const early = await page.evaluate(() => (window as unknown as { __early: string }).__early);
    expect(early).toBe('dark');
    const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    expect(bg).toBe('rgb(21, 18, 14)'); // bg/canvas en Dark (sand/950)
  });
});

test.describe('Idiomas', () => {
  test('ES en / y EN en /en/ con lang y hreflang', async ({ page }) => {
    await open(page, '/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.locator('link[rel=alternate][hreflang=en]')).toHaveAttribute('href', /\/en\/$/);
    await expect(page.locator('link[rel=alternate][hreflang=x-default]')).toHaveAttribute('href', /\/$/);
    await open(page, '/en/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stop chasing emails. Start designing.');
  });

  test('el selector cambia de idioma manteniendo la sección', async ({ page }) => {
    await open(page, '/#pricing');
    const switcher = page.locator('header [data-lang-switcher]').first();
    await switcher.getByRole('button').click();
    await expect(switcher.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    await switcher.getByRole('link', { name: 'English' }).click();
    await expect(page).toHaveURL(/\/en\/#pricing$/);
  });

  test('la lista de idiomas se cierra con Escape y devuelve el foco', async ({ page }) => {
    await open(page);
    const button = page.locator('header [data-lang-toggle]').first();
    await button.click();
    await page.keyboard.press('Escape');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toBeFocused();
  });
});

test.describe('Precios', () => {
  test('el interruptor mensual/anual cambia precios y lo anuncia', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    const toggle = page.getByRole('switch', { name: 'Facturación anual' });
    const studio = page.locator('#plan-studio').locator('xpath=ancestor::article').locator('[data-price]').first();
    await expect(studio).toHaveText('39 €');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(studio).toHaveText('31 €');
    await expect(page.locator('[data-billing-status]')).toHaveText('Mostrando precios con facturación anual');
    await toggle.press('Space');
    await expect(studio).toHaveText('39 €');
  });
});

test.describe('FAQ', () => {
  test('acordeón accesible: la primera abierta, el resto se abre con teclado', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    const items = page.locator('details[data-faq]');
    await expect(items.nth(0)).toHaveAttribute('open', '');
    await expect(items.nth(1)).not.toHaveAttribute('open', '');
    await items.nth(1).locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(items.nth(1)).toHaveAttribute('open', '');
    await expect(items.nth(1).getByText('Desde el plan Estudio')).toBeVisible();
  });
});

test.describe('Menú móvil', () => {
  test('atrapa el foco, se cierra con Escape y devuelve el foco', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/', mobile);
    const opener = page.getByRole('button', { name: 'Abrir menú' });
    await opener.click();
    const dialog = page.locator('#mobile-menu');
    await expect(dialog).toHaveAttribute('open', '');
    await expect(opener).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: 'Cerrar menú' })).toBeFocused();

    for (let i = 0; i < 25; i++) {
      await page.keyboard.press(i % 7 === 6 ? 'Shift+Tab' : 'Tab');
      const inside = await page.evaluate(() =>
        document.getElementById('mobile-menu')!.contains(document.activeElement),
      );
      expect(inside).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).not.toHaveAttribute('open', '');
    await expect(opener).toHaveAttribute('aria-expanded', 'false');
    await expect(opener).toBeFocused();
  });

  test('un enlace del menú cierra el menú y lleva a la sección', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/', mobile);
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    await page.locator('#mobile-menu').getByRole('link', { name: 'Precios' }).click();
    await expect(page.locator('#mobile-menu')).not.toHaveAttribute('open', '');
    await expect(page).toHaveURL(/#pricing$/);
    await expect(page.locator('#pricing')).toBeFocused();
  });
});

test.describe('Teclado y foco', () => {
  test('el primer Tab muestra el enlace para saltar al contenido', async ({ page }) => {
    await open(page);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Saltar al contenido' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });

  test('el foco es visible en botones y enlaces', async ({ page }) => {
    await open(page);
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    expect(outline.style).toBe('solid');
    expect(outline.width).toBeGreaterThanOrEqual(2);
  });
});

test.describe('Movimiento reducido', () => {
  test('sin animaciones: todo el contenido es visible desde el inicio', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await expect(page.locator('html')).not.toHaveClass(/motion/);
    const hidden = await page.$$eval(
      '[data-reveal], [data-hero-item]',
      (els) => els.filter((el) => getComputedStyle(el).opacity !== '1').length,
    );
    expect(hidden).toBe(0);
  });

  test('con animaciones: tras la entrada, el contenido visible llega a opacidad 1', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open(page);
    await expect(page.locator('html')).toHaveClass(/motion/);
    await page.waitForTimeout(2500);
    const heroHidden = await page.$$eval(
      '[data-hero-item]',
      (els) => els.filter((el) => getComputedStyle(el).opacity !== '1').length,
    );
    expect(heroHidden).toBe(0);
  });
});

test('con animaciones: al recorrer la página todo lo animado termina visible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page, '/', mobile);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 500) {
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(1500);
  const hidden = await page.$$eval(
    '[data-reveal]',
    (els) => els.filter((el) => getComputedStyle(el).opacity !== '1').length,
  );
  expect(hidden).toBe(0);
});

test('sin scroll horizontal en 320 px', async ({ page }) => {
  await open(page, '/', { width: 320, height: 700 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
