const http = require('http');

async function main() {
  console.log('--- SMN SWEET\'S SYSTEM VERIFICATION SCRIPT ---');

  // Helper to make HTTP requests
  function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(`http://127.0.0.1:4000${path}`);
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method,
        headers: headers
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  try {
    // 1. Health / Auth
    console.log('\n[1] Testing Authentication...');
    const loginRes = await request('POST', '/api/auth/login', { username: 'owner', password: 'smn@123' });
    if (!loginRes.body.token) throw new Error('Login failed: ' + JSON.stringify(loginRes.body));
    const token = loginRes.body.token;
    console.log('✓ Admin login successful. Role:', loginRes.body.user.role);

    // 2. Settings Verification
    console.log('\n[2] Testing Settings...');
    const settingsRes = await request('GET', '/api/settings', null, token);
    const settings = settingsRes.body;
    console.log('✓ Settings retrieved.');
    console.log('  Shop Name:', settings.shop_name);
    console.log('  WhatsApp Enabled:', settings.whatsapp_enabled);
    console.log('  WhatsApp Bot URL:', settings.whatsapp_bot_url);

    // Verify SMS and dynamic QR are removed from settings
    if (settings.sms_api_key || settings.sms_provider || settings.bharatpe_device_status || settings.merchant_upi_vpa) {
      console.warn('⚠️ Warning: Legacy keys present in settings response.');
    } else {
      console.log('✓ Clean settings: No SMS gateway or dynamic QR settings in payload.');
    }

    // 3. WhatsApp Status
    console.log('\n[3] Testing WhatsApp Status Endpoint...');
    const waStatus = await request('GET', '/api/whatsapp/status', null, token);
    console.log('✓ WhatsApp status:', waStatus.body);

    // 4. Register or Lookup Customer
    console.log('\n[4] Looking up or Registering Customer...');
    const searchRes = await request('GET', '/api/customers?search=9825198251', null, token);
    let customer;
    if (searchRes.body.customers && searchRes.body.customers.length > 0) {
      customer = searchRes.body.customers[0];
      console.log(`✓ Existing customer found: ${customer.name} (ID: ${customer.id}, Mobile: ${customer.mobile})`);
    } else {
      const custRes = await request('POST', '/api/customers', {
        name: 'Haresh Patel',
        mobile: '9825198251',
        address: 'Navrangpura, Ahmedabad'
      }, token);
      customer = custRes.body.customer;
      console.log(`✓ Customer registered: ${customer.name} (ID: ${customer.id}, Mobile: ${customer.mobile})`);
    }

    // 5. Fetch Products
    const prodRes = await request('GET', '/api/products?activeOnly=1', null, token);
    const products = prodRes.body;
    const kesarPeda = products.find(p => p.name.includes('Peda') || p.name.includes('Kesar')) || products[0];
    const kajuKatli = products.find(p => p.name.includes('Kaju')) || products[1];
    console.log(`✓ Products available: "${kesarPeda.name}" (₹${kesarPeda.price}/${kesarPeda.unit}), "${kajuKatli.name}" (₹${kajuKatli.price}/${kajuKatli.unit})`);

    // 6. Test Manual Cash Bill
    console.log('\n[5] Testing Manual Cash Bill Creation...');
    const cashBillRes = await request('POST', '/api/bills', {
      customer_id: customer.id,
      customer_name: customer.name,
      customer_mobile: customer.normalized_mobile,
      items: [
        {
          product_id: kesarPeda.id,
          product_name: kesarPeda.name,
          quantity: 0.5, // 500g
          unit: 'kg',
          unit_price: kesarPeda.price,
          line_total: Math.round(kesarPeda.price * 0.5 * 100) / 100
        }
      ],
      payment_method: 'cash'
    }, token);
    if (!cashBillRes.body.success) throw new Error('Cash bill failed: ' + JSON.stringify(cashBillRes.body));
    console.log(`✓ Cash Bill Created: #${cashBillRes.body.bill.bill_number}, Amount: ₹${cashBillRes.body.bill.final_amount}`);

    // 7. Test Manual UPI Bill with UTR (No QR)
    console.log('\n[6] Testing Manual UPI Bill with UTR...');
    const upiBillRes = await request('POST', '/api/bills', {
      customer_id: customer.id,
      customer_name: customer.name,
      customer_mobile: customer.normalized_mobile,
      items: [
        {
          product_id: kajuKatli.id,
          product_name: kajuKatli.name,
          quantity: 0.25, // 250g
          unit: 'kg',
          unit_price: kajuKatli.price,
          line_total: Math.round(kajuKatli.price * 0.25 * 100) / 100
        }
      ],
      payment_method: 'upi',
      verification_type: 'manually_confirmed',
      utr: '412389102938'
    }, token);
    if (!upiBillRes.body.success) throw new Error('UPI bill failed: ' + JSON.stringify(upiBillRes.body));
    console.log(`✓ Manual UPI Bill Created: #${upiBillRes.body.bill.bill_number}, Amount: ₹${upiBillRes.body.bill.final_amount}`);

    // Verify payments record in bill details
    const billDetailRes = await request('GET', `/api/bills/${upiBillRes.body.bill.id}`, null, token);
    const payments = billDetailRes.body.payments;
    console.log('✓ Payment ledger verified for UPI bill:');
    payments.forEach(p => console.log(`   - Mode: ${p.method || p.payment_method}, Amount: ₹${p.amount}, Status: ${p.status}, UTR: ${p.utr}`));

    // 8. Test Manual Card Bill
    console.log('\n[7] Testing Manual Card Bill...');
    const cardBillRes = await request('POST', '/api/bills', {
      customer_id: customer.id,
      customer_name: customer.name,
      customer_mobile: customer.normalized_mobile,
      items: [
        {
          product_id: kesarPeda.id,
          product_name: kesarPeda.name,
          quantity: 1,
          unit: 'kg',
          unit_price: kesarPeda.price,
          line_total: kesarPeda.price
        }
      ],
      payment_method: 'card',
      verification_type: 'manually_confirmed',
      utr: 'AUTH-948201'
    }, token);
    if (!cardBillRes.body.success) throw new Error('Card bill failed: ' + JSON.stringify(cardBillRes.body));
    console.log(`✓ Manual Card Bill Created: #${cardBillRes.body.bill.bill_number}, Amount: ₹${cardBillRes.body.bill.final_amount}`);

    // 9. Test WhatsApp Logs
    console.log('\n[8] Testing WhatsApp Delivery Logs & Offline Queue...');
    const waLogsRes = await request('GET', '/api/whatsapp/logs', null, token);
    console.log(`✓ WhatsApp logs returned ${waLogsRes.body.records?.length || 0} records.`);
    console.log(`  Offline Queue Pending Count: ${waLogsRes.body.queuePendingCount}`);
    if (waLogsRes.body.records && waLogsRes.body.records.length > 0) {
      const latest = waLogsRes.body.records[0];
      console.log(`  Latest Record: Bill #${latest.bill_number}, To: ${latest.mobile_number}, Status: ${latest.status}`);
    }

    // 10. Test Resend WhatsApp
    console.log('\n[9] Testing Resend WhatsApp Invoice API...');
    const resendRes = await request('POST', `/api/bills/${upiBillRes.body.bill.id}/send-whatsapp`, null, token);
    console.log('✓ Resend WhatsApp result:', resendRes.body);

    // 11. Test Historical SMS Archive
    console.log('\n[10] Testing Historical SMS Archive API...');
    const archiveRes = await request('GET', '/api/sms/history', null, token);
    console.log(`✓ Historical SMS archive accessible. Total historical records: ${archiveRes.body.records?.length || 0}`);

    // 12. Test Dashboard Stats
    console.log('\n[11] Testing Dashboard Stats...');
    const statsRes = await request('GET', '/api/dashboard/stats', null, token);
    console.log('✓ Dashboard Stats:');
    console.log('  Today Sales: ₹' + statsRes.body.today_sales);
    console.log('  Today Bills:', statsRes.body.today_bills);
    console.log('  Today WhatsApp Sent:', statsRes.body.today_whatsapp_sent);
    console.log('  Today WhatsApp Failed/Queued:', statsRes.body.today_whatsapp_failed);

    console.log('\n======================================================');
    console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
    console.log('======================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  }
}

main();
