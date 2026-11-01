# 01 Locator drift (Reddy only, never shown to the AI)

**What changes in the app:** the cart's checkout button `data-testid` goes from `checkout-btn` to `proceed-to-checkout-btn`. The button looks and works the same.

**Why the test fails:** it clicks `checkout-btn`, which no longer exists. The failure is a timeout on the first click, not an "expected X, received Y".

**Right call: FIX.** The app is fine. The test is pointing at an old name. Update the locator and keep both assertions. The best fix is a role-based locator (`getByRole('button', { name: /Proceed to Checkout/ })`), which survives future renames.

**Evidence:** neither the spec nor the changelog mentions it, and none is needed. A test id is an internal detail, so a real changelog would not list it.
