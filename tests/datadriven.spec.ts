import { test } from '../fixtures/test';
import testData from '../testData/loginData.json' with { type: 'json' };

/**
 * Data-driven pattern: one test per credential record in testData/loginData.json.
 * Adding a row to the JSON adds a test — no code change.
 */
for (const data of testData) {
    test(`Login test for ${data.email}`, async ({ loginPage, homePage }) => {
        await loginPage.open();
        await loginPage.login(data.email, data.password);

        if (data.valid) {
            await homePage.expectLoaded();
        } else {
            await loginPage.expectInvalidCredentials();
        }
    });
}
