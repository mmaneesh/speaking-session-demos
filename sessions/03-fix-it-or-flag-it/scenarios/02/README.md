# 02 Stale expectation, documented (Reddy only, never shown to the AI)

**What changes in the app:** shipping is $5.00, so the total is $105.00.

**Why the test fails:** it still expects $4.99 and $104.99. "Expected '$4.99', Received '$5.00'".

**Right call: FIX.** The changelog says `v2.3 (2026-10-28) Changed: Flat-rate shipping is now $5.00, up from $4.99 (CHK-334)`, so the change was on purpose. The total still equals subtotal plus shipping, so the spec holds.

**Compare with scenario 3:** same app, same test. Only the changelog entry differs.
