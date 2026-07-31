// Loads .env into process.env before anything below reads it. Must stay first.
// .env holds BROWSERSTACK_USERNAME / ACCESS_KEY / APP_ID and is gitignored.
import 'dotenv/config';
import { defineConfig, Platform } from '@taqwright/taqwright';

/**
 * Taqwright runner configuration — the single source of truth for
 * platform / device / app / timeout / reporter.
 *
 * App under test: Way2Automation MediShop (Jetpack Compose, minSdk 24).
 *
 * Projects:
 *   android              → local emulator, Taqwright boots the AVD for you
 *   android-ci           → an emulator that is *already* running (GitHub Actions / Bitrise)
 *   android-device       → a physical handset plugged into adb
 *   browserstack-android → BrowserStack real-device cloud (Android)
 *
 * iOS is disabled — there is only an Android app (way2automation.apk) today. The
 * ios / ios-ci / ios-device / browserstack-ios projects below are commented out;
 * uncomment them once an iOS build (`.app`/`.ipa`) exists.
 *
 * Run one with:  npx taqwright test --project <name>
 */

const APP_PACKAGE = 'com.way2automation.medishop';
const APP_PATH = './app/way2automation.apk';

/** AVD id from `emulator -list-avds`. Created by `npm run setup:android`. */
const AVD_NAME = process.env.ANDROID_AVD ?? 'Pixel_10_Pro_XL';
/** adb serial of an already-booted emulator (CI) — see `npx taqwright devices`. */
const CI_UDID = process.env.ANDROID_UDID ?? 'emulator-5554';

