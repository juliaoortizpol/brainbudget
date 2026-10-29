// Foreground supervisor: Ctrl+C stops only its own children. `smoke` verifies and stops.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
const qa = require('./qa.cjs');
const FRONT = path.resolve(qa.ROOT, '../chillbudget');
const API = 'http://127.0.0.1:13000', UI = 'http://127.0.0.1:15173';
const children = [];
let stage = 'configuration';
const git = root => execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const request = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
async function free(port) {
  await new Promise((resolve, reject) => { const s = net.createServer(); s.once('error', reject); s.listen(port, '127.0.0.1', () => s.close(resolve)); });
}
function stop() {
  for (const child of children) if (child.exitCode === null) {
    if (process.platform === 'win32') { try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {} }
    else { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
  }
}
function start(args, env) {
  const child = spawn(process.execPath, args, { cwd: qa.STATE, env, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true, detached: process.platform !== 'win32' });
  child.stderr.on('data', chunk => { const codes = String(chunk).match(/ERR_[A-Z_]+|Mongo[A-Za-z]+Error|TypeError|SyntaxError/g); if (codes) child.diagnostic = [...new Set(codes)].join(','); });
  children.push(child); return child;
}
async function wait(url) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (children.some(c => c.exitCode !== null)) throw Error('Server exited during startup');
    try { const r = await fetch(url, { signal: AbortSignal.timeout(1000) }); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw Error('Readiness timeout');
}
async function main(smoke) {
  fs.mkdirSync(qa.STATE, { recursive: true });
  const lock = path.join(qa.STATE, 'server.lock');
  const fd = fs.openSync(lock, 'wx'); fs.writeSync(fd, String(process.pid)); fs.closeSync(fd);
  try {
    await free(13000); await free(15173);
    stage = 'clean source/build';
    for (const root of [qa.ROOT, FRONT]) execFileSync('git', ['-C', root, 'diff', '--quiet', 'HEAD', '--', 'src', 'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.build.json', 'vite.config.ts'], { stdio: 'ignore' });
    for (const args of [[path.join(qa.ROOT, 'node_modules/@nestjs/cli/bin/nest.js'), 'build'], [path.join(qa.ROOT, 'node_modules/tsc-alias/dist/bin/index.js'), '-p', 'tsconfig.build.json']]) {
      execFileSync(process.execPath, args, { cwd: qa.ROOT, stdio: 'ignore', timeout: 180000, windowsHide: true });
    }
    const secrets = qa.credentials();
    const env = Object.fromEntries(['PATH', 'SystemRoot', 'SystemDrive', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
    Object.assign(env, { NODE_ENV: 'test', APP_ENV: 'test', PORT: '13000', FRONTEND_URL: UI,
      MONGODB_URI: qa.connection(), JWT_SECRET: secrets.jwtSecret, GOOGLE_CLIENT_ID: 'synthetic-unused',
      GOOGLE_CLIENT_SECRET: 'synthetic-unused', GOOGLE_CALLBACK_URL: API + '/auth/google/callback',
      GMAIL_READER_STATE_SECRET: secrets.jwtSecret, GMAIL_READER_REDIRECT_URI: API + '/gmail-reader/callback' });
    const wrapper = path.join(qa.STATE, 'backend.cjs');
    fs.writeFileSync(wrapper, `const net=require('node:net');const original=net.Server.prototype.listen;net.Server.prototype.listen=function(...args){if(typeof args[0]==='object')args[0]={...args[0],host:'127.0.0.1'};else if(typeof args[1]==='string')args[1]='127.0.0.1';else args.splice(1,0,'127.0.0.1');return original.apply(this,args)};require(${JSON.stringify(path.join(qa.ROOT, 'dist/main.js'))});`);
    start([wrapper], env);
    const uiEnv = { ...env, VITE_API_URL: API }; delete uiEnv.MONGODB_URI; delete uiEnv.JWT_SECRET;
    // Vite receives an explicit test API URL and loopback bind; API CORS matches this UI.
    start([path.join(FRONT, 'node_modules/vite/bin/vite.js'), FRONT, '--host', '127.0.0.1', '--port', '15173', '--strictPort'], uiEnv);
    stage = 'backend health'; await wait(API + '/health'); stage = 'frontend HTTP'; await wait(UI);
    stage = 'synthetic login';
    const login = await request(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'qa1@example.test', password: secrets.password }) });
    if (!login.ok) throw Error('Synthetic authentication failed');
    const { access_token: token } = await login.json();
    stage = 'database ownership';
    const headers = { Authorization: 'Bearer ' + token };
    const accounts = await request(API + '/accounts', { headers });
    const data = await accounts.json();
    if (!accounts.ok || !Array.isArray(data) || data.length !== 1 || data[0]._id !== '000000000000000000000014') throw Error('Database ownership/soft-delete readiness failed');
    const other = await request(API + '/accounts/000000000000000000000015', { headers });
    if (![403, 404].includes(other.status)) throw Error('Cross-user access check failed');
    const report = { at: new Date().toISOString(), database: qa.DATABASE, data_mode: 'synthetic',
      commits: { backend: git(qa.ROOT), frontend: git(FRONT) }, api: API, ui: UI,
      pids: children.map(c => c.pid), readiness_verified: true, browser_ready: false,
      checks: ['health', 'frontend HTTP', 'synthetic login', 'database accounts read', 'other-user denied', 'deleted account excluded'],
      mode: smoke ? 'smoke-stops-servers' : 'serve-until-interrupted',
      limitations: ['No browser QA yet', 'Shared dev credential; database-scoped user still required', 'No served-build attestation beyond this supervised local build'] };
    fs.writeFileSync(path.join(qa.STATE, 'readiness.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    if (!smoke) await new Promise(resolve => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); children.forEach(c => c.once('exit', resolve)); });
  } finally { stop(); fs.unlinkSync(lock); }
}
if (require.main === module) main(process.argv[2] === 'smoke').catch(e => { stop(); console.error(JSON.stringify({ failed: true, stage, errorType: e.name, childErrors: children.map(c => c.diagnostic || null) })); process.exitCode = 1; });
