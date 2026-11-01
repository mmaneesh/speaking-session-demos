// SPEC 1 (prices and subtotal), 6 (quantity from one up to stock).
import { test, expect } from '../../fixtures/test.js';
import { DEFAULT_CART, STOCK, type Cart } from '../../fixtures/data.js';

test.describe('Cart: display and quantity', () => {
  test('shows each item with its price and the subtotal', async ({ cartPage }) => {
    await cartPage.goto();
    await expect(cartPage.page.getByTestId('item-keyboard-name')).toHaveText('Mechanical Keyboard');
    await expect(cartPage.page.getByTestId('item-keyboard-unit-price')).toHaveText('$80.00 each');
    await cartPage.expectContents(DEFAULT_CART);
  });

  test('increasing and decreasing updates the line, heading and subtotal', async ({ cartPage }) => {
    await cartPage.goto();
    await cartPage.increase('keyboard');
    await cartPage.expectContents({ keyboard: 2, mouse: 1 });
    await cartPage.decrease('keyboard');
    await cartPage.expectContents(DEFAULT_CART);
  });

  test('changing one item leaves the other alone', async ({ cartPage }) => {
    await cartPage.goto();
    await cartPage.increase('mouse', 4);
    await cartPage.expectContents({ keyboard: 1, mouse: 5 });
  });

  test('quantity cannot go below one', async ({ cartPage }) => {
    await cartPage.goto();
    await expect(cartPage.minusButton('keyboard')).toBeDisabled();
    await cartPage.increase('keyboard');
    await cartPage.decrease('keyboard');
    await expect(cartPage.minusButton('keyboard')).toBeDisabled();
    await expect(cartPage.quantity('keyboard')).toHaveText('1');
  });

  test('quantity cannot exceed stock and the customer is told why', async ({ cartPage, storage }) => {
    await storage.seedCart({ keyboard: STOCK - 1, mouse: 1 });
    await cartPage.goto();
    await expect(cartPage.stockMessage('keyboard')).toBeHidden();
    await cartPage.increase('keyboard');
    await expect(cartPage.quantity('keyboard')).toHaveText(String(STOCK));
    await expect(cartPage.plusButton('keyboard')).toBeDisabled();
    await expect(cartPage.stockMessage('keyboard')).toContainText(`only ${STOCK} available`);
    await cartPage.decrease('keyboard');
    await expect(cartPage.stockMessage('keyboard')).toBeHidden();
  });

  const carts: Array<[string, Cart]> = [
    ['only a mouse', { mouse: 1 }],
    ['mixed quantities', { keyboard: 3, mouse: 7 }],
    ['full stock of everything', { keyboard: STOCK, mouse: STOCK }],
  ];
  for (const [name, cart] of carts) {
    test(`totals are right: ${name}`, async ({ cartPage, storage }) => {
      await storage.seedCart(cart);
      await cartPage.goto();
      await cartPage.expectContents(cart);
    });
  }
});
