import { test, expect } from '@playwright/test';

test('customer can place an order and see the confirmation', async ({ page }) => {
  // Given a customer with the default cart
  await page.goto('/cart?scenario=1');

  // When they go to checkout and place the order
  await page.getByTestId('checkout-btn').click();
  await page.getByTestId('place-order-btn').click();

  // Then an order confirmation appears
  await expect(page.getByTestId('order-confirmation')).toBeVisible();
  await expect(page.getByTestId('order-confirmation')).toContainText('Order confirmed');
});
