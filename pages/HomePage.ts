import { expect, type Mobile, type ScrollDirection } from '@taqwright/taqwright';

/**
 * MediShop home screen — medicine list, category chips, bottom tab bar.
 */
export class HomePage {
    constructor(private readonly mobile: Mobile) {}

    // ----Locators------
    private get medicineList() {
        return this.mobile.getById('list_id');
    }

    /** Parameterized locator — a private method, not a getter. */
    private category(name: string) {
        return this.mobile.getByText(name);
    }

    private medicine(name: string) {
        return this.mobile.getByText(name, { exact: false });
    }

    private get cartTab() {
        return this.mobile.getByText('Cart');
    }

    // ----Actions----
    async expectLoaded() {
        await expect(this.medicineList).toBeVisible();
    }

    async selectCategory(name: string) {
        await this.category(name).click();
    }

    /** Swipe inside the list's own bounding box, not the whole screen. */
    async swipeList(direction: ScrollDirection = 'left') {
        const list = this.medicineList;
        if (direction === 'left') await list.swipeLeft();
        else if (direction === 'right') await list.swipeRight();
        else if (direction === 'up') await list.swipeUp();
        else await list.swipeDown();
    }

    /**
     * Open a medicine that may be off-screen.
     *
     * `scrollIntoView` replaces MobileWright's hand-rolled
     * "swipe until isVisible()" loop: it uses the native scroll where available
     * and falls back to a gesture, then the click auto-waits.
     */
    async openMedicine(name: string, direction: ScrollDirection = 'down') {
        const item = this.medicine(name);
        await item.scrollIntoView({ direction, maxAttempts: 10 });
        await item.click();
    }

    async goToCart() {
        await this.cartTab.click();
    }
}
