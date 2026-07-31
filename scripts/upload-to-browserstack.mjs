#!/usr/bin/env node
/**
 * Upload the app build to BrowserStack App Automate once, then reuse the
 * returned bs:// id for every run.
 *
 *   npm run bs:upload            # uploads ./app/way2automation.apk
 *   npm run bs:upload -- --ios   # uploads ./app/way2automation.ipa
 *
 * Why bother: without a bs:// id, Taqwright uploads the 20 MB APK once per
 * worker, every run. This uploads once and writes BROWSERSTACK_APP_ID into .env
 * so subsequent `npm run test:bs` calls skip the upload entirely.
 *
 * Note BrowserStack deletes uploads 30 days after last use, so re-run this if a
 * run suddenly complains the app id is unknown.
 */
import { readFile, writeFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import 'dotenv/config';

const UPLOAD_URL = 'https://api-cloud.browserstack.com/app-automate/upload';

const isIos = process.argv.includes('--ios');
const appPath = isIos
    ? (process.env.IOS_IPA_PATH ?? './app/way2automation.ipa')
    : './app/way2automation.apk';
const envKey = isIos ? 'BROWSERSTACK_IOS_APP_ID' : 'BROWSERSTACK_APP_ID';

const user = process.env.BROWSERSTACK_USERNAME;
const key = process.env.BROWSERSTACK_ACCESS_KEY;

function fail(message) {
    console.error(`\n✖ ${message}\n`);
    process.exit(1);
}

if (!user || !key) {
    fail(
        'BROWSERSTACK_USERNAME / BROWSERSTACK_ACCESS_KEY are not set.\n' +
        '  cp .env.example .env   then fill them in (dashboard → Account → Settings → Auth & Keys).',
    );
}

try {
    await stat(appPath);
} catch {
    fail(`Build not found at ${appPath}${isIos ? ' — an iOS run needs a signed .ipa, not a simulator .app.' : ''}`);
}

// A stable custom_id means re-uploading replaces the same entry instead of
// piling up builds in the dashboard.
const customId = isIos ? 'medishop-ios' : 'medishop-android';

const form = new FormData();
form.append('file', new Blob([await readFile(appPath)]), basename(appPath));
form.append('custom_id', customId);

console.log(`Uploading ${appPath} to BrowserStack as "${customId}"…`);

const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${user}:${key}`).toString('base64')}` },
    body: form,
});

const body = await res.text();
if (!res.ok) fail(`Upload failed (HTTP ${res.status}):\n${body}`);

let appUrl;
try {
    appUrl = JSON.parse(body).app_url;
} catch {
    fail(`Could not parse the response:\n${body}`);
}
if (!appUrl) fail(`No app_url in the response:\n${body}`);

console.log(`✔ Uploaded: ${appUrl}`);

// Persist it into .env so `npm run test:bs` picks it up with no extra flags.
let env = '';
try {
    env = await readFile('.env', 'utf8');
} catch {
    console.log('  (no .env yet — creating one)');
}

const line = `${envKey}=${appUrl}`;
const pattern = new RegExp(`^${envKey}=.*$`, 'm');
env = pattern.test(env)
    ? env.replace(pattern, line)
    : `${env.trimEnd()}\n${line}\n`.replace(/^\n/, '');

await writeFile('.env', env);
console.log(`✔ Wrote ${envKey} to .env — now run: npm run test:bs`);
