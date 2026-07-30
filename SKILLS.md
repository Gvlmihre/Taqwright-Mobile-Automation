# SKILLS.md — Build This Framework From Scratch

A reproducible blueprint. Given only this file (plus `CLAUDE.md` and `ARCHITECTURE.md`), an AI model
should be able to recreate an equivalent **Taqwright + TypeScript + Page Object Model** mobile
automation framework — with CI — for any Android or iOS app.

Follow the phases in order. Each phase lists **goal → files → exact content pattern → checkpoint**.

---

## Phase 0 — Skills required

1. **TypeScript** — classes, `readonly` params, async/await, ESM imports, JSON import attributes.
2. **Page Object Model** — separating *locators* from *actions*, one class per screen, constructor DI.
3. **Playwright** — `test.extend` fixtures, `beforeEach`/`afterEach`, projects, retries, reporters,
   auto-retrying `expect`.
4. **Taqwright / mobile automation** — the flat `mobile` fixture, Appium 3 providers
   (emulator / local-device / browserstack / lambdatest), app lifecycle, gestures.
5. **Data-driven testing** — externalizing inputs to JSON and looping to generate tests.
6. **CI for mobile** — booting an emulator on a hosted runner, caching the AVD, uploading reports,
   and passing cloud credentials as secrets.

---

## Phase 1 — Project scaffolding

**Goal:** an installable npm project targeting Taqwright.

The fastest path is `npm init taqwright`, which probes the machine, scaffolds a sample project, and
can install the whole Android toolchain. To build it by hand instead:

`package.json`
```json
{
  "name": "<project-name>",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24.0.0" },
  "scripts": {
    "test": "taqwright test --project android",
    "test:report": "taqwright test --project android --reporter html && taqwright show-report",
    "setup:android": "taqwright install --with-avd",
    "doctor": "taqwright doctor",
    "codegen": "taqwright codegen",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@taqwright/taqwright": "^0.1.0-beta.3",
    "@types/node": "^24.3.0",
    "typescript": "^5.9.2"
  }
}
```

Add a `tsconfig.json` with `"module": "ESNext"`, `"moduleResolution": "bundler"`,
`"resolveJsonModule": true`, `"strict": true`, `"noEmit": true` — typecheck only; the runner does
its own transpiling. Add `.nvmrc` (`24`) and a `.gitignore` covering `node_modules/`,
`playwright-report/`, `test-results/`, `.taqwright/`, `.env`.

Then `npm install`, `npm run setup:android`, `npm run doctor`.

**Checkpoint:** `npx taqwright --version` works and `npm run doctor` is green.

---

## Phase 2 — Know your app

**Goal:** real values for the config, not guesses.

```bash
# Android package id + label, straight from the build
unzip -o app.apk >/dev/null && python3 -c "from pyaxmlparser import APK; a=APK('app.apk'); print(a.package, a.application)"
# or: aapt dump badging app.apk | head
adb devices                 # device serials
emulator -list-avds         # AVD ids
npx taqwright devices       # everything Taqwright can see
```

**Decisions to record:** package id / bundle id, AVD id, device serial, and a realistic `timeout`
(mobile is slow; 90 s per test is a good default).

Put the binary under `app/`. Use `npx taqwright inspect` on the live app to learn how each element is
exposed (resource-id vs content-desc vs text) *before* writing locators — it ranks them by stability.

---

## Phase 3 — Runner configuration

**Goal:** one config, one project per device target.

**File:** `taqwright.config.ts`
```ts
import { defineConfig, Platform } from '@taqwright/taqwright';

const APP_PACKAGE = '<app.package.id>';
const APP_PATH = './app/<app>.apk';

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expectTimeout: 30_000,
  outputDir: './test-results',
  reporter: [['list'], ['html', { open: 'never' }]],
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  projects: [
    {
      name: 'android',
      use: {
        platform: Platform.ANDROID,
        device: { provider: 'emulator', name: process.env.ANDROID_AVD ?? '<avd-id>' },
        appium: { autoStart: true, autoStartDevice: true, host: 'localhost', port: 4723, path: '/' },
        resetBetweenTests: true,          // these three are type-required together
        buildPath: APP_PATH,
        appBundleId: APP_PACKAGE,
        trace: 'on-failure',
        video: 'on-failure',
      },
    },
    // + android-ci     → device: { provider: 'emulator', udid: process.env.ANDROID_UDID },
    //                    appium.autoStartDevice: false   (CI booted it already)
    // + android-device → device: { provider: 'local-device', udid: process.env.DEVICE_UDID }
    // + browserstack   → device: { provider: 'browserstack', name, osVersion },
    //                    buildPath: process.env.BROWSERSTACK_APP_ID ?? APP_PATH,
    //                    workers: N   (cloud parallelism is plain workers)
  ],
});
```

**Rules:** every device- or credential-specific value comes from an env var with a default; new
targets are new **projects**, never edits to an existing one; cloud credentials live only in the
environment.

