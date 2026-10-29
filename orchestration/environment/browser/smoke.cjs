// Trusted operator tool, never an unrestricted browser service for role sessions.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const UI = 'http://127.0.0.1:15173';
const API = 'http://127.0.0.1:13000';
function allowed(url) {
  try { const u = new URL(url); return !u.username && !u.password && [UI, API].includes(u.origin); }
  catch { return false; }
}
async function run({ state, password, commits }) {
  const { chromium } = require('playwright');
  const directory = fs.mkdtempSync(path.join(state, 'browser-'));
  const report = { kind: 'tool-smoke', at: new Date().toISOString(), commits, data_mode: 'synthetic',
    verdict: 'FAIL', checks: [], screenshots: [], limitations: ['Not an independent ticket QA verdict', 'Browser routing is not OS network isolation'] };
  let browser, page, stage = 'launch';
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', acceptDownloads: false });
    await context.routeWebSocket('**/*', socket => socket.close());
    await context.route('**/*', route => allowed(route.request().url()) ? route.continue() : route.abort());
    page = await context.newPage();
    page.setDefaultTimeout(15000);
    const capture = async (name, caption, mode = 'real') => {
      const file = path.join(directory, name + '.png');
      await page.screenshot({ path: file, fullPage: true, animations: 'disabled', mask: [page.locator('input[type=password]')] });
      report.screenshots.push({ path: file, caption, mode, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') });
      report.checks.push(name);
    };
    stage = 'login';
    await page.goto(UI);
    await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
    await capture('login', 'Synthetic QA login screen');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await page.getByText('Email is required.', { exact: true }).waitFor();
    await page.getByText('Password is required.', { exact: true }).waitFor();
    await capture('validation', 'Required email and password validation');
    await page.getByLabel('Email address').fill('qa1@example.test');
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await page.waitForURL(UI + '/dashboard');
    stage = 'accounts';
    await page.goto(UI + '/accounts');
    await page.getByRole('button', { name: 'Delete Synthetic account 20', exact: true }).waitFor();
    await capture('accounts-desktop', 'Real synthetic database account after UI login, desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await capture('accounts-mobile', 'Same real synthetic account at 390px viewport; visual review required');
    await page.setViewportSize({ width: 1440, height: 1000 });
    stage = 'mocked states';
    let mode = 'empty';
    await context.route(API + '/accounts', async route => {
      await route.fulfill({ status: mode === 'error' ? 503 : 200, contentType: 'application/json', body: mode === 'error' ? '{"message":"Synthetic QA unavailable"}' : '[]' });
    });
    await page.reload();
    await page.getByText('No financial accounts yet', { exact: true }).waitFor();
    await capture('accounts-empty', 'Mocked empty accounts response; not database integration', 'mocked');
    mode = 'error';
    await page.reload();
    await page.getByRole('button', { name: 'Try again', exact: true }).waitFor();
    await capture('accounts-error', 'Mocked HTTP 503 accounts response', 'mocked');
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await context.route(API + '/accounts', async route => { await held; await route.fulfill({ json: [] }).catch(() => {}); });
    try {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByText('Loading accounts...', { exact: true }).waitFor();
      await capture('accounts-loading', 'Mocked delayed accounts response', 'mocked');
    } finally { release(); }
    report.verdict = 'PASS';
  } catch (error) {
    report.failure = { stage, errorType: error.name }; // Never serialize browser call logs or credentials.
    if (page && stage === 'accounts') await page.screenshot({ path: path.join(directory, 'failure.png'), fullPage: true }).catch(() => {});
  } finally {
    if (browser) await browser.close();
    fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
  }
  return { report, reportPath: path.join(directory, 'report.json') };
}
module.exports = { run, allowed };
