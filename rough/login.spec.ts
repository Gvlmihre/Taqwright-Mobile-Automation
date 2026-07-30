import { test, expect } from '@taqwright/taqwright';
import testData from '../testData/loginData.json' with { type: 'json' };

/**
 * SCRATCH / REFERENCE — the "before refactor" version.
 *
 * Imports the base runner directly and inlines every locator and interaction.
 * This is what pages/LoginPage.ts, HomePage.ts and CartPage.ts were extracted
 * from. Kept for the side-by-side comparison; not part of the maintained suite.
 */

const APP_PACKAGE = 'com.way2automation.medishop';
const login = testData[0];

test.beforeEach(async ({ mobile }) => {
    await expect(mobile.getById('email_id')).toBeVisible();

    await mobile.getById('email_id').fill(login.email);
    await mobile.getById('password_id').fill(login.password);

    if (await mobile.isKeyboardShown()) {
        await mobile.hideKeyboard();
    }
    await mobile.getByType('android.widget.CheckBox').check();
    await mobile.getByText('Sign In').click();
});

test.afterEach(async ({ mobile }) => {
    await mobile.terminateApp(APP_PACKAGE);
});

test('raw: search medicine', async ({ mobile }) => {
    await expect(mobile.getById('list_id')).toBeVisible();
    await mobile.getByText('Fever').click();

    const item = mobile.getByText('Antibiotic', { exact: false });
    await item.scrollIntoView({ direction: 'down', maxAttempts: 10 });
    await item.click();
});

test('raw: empty cart', async ({ mobile }) => {
    await mobile.getByText('Cart').click();

    const removeButtons = mobile.getByLabel('Remove');
    for (let i = 0; i < 25; i++) {
        if ((await removeButtons.count()) === 0) break;
        await removeButtons.first().click();
    }
    await expect(removeButtons).toHaveCount(0);
});
