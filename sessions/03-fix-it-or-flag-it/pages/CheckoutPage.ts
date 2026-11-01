import { expect, type Locator, type Page } from '@playwright/test';
import { expectedOrder, usd, type Cart, type ProductId } from '../fixtures/data.js';

export class CheckoutPage {
  readonly view: Locator;
  readonly shippingAddress: Locator;
  readonly deliveryMethod: Locator;
  readonly paymentMethod: Locator;
  readonly subtotal: Locator;
  readonly shipping: Locator;
  readonly total: Locator;
  readonly placeOrderButton: Locator;
  readonly backToCartButton: Locator;
  readonly changedNotice: Locator;
  readonly confirmation: Locator;
  readonly orderNumber: Locator;


  constructor(readonly page: Page) {
    this.view = page.getByTestId('checkout-view');
    this.shippingAddress = page.getByTestId('shipping-address');
    this.deliveryMethod = page.getByTestId('delivery-method');
    this.paymentMethod = page.getByTestId('payment-method');
    this.subtotal = page.getByTestId('subtotal');
    this.shipping = page.getByTestId('shipping');
    this.total = page.getByTestId('total');
    this.placeOrderButton = page.getByRole('button', { name: /^(Place Order|Order Placed)$/ });
    this.backToCartButton = page.getByRole('button', { name: /Back to Cart/ });
    this.changedNotice = page.getByTestId('checkout-changed-notice');
    this.confirmation = page.getByTestId('order-confirmation');
    this.orderNumber = page.getByTestId('order-number');
  }

  lineLabel = (id: ProductId) => this.page.getByTestId(`checkout-${id}-label`);
  linePrice = (id: ProductId) => this.page.getByTestId(`checkout-${id}-price`);

  async goto(query = '') {
    await this.page.goto(`/checkout${query}`);
    await expect(this.view).toBeVisible();
  }

  async placeOrder() {
    await this.placeOrderButton.click();
  }

  async backToCart() {
    await this.backToCartButton.click();
    await expect(this.page).toHaveURL(/\/cart/);
  }

  /** Every line, the subtotal, flat shipping and the total match the spec for this cart. */
  async expectSummary(cart: Cart) {
    const order = expectedOrder(cart);
    for (const line of order.lines) {
      await expect(this.lineLabel(line.id)).toHaveText(`${line.name} (×${line.qty})`);
      await expect(this.linePrice(line.id)).toHaveText(usd(line.lineCents));
    }
    await expect(this.subtotal).toHaveText(order.subtotal);
    await expect(this.shipping).toHaveText(order.shipping);
    await expect(this.total).toHaveText(order.total);
  }

  async expectConfirmed() {
    await expect(this.confirmation).toContainText('Order confirmed');
    await expect(this.orderNumber).toHaveText(/^TG-\d{6}$/);
    await expect(this.placeOrderButton).toBeDisabled();
  }
}
