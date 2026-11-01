import type { Page } from '@playwright/test';
import type { Cart } from './data.js';

/** The shop keeps the cart and the order log in sessionStorage. This is how tests set up and inspect it. */
export class Storage {
  constructor(private readonly page: Page) {}

  /** Start the tab with this cart. Applied once per tab, so reloads afterwards keep the app's own state. */
  async seedCart(cart: Cart) {
    await this.seedRaw(JSON.stringify(cart));
  }

  /** Same, with exact stored text, for corrupt-data cases. */
  async seedRaw(raw: string) {
    await this.page.addInitScript((value) => {
      try {
        if (sessionStorage.getItem('__seeded') === null) {
          sessionStorage.setItem('cart', value);
          sessionStorage.setItem('__seeded', '1');
        }
      } catch {
        /* about:blank has no storage */
      }
    }, raw);
  }

  /** Change the stored cart right now, as if it changed somewhere else. */
  async changeCartNow(cart: Cart) {
    await this.page.evaluate((c) => sessionStorage.setItem('cart', JSON.stringify(c)), cart);
  }

  async orderCount() {
    return this.page.evaluate(() => (JSON.parse(sessionStorage.getItem('orderLog') ?? '[]') as unknown[]).length);
  }
}
