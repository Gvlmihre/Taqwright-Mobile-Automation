import { test as base, expect } from '@taqwright/taqwright';
import { LoginPage } from '../pages/LoginPage';
import { HomePage } from '../pages/HomePage';
import { CartPage } from '../pages/CartPage';

/**
 * Dependency-injection layer.
 *
 * Taqwright gives us one flat base fixture, `mobile`, which owns the whole
 * WebDriver/Appium session (locators + gestures + app lifecycle). Here we build
 * page-object fixtures on top of it, so a spec asks for `{ loginPage }` and gets
 * a live instance — freshly constructed per test, so tests stay isolated.
 *
 * This is the only place page objects are constructed.
 */
type Pages = {
    loginPage: LoginPage;
    homePage: HomePage;
    cartPage: CartPage;
};

export const test = base.extend<Pages>({
    loginPage: async ({ mobile }, use) => {
        await use(new LoginPage(mobile));
    },
    homePage: async ({ mobile }, use) => {
        await use(new HomePage(mobile));
    },
    cartPage: async ({ mobile }, use) => {
        await use(new CartPage(mobile));
    },
});

export { expect };