// iOS disabled — no `.app`/`.ipa` checked into `app/` yet, only Android. Uncomment
// these along with the iOS projects below once an iOS build exists.
// const IOS_BUNDLE_ID = process.env.IOS_BUNDLE_ID ?? 'com.way2automation.medishop';
// /** Simulator build (`.app`), used by `ios` / `ios-ci`. */
// const IOS_APP_PATH = process.env.IOS_APP_PATH ?? './app/way2automation.app';
// /** Signed device build (`.ipa`), used by `ios-device` / `browserstack-ios`. */
// const IOS_IPA_PATH = process.env.IOS_IPA_PATH ?? './app/way2automation.ipa';
//
// /** Simulator name from `xcrun simctl list devices`. Taqwright boots it for `ios`. */
// const SIMULATOR_NAME = process.env.IOS_SIMULATOR_NAME ?? 'iPhone 17 Pro';
// /** iOS runtime version backing that simulator. */
// const SIMULATOR_OS_VERSION = process.env.IOS_OS_VERSION ?? '26.5';
// /** UDID of an already-booted simulator (CI, or a local sim you booted yourself) — see `npx taqwright devices`. */
// const CI_IOS_UDID = process.env.IOS_UDID ?? '786021CF-AD4B-4C3E-8F14-509D9754B366';
// /** UDID of the physical iPhone (from `xcrun xctrace list devices` or Xcode's Devices window). */
// const IOS_DEVICE_UDID = process.env.IOS_DEVICE_UDID ?? '';

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expectTimeout: 60_000,
  outputDir: './test-results',
  reporter: [['list'], ['html', { open: 'never' }]],
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  // Serial by default: one Appium, one device. See docs/parallelism before raising this —
  // workers > 1 on a local provider requires device.pool or device.autoDiscover.
  workers: 1,

  projects: [
    /* ── Local emulator: Taqwright starts Appium AND cold-boots the AVD ────────── */
    {
      name: 'android',
      use: {
        platform: Platform.ANDROID,
        device: {
          provider: 'emulator',
          name: AVD_NAME,
          orientation: 'portrait',
          // pool: [                                   // parallel across emulators
          //   { udid: 'emulator-5554', name: 'Pixel_7_API_34' },
          //   { udid: 'emulator-5556', name: 'Pixel_7_API_34_2' },
          // ],
          // autoDiscover: true,                       // or let Taqwright find them
        },
        appium: {
          autoStart: true,
          autoStartDevice: true, // cold-boots AVD_NAME
          host: 'localhost',
          port: 4723,
          path: '/', // Appium 3 default (1.x used '/wd/hub')
          logLevel: 'warn',
        },
        // Reinstall + relaunch a clean app before every test. All three are
        // type-required together — this is what gives us test isolation.
        resetBetweenTests: true,
        buildPath: APP_PATH,
        appBundleId: APP_PACKAGE,
        capabilities: {
          'appium:autoGrantPermissions': true,
        },
        trace: 'on-failure',
        video: 'on-failure',
      },
    },

    /* ── CI: emulator is already booted by the runner, don't try to boot one ───── */
    {
      name: 'android-ci',
      use: {
        platform: Platform.ANDROID,
        device: {
          provider: 'emulator',
          udid: CI_UDID,
        },
        appium: {
          autoStart: true,
          autoStartDevice: false, // the CI step already booted it
          host: 'localhost',
          port: 4723,
          path: '/',
          logLevel: 'warn',
          newCommandTimeout: 240,
        },
        resetBetweenTests: true,
        buildPath: APP_PATH,
        appBundleId: APP_PACKAGE,
        capabilities: {
          'appium:autoGrantPermissions': true,
        },
        trace: 'on',
        video: 'on-failure',
      },
      retries: 2,
    },

    /* ── Physical handset over adb ─────────────────────────────────────────────── */
    {
      name: 'android-device',
      use: {
        platform: Platform.ANDROID,
        device: {
          provider: 'local-device',
          //udid: DEVICE_UDID,
        },
        appium: { autoStart: true, host: 'localhost', port: 4723, path: '/' },
        resetBetweenTests: true,
        buildPath: APP_PATH,
        appBundleId: APP_PACKAGE,
        trace: 'on-failure',
        video: 'on-failure',
      },
    },

    /* ── BrowserStack real devices ─────────────────────────────────────────────── */
    /* Credentials come from the environment, never from this file:
     *   export BROWSERSTACK_USERNAME=...
     *   export BROWSERSTACK_ACCESS_KEY=...
     * Pre-upload the APK once and set BROWSERSTACK_APP_ID=bs://<id> so each worker
     * doesn't re-upload the 20 MB build.
     */
    {
      name: 'browserstack-android',
      use: {
        platform: Platform.ANDROID,
        device: {
          provider: 'browserstack',
          name: process.env.BS_DEVICE ?? 'Google Pixel 8',
          osVersion: process.env.BS_OS_VERSION ?? '14.0',
          orientation: 'portrait',
        },
        resetBetweenTests: true,
        buildPath: process.env.BROWSERSTACK_APP_ID ?? APP_PATH,
        appBundleId: APP_PACKAGE,
        trace: 'on',
        video: 'off', // BrowserStack records server-side
        capabilities: {
          'bstack:options': {
            projectName: 'PageObjectModelTW',
            // Just a label to group this run in the BrowserStack dashboard —
            // nothing to do with the BrowserStack Local tunnel.
            buildName: process.env.BROWSERSTACK_BUILD_NAME ?? 'medishop-manual-run',
            appiumVersion: '2.19.0',
          },
        },
      },
      // Cloud parallelism is plain workers — no device.pool needed. Keep this at or
      // below your plan's parallel-session limit; override per run with --workers N.
      workers: Number(process.env.BS_WORKERS ?? 2),
    },

    /* ── iOS projects — disabled, no iOS app build exists yet, only Android. ──────
     * Uncomment these (and the IOS_* consts above) once an iOS `.app`/`.ipa` exists.
     *
     * { ── Local simulator: Taqwright starts Appium AND boots the simulator ─────── }
     * {
     *   name: 'ios',
     *   use: {
     *     platform: Platform.IOS,
     *     device: {
     *       provider: 'emulator',
     *       name: SIMULATOR_NAME,
     *       osVersion: SIMULATOR_OS_VERSION,
     *       orientation: 'portrait',
     *     },
     *     appium: {
     *       autoStart: true,
     *       autoStartDevice: true, // boots the named simulator
     *       host: 'localhost',
     *       port: 4723,
     *       path: '/',
     *       logLevel: 'warn',
     *     },
     *     resetBetweenTests: true,
     *     buildPath: IOS_APP_PATH,
     *     appBundleId: IOS_BUNDLE_ID,
     *     trace: 'on-failure',
     *     video: 'on-failure',
     *   },
     * },
     *
     * { ── CI: simulator is already booted, don't try to boot one ───────────────── }
     * {
     *   name: 'ios-ci',
     *   use: {
     *     platform: Platform.IOS,
     *     device: {
     *       provider: 'emulator',
     *       udid: CI_IOS_UDID,
     *     },
     *     appium: {
     *       autoStart: true,
     *       autoStartDevice: false, // the CI step already booted it
     *       host: 'localhost',
     *       port: 4723,
     *       path: '/',
     *       logLevel: 'warn',
     *       newCommandTimeout: 240,
     *     },
     *     resetBetweenTests: true,
     *     buildPath: IOS_APP_PATH,
     *     appBundleId: IOS_BUNDLE_ID,
     *     trace: 'on',
     *     video: 'on-failure',
     *   },
     *   retries: 2,
     * },
     *
     * { ── Physical iPhone over usbmuxd ───────────────────────────────────────────── }
     * {
     *   name: 'ios-device',
     *   use: {
     *     platform: Platform.IOS,
     *     device: {
     *       provider: 'local-device',
     *       //udid: IOS_DEVICE_UDID,
     *     },
     *     appium: { autoStart: true, host: 'localhost', port: 4723, path: '/' },
     *     resetBetweenTests: true,
     *     buildPath: IOS_IPA_PATH,
     *     appBundleId: IOS_BUNDLE_ID,
     *     trace: 'on-failure',
     *     video: 'on-failure',
     *   },
     * },
     *
     * { ── BrowserStack real devices (iOS) ───────────────────────────────────────── }
     * { Credentials come from the environment, never from this file — same two vars
     *   as browserstack-android. Pre-upload the .ipa once and set
     *   BROWSERSTACK_IOS_APP_ID=bs://<id> so each worker doesn't re-upload the build.
     * }
     * {
     *   name: 'browserstack-ios',
     *   use: {
     *     platform: Platform.IOS,
     *     device: {
     *       provider: 'browserstack',
     *       name: process.env.BS_IOS_DEVICE ?? 'iPhone 15',
     *       osVersion: process.env.BS_IOS_OS_VERSION ?? '17',
     *       orientation: 'portrait',
     *     },
     *     resetBetweenTests: true,
     *     buildPath: process.env.BROWSERSTACK_IOS_APP_ID ?? IOS_IPA_PATH,
     *     appBundleId: IOS_BUNDLE_ID,
     *     trace: 'on',
     *     video: 'off', // BrowserStack records server-side
     *     capabilities: {
     *       'bstack:options': {
     *         projectName: 'PageObjectModelTW',
     *         // Just a label to group this run in the BrowserStack dashboard —
     *         // nothing to do with the BrowserStack Local tunnel.
     *         buildName: process.env.BROWSERSTACK_BUILD_NAME ?? 'medishop-manual-run',
     *         appiumVersion: '2.19.0',
     *       },
     *     },
     *   },
     *   workers: Number(process.env.BS_WORKERS ?? 2),
     * },
     */
  ],
});
