# Changelog

All notable changes to the TechGear checkout. Newest first.

## v2.2 (2026-10-14)
### Added
- Order confirmation now shows an order number (CHK-318).
### Fixed
- Double-clicking Place Order no longer submits the order twice (CHK-325).
### Changed
- The cart is emptied once an order is placed (CHK-318).

## v2.1 (2026-09-30)
### Added
- Per-item quantity limit based on stock, with a message when the limit is reached (CHK-271).
- Empty-cart state with a "Restore sample items" action (CHK-280).
### Fixed
- The cart is kept when the page is reloaded or you move between Cart and Checkout (CHK-266).
- "Proceed to Checkout" was enabled with an empty cart (CHK-289).

## v2.0 (2026-09-16)
### Added
- Cart and Checkout are now two steps with a progress indicator (CHK-240).
- Flat-rate shipping applied at checkout (CHK-243).
### Changed
- Cancelling at the cart keeps your items instead of clearing them (CHK-251).
