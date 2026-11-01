import { expect, type Locator, type Page } from '@playwright/test';
import { expectedOrder, usd, PRODUCTS, PRODUCT_IDS, type Cart, type ProductId } from '../fixtures/data.js';

export class CartPage {
  readonly view: Locator;
  readonly heading: Locator;
  readonly subtotal: Locator;
  readonly proceedButton: Locator;
  readonly cancelButton: Locator;
  readonly cancelNotice: Locator;
  readonly emptyState: Locator;
  readonly restoreButton: Locator;


  constructor(readonly page: Page) {
    this.view = page.getByTestId('cart-view');
    this.heading = page.getByRole('heading', { name: /Your Shopping Cart/ });
    this.subtotal = page.getByTestId('cart-subtotal');
    this.proceedButton = page.getByRole('button', { name: /Proceed to Checkout/ });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
    this.cancelNotice = page.getByTestId('cart-cancelled-notice');
    this.emptyState = page.getByTestId('cart-empty');
    this.restoreButton = page.getByRole('button', { name: 'Restore sample items' });
  }

  row = (id: ProductId) => this.page.getByTestId(`cart-item-${id}`);
  quantity = (id: ProductId) => this.page.getByTestId(`qty-value-${id}`);
  linePrice = (id: ProductId) => this.page.getByTestId(`item-${id}-price`);
  plusButton = (id: ProductId) => this.page.getByRole('button', { name: `Increase ${PRODUCTS[id].name} quantity` });
  minusButton = (id: ProductId) => this.page.getByRole('button', { name: `Decrease ${PRODUCTS[id].name} quantity` });
  removeButton = (id: ProductId) => this.page.getByRole('button', { name: `Remove ${PRODUCTS[id].name}` });
  stockMessage = (id: ProductId) => this.page.getByTestId(`stock-message-${id}`);

  async goto(query = '') {
    await this.page.goto(`/cart${query}`);
    await expect(this.heading).toBeVisible();
  }

  async increase(id: ProductId, times = 1) {
    for (let i = 0; i < times; i++) await this.plusButton(id).click();
  }

  async decrease(id: ProductId, times = 1) {
    for (let i = 0; i < times; i++) await this.minusButton(id).click();
  }

  async remove(id: ProductId) {
    await this.removeButton(id).click();
  }

  async proceedToCheckout() {
    await this.proceedButton.click();
    await expect(this.page).toHaveURL(/\/checkout/);
  }

  /** Heading, subtotal and every row match what the spec says this cart must show. */
  async expectContents(cart: Cart) {
    const order = expectedOrder(cart);
    await expect(this.heading).toHaveText(order.heading);
    await expect(this.subtotal).toHaveText(order.subtotal);
    for (const id of PRODUCT_IDS) {
      const line = order.lines.find((l) => l.id === id);
      if (line) {
        await expect(this.quantity(id)).toHaveText(String(line.qty));
        await expect(this.linePrice(id)).toHaveText(usd(line.lineCents));
      } else {
        await expect(this.row(id)).toHaveCount(0);
      }
    }
  }

  async expectEmpty() {
    await expect(this.emptyState).toBeVisible();
    await expect(this.subtotal).toHaveText(usd(0));
    await expect(this.proceedButton).toBeDisabled();
  }
}
