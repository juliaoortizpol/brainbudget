// Run by the trusted operator, outside the role process.
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const qa = require('../qa.cjs');
const [executable, output] = process.argv.slice(2);
if (!executable || !output || !fs.existsSync(executable)) throw Error('Usage: node serve.cjs HEADLESS_CHROMIUM_EXE QA_SCRATCH');
const scratch = fs.realpathSync(output);
const relative = path.relative(path.resolve(qa.STATE, '..'), scratch);
if (relative.startsWith('..') || path.isAbsolute(relative) || path.basename(scratch) !== 'scratch') throw Error('Output must be an existing QA scratch under the runs directory');
const child = spawn(process.execPath, [path.join(__dirname, 'node_modules/@playwright/mcp/cli.js'),
  '--headless', '--isolated', '--executable-path', path.resolve(executable),
  '--init-page', path.join(__dirname, 'init.ts'), '--block-service-workers', '--no-webmcp',
  '--codegen', 'none', '--allowed-origins', 'http://127.0.0.1:15173;http://127.0.0.1:13000',
  '--host', '127.0.0.1', '--port', '15174', '--output-dir', scratch],
  { cwd: scratch, stdio: 'inherit', windowsHide: true,
    env: { ...process.env, FINANCES_QA_CREDENTIALS_FILE: path.join(qa.STATE, 'credentials.json') } });
process.on('SIGINT', () => child.kill());
process.on('SIGTERM', () => child.kill());
child.on('exit', code => { process.exitCode = code || 0; });
