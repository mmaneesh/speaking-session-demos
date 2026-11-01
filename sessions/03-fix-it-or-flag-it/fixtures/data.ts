// What the shop must show, written down independently of the app's own code.
export const PRODUCTS = {
  keyboard: { name: 'Mechanical Keyboard', unitCents: 8000 },
  mouse: { name: 'Wireless Mouse', unitCents: 2000 },
} as const;

export type ProductId = keyof typeof PRODUCTS;
export type Cart = Partial<Record<ProductId, number>>;

export const PRODUCT_IDS = Object.keys(PRODUCTS) as ProductId[];
export const STOCK = 10;
export const SHIPPING_CENTS = 499;
export const DEFAULT_CART: Cart = { keyboard: 1, mouse: 1 };

export const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** Spec rules: Subtotal = sum of line prices, Total = Subtotal + flat Shipping. */
export function expectedOrder(cart: Cart) {
  const lines = PRODUCT_IDS.filter((id) => (cart[id] ?? 0) > 0).map((id) => ({
    id,
    name: PRODUCTS[id].name,
    qty: cart[id] as number,
    lineCents: (cart[id] as number) * PRODUCTS[id].unitCents,
  }));
  const subtotalCents = lines.reduce((sum, l) => sum + l.lineCents, 0);
  const count = lines.reduce((sum, l) => sum + l.qty, 0);
  return {
    lines,
    heading: `Your Shopping Cart (${count} ${count === 1 ? 'Item' : 'Items'})`,
    subtotal: usd(subtotalCents),
    shipping: usd(SHIPPING_CENTS),
    total: usd(subtotalCents + SHIPPING_CENTS),
  };
}
