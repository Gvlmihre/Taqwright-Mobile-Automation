import { expect, type Mobile } from '@taqwright/taqwright';

/** Android package id of the app under test — owned by the page that launches it. */
export const APP_PACKAGE = 'com.way2automation.medishop';

/**
 * MediShop login screen.
 *
 * Locators are private getters (lazy — re-queried on every access, never cached).
 * Actions are public async methods named for user intent.
 */
export class LoginPage {
    constructor(private readonly mobile: Mobile) {}

    // ----Locators------
    private get emailField() {
        return this.mobile.getById('email_id');
    }

    private get passwordField() {
        return this.mobile.getById('password_id');
    }

    private get termsCheckbox() {
        return this.mobile.getByType('android.widget.CheckBox');
    }

    private get signInButton() {
        return this.mobile.getByText('Sign In');
    }

    // ----Actions----

    /**
     * Reach a ready login screen.
     *
     * `resetBetweenTests` in taqwright.config.ts has already reinstalled and
     * launched the app, so there is nothing to launch here — we only assert the
     * screen is up. `toBeVisible()` auto-retries, which replaces the fixed sleep
     * the MobileWright version needed.
     */
    async open() {
        await expect(this.emailField).toBeVisible();
    }

    /** Explicit relaunch, for tests that background or terminate the app themselves. */
    async relaunch() {
        await this.mobile.launchApp(APP_PACKAGE);
        await this.open();
    }

    /** `fill` focuses, clears, then sends real key events — no select-all/cut dance. */
    async enterEmail(email: string) {
        await this.emailField.fill(email);
    }

    async enterPassword(password: string) {
        await this.passwordField.fill(password);
    }

    /** Dismiss the keyboard so it can't cover the checkbox or the Sign In button. */
    async dismissKeyboard() {
        if (await this.mobile.isKeyboardShown()) {
            await this.mobile.hideKeyboard();
        }
    }

    /** `check()` is idempotent — safe to call whatever state the box is in. */
    async acceptTermsAndSubmit() {
        await this.dismissKeyboard();
        await this.termsCheckbox.check();
        await this.signInButton.click();
    }

    /** High-level orchestration: the whole login flow, end to end. */
    async login(email: string, password: string) {
        await this.enterEmail(email);
        await this.enterPassword(password);
        await this.acceptTermsAndSubmit();
    }

    // ----Assertions----
    async expectLoaded() {
        await expect(this.signInButton).toBeVisible();
    }
}
