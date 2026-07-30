import { expect, type Mobile } from '@taqwright/taqwright';

/**
 * MediShop cart screen.
 */
export class CartPage {
    constructor(private readonly mobile: Mobile) {}

    // ----Locators------
    /** Every Remove button in the cart — one per line item. */
    private get removeButtons() {
        return this.mobile.getByLabel('Remove');
    }

    // ----Actions----
    /** Number of items currently in the cart. */
    async itemCount(): Promise<number> {
        return this.removeButtons.count();
    }

    /**
     * Tap Remove until the cart is empty.
     *
     * No sleeps: `click()` auto-waits for the next Remove button to be
     * actionable, and `count()` is re-read each pass. `maxRounds` is a guard so a
     * stuck UI fails the test instead of looping forever.
     */
    async emptyCart(maxRounds = 25) {
        for (let round = 0; round < maxRounds; round++) {
            if ((await this.itemCount()) === 0) return;
            await this.removeButtons.first().click();
        }
        throw new Error(`Cart still has ${await this.itemCount()} item(s) after ${maxRounds} removals`);
    }

    // ----Assertions----
    async expectEmpty() {
        await expect(this.removeButtons).toHaveCount(0);
    }

    async expectItemCount(expected: number) {
        await expect(this.removeButtons).toHaveCount(expected);
    }
}
