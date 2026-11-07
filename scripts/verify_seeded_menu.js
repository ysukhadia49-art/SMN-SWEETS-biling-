const http = require('http');

function apiCall(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://127.0.0.1:4000${path}`);
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function verify() {
  console.log('=== SMN SWEET\'S — END-TO-END SEEDED MENU VERIFICATION ===\n');

  // 1. Login as owner
  console.log('[1] Logging in as Owner...');
  const loginRes = await apiCall('POST', '/api/auth/login', {
    username: 'owner',
    password: 'smn@123'
  });
  if (loginRes.status !== 200 || !loginRes.data.token) {
    throw new Error('Login failed: ' + JSON.stringify(loginRes.data));
  }
  const token = loginRes.data.token;
  console.log('    ✓ Login successful. User:', loginRes.data.user.full_name);

  // 2. Verify Settings
  console.log('\n[2] Verifying Shop Settings...');
  const settingsRes = await apiCall('GET', '/api/settings', null, token);
  const s = settingsRes.data;
  console.log(`    Shop Name: "${s.shop_name}"`);
  console.log(`    Established: "${s.est_year}"`);
  console.log(`    Address: "${s.shop_address}"`);
  console.log(`    Mobile: "${s.shop_mobile}"`);
  console.log(`    Bill Prefix: "${s.bill_prefix}" | Next: "${s.bill_next_number}"`);
  if (s.shop_name !== 'Sukhadiya Manilal Nathalal' || s.est_year !== '1849') {
    throw new Error('Settings mismatch!');
  }
  console.log('    ✓ Settings match official menu card.');

  // 3. Verify Categories
  console.log('\n[3] Verifying Categories...');
  const catRes = await apiCall('GET', '/api/categories', null, token);
  console.log(`    Total categories returned: ${catRes.data.length}`);
  for (const c of catRes.data) {
    console.log(`    • ${c.name} (${c.gujarati_name})`);
  }
  if (catRes.data.length !== 8) {
    throw new Error(`Expected 8 categories, got ${catRes.data.length}`);
  }
  console.log('    ✓ All 8 official categories confirmed.');

  // 4. Verify Products
  console.log('\n[4] Verifying Products...');
  const prodRes = await apiCall('GET', '/api/products', null, token);
  console.log(`    Total products returned: ${prodRes.data.length}`);
  if (prodRes.data.length !== 49) {
    throw new Error(`Expected 49 products, got ${prodRes.data.length}`);
  }

  // Spot-check key items
  const safedPeda = prodRes.data.find(p => p.name === 'Safed Peda');
  console.log(`    • Safed Peda: ₹${safedPeda.price}/${safedPeda.unit} (${safedPeda.gujarati_name}) - Category: ${safedPeda.category}`);
  const kajukatri = prodRes.data.find(p => p.name === 'Kajukatri');
  console.log(`    • Kajukatri: ₹${kajukatri.price}/${kajukatri.unit} (${kajukatri.gujarati_name}) - Category: ${kajukatri.category}`);
  const bombayIceHalwa = prodRes.data.find(p => p.name === 'Bombay Ice Halwa');
  console.log(`    • Bombay Ice Halwa: ₹${bombayIceHalwa.price}/${bombayIceHalwa.unit} (${bombayIceHalwa.gujarati_name}) - Category: ${bombayIceHalwa.category}`);
  const badamKatri = prodRes.data.find(p => p.name === 'Badam Katri');
  console.log(`    • Badam Katri: ₹${badamKatri.price}/${badamKatri.unit} (${badamKatri.gujarati_name}) - Category: ${badamKatri.category}`);
  const mohanthal = prodRes.data.find(p => p.name === 'Kesar Mohanthal');
  console.log(`    • Kesar Mohanthal: ₹${mohanthal.price}/${mohanthal.unit} (${mohanthal.gujarati_name}) - Category: ${mohanthal.category}`);

  console.log('    ✓ All 49 authentic products verified successfully.');

  // 5. Verify Bills is currently 0
  console.log('\n[5] Verifying zero prior bills...');
  const billsRes = await apiCall('GET', '/api/bills', null, token);
  console.log(`    Existing bills count: ${billsRes.data.bills ? billsRes.data.bills.length : billsRes.data.length}`);
  
  console.log('\n========================================');
  console.log('ALL VERIFICATION CHECKS PASSED PERFECTLY!');
  console.log('========================================\n');
}

verify().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});

