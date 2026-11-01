# Shop Checkout Specification

1. The cart displays each item's price and the sum of all item prices as the Subtotal.
2. Checkout applies a flat-rate shipping fee displayed on the Shipping line.
3. Order Total MUST equal Subtotal plus Shipping (`Total = Subtotal + Shipping`).
4. Clicking the primary checkout action button submits the order and displays a confirmation banner.
5. Prices are formatted in USD (`$XX.XX`) and cannot be negative.
6. An item's quantity can be changed from one up to the number in stock, or the item can be removed.
7. The cart survives moving between pages and reloading. Cancelling leaves the cart unchanged.
8. The checkout summary matches the cart: same items, quantities and Subtotal.
9. An empty cart cannot be checked out.
10. An order is placed at most once. It receives an order number and empties the cart.
