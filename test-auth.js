const http = require('http');

async function request(path, method, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: responseBody ? JSON.parse(responseBody) : null
        });
      });
    });

    req.on('error', (error) => { reject(error); });

    if (body) { req.write(data); }
    req.end();
  });
}

async function runTests() {
  const email = `test-${Date.now()}@example.com`;
  const password = 'mySuperPassword123!';

  console.log('--- TESTING SIGNUP ---');
  try {
    const signupRes = await request('/auth/signup', 'POST', { email, password });
    console.log(`Status: ${signupRes.statusCode}`);
    console.log(signupRes.body);
  } catch (err) {
    console.log('Signup error:', err.message);
  }

  console.log('\n--- TESTING LOGIN ---');
  let token = null;
  try {
    const loginRes = await request('/auth/login', 'POST', { email, password });
    console.log(`Status: ${loginRes.statusCode}`);
    console.log(loginRes.body);
    token = loginRes.body.access_token;
  } catch (err) {
    console.log('Login error:', err.message);
  }

  console.log('\n--- TESTING PROFILE ---');
  if (token) {
    try {
      const profileRes = await request('/auth/profile', 'GET', null, token);
      console.log(`Status: ${profileRes.statusCode}`);
      console.log(profileRes.body);
    } catch (err) {
      console.log('Profile error:', err.message);
    }
  } else {
    console.log('Skipping profile test because login failed.');
  }
}

runTests();
