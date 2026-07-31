# MobileWright vs Taqwright — same app, same tests, side by side

Both repos automate the **Way2Automation MediShop** Android app
(`com.way2automation.medishop`), cover the same three scenarios (login, search medicine, empty cart),
and use the same Page Object Model layering. This file is the delta — what to point at during the demo.

| | `PageObjectModelMW` (MobileWright) | `PageObjectModelTW` (Taqwright) |
|---|---|---|
| Package | `mobilewright` / `@mobilewright/test` | `@taqwright/taqwright` |
| Runner | MobileWright's own Playwright-style runner | **the actual Playwright runner** |
| Engine | MobileWright's driver (accessibility tree) | **Appium 3** — UiAutomator2 / XCUITest |
| Config file | `mobilewright.config.ts` | `taqwright.config.ts` |
| Base fixtures | two: `device` + `screen` | **one flat `mobile`** (+ `rawDriver`, `networkProxy`) |
| Spec suffix | `.test.ts` | `.spec.ts` (Playwright default) |
| Waiting | manual — `setTimeout` sleeps, `isVisible()` loops | **auto-wait on every action, auto-retrying `expect`** |
| Assertions | `expect` present, mostly unused | `toBeVisible/toHaveCount/toHaveText/…` + `loc.assert*()` |
| App install | `installApps` in config (commented out) | `resetBetweenTests` + `buildPath` + `appBundleId` — clean install per test |
| Devices | `deviceName` (adb serial) in config | `device.provider`: `emulator` / `local-device` / `browserstack` / `lambdatest` |
| Parallel | `workers` / `fullyParallel` (commented) | `device.pool` or `autoDiscover` + per-worker Appium & staggered ports |
| Cloud | — | BrowserStack / LambdaTest as a first-class provider |
| Artifacts | HTML report | HTML report + **trace timeline + video + HAR**, each `on-failure` |
| Tooling | — | `init`, `doctor`, `devices`, `inspect`, `codegen`, `install`, `merge-reports`, `show-report` |
| iOS | supported by the framework | `ios` / `ios-ci` / `ios-device` / `browserstack-ios` projects exist — same specs, `Platform.IOS` — but are **commented out** in `taqwright.config.ts` / CI, since no `.app`/`.ipa` build is checked in |
| Node | any modern | **≥ 24** |

## 1. Fixtures: two objects vs one

```ts
// MobileWright — screen for queries, device for lifecycle; pass whichever each page needs
loginPage: async ({ screen, device }, use) => use(new LoginPage(screen, device)),
homePage:  async ({ screen }, use)         => use(new HomePage(screen)),

// Taqwright — one fixture owns queries, gestures, and lifecycle
loginPage: async ({ mobile }, use) => { await use(new LoginPage(mobile)); },
homePage:  async ({ mobile }, use) => { await use(new HomePage(mobile)); },
```

Every Taqwright page object has exactly one constructor argument, so there is no "does this page need
`device` too?" decision to get wrong.

## 2. Clearing a pre-filled field — the biggest single win

MobileWright needed a workaround because `fill()` could append instead of replace:

```ts
// MobileWright: LoginPage.clearAndFill — ~20 lines
await field.tap();
await field.longPress({ duration: 800 });
const menuVisible = await this.screen.getByText('Select all').isVisible().catch(() => false);
if (menuVisible) {
    await this.screen.getByText('Select all').tap();
    await this.screen.getByText('Cut').tap();
} else if (field.fill) {
    await field.fill(value);
} else {
    await this.device.driver.typeText(value);
}
```

```ts
// Taqwright: fill() focuses, clears, then sends real key events
await this.emailField.fill(email);
```

## 3. Waiting: sleeps vs auto-wait

```ts
// MobileWright
async open() {
    await this.device.launchApp(APP_PACKAGE);
    await this.waitForLoad(10_000);          // setTimeout sleep
}

// Taqwright — resetBetweenTests already installed + launched a clean app
async open() {
    await expect(this.emailField).toBeVisible();   // polls every 200 ms, up to expectTimeout
}
```

Fixed sleeps are the main source of both flakiness and wasted wall-clock. There is not a single
`setTimeout` in this repo.

## 4. Scroll-to-find: hand-rolled loop vs one call

```ts
// MobileWright: HomePage.openMedicine
async openMedicine(name: string) {
    while (!(await this.screen.getByText(name, { exact: false }).isVisible())) {
        await this.swipeList('left', 1000);
    }
    await this.screen.getByText(name, { exact: false }).tap();
}

// Taqwright
async openMedicine(name: string, direction: ScrollDirection = 'down') {
    const item = this.medicine(name);
    await item.scrollIntoView({ direction, maxAttempts: 10 });
    await item.click();
}
```

`scrollIntoView` uses the native scroll where the platform offers one and falls back to a gesture —
and it can't loop forever.

## 5. Emptying the cart: sleeps vs count + auto-wait

