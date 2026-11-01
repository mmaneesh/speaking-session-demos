// SPEC 2 (flat shipping), 3 (Total = Subtotal + Shipping), 8 (summary matches the cart).
import { test, expect } from '../../fixtures/test.js';
import { DEFAULT_CART, STOCK, type Cart } from '../../fixtures/data.js';

test.describe('Checkout: summary', () => {
  test('the default cart totals $104.99', async ({ cartPage, checkoutPage }) => {
    await cartPage.goto();
    await cartPage.proceedToCheckout();
    await checkoutPage.expectSummary(DEFAULT_CART);
    await expect(checkoutPage.total).toHaveText('$104.99');
  });

  const carts: Array<[string, Cart]> = [
    ['only a mouse', { mouse: 1 }],
    ['mixed quantities', { keyboard: 3, mouse: 2 }],
    ['full stock of everything (shipping stays flat)', { keyboard: STOCK, mouse: STOCK }],
  ];
  for (const [name, cart] of carts) {
    test(`matches the cart and adds up: ${name}`, async ({ cartPage, checkoutPage, storage }) => {
      await storage.seedCart(cart);
      await cartPage.goto();
      await cartPage.proceedToCheckout();
      await checkoutPage.expectSummary(cart);
    });
  }

  test('an item removed from the cart is not in the summary', async ({ cartPage, checkoutPage }) => {
    await cartPage.goto();
    await cartPage.remove('keyboard');
    await cartPage.proceedToCheckout();
    await expect(checkoutPage.lineLabel('keyboard')).toHaveCount(0);
    await checkoutPage.expectSummary({ mouse: 1 });
  });

  test('shows the shipping address, delivery method and payment method', async ({ cartPage, checkoutPage }) => {
    await cartPage.goto();
    await cartPage.proceedToCheckout();
    await expect(checkoutPage.shippingAddress).toContainText('742 Evergreen Terrace');
    await expect(checkoutPage.deliveryMethod).toContainText('Flat-Rate Shipping');
    await expect(checkoutPage.paymentMethod).toContainText('4242');
  });
});
