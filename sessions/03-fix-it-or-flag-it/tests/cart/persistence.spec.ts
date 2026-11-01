// SPEC 7 (the cart survives navigation and reload; cancelling changes nothing).
import { test, expect } from '../../fixtures/test.js';
import { DEFAULT_CART } from '../../fixtures/data.js';

test.describe('Cart: persistence and cancel', () => {
  test('survives a reload', async ({ cartPage }) => {
    await cartPage.goto();
    await cartPage.increase('keyboard');
    await cartPage.remove('mouse');
    await cartPage.page.reload();
    await cartPage.expectContents({ keyboard: 2 });
  });

  test('cancelling keeps the cart and stays on the cart', async ({ cartPage }) => {
    await cartPage.goto();
    await cartPage.cancelButton.click();
    await expect(cartPage.cancelNotice).toBeVisible();
    await expect(cartPage.page).toHaveURL(/\/cart/);
    await cartPage.expectContents(DEFAULT_CART);
  });

  test('stored quantities above stock are capped and invalid ones dropped', async ({ cartPage, storage }) => {
    await storage.seedRaw('{"keyboard":999,"mouse":-3}');
    await cartPage.goto();
    await cartPage.expectContents({ keyboard: 10 });
  });

  test('unreadable stored data falls back to the sample cart', async ({ cartPage, storage }) => {
    await storage.seedRaw('this is not json');
    await cartPage.goto();
    await cartPage.expectContents(DEFAULT_CART);
  });
});
