// The whole customer story, end to end.
import { test, expect } from '../../fixtures/test.js';

test('a customer adjusts the cart, reviews the summary and places the order', async ({ cartPage, checkoutPage, storage }) => {
  await test.step('review the cart', async () => {
    await cartPage.goto();
    await cartPage.expectContents({ keyboard: 1, mouse: 1 });
  });

  await test.step('add two more mice', async () => {
    await cartPage.increase('mouse', 2);
    await cartPage.expectContents({ keyboard: 1, mouse: 3 });
  });

  await test.step('check the order summary', async () => {
    await cartPage.proceedToCheckout();
    await checkoutPage.expectSummary({ keyboard: 1, mouse: 3 });
  });

  await test.step('place the order', async () => {
    await checkoutPage.placeOrder();
    await checkoutPage.expectConfirmed();
    expect(await storage.orderCount()).toBe(1);
  });

  await test.step('the cart is now empty', async () => {
    await checkoutPage.backToCart();
    await cartPage.expectEmpty();
  });
});