```ts
// MobileWright
async emptyCart() {
    while ((await this.removeButtons.count()) > 0) {
        await this.removeButtons.first().tap();
        await new Promise(r => setTimeout(r, 1000));   // hope 1s is enough
    }
}

// Taqwright
async emptyCart(maxRounds = 25) {
    for (let round = 0; round < maxRounds; round++) {
        if ((await this.itemCount()) === 0) return;
        await this.removeButtons.first().click();       // auto-waits for the next button
    }
    throw new Error(`Cart still has ${await this.itemCount()} item(s) after ${maxRounds} removals`);
}
// …and the spec asserts the end state:
await expect(this.removeButtons).toHaveCount(0);
```

## 6. Keyboard and checkboxes

| Step | MobileWright | Taqwright |
|------|--------------|-----------|
| Dismiss keyboard | `screen.pressButton('BACK')` (can also navigate back) | `if (await mobile.isKeyboardShown()) await mobile.hideKeyboard();` |
| Tick terms | `checkbox.tap()` — double-taps if already checked | `checkbox.check()` — idempotent |

## 7. Locator API

| MobileWright | Taqwright | Android strategy |
|--------------|-----------|------------------|
| `getByTestId('email_id')` | `getById('email_id')` / `getByTestId('email_id')` | `resource-id` |
| `getByText('Sign In')` | `getByText('Sign In', { exact })` | xpath on `@text` |
| `getByType('android.widget.CheckBox')` | `getByType('android.widget.CheckBox')` | `class name` |
| `getByLabel('Remove')` | `getByLabel('Remove')` | `accessibility id` |
| — | `getByRole`, `getByPlaceholder`, `getByXpath`, `getByUiSelector`, `getByPredicate` | — |
| `first()`, `nth()`, `count()` | same, plus `filter({hasText,has,hasNot,visible})`, `last()`, `locator()`, `and()`, `or()`, `all()` | — |

## 8. Devices and scale

```ts
// MobileWright — one device serial in the config
deviceName: 'R3CT204N57L',

// Taqwright — a project per target, provider-driven
device: { provider: 'emulator',     name: 'Pixel_10_Pro_XL' }
device: { provider: 'local-device', udid: 'R3CT204N57L' }
device: { provider: 'browserstack', name: 'Google Pixel 8', osVersion: '14.0' }
device: { provider: 'emulator',     autoDiscover: true }        // pool resolved for you

// Same providers, iOS side — only `platform: Platform.IOS` + the device block change
device: { provider: 'emulator',     name: 'iPhone 17 Pro', osVersion: '26.5' }   // simulator
device: { provider: 'local-device', udid: '<iPhone UDID>' }                  // physical iPhone
device: { provider: 'browserstack', name: 'iPhone 15', osVersion: '17' }
```

Local parallelism needs a `device.pool` (or `autoDiscover`) with at least `workers` entries —
Taqwright rejects `workers > 1` at config load rather than letting two workers collide on one device.
Cloud parallelism is plain `workers: N`.

## 9. Debugging

- **MobileWright:** HTML report.
- **Taqwright:** HTML report, plus a self-contained `trace.html` per-action screenshot + page-source
  timeline, a screen recording, and HAR network logs — each configurable as
  `on` / `on-failure` / `retain-on-failure`. Plus `taqwright inspect` (live inspector that ranks
  locators by stability) and `taqwright codegen` (tap the app, get a runnable spec).

## 10. CI

MobileWright's repo ran locally against a named handset. This repo ships (Android active today;
iOS wired up but commented out everywhere — see README.md):

- **GitHub Actions `ci.yml`** — typecheck + config-load check (`android-ci`; the `ios-ci` list step
  is commented out), then an API 34 emulator on every push and PR, with the report as a build
  artifact. The `ios-simulator` job (iPhone 15 on a macOS runner) is commented out.
- **GitHub Actions `browserstack.yml`** — APK uploaded once, `bs://` id reused, real Android
  devices on `main` + nightly + manual. The `browserstack-ios` job (same for the `.ipa`) is
  commented out.
- **`bitrise.yml`** — `emulator` and `browserstack` are active Bitrise workflows; `ios-simulator`
  and `browserstack-ios` (plus their shared `_setup_ios`) are commented out and need a macOS Stack
  once re-enabled.

Because only `taqwright.config.ts` knows about devices, the specs themselves would be identical
across all environments — once an iOS build exists and the commented-out projects/jobs are
uncommented (see the note in README.md; no `.app`/`.ipa` is checked in yet).

---

## Talking points for the demo

1. **The tests didn't change shape — the plumbing shrank.** Same POM, same three scenarios; the page
   objects lost their workarounds. `git diff` the two `pages/` folders.
2. **Flakiness is designed out, not retried away.** Auto-wait + auto-retrying assertions instead of
   `setTimeout`.
3. **Appium 3 underneath** means the whole existing Appium ecosystem (capabilities, drivers, cloud
   grids) is available through an escape hatch (`capabilities`, `rawDriver`) you rarely need.
4. **One API, many devices.** Emulator → handset → CI → BrowserStack is a `--project` flag.
5. **Failures come with evidence.** Trace timeline + video + logs, not just a red line in the console.
6. **Tooling closes the loop.** `doctor` for setup, `inspect`/`codegen` for locators, `merge-reports`
   for sharded runs.
