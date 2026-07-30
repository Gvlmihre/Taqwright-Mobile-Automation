import { test, expect } from '@taqwright/taqwright';
import testData from '../testData/loginData.json' with { type: 'json' };

/**
 * SCRATCH / REFERENCE — data-driven login with everything inlined.
 * Compare with tests/datadriven.spec.ts, which does the same thing through the POM.
 */
for (const data of testData) {
    test(`raw: login as ${data.email}`, async ({ mobile }) => {
        await mobile.getById('email_id').fill(data.email);
        await mobile.getById('password_id').fill(data.password);

        if (await mobile.isKeyboardShown()) {
            await mobile.hideKeyboard();
        }
        await mobile.getByType('android.widget.CheckBox').check();
        await mobile.getByText('Sign In').click();

        await expect(mobile.getById('list_id')).toBeVisible();
    });
}
