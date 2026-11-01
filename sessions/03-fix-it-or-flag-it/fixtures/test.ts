import { test as base, expect } from '@playwright/test';
import { CartPage } from '../pages/CartPage.js';
import { CheckoutPage } from '../pages/CheckoutPage.js';
import { Storage } from './storage.js';

export const test = base.extend<{ cartPage: CartPage; checkoutPage: CheckoutPage; storage: Storage }>({
  cartPage: async ({ page }, use) => use(new CartPage(page)),
  checkoutPage: async ({ page }, use) => use(new CheckoutPage(page)),
  storage: async ({ page }, use) => use(new Storage(page)),
});

export { expect };
