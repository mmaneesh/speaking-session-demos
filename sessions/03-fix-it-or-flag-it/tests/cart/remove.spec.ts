// SPEC 6 (remove an item), 9 (an empty cart cannot be checked out).
import { test, expect } from '../../fixtures/test.js';
import { DEFAULT_CART } from '../../fixtures/data.js';

test.describe('Cart: removing items and the empty cart', () => {
  test('removing an item takes it out and updates the subtotal', async ({ cartPage }) => {
    await cartPage.goto();
    await cartPage.remove('keyboard');
    await cartPage.expectContents({ mouse: 1 });
  });

  test('removing an item with a raised quantity removes the whole line', async ({ cartPage, storage }) => {
    await storage.seedCart({ keyboard: 4, mouse: 1 });
    await cartPage.goto();
    await cartPage.remove('keyboard');
    await cartPage.expectContents({ mouse: 1 });
  });

  test('removing the last item shows the empty state and blocks checkout', async ({ cartPage }) => {
    await cartPage.goto();
    await cartPage.remove('keyboard');
    await cartPage.remove('mouse');
    await cartPage.expectEmpty();
    await expect(cartPage.heading).toHaveText('Your Shopping Cart (0 Items)');
  });

  test('restoring the sample items brings the default cart back', async ({ cartPage }) => {
    await cartPage.goto();
    await cartPage.remove('keyboard');
    await cartPage.remove('mouse');
    await cartPage.restoreButton.click();
    await cartPage.expectContents(DEFAULT_CART);
    await expect(cartPage.proceedButton).toBeEnabled();
  });
});
