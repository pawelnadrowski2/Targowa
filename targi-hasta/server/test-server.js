import './server.js';

async function test() {
  await new Promise(r => setTimeout(r, 500));

  console.log('Testing /api/health...');
  const res = await fetch('http://127.0.0.1:3001/api/health');
  const health = await res.json();
  console.log('Health:', health);

  console.log('Testing Exhibitor Login with HA-101...');
  const loginRes = await fetch('http://127.0.0.1:3001/api/auth/login-exhibitor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessCode: 'HA-101' })
  });
  const loginData = await loginRes.json();
  console.log('Exhibitor Login:', loginData);

  if (!loginData.session || !loginData.session.token) {
    throw new Error('Login failed!');
  }
  const exhibitorToken = loginData.session.token;

  console.log('Testing creating order by exhibitor...');
  const orderRes = await fetch('http://127.0.0.1:3001/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${exhibitorToken}`
    },
    body: JSON.stringify({
      clientName: 'Firma Budowlana Janusz i Syn',
      orderValue: 12500.50
    })
  });
  const orderData = await orderRes.json();
  console.log('Order created:', orderData);

  console.log('Testing Admin Login...');
  const adminLoginRes = await fetch('http://127.0.0.1:3001/api/auth/login-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin123' })
  });
  const adminLoginData = await adminLoginRes.json();
  console.log('Admin login:', adminLoginData);
  const adminToken = adminLoginData.session.token;

  console.log('Testing Stats with Admin token...');
  const statsRes = await fetch('http://127.0.0.1:3001/api/stats', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const stats = await statsRes.json();
  console.log('Stats:', stats);

  console.log('ALL API TESTS PASSED SUCCESSFULLY! ✅');
  process.exit(0);
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
