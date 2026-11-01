// SPEC 4 (placing the order confirms it), 9 (empty cart cannot be checked out), 10 (placed at most once).
import { test, expect } from '../../fixtures/test.js';

test.describe('Checkout: placing the order', () => {
  test('confirms with an order number, locks the button and empties the cart', async ({ cartPage, checkoutPage, storage }) => {
    await cartPage.goto();
    await cartPage.proceedToCheckout();
    await checkoutPage.placeOrder();
    await checkoutPage.expectConfirmed();
    expect(await storage.orderCount()).toBe(1);

    await checkoutPage.backToCart();
    await cartPage.expectEmpty();
  });

  test('a double click places exactly one order', async ({ cartPage, checkoutPage, storage }) => {
    await cartPage.goto();
    await cartPage.proceedToCheckout();
    await checkoutPage.placeOrderButton.dblclick();
    await checkoutPage.expectConfirmed();
    expect(await storage.orderCount()).toBe(1);
  });

  test('reloading after the order does not place another', async ({ cartPage, checkoutPage, storage }) => {
    await cartPage.goto();
    await cartPage.proceedToCheckout();
    await checkoutPage.placeOrder();
    await checkoutPage.page.reload();
    await cartPage.expectEmpty();
    expect(await storage.orderCount()).toBe(1);
  });

  test('browser back after the order shows an empty cart, not the old one', async ({ cartPage, checkoutPage }) => {
    await cartPage.goto();
    await cartPage.proceedToCheckout();
    await checkoutPage.placeOrder();
    await checkoutPage.page.goBack();
    await cartPage.expectEmpty();
  });

  test('a second purchase starts from a clean checkout', async ({ cartPage, checkoutPage, storage }) => {
    await cartPage.goto();
    await cartPage.proceedToCheckout();
    await checkoutPage.placeOrder();
    await checkoutPage.backToCart();
    await cartPage.restoreButton.click();
    await cartPage.proceedToCheckout();

    await expect(checkoutPage.confirmation).toBeHidden();
    await expect(checkoutPage.placeOrderButton).toBeEnabled();
    await checkoutPage.placeOrder();
    await checkoutPage.expectConfirmed();
    expect(await storage.orderCount()).toBe(2);
  });

  test('if the cart was emptied underneath, no order is placed and the customer returns to the cart', async ({ cartPage, checkoutPage, storage }) => {
    await cartPage.goto();
    await cartPage.proceedToCheckout();
    await storage.changeCartNow({});
    await checkoutPage.placeOrder();
    await expect(cartPage.page).toHaveURL(/\/cart/);
    await cartPage.expectEmpty();
    expect(await storage.orderCount()).toBe(0);
  });

  test('if the cart changed after the total was shown, the order waits for the customer to review it', async ({ cartPage, checkoutPage, storage }) => {
    await cartPage.goto();
    await cartPage.proceedToCheckout();
    await storage.changeCartNow({ keyboard: 2, mouse: 1 });

    await checkoutPage.placeOrder();
    await expect(checkoutPage.changedNotice).toBeVisible();
    await checkoutPage.expectSummary({ keyboard: 2, mouse: 1 });
    expect(await storage.orderCount()).toBe(0);

    await checkoutPage.placeOrder();
    await checkoutPage.expectConfirmed();
    expect(await storage.orderCount()).toBe(1);
  });
});
