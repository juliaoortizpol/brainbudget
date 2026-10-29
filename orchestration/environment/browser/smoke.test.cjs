const { test } = require('node:test');
const assert = require('node:assert/strict');
const { allowed } = require('./smoke.cjs');
test('browser allows only the two synthetic HTTP origins without URL credentials', () => {
  for (const url of ['http://127.0.0.1:15173/accounts', 'http://127.0.0.1:13000/accounts']) assert.equal(allowed(url), true);
  for (const url of ['https://127.0.0.1:13000', 'http://localhost:13000', 'http://127.0.0.1:13001', 'http://127.0.0.1:13000.evil.test', 'file:///etc/passwd', 'http://user:secret@127.0.0.1:13000', 'https://example.com', 'invalid']) assert.equal(allowed(url), false);
});
