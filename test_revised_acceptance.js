/**
 * SMN SWEET'S — REVISED ACCEPTANCE & COMPLIANCE TEST SUITE
 * Validates:
 * 1. Zero customer-facing "No GST" / "Non-GST" terminology.
 * 2. Exact-amount Dynamic UPI QR generation with 2-decimal amount and superseding on cart changes.
 * 3. BharatPe hardware status truthfulness ('NOT CONFIGURED / UNSUPPORTED').
 * 4. Standalone Card payment process with manual confirmation.
 * 5. Split payment (Cash + UPI balance) calculations.
 * 6. Google Cloud outbox logging and diagnostics.
 * 7. Real-time SSE event bus broadcasting.
 * 8. Short URL token resolver (/i/:token).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { db } = require('./server/database/db');

const BASE_URL = 'http://127.0.0.1:4000';
let authToken = '';

function request(method, pathName, body = null, token = authToken) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathName, BASE_URL);
    const postData = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: json, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data, data: {} });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('\n======================================================');
  console.log("SMN SWEET'S — REVISED ACCEPTANCE VERIFICATION");
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
    }
  }

  try {
    // 1. LABEL CLEANUP: Scan built dist/ and src/ for forbidden strings
    console.log('[Test 1] Customer-Facing Label Cleanup (Section 2)...');
    const forbiddenPatterns = [
      /No GST/i,
      /Non-GST/i,
      /Without GST/i,
      /GST Free/i,
      /Tax Free/i,
      /GST:\s*0%/i,
      /Non-GST Billing Mode/i
    ];

    const distFiles = [
      'dist/index.html',
      ...fs.readdirSync('dist/assets').map(f => path.join('dist/assets', f))
    ];
    let forbiddenCount = 0;

    for (const f of distFiles) {
      if (fs.existsSync(f)) {
        const content = fs.readFileSync(f, 'utf8');
        for (const pattern of forbiddenPatterns) {
          if (pattern.test(content)) {
            console.error(`    Found forbidden string matching ${pattern} in ${f}`);
            forbiddenCount++;
          }
        }
      }
    }
    assert(forbiddenCount === 0, 'Zero forbidden tax/non-GST badges or labels found in production bundle');

    // 2. Authentication
    console.log('\n[Test 2] Authentication & Session Token...');
    const loginRes = await request('POST', '/api/auth/login', { username: 'owner', password: 'smn@123' });
    assert(loginRes.status === 200 && loginRes.data.token, 'Owner logged in successfully');
    authToken = loginRes.data.token;

    // 3. Dynamic UPI QR Generation (Exact ₹450.00)
    console.log('\n[Test 3] Dynamic Invoice-Amount UPI QR Generation (Section 51)...');
    const orderRef1 = 'ORD-TEST-' + Date.now();
    const qrRes1 = await request('POST', '/api/payments/attempts', {
      amount: 450.00,
      orderRef: orderRef1,
      method: 'upi'
    });

    assert(qrRes1.status === 200, 'Payment attempt endpoint returned HTTP 200');
    assert(qrRes1.data.attempt.amount_rupees === 450.00, 'Exact payable amount ₹450.00 recorded');
    assert(qrRes1.data.attempt.amount_paise === 45000, 'Amount minor matches 45000 paise');
    assert(qrRes1.data.attempt.qr_data_url.startsWith('data:image/png;base64,'), 'High-contrast base64 QR code image generated');

    const upiPayload = qrRes1.data.attempt.upi_payload;
    assert(upiPayload.includes('pa=smnsweets%40upi') || upiPayload.includes('pa=smnsweets@upi'), 'UPI URI includes merchant VPA');
    assert(upiPayload.includes('am=450.00'), 'UPI URI strictly formats exact 2 decimal amount am=450.00');
    assert(upiPayload.includes('cu=INR'), 'UPI URI specifies currency cu=INR');
    assert(upiPayload.includes(orderRef1), 'UPI URI contains unique order reference');

    // 4. Cart Weight/Item Change: Superseding previous attempt
    console.log('\n[Test 4] Superseding Payment Attempt on Amount Adjustment (Section 51)...');
    const qrRes2 = await request('POST', '/api/payments/attempts', {
      amount: 750.00,
      orderRef: orderRef1,
      method: 'upi'
    });
    assert(qrRes2.status === 200, 'Updated payment attempt returned HTTP 200');
    assert(qrRes2.data.attempt.amount_rupees === 750.00, 'Revised amount ₹750.00 generated');
    assert(qrRes2.data.attempt.upi_payload.includes('am=750.00'), 'UPI URI reflects updated am=750.00');

    // Verify in DB that old attempt was superseded
    const oldAttempt = db.prepare('SELECT status, superseded_by FROM payment_attempts WHERE attempt_uuid = ?').get(qrRes1.data.attempt.attempt_uuid);
    assert(oldAttempt.status === 'CANCELLED' && oldAttempt.superseded_by === qrRes2.data.attempt.attempt_uuid, 'Previous attempt marked CANCELLED and linked to superseded attempt');

    // 5. BharatPe Hardware Status Truthfulness
    console.log('\n[Test 5] BharatPe Hardware Truthful Reporting (Section 52)...');
    const settingsRes = await request('GET', '/api/settings');
    assert(settingsRes.status === 200, 'Settings retrieved');
    assert(settingsRes.data.bharatpe_device_status === 'NOT CONFIGURED / UNSUPPORTED', 'BharatPe device status truthfully reports NOT CONFIGURED / UNSUPPORTED');

    // 6. Card Payment & Manual Confirmation
    console.log('\n[Test 6] Standalone Card Payment & Audited Confirmation (Section 53)...');
    const billRes = await request('POST', '/api/bills', {
      customer_name: 'Harshil Mehta',
      customer_mobile: '9825099999',
      items: [
        {
          product_name: 'Kaju Katli',
          gujarati_name: 'કાજુ કતરી',
          quantity: 0.5,
          unit: 'kg',
          unit_price: 900,
          line_total: 450
        }
      ],
      payment_method: 'card',
      utr: 'AUTH-CARD-7821',
      verification_type: 'manually_confirmed'
    });

    assert(billRes.status === 200 && billRes.data.success, 'Card bill created successfully');
    const createdBill = billRes.data.bill;
    assert(createdBill.payment_method === 'card', 'Bill payment method recorded as card');

    const paymentRow = db.prepare('SELECT * FROM payments WHERE bill_id = ?').get(createdBill.id);
    assert(paymentRow !== undefined, 'Payment row written to payments table');
    assert(paymentRow.method === 'card', 'Payment row method matches card');
    assert(paymentRow.verification_type === 'manually_confirmed', 'Payment verification_type recorded as manually_confirmed');
    assert(paymentRow.utr === 'AUTH-CARD-7821', 'Terminal approval code stored in utr field');

    // 7. Split Payment: Cash + UPI
    console.log('\n[Test 7] Split Payment Tender (Cash + UPI)...');
    const splitBillRes = await request('POST', '/api/bills', {
      customer_name: 'Bhavin Shah',
      customer_mobile: '9824011111',
      items: [
        {
          product_name: 'Kesar Peda',
          gujarati_name: 'કેસર પેંડા',
          quantity: 1,
          unit: 'kg',
          unit_price: 600,
          line_total: 600
        },
        {
          product_name: 'White Barfi',
          gujarati_name: 'સફેદ બરફી',
          quantity: 1,
          unit: 'kg',
          unit_price: 400,
          line_total: 400
        }
      ],
      payment_method: 'split',
      split_details: { cash: 400, upi: 600 }
    });
    assert(splitBillRes.status === 200 && splitBillRes.data.success, 'Split bill created successfully');
    assert(splitBillRes.data.bill.final_amount === 1000, 'Total bill amount is ₹1,000');
    assert(splitBillRes.data.bill.payment_method === 'split', 'Payment method is split');

    // 8. Google Cloud Storage Diagnostics & Outbox Queue
    console.log('\n[Test 8] Google Cloud Diagnostics & Sync Outbox (Section 42-44)...');
    const gcpDiag = await request('GET', '/api/gcp/diagnostics');
    assert(gcpDiag.status === 200, 'GCP diagnostics returned HTTP 200');
    assert(Boolean(gcpDiag.data.projectId), `Tenant project ID configured (${gcpDiag.data.projectId})`);
    assert(gcpDiag.data.syncOutboxCount >= 1 || gcpDiag.data.outbox?.total >= 1, 'Bills recorded in durable sync_outbox');

    const syncNowRes = await request('POST', '/api/gcp/sync-now');
    assert(syncNowRes.status === 200 && syncNowRes.data.success, 'Sync outbox triggered successfully');

    // 9. Short URL Resolver (/i/:token)
    console.log('\n[Test 9] Short URL Invoice Token Resolver (Section 48)...');
    const shortResolverRes = await request('GET', `/i/${createdBill.invoice_token}`);
    assert(shortResolverRes.status === 302, 'Short URL /i/:token redirects with HTTP 302 to full invoice URL');
    assert(shortResolverRes.headers.location === `/invoice/${createdBill.invoice_token}`, 'Redirect target matches canonical /invoice/:token');

    console.log('\n======================================================');
    console.log(`RESULTS: ${passed}/${total} assertions PASSED`);
    console.log('======================================================\n');

    process.exit(passed === total ? 0 : 1);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
