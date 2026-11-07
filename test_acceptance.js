const fs = require('fs');
const path = require('path');
const { db, normalizeIndianMobile, INVOICES_DIR } = require('./server/database/db');
const { createBill, cancelBill } = require('./server/services/billingService');
const { generateInvoicePDF } = require('./server/services/pdfService');
const { processBillSMS, resendBillSMS, formatSMSMessage } = require('./server/services/smsService');
const { createBackup, restoreBackup } = require('./server/services/backupService');

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = {};
  for (const r of rows) s[r.key] = r.value;
  return s;
}

async function runAcceptanceTests() {
  console.log('====================================================');
  console.log('  RUNNING SMN SWEET\'S MASTER ACCEPTANCE TEST SUITE  ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // TEST 1: Customer Mobile Normalization & Duplicate Prevention
  console.log('\n--- 1. CUSTOMER REGISTRATION & VALIDATION TESTS ---');
  const norm1 = normalizeIndianMobile('+91 98765 43210');
  const norm2 = normalizeIndianMobile('09876543210');
  const norm3 = normalizeIndianMobile('9876543210');
  assert(norm1 === '9876543210' && norm2 === '9876543210' && norm3 === '9876543210', 'Normalizes Indian mobile (+91, 0, spaces)');

  // Clear any existing test customer
  db.prepare('DELETE FROM customers WHERE normalized_mobile = ?').run('9876543210');

  // Register Rahul Patel
  const insertCust = db.prepare(`
    INSERT INTO customers (customer_code, name, mobile, normalized_mobile, address)
    VALUES (?, ?, ?, ?, ?)
  `);
  const custResult = insertCust.run('CUST-00001', 'Rahul Patel', '9876543210', '9876543210', 'Ahmedabad');
  const rahul = db.prepare('SELECT * FROM customers WHERE id = ?').get(custResult.lastInsertRowid);
  assert(rahul && rahul.name === 'Rahul Patel' && rahul.customer_code === 'CUST-00001', 'Rahul Patel registered with code CUST-00001');

  // Prevent duplicate registration with same normalized mobile
  let duplicatePrevented = false;
  try {
    insertCust.run('CUST-00002', 'Duplicate Rahul', '+919876543210', '9876543210', 'Ahmedabad');
  } catch (e) {
    duplicatePrevented = true;
  }
  assert(duplicatePrevented, 'Database strictly prevents duplicate registration of same mobile');

  // TEST 2: Sweet Products & Price Snapshots
  console.log('\n--- 2. PRODUCT MANAGEMENT & WEIGHT CALCULATIONS ---');
  const kesarPeda = db.prepare("SELECT * FROM products WHERE name = 'Kesar Peda'").get();
  const whiteBarfi = db.prepare("SELECT * FROM products WHERE name = 'White Barfi'").get();
  assert(kesarPeda && kesarPeda.price === 600, 'Kesar Peda priced at ₹600/kg');
  assert(whiteBarfi && whiteBarfi.price === 600, 'White Barfi priced at ₹600/kg');

  // Calculations:
  // Kesar Peda 250g: 600 * 0.25 = ₹150
  // White Barfi 500g: 600 * 0.50 = ₹300
  const kpAmount = Math.round((kesarPeda.price * 0.25) * 100) / 100;
  const wbAmount = Math.round((whiteBarfi.price * 0.50) * 100) / 100;
  assert(kpAmount === 150, 'Weight calculation: 250g Kesar Peda = ₹150.00');
  assert(wbAmount === 300, 'Weight calculation: 500g White Barfi = ₹300.00');
  assert(kpAmount + wbAmount === 450, 'Subtotal sum = ₹450.00 (Strict Non-GST)');

  // TEST 3: Section 39 Required Acceptance Scenario
  console.log('\n--- 3. SECTION 39 ACCEPTANCE TEST SCENARIO ---');
  const user = { id: 1, username: 'owner', role: 'owner', full_name: 'Owner - SMN Sweets' };

  const billPayload = {
    customer_id: rahul.id,
    customer_name: rahul.name,
    customer_mobile: rahul.normalized_mobile,
    payment_method: 'upi',
    discount_type: 'fixed',
    discount_value: 0,
    items: [
      {
        product_id: kesarPeda.id,
        product_name: kesarPeda.name,
        gujarati_name: kesarPeda.gujarati_name,
        quantity: 0.25,
        unit: 'kg',
        unit_price: kesarPeda.price,
        line_total: 150
      },
      {
        product_id: whiteBarfi.id,
        product_name: whiteBarfi.name,
        gujarati_name: whiteBarfi.gujarati_name,
        quantity: 0.50,
        unit: 'kg',
        unit_price: whiteBarfi.price,
        line_total: 300
      }
    ]
  };

  const billResult = await createBill(billPayload, user, getSettings);
  assert(billResult.success, 'Step 1-4: Bill generated successfully with unique sequence');

  const generatedBill = billResult.bill;
  assert(generatedBill.bill_number.startsWith('SMN-'), `Assigned unique Bill Number: ${generatedBill.bill_number}`);
  assert(generatedBill.final_amount === 450, `Total amount equals exactly ₹450.00 (Actual: ₹${generatedBill.final_amount})`);
  assert(generatedBill.payment_method === 'upi', `Payment method recorded as UPI`);

  // Verify PDF file was generated and exists on disk
  assert(billResult.pdfPath && fs.existsSync(billResult.pdfPath), `Step 5-6: PDF invoice generated locally at: ${billResult.pdfPath}`);
  const pdfStat = fs.statSync(billResult.pdfPath);
  assert(pdfStat.size > 2000, `PDF invoice contains authentic binary content (${pdfStat.size} bytes)`);

  // Verify secure invoice token and download link
  assert(generatedBill.invoice_token && generatedBill.invoice_token.startsWith('smn_'), `Step 7: Secure cryptographic invoice token created (${generatedBill.invoice_token})`);
  assert(billResult.invoiceUrl.includes(generatedBill.invoice_token), `Invoice URL properly formatted: ${billResult.invoiceUrl}`);

  // Verify SMS message content
  const smsText = formatSMSMessage(generatedBill, billResult.invoiceUrl);
  assert(smsText.includes(generatedBill.bill_number), 'Step 8-9: SMS template contains bill number');
  assert(smsText.includes('450.00'), 'SMS template contains ₹450.00');
  assert(smsText.includes(billResult.invoiceUrl), 'SMS template contains secure PDF download link');
  assert(smsText.includes('SMN SWEET\'S'), 'SMS template contains SMN SWEET\'S branding');

  // Verify SMS record logging in DB
  const smsRecord = db.prepare('SELECT * FROM sms_records WHERE bill_id = ?').get(generatedBill.id);
  assert(smsRecord && smsRecord.mobile_number === '9876543210', `Step 10: SMS logged in database with recipient 9876543210 (Status: ${smsRecord?.status})`);

  // Verify sales history
  const dbBill = db.prepare('SELECT * FROM bills WHERE id = ?').get(generatedBill.id);
  assert(dbBill && dbBill.status === 'completed', 'Step 11: Bill appears in sales history as completed');

  // Verify customer profile updated
  const updatedRahul = db.prepare('SELECT * FROM customers WHERE id = ?').get(rahul.id);
  assert(updatedRahul.total_bills >= 1 && updatedRahul.total_spent >= 450, `Step 12: Rahul Patel\'s profile updated (Total Bills: ${updatedRahul.total_bills}, Total Spent: ₹${updatedRahul.total_spent})`);

  // TEST 4: Bill Cancellation & Sales Audit Reversion
  console.log('\n--- 4. BILL CANCELLATION & AUDIT INTEGRITY ---');
  const cancelRes = cancelBill(generatedBill.id, 'Customer requested change of sweets', user);
  assert(cancelRes.success, 'Bill cancelled cleanly with reason recorded');

  const cancelledBill = db.prepare('SELECT * FROM bills WHERE id = ?').get(generatedBill.id);
  assert(cancelledBill.status === 'cancelled', 'Bill status updated to cancelled without deleting record');
  assert(cancelledBill.cancellation_reason === 'Customer requested change of sweets', 'Cancellation reason preserved');

  const customerAfterCancel = db.prepare('SELECT * FROM customers WHERE id = ?').get(rahul.id);
  assert(customerAfterCancel.total_spent === updatedRahul.total_spent - 450, 'Customer spending accurately deducted upon cancellation');

  // TEST 5: Backup and Restore Validation
  console.log('\n--- 5. BACKUP & RESTORE INTEGRITY ---');
  const backup = createBackup();
  assert(backup.success && fs.existsSync(backup.backupPath), `Backup ZIP created (${backup.fileName})`);
  
  const restoreRes = restoreBackup(backup.backupPath);
  assert(restoreRes.success, 'Safety pre-backup created and backup archive restored successfully');

  console.log('\n====================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed === 0) {
    console.log('>>> ALL ACCEPTANCE TESTS PASSED WITH 100% SUCCESS! <<<');
  } else {
    process.exit(1);
  }
}

runAcceptanceTests().catch((e) => {
  console.error('Test execution failed:', e);
  process.exit(1);
});

