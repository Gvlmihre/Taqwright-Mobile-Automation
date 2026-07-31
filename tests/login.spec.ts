import { test } from '../fixtures/test';
import { APP_PACKAGE } from '../pages/LoginPage';
import testData from '../testData/loginData.json' with { type: 'json' };

/**
 * The maintained suite. Same three scenarios as the MobileWright repo, driven
 * entirely through page objects — no locators, no sleeps, no Android quirks here.
 */

const login = testData[0];

// test.beforeEach(async ({ loginPage }) => {
//     // resetBetweenTests has already reinstalled + launched a clean app.
//     await loginPage.open();
//     await loginPage.login(login.email, login.password);
// });
test('Log in test', async ({loginPage}) => {
    await loginPage.open();
    await loginPage.login(login.email, login.password);
})

test.afterEach(async ({ mobile }) => {
    await mobile.terminateApp(APP_PACKAGE);
});

// test('Search Medicine Test', async ({ homePage }) => {
//     await homePage.expectLoaded();
//     await homePage.selectCategory('Fever');
//     await homePage.openMedicine('Antibiotic');
// });

// test('Empty Cart Test', async ({ homePage, cartPage }) => {
//     await homePage.goToCart();
//     await cartPage.emptyCart();
//     await cartPage.expectEmpty();
// });
