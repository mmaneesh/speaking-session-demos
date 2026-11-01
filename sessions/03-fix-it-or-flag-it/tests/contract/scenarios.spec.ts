// Guards the demo itself: each scenario changes exactly one thing, and scenarios 2 and 3 are twins.
// If this fails, the session's comparison is no longer honest.
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../../fixtures/test.js';
import type { CartPage } from '../../pages/CartPage.js';
import type { CheckoutPage } from '../../pages/CheckoutPage.js';

async function observe(cartPage: CartPage, checkoutPage: CheckoutPage, query: string) {
  await cartPage.goto(query);
  const cartSubtotal = await cartPage.subtotal.textContent();
  // Located by role, so we can read whatever test id the button currently carries.
  const proceedTestId = await cartPage.proceedButton.getAttribute('data-testid');
  await cartPage.proceedToCheckout();
  return {
    cartSubtotal,
    proceedTestId,
    placeOrderTestId: await checkoutPage.placeOrderButton.getAttribute('data-testid'),
    subtotal: await checkoutPage.subtotal.textContent(),
    shipping: await checkoutPage.shipping.textContent(),
    total: await checkoutPage.total.textContent(),
  };
}

test.describe('Scenario behaviour', () => {
  test('each scenario differs from the baseline in exactly one way', async ({ cartPage, checkoutPage }) => {
    const seen = (query: string) => observe(cartPage, checkoutPage, query);
    const base = await seen('');
    expect(base).toMatchObject({ proceedTestId: 'checkout-btn', placeOrderTestId: 'place-order-btn', shipping: '$4.99', total: '$104.99' });

    expect(await seen('?scenario=1')).toEqual({ ...base, proceedTestId: 'proceed-to-checkout-btn' });
    const s2 = await seen('?scenario=2');
    expect(s2).toEqual({ ...base, shipping: '$5.00', total: '$105.00' });
    expect(await seen('?scenario=3')).toEqual(s2);
    // Scenario 4: the total is wrong by itself, no action needed to see it (unlike 1/2/3, nothing else changes).
    expect(await seen('?scenario=4')).toEqual({ ...base, total: '$94.99' });
  });

  test('an unknown scenario value is ignored', async ({ cartPage, checkoutPage }) => {
    const base = await observe(cartPage, checkoutPage, '');
    expect(await observe(cartPage, checkoutPage, '?scenario=99')).toEqual(base);
  });

  test('the scenario survives the redirect and the move between views', async ({ page, cartPage, checkoutPage }) => {
    await page.goto('/?scenario=2');
    await expect(page).toHaveURL(/\/cart\?scenario=2$/);
    await cartPage.proceedToCheckout();
    await expect(page).toHaveURL(/\/checkout\?scenario=2$/);
    await expect(checkoutPage.shipping).toHaveText('$5.00');
  });
});

test.describe('Scenario files', () => {
  const dirs = ['01', '02', '03', '04'];
  const baseline = (dir: string) => fs.readFileSync(path.join('scenarios', dir, 'test.spec.ts.baseline'), 'utf-8');

  test('scenario 2 and 3 tests differ only in the scenario number', () => {
    expect(baseline(dirs[1]).replace('scenario=2', 'scenario=3')).toBe(baseline(dirs[2]));
  });

  test('each baseline has the number of assertions its answer key states', () => {
    for (const dir of dirs) {
      const key = JSON.parse(fs.readFileSync(path.join('scenarios', dir, 'answer-key.json'), 'utf-8')) as { baselineAssertionCount: number };
      expect(baseline(dir).match(/expect\(/g)?.length, dir).toBe(key.baselineAssertionCount);
    }
  });

  test('the test files give the AI no hint of the right call', () => {
    for (const dir of dirs) expect(baseline(dir), dir).not.toMatch(/stale|drift|changelog|real.?bug|document|FIX|FLAG|ASK/i);
  });

  test('the v2.3 shipping entry exists only as scenario 2 material; older entries state no amounts', () => {
    const entry = fs.readFileSync(path.join('scenarios', dirs[1], 'changelog-entry.md'), 'utf-8');
    expect(entry).toMatch(/^## v2\.3\b/);
    expect(entry).toContain('Flat-rate shipping is now $5.00');

    // Whatever state CHANGELOG.md is in, once v2.3 is removed no release may mention a shipping amount:
    // an old "$4.99" would turn scenario 3 from "ask" into "the app regressed".
    const withoutV23 = fs.readFileSync('CHANGELOG.md', 'utf-8').replace(/^## v2\.3\b[\s\S]*?(?=^## |(?![\s\S]))/m, '');
    expect(withoutV23).not.toMatch(/\$\d/);
  });

  test('scenario tests are self-contained: they import only Playwright', () => {
    for (const dir of dirs) {
      expect(baseline(dir).match(/^import .+$/gm), dir).toEqual(["import { test, expect } from '@playwright/test';"]);
    }
  });
});
