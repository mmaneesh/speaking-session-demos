import { test, expect } from '@playwright/test';

test('checkout shows the subtotal, shipping and order total', async ({ page }) => {
  // Given a customer with the default cart (keyboard $80.00 + mouse $20.00)
  await page.goto('/cart?scenario=5');

  // When they go to checkout
  await page.getByTestId('checkout-btn').click();

  // Then the order summary adds up
  // Use auto-retrying assertions so we wait for the values to finish loading
  // (the element initially shows a placeholder like "…").
  await expect(page.getByTestId('subtotal')).toHaveText('$100.00');
  await expect(page.getByTestId('shipping')).toHaveText('$4.99');
  await expect(page.getByTestId('total')).toHaveText('$104.99');
});
