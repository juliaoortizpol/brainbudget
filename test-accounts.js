const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body || '{}') });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function run() {
  console.log("1. Signup / Login...");
  const authOpts = {
    hostname: 'localhost', port: 3000, path: '/auth/signup', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  };
  let res = await request(authOpts, { email: 'account_test@example.com', password: 'password123' });
  authOpts.path = '/auth/login';
  res = await request(authOpts, { email: 'account_test@example.com', password: 'password123' });
  
  const token = res.data.access_token;
  if (!token) return console.log("Failed to get token", res);
  
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  
  console.log("2. Create an Account...");
  res = await request({ hostname: 'localhost', port: 3000, path: '/accounts', method: 'POST', headers }, {
    name: "My Checking Account",
    institution: "Chase Bank",
    type: "checking",
    last4Digits: "1234"
  });
  console.log("Account created:", res.status, res.data);
  const accountId = res.data._id;
  
  if (!accountId) return console.log("Failed to create account");

  console.log("3. Fetch all accounts...");
  res = await request({ hostname: 'localhost', port: 3000, path: '/accounts', method: 'GET', headers });
  console.log("Fetched Accounts:", res.status, `Count: ${res.data.length}`);

  console.log("4. Update the account...");
  res = await request({ hostname: 'localhost', port: 3000, path: `/accounts/${accountId}`, method: 'PATCH', headers }, {
    name: "Updated Checking Account",
    maxBalance: 5000
  });
  console.log("Account updated:", res.status, res.data.name, res.data.maxBalance);

  console.log("5. Delete the account...");
  res = await request({ hostname: 'localhost', port: 3000, path: `/accounts/${accountId}`, method: 'DELETE', headers });
  console.log("Account deleted:", res.status);
  
  console.log("6. Fetch all accounts after delete...");
  res = await request({ hostname: 'localhost', port: 3000, path: '/accounts', method: 'GET', headers });
  console.log("Fetched Accounts:", res.status, `Count: ${res.data.length}`);
}

run().catch(console.error);
