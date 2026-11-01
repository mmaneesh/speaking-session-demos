import { test, expect } from '@playwright/test';

test('checkout shows the subtotal, shipping and order total', async ({ page }) => {
  // Given a customer with the default cart (keyboard $80.00 + mouse $20.00)
  await page.goto('/cart?scenario=5');

  // When they go to checkout
  await page.getByTestId('checkout-btn').click();

  // Then the order summary adds up
  const subtotal = await page.getByTestId('subtotal').textContent();
  const shipping = await page.getByTestId('shipping').textContent();
  const total = await page.getByTestId('total').textContent();
  expect(subtotal).toBe('$100.00');
  expect(shipping).toBe('$4.99');
  expect(total).toBe('$104.99');
});
