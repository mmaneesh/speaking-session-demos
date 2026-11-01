// SPEC 7 (state across navigation), 9 (empty cart cannot be checked out).
import { test, expect } from '../../fixtures/test.js';
import { DEFAULT_CART } from '../../fixtures/data.js';

test.describe('Checkout: navigation', () => {
  test('back to cart keeps the quantities', async ({ cartPage, checkoutPage, storage }) => {
    await storage.seedCart({ keyboard: 4, mouse: 1 });
    await cartPage.goto();
    await cartPage.proceedToCheckout();
    await checkoutPage.backToCart();
    await cartPage.expectContents({ keyboard: 4, mouse: 1 });
  });

  test('browser back and forward move between the views and keep state', async ({ cartPage, checkoutPage }) => {
    await cartPage.goto();
    await cartPage.increase('keyboard');
    await cartPage.proceedToCheckout();

    await cartPage.page.goBack();
    await cartPage.expectContents({ keyboard: 2, mouse: 1 });
    await cartPage.page.goForward();
    await checkoutPage.expectSummary({ keyboard: 2, mouse: 1 });
  });

  test('the checkout URL can be reloaded', async ({ cartPage, checkoutPage, storage }) => {
    await storage.seedCart({ keyboard: 2, mouse: 1 });
    await cartPage.goto();
    await cartPage.proceedToCheckout();
    await checkoutPage.page.reload();
    await checkoutPage.expectSummary({ keyboard: 2, mouse: 1 });
  });

  test('a first visit straight to /checkout shows the sample cart', async ({ checkoutPage }) => {
    await checkoutPage.goto();
    await checkoutPage.expectSummary(DEFAULT_CART);
  });

  test('checkout with an empty cart sends the customer back to the cart', async ({ cartPage, page, storage }) => {
    await storage.seedCart({});
    await page.goto('/checkout');
    await expect(page).toHaveURL(/\/cart$/);
    await cartPage.expectEmpty();
  });

  test('the front door redirects to the cart', async ({ cartPage, page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/cart$/);
    await expect(cartPage.heading).toBeVisible();
  });
});
