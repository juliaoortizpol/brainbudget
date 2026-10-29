import fs from 'node:fs';
export default async ({ page }) => {
  const credentialsFile = process.env.FINANCES_QA_CREDENTIALS_FILE;
  if (!credentialsFile) throw new Error('Synthetic QA credentials file is not configured');
  const secrets = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));
  const response = await fetch('http://127.0.0.1:13000/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'qa1@example.test', password: secrets.password }) });
  if (!response.ok) throw new Error('Synthetic authentication failed');
  const { access_token } = await response.json();
  await page.context().route('**/*', route => {
    const url = new URL(route.request().url());
    return ['http://127.0.0.1:15173', 'http://127.0.0.1:13000'].includes(url.origin) ? route.continue() : route.abort();
  });
  await page.context().routeWebSocket('**/*', socket => socket.close());
  await page.addInitScript(token => { if (location.origin === 'http://127.0.0.1:15173') localStorage.setItem('jwt_token', token); }, access_token);
};

