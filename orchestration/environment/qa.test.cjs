const { test } = require('node:test');
const assert = require('node:assert/strict');
const { targetUri, guard, DATABASE, MARKER } = require('./qa.cjs');
test('database rewrite preserves authentication database and explicit options', () => {
  const uri = targetUri('mongodb://synthetic:password@localhost/dev?retryWrites=true');
  assert.match(uri, /\/brainbudget_qa_synthetic\?/);
  assert.match(uri, /authSource=dev/);
  assert.match(targetUri('mongodb://synthetic:password@localhost/dev?authSource=admin'), /authSource=admin/);
  assert.throws(() => targetUri('mongodb://localhost/' + DATABASE));
});
function fake({ name = DATABASE, marker = { _id: MARKER, database: DATABASE, synthetic: true }, unknown = 0 } = {}) {
  return { databaseName: name, listCollections: () => ({ toArray: async () => [{ name: '_qa_control' }, { name: 'users' }] }),
    collection: n => ({ findOne: async () => marker, countDocuments: async () => n === '_qa_control' ? 1 : unknown }) };
}
test('reset guard refuses other databases, missing ownership and unknown records', async () => {
  await assert.rejects(guard(fake({ name: 'production' }), {}));
  await assert.rejects(guard(fake({ marker: null }), {}));
  await assert.rejects(guard(fake({ unknown: 1 }), { users: [{ _id: 'owned' }] }));
  await guard(fake(), { users: [{ _id: 'owned' }] });
});
