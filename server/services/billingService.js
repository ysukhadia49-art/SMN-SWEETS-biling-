const crypto = require('crypto');
const { db, normalizeIndianMobile } = require('../database/db');
const { generateInvoicePDF } = require('./pdfService');
const { processBillWhatsApp } = require('./whatsappService');
const googleCloudService = require('./googleCloudService');
const eventBus = require('./eventBus');

/**
 * Format currency and prevent floating-point inaccuracies
 */
function roundToTwo(num) {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

function toPaise(rupees) {
  return Math.round((Number(rupees) + Number.EPSILON) * 100);
}

/**
 * Compute line total based on unit and quantity
 */
function calculateLineTotal(unitPrice, quantity, unit) {
  const p = Number(unitPrice);
  const q = Number(quantity);
  
  if (isNaN(p) || isNaN(q) || q <= 0 || p < 0) {
    throw new Error('Invalid product price or quantity');
  }

  return roundToTwo(p * q);
}

/**
 * Generate next unique sequential bill number using configured prefix
 */
function getNextBillNumber(dbConn) {
  const prefixSetting = dbConn.prepare("SELECT value FROM settings WHERE key = 'bill_prefix'").get();
  const nextNumSetting = dbConn.prepare("SELECT value FROM settings WHERE key = 'bill_next_number'").get();

  const prefix = prefixSetting ? prefixSetting.value : 'SMN-';
  let nextNum = nextNumSetting ? parseInt(nextNumSetting.value, 10) : 1;
  if (isNaN(nextNum) || nextNum < 1) nextNum = 1;

  let candidate = '';
  let exists = true;

  while (exists) {
    candidate = `${prefix}${String(nextNum).padStart(6, '0')}`;
    const check = dbConn.prepare('SELECT id FROM bills WHERE bill_number = ?').get(candidate);
    if (!check) {
      exists = false;
    } else {
      nextNum++;
    }
  }

  dbConn.prepare("UPDATE settings SET value = ?, updated_at = datetime('now', 'localtime') WHERE key = 'bill_next_number'")
        .run(String(nextNum + 1));

  return candidate;
}

/**
 * Create a new bill with ACID transaction
 */
async function createBill(billData, user, getSettingsFn) {
  const settings = getSettingsFn();

  // 1. Validation
  const items = billData.items;
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('Cannot create bill without items');
  }

  // Customer resolution
  let customer = null;
  let customerName = (billData.customer_name || 'Walk-in Customer').trim();
  let customerMobile = billData.customer_mobile ? normalizeIndianMobile(billData.customer_mobile) : null;

  if (billData.customer_id) {
    customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(billData.customer_id);
    if (customer) {
      customerName = customer.name;
      customerMobile = customer.normalized_mobile;
    }
  } else if (customerMobile && customerMobile.length === 10) {
    customer = db.prepare('SELECT * FROM customers WHERE normalized_mobile = ?').get(customerMobile);
    if (customer) {
      customerName = customer.name;
    }
  }

  // Calculate items and subtotal
  let subtotal = 0;
  const processedItems = [];

  for (const it of items) {
    const unitPrice = roundToTwo(it.unit_price);
    const quantity = Number(it.quantity);
    const lineTotal = calculateLineTotal(unitPrice, quantity, it.unit || 'kg');

    subtotal = roundToTwo(subtotal + lineTotal);

    processedItems.push({
      product_id: it.product_id || null,
      product_name_snapshot: it.product_name || 'Item',
      gujarati_name_snapshot: it.gujarati_name || null,
      quantity: quantity,
      unit: it.unit || 'kg',
      unit_price: unitPrice,
      line_total: lineTotal,
      notes: it.notes || null
    });
  }

  // Calculate discount
  let discountAmount = 0;
  const discountType = billData.discount_type === 'percentage' ? 'percentage' : 'fixed';
  const discountValue = Math.max(0, Number(billData.discount_value || 0));

  if (discountType === 'percentage') {
    discountAmount = roundToTwo((subtotal * discountValue) / 100);
  } else {
    discountAmount = roundToTwo(discountValue);
  }

  if (discountAmount > subtotal) {
    discountAmount = subtotal;
  }

  // Cashier discount limit check
  if (user.role === 'cashier') {
    const maxDiscountAllowed = Number(settings.max_discount_cashier || 100);
    if (discountAmount > maxDiscountAllowed) {
      throw new Error(`Discount of ₹${discountAmount} exceeds cashier maximum authorized discount of ₹${maxDiscountAllowed}. Please ask the Owner to authorize.`);
    }
  }

  const finalAmount = roundToTwo(subtotal - discountAmount);
  const amountMinor = toPaise(finalAmount);
  const paymentMethod = billData.payment_method || settings.default_payment_method || 'cash';
  const billType = (billData.bill_type || 'retail').toLowerCase() === 'wholesale' ? 'wholesale' : 'retail';
  const splitDetails = billData.split_details ? JSON.stringify(billData.split_details) : null;
  const invoiceToken = 'smn_' + crypto.randomBytes(16).toString('hex');
  const billUuid = 'bill_' + crypto.randomBytes(16).toString('hex');

  // 2. Database Transaction
  let newBillId = null;
  let billNumber = null;

  db.exec('BEGIN TRANSACTION;');
  try {
    billNumber = getNextBillNumber(db);

    const insertBill = db.prepare(`
      INSERT INTO bills (
        bill_uuid, shop_id, terminal_id, bill_number, customer_id, customer_name_snapshot, customer_mobile_snapshot,
        subtotal, discount_type, discount_value, discount_amount, final_amount, amount_minor,
        payment_method, split_details, payment_status, status,
        cashier_id, cashier_name, invoice_token, sync_status, bill_type
      ) VALUES (
        ?, 'smn_ahmedabad', 'term_01', ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, 'paid', 'completed',
        ?, ?, ?, 'saved_locally', ?
      )
    `);

    const billResult = insertBill.run(
      billUuid,
      billNumber,
      customer ? customer.id : null,
      customerName,
      customerMobile,
      subtotal,
      discountType,
      discountValue,
      discountAmount,
      finalAmount,
      amountMinor,
      paymentMethod,
      splitDetails,
      user.id,
      user.full_name || user.username,
      invoiceToken,
      billType
    );

    newBillId = billResult.lastInsertRowid;

    // Insert bill items
    const insertItem = db.prepare(`
      INSERT INTO bill_items (
        bill_id, product_id, product_name_snapshot, gujarati_name_snapshot,
        quantity, unit, unit_price, line_total, notes
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    for (const item of processedItems) {
      insertItem.run(
        newBillId,
        item.product_id,
        item.product_name_snapshot,
        item.gujarati_name_snapshot,
        item.quantity,
        item.unit,
        item.unit_price,
        item.line_total,
        item.notes
      );
    }

    // Insert into payments ledger
    // Insert into payments ledger (Clean manual verification: Cash, UPI, Card, Bank Transfer, Split)
    const paymentUuid = 'pay_' + crypto.randomBytes(16).toString('hex');
    const verificationType = paymentMethod === 'cash' ? 'cash' : 'manually_confirmed';
    const utr = billData.utr || billData.provider_transaction_id || null;

    db.prepare(`
      INSERT INTO payments (
        payment_uuid, bill_id, bill_uuid, attempt_uuid, amount, amount_minor,
        method, verification_type, utr, status, recorded_by
      ) VALUES (
        ?, ?, ?, null, ?, ?,
        ?, ?, ?, 'completed', ?
      )
    `).run(
      paymentUuid,
      newBillId,
      billUuid,
      finalAmount,
      amountMinor,
      paymentMethod,
      verificationType === 'cash' ? 'manually_confirmed' : verificationType,
      utr,
      user.username || 'cashier'
    );

    // Update customer stats if registered customer
    if (customer) {
      db.prepare(`
        UPDATE customers 
        SET total_bills = total_bills + 1,
            total_spent = total_spent + ?,
            last_purchase_at = datetime('now', 'localtime'),
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(finalAmount, customer.id);
    }

    // Append to sync_outbox for Google Cloud synchronization
    const opUuid = 'op_bill_' + crypto.randomBytes(12).toString('hex');
    db.prepare(`
      INSERT INTO sync_outbox (op_uuid, entity_type, entity_uuid, action, payload, status)
      VALUES (?, 'bill', ?, 'create', ?, 'pending')
    `).run(
      opUuid,
      billUuid,
      JSON.stringify({
        bill_uuid: billUuid,
        bill_number: billNumber,
        customer_name: customerName,
        customer_mobile: customerMobile,
        subtotal,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        payment_method: paymentMethod,
        cashier_name: user.full_name || user.username,
        created_at: new Date().toISOString(),
        items: processedItems
      })
    );

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, details)
      VALUES (?, ?, 'CREATE_BILL', ?)
    `).run(user.id, user.username, `Created bill ${billNumber} for ₹${finalAmount} (${paymentMethod})`);

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('[Billing] Transaction failed, rolled back:', err);
    throw new Error(`Failed to save bill: ${err.message}`);
  }

  // 3. Post-transaction: Fetch complete bill record
  const fullBill = db.prepare('SELECT * FROM bills WHERE id = ?').get(newBillId);
  fullBill.items = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(newBillId);

  // 4. Generate PDF Invoice
  let pdfPath = null;
  let pdfError = null;
  let gcsResult = null;

  try {
    const pdfFormat = settings.default_pdf_format || 'format_a';
    pdfPath = await generateInvoicePDF(fullBill, settings, pdfFormat);

    // Update bill with saved pdf_path
    db.prepare('UPDATE bills SET pdf_path = ? WHERE id = ?').run(pdfPath, newBillId);
    fullBill.pdf_path = pdfPath;

    // Upload to Google Cloud Storage (or queue in sync_outbox)
    gcsResult = await googleCloudService.uploadInvoicePdf(fullBill, pdfPath, settings);
  } catch (err) {
    console.error('[Billing] PDF generation error:', err);
    pdfError = `PDF generation failed: ${err.message}`;
  }

  // 5. Automatic WhatsApp Bot Delivery
  let whatsappResult = null;
  try {
    whatsappResult = await processBillWhatsApp(fullBill, settings);
  } catch (err) {
    console.error('[Billing] WhatsApp processing error:', err);
    whatsappResult = { success: false, status: 'failed', error: err.message };
  }

  // 6. Broadcast Real-Time Domain Event across all open panels
  eventBus.broadcast('BILL_CREATED', {
    billId: fullBill.id,
    billNumber: fullBill.bill_number,
    finalAmount: fullBill.final_amount,
    paymentMethod: fullBill.payment_method,
    customerName: fullBill.customer_name_snapshot,
    customerId: fullBill.customer_id
  });

  return {
    success: true,
    bill: fullBill,
    pdfPath: pdfPath,
    pdfError: pdfError,
    gcsResult: gcsResult,
    whatsappResult: whatsappResult,
    invoiceUrl: `${settings.invoice_base_url || 'http://127.0.0.1:4000'}/invoice/${invoiceToken}`
  };
}

/**
 * Cancel a completed bill with audit logging & real-time panel broadcast
 */
function cancelBill(billId, reason, user) {
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId);
  if (!bill) throw new Error('Bill not found');
  if (bill.status === 'cancelled') throw new Error('Bill is already cancelled');

  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare(`
      UPDATE bills 
      SET status = 'cancelled',
          cancellation_reason = ?,
          cancelled_by = ?,
          cancelled_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(reason, user.username, billId);

    // Revert customer statistics if customer was associated
    if (bill.customer_id) {
      db.prepare(`
        UPDATE customers
        SET total_bills = MAX(0, total_bills - 1),
            total_spent = MAX(0, total_spent - ?),
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(bill.final_amount, bill.customer_id);
    }

    // Append to sync_outbox
    db.prepare(`
      INSERT INTO sync_outbox (op_uuid, entity_type, entity_uuid, action, payload)
      VALUES (?, 'bill', ?, 'cancel', ?)
    `).run(
      'op_cancel_' + crypto.randomBytes(12).toString('hex'),
      bill.bill_uuid || String(bill.id),
      JSON.stringify({ bill_number: bill.bill_number, reason, cancelled_by: user.username })
    );

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, details)
      VALUES (?, ?, 'CANCEL_BILL', ?)
    `).run(user.id, user.username, `Cancelled bill ${bill.bill_number}. Reason: ${reason}`);

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  // Broadcast real-time event across panels
  eventBus.broadcast('BILL_CANCELLED', {
    billId: bill.id,
    billNumber: bill.bill_number,
    finalAmount: bill.final_amount,
    customerId: bill.customer_id
  });

  return { success: true, message: `Bill ${bill.bill_number} cancelled successfully` };
}

module.exports = {
  roundToTwo,
  toPaise,
  calculateLineTotal,
  getNextBillNumber,
  createBill,
  cancelBill
};