**Checkpoint:** `npx taqwright test --project android --list` prints your (still empty) suite
without a config error.

---

## Phase 4 — Page Object layer (`pages/`)

**Goal:** one class per app screen. This is the heart of the framework.

**Template — copy this shape for every screen:**
```ts
import { expect, type Mobile } from '@taqwright/taqwright';

// Export shared constants from the page that owns them
export const APP_PACKAGE = '<app.package.id>';

export class <Name>Page {
    constructor(private readonly mobile: Mobile) {}

    // ----Locators------
    private get someField()      { return this.mobile.getById('some_id'); }
    private byName(name: string) { return this.mobile.getByText(name); }   // parameterized

    // ----Actions----
    async doSomething() {
        await this.someField.click();
    }
    async highLevelFlow(a: string, b: string) {   // compose small actions
        await this.stepOne(a);
        await this.stepTwo(b);
    }

    // ----Assertions----
    async expectLoaded() {
        await expect(this.someField).toBeVisible();
    }
}
```

**Rules (non-negotiable — they define the pattern):**
- Locators are `private get`ters (or `private` methods when parameterized). Never store elements in
  fields — re-query each time; Taqwright locators are lazy.
- Actions are `public async`, named for user intent, not UI mechanics.
- Inject `mobile` through the constructor; never use globals. One dependency is all you need.
- Let the framework do the waiting: `fill()` clears, `check()` is idempotent, `click()` auto-waits,
  `scrollIntoView()` replaces swipe loops, `expect` retries. **No `setTimeout` sleeps.**
- Encapsulate platform quirks (keyboard dismissal, scroll-to-find) in page methods.

