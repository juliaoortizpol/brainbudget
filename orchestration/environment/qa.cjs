// Trusted operator utility. Never pass connection strings or passwords as CLI arguments.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseEnv } = require('node:util');
const { MongoClient, ObjectId } = require('mongodb');
const ConnectionString = require('mongodb-connection-string-url').default;
const bcrypt = require('bcrypt');
const ROOT = path.resolve(__dirname, '../..');
const STATE = path.resolve(ROOT, '../.finances-runs/qa-environment');
const DATABASE = 'brainbudget_qa_synthetic';
const MARKER = 'finances-synthetic-v1';
const id = n => new ObjectId(n.toString(16).padStart(24, '0'));
function assert(ok, message) { if (!ok) throw new Error(message); }
function targetUri(uri) {
  const parsed = new ConnectionString(uri);
  const original = decodeURIComponent(parsed.pathname.slice(1));
  assert(original !== DATABASE, 'Source must identify the approved dev connection, not this synthetic target');
  const authKey = [...parsed.searchParams.keys()].find(k => k.toLowerCase() === 'authsource');
  if (parsed.username && !authKey) parsed.searchParams.set('authSource', original || 'admin');
  parsed.pathname = '/' + DATABASE;
  return parsed.toString();
}
function connection(pin = false) {
  const env = parseEnv(fs.readFileSync(path.join(ROOT, '.env'), 'utf8'));
  assert(env.MONGODB_URI, 'Approved local .env must contain MONGODB_URI');
  assert(!['production', 'beta'].includes(env.APP_ENV), 'Refusing deployed environment configuration');
  const parsed = new ConnectionString(env.MONGODB_URI);
  const fingerprint = crypto.createHash('sha256').update(parsed.hosts.join(',').toLowerCase()).digest('hex');
  const filename = path.join(STATE, 'instance-pin.json');
  if (pin && !fs.existsSync(filename)) {
    fs.mkdirSync(STATE, { recursive: true });
    fs.writeFileSync(filename, JSON.stringify({ fingerprint, database: DATABASE }), { flag: 'wx', mode: 0o600 });
  }
  assert(fs.existsSync(filename), 'Operator must pin the approved dev/QA instance first');
  const approved = JSON.parse(fs.readFileSync(filename, 'utf8'));
  assert(approved.fingerprint === fingerprint && approved.database === DATABASE, 'Instance changed; reconfirm with Julio');
  return targetUri(env.MONGODB_URI);
}
function credentials() {
  fs.mkdirSync(STATE, { recursive: true });
  const filename = path.join(STATE, 'credentials.json');
  if (!fs.existsSync(filename)) fs.writeFileSync(filename, JSON.stringify({
    password: crypto.randomBytes(24).toString('base64url'), jwtSecret: crypto.randomBytes(48).toString('hex')
  }), { flag: 'wx', mode: 0o600 });
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
}
async function fixtures() {
  const passwordHash = await bcrypt.hash(credentials().password, 10);
  const date = new Date('2026-10-15T12:00:00Z');
  const user = n => ({ _id: id(n), email: `qa${n}@example.test`, passwordHash, providers: ['local'], role: 'user', createdAt: date, updatedAt: date });
  const account = (n, userId, deleted = false) => ({ _id: id(n), userId: id(userId), name: `Synthetic account ${n}`, institution: 'Synthetic Bank', institutionId: id(10), type: 'checking', status: 'active', isDeleted: deleted, maxBalance: 1000, last4Digits: '0000' });
  const budget = (n, status, deleted = false) => ({ _id: id(n), userId: id(1), name: `Synthetic ${status} budget`, periodType: 'monthly', startDate: new Date('2026-10-01T00:00:00Z'), endDate: new Date('2026-10-31T23:59:59Z'), status, isDeleted: deleted });
  return {
    users: [user(1), user(2)],
    institutions: [{ _id: id(10), name: 'Synthetic Bank', slug: 'synthetic-bank', aliases: [], supportedAccountTypes: ['checking'], emailRules: [], enabled: true }],
    accounts: [account(20, 1), account(21, 2), account(22, 1, true)],
    budgets: [budget(30, 'active'), budget(31, 'closed'), budget(32, 'draft', true)],
    budgetitems: [{ _id: id(40), userId: id(1), budgetId: id(30), name: 'Synthetic groceries', type: 'expense', plannedAmount: 500, isDeleted: false, matchingRules: [] }],
    transactions: [{ _id: id(50), userId: id(1), accountId: id(20), budgetItemId: id(40), name: 'Synthetic groceries', amount: 25.5, type: 'expense', currency: 'BOB', date, source: 'manual', matchingStatus: 'manual', matchingSource: 'manual' }]
  };
}
async function guard(db, data, initialize = false) {
  assert(db.databaseName === DATABASE, 'Unexpected database');
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  if (!collections.length && initialize) {
    await db.collection('_qa_control').insertOne({ _id: MARKER, database: DATABASE, synthetic: true });
    return;
  }
  const marker = await db.collection('_qa_control').findOne({ _id: MARKER });
  assert(marker?.synthetic === true && marker.database === DATABASE, 'Missing synthetic ownership marker');
  assert(await db.collection('_qa_control').countDocuments({}) === 1, 'Unexpected control records');
  for (const { name } of collections) {
    if (name === '_qa_control') continue;
    const ids = (data[name] || []).map(row => row._id);
    assert(await db.collection(name).countDocuments({ _id: { $nin: ids } }) === 0,
      'Unknown documents found; reset refused. Preserve and inspect test-created data first');
  }
}
async function seed(reset = false) {
  fs.mkdirSync(STATE, { recursive: true });
  const lock = path.join(STATE, 'server.lock');
  const fd = fs.openSync(lock, 'wx'); fs.writeSync(fd, String(process.pid)); fs.closeSync(fd);
  let client;
  try {
    client = new MongoClient(connection(), { serverSelectionTimeoutMS: 10000 });
    await client.connect();
    const db = client.db(DATABASE), data = await fixtures();
    await guard(db, data, !reset);
    // No dropDatabase, collection drops, or unfiltered deletes. Unknown records stop the operation.
    for (const [name, rows] of Object.entries(data)) {
      if (reset) await db.collection(name).deleteMany({ _id: { $in: rows.map(row => row._id) } });
      for (const row of rows) await db.collection(name).updateOne({ _id: row._id }, { $setOnInsert: row }, { upsert: true });
    }
    const report = { database: DATABASE, synthetic: true, operation: reset ? 'reset' : 'seed', at: new Date().toISOString(), counts: {} };
    for (const name of Object.keys(data)) report.counts[name] = await db.collection(name).countDocuments({});
    fs.writeFileSync(path.join(STATE, 'seed-report.json'), JSON.stringify(report, null, 2));
    return report;
  } finally { if (client) await client.close(); fs.unlinkSync(lock); }
}
module.exports = { ROOT, STATE, DATABASE, MARKER, targetUri, connection, credentials, fixtures, guard, seed };
if (require.main === module) {
  const action = process.argv[2];
  if (action === 'pin') { try { connection(true); console.log(JSON.stringify({ pinned: true, database: DATABASE })); } catch { console.error('Instance pin refused'); process.exitCode = 1; } }
  else if (!['seed', 'reset'].includes(action)) { console.error('Usage: node qa.cjs pin|seed|reset'); process.exitCode = 2; }
  else seed(action === 'reset').then(r => console.log(JSON.stringify(r))).catch(e => {
    // Driver errors may contain connection details; emit classification only.
    console.error(JSON.stringify({ failed: true, errorType: e.name, code: e.code || null })); process.exitCode = 1;
  });
}