**Reference implementations to reproduce (this repo's three screens):**
- `LoginPage` — email / password / terms-checkbox / sign-in locators; `open()` (assert, don't sleep),
  `enterEmail`, `enterPassword`, `dismissKeyboard`, `acceptTermsAndSubmit`, orchestrating `login()`.
  Owns `APP_PACKAGE`.
- `HomePage` — list / category / cart-tab locators; `selectCategory`, `swipeList`,
  `openMedicine` (`scrollIntoView` + `click`), `goToCart`, `expectLoaded`.
- `CartPage` — `removeButtons` locator; `itemCount()` via `.count()`, `emptyCart()` (tap first
  Remove until the count is 0, with a `maxRounds` guard), `expectEmpty()` via `toHaveCount(0)`.

**Checkpoint:** `npm run typecheck` is clean and every device interaction is reachable through some
page method.

---

## Phase 5 — Fixtures layer (`fixtures/test.ts`)

**Goal:** auto-construct and inject page objects (dependency injection).

```ts
import { test as base, expect } from '@taqwright/taqwright';
import { LoginPage } from '../pages/LoginPage';
import { HomePage } from '../pages/HomePage';
import { CartPage } from '../pages/CartPage';

type Pages = {
    loginPage: LoginPage;
    homePage: HomePage;
    cartPage: CartPage;
};

export const test = base.extend<Pages>({
    loginPage: async ({ mobile }, use) => { await use(new LoginPage(mobile)); },
    homePage:  async ({ mobile }, use) => { await use(new HomePage(mobile)); },
    cartPage:  async ({ mobile }, use) => { await use(new CartPage(mobile)); },
});

export { expect };
```

**Rules:** one entry per page object, added to both the `Pages` type and the `extend` object; every
page receives the single `mobile` fixture; re-export `expect`.

**Checkpoint:** a spec can request `{ loginPage }` and receive a live instance.

---

## Phase 6 — Test data (`testData/`)

```json
[
  { "email": "user@example.com", "password": "secret" },
  { "email": "user2@example.com", "password": "secret2" }
]
```

**Rules:** no inputs hardcoded in specs. Import with the ESM attribute:
`import testData from '../testData/loginData.json' with { type: 'json' };`

---

## Phase 7 — Test specs (`tests/`)

**Goal:** business-readable scenarios driven entirely through page objects.

```ts
import { test } from '../fixtures/test';          // custom fixture, NOT the base runner
import { APP_PACKAGE } from '../pages/LoginPage';
import testData from '../testData/loginData.json' with { type: 'json' };

const login = testData[0];

test.beforeEach(async ({ loginPage }) => {
    await loginPage.open();
    await loginPage.login(login.email, login.password);
});

test.afterEach(async ({ mobile }) => {
    await mobile.terminateApp(APP_PACKAGE);
});

test('Search Medicine Test', async ({ homePage }) => {
    await homePage.expectLoaded();
    await homePage.selectCategory('Fever');
    await homePage.openMedicine('Antibiotic');
});

test('Empty Cart Test', async ({ homePage, cartPage }) => {
    await homePage.goToCart();
    await cartPage.emptyCart();
    await cartPage.expectEmpty();
});
```

**Data-driven variant** (one test per record):
```ts
for (const data of testData) {
    test(`Login test for ${data.email}`, async ({ loginPage, homePage }) => {
        await loginPage.open();
        await loginPage.login(data.email, data.password);
        await homePage.expectLoaded();
    });
}
```

**Rules:** `.spec.ts` suffix; import from `../fixtures/test`; bodies stay locator- and sleep-free;
`beforeEach`/`afterEach` for state + isolation; `test.skip` for parked tests; never `test.only`.

**Checkpoint:** `npm test` runs green against a device.

---

## Phase 8 — Scratch area (`rough/`) — optional but recommended

Prototype raw specs importing the **base** `@taqwright/taqwright` with locators inlined, then extract
locators into page getters and steps into action methods. Give `rough/` its own project
(`{ name: 'android-rough', testDir: './rough', ... }`) so it never joins the maintained suite —
the positional test filter is a regex, not a glob, so a separate project is the clean way to do this.

---

## Phase 9 — CI: run on every push

**GitHub Actions** — `.github/workflows/ci.yml`, two jobs:

1. `static`: `actions/setup-node@v4` (node 24, `cache: npm`) → `npm ci` → `npm run typecheck` →
   `npx taqwright test --project android-ci --list` (proves the config loads).
2. `android-emulator`: enable KVM via a udev rule → `setup-java@v4` (temurin 17) → setup-node 24 →
   `npm ci` → install `appium@3` + the `uiautomator2` driver → cache `~/.android/avd` →
   `reactivecircus/android-emulator-runner@v2` (api-level 34, `google_apis`, `x86_64`,
   `-no-window -gpu swiftshader_indirect`) with `script: npx taqwright test --project android-ci` →
   `actions/upload-artifact@v4` for `playwright-report/` and `test-results/`.

Triggers: `push: branches: ['**']`, `pull_request`, `workflow_dispatch`, plus a `concurrency` group
so superseded runs cancel.

Key detail: the emulator is booted by the CI step, so the CI project must set
`appium.autoStartDevice: false` and take its `udid` from `ANDROID_UDID` (`emulator-5554`).

**Cloud (BrowserStack / LambdaTest)** — a separate workflow on `main` + nightly + manual:
`curl -u "$USER:$KEY" -X POST https://api-cloud.browserstack.com/app-automate/upload -F "file=@./app/app.apk"`,
read `app_url` from the JSON, export it as `BROWSERSTACK_APP_ID`, then
`npx taqwright test --project browserstack-android --workers N`. Credentials are repository secrets;
pre-uploading avoids one 20 MB upload per worker.

**Bitrise** — `bitrise.yml` with a `_setup` workflow (activate-ssh-key → git-clone → nvm install
Node 24 → `npm ci` → install Appium) then an `emulator` workflow (`avd-manager` →
`wait-for-android-emulator` → `taqwright test --project android-ci`) and a `browserstack` workflow,
both ending in a `_publish` workflow that copies the report into `$BITRISE_DEPLOY_DIR` and runs
`deploy-to-bitrise-io`. A `trigger_map` maps `push_branch: '*'` → `emulator` and
`push_branch: main` → `browserstack`.

**Checkpoint:** push a branch; the emulator job goes green and the HTML report downloads as an
artifact.

---

## Phase 10 — Documentation

Produce the companion docs so the framework is self-describing:
- `README.md` — quick start, scripts, layout, projects, CI, secrets.
- `ARCHITECTURE.md` — layers, file-by-file explanation, API reference.
- `CLAUDE.md` — conventions + gotchas for future AI/dev work.
- `SKILLS.md` — this rebuild blueprint.
- `COMPARISON.md` — if you also keep a framework on another runner, document the deltas.

---

## Build order summary

```
1. package.json / tsconfig      → npm install, taqwright install
2. inspect the app              → package id, AVD, real locators
3. taqwright.config.ts          → one project per device target
4. pages/*.ts                   → POM screens (locators + actions + assertions)
5. fixtures/test.ts             → inject page objects
6. testData/*.json              → external inputs
7. tests/*.spec.ts              → scenarios (via fixtures + pages)
8. rough/*.spec.ts              → prototype → refactor (optional)
9. .github/workflows + bitrise.yml → run on every push, then cloud devices
10. docs                        → README / ARCHITECTURE / CLAUDE / SKILLS
```

## Golden rules (what makes this framework what it is)

1. **Strict layering:** config → fixtures → pages → tests/data. Specs never touch `mobile` directly.
2. **Locators are getters, actions are methods** — always separated, always in a page object.
3. **Constructor injection** of `mobile`; no globals.
4. **Data lives in JSON**, not in specs.
5. **Trust the auto-waiting.** No sleeps, no retry loops you wrote yourself — use `expect`,
   `scrollIntoView`, `check`, `fill`.
6. **Isolation** via `resetBetweenTests` + `beforeEach`/`afterEach`.
7. **Devices are config, not code** — the same specs run on an emulator, a handset, CI, and the cloud.
8. **Secrets only from the environment.**
