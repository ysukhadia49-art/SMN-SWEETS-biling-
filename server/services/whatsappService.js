const http = require('http');
const https = require('https');
const { db, normalizeIndianMobile } = require('../database/db');

/**
 * Make an authenticated HTTP request helper
 */
function makeHttpRequest(urlStr, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const client = url.protocol === 'https:' ? https : http;

      const reqOptions = {
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || 6000
      };

      const req = client.request(url, reqOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('WhatsApp Bot request timed out'));
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Format WhatsApp message for a retail invoice
 */
function formatWhatsAppMessage(bill, invoiceUrl, settings) {
  const formattedDate = new Date(bill.created_at || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  const shopName = settings.shop_name || "SMN SWEET'S";
  const shopMobile = settings.shop_mobile || '+91 98250 12345';
  const customerName = bill.customer_name_snapshot || 'Valued Customer';
  const billNumber = bill.bill_number;
  const amount = parseFloat(bill.final_amount).toFixed(2);
  const paymentMethod = (bill.payment_method || 'Cash').toUpperCase();

  return (
`✨ *${shopName} — Retail Invoice* ✨
_Traditional Taste & Purity_

Dear *${customerName}*,
Thank you for your visit! Your bill has been created:

📋 *Bill Number:* ${billNumber}
💰 *Total Amount:* ₹${amount}
📅 *Date:* ${formattedDate}
💳 *Payment Mode:* ${paymentMethod}

📄 *Download Invoice PDF:*
${invoiceUrl}

*${shopName}*
Contact: ${shopMobile}
_Thank you for visiting! Please visit again._`
  );
}

/**
 * Dispatch message to the Node.js WhatsApp bot with token authentication
 */
async function sendViaWhatsAppBot(mobile, bill, invoiceUrl, settings) {
  const botUrl = (settings.whatsapp_bot_url || 'http://127.0.0.1:3001/api/send').trim();
  const botToken = (settings.whatsapp_bot_token || '').trim();

  const normalizedMobile = normalizeIndianMobile(mobile);
  if (!normalizedMobile || normalizedMobile.length !== 10) {
    return {
      success: false,
      status: 'failed',
      error: `Invalid Indian mobile number: ${mobile}. Must be 10 digits.`
    };
  }

  const messageText = formatWhatsAppMessage(bill, invoiceUrl, settings);

  const payload = JSON.stringify({
    to: '91' + normalizedMobile,
    mobile: normalizedMobile,
    message: messageText,
    billNumber: bill.bill_number,
    amount: bill.final_amount,
    customerName: bill.customer_name_snapshot,
    pdfUrl: invoiceUrl,
    billId: bill.id
  });

  try {
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    };

    if (botToken) {
      headers['Authorization'] = `Bearer ${botToken}`;
    }

    const res = await makeHttpRequest(botUrl, {
      method: 'POST',
      headers,
      timeout: 5000
    }, payload);

    let parsed = {};
    try {
      parsed = JSON.parse(res.body || '{}');
    } catch (e) {
      parsed = { raw: res.body };
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return {
        success: true,
        messageId: parsed.messageId || parsed.id || `WA-${Date.now()}`,
        status: 'sent',
        message: messageText
      };
    } else {
      return {
        success: false,
        status: 'failed',
        error: parsed.error || parsed.message || `WhatsApp Bot returned HTTP ${res.statusCode}`,
        message: messageText
      };
    }
  } catch (err) {
    // If bot is unreachable or timed out, queue for offline retry
    console.warn(`[WhatsApp] Bot offline or unreachable (${err.message}). Queuing message.`);
    return {
      success: false,
      status: 'queued',
      error: `WhatsApp Bot offline: ${err.message}`,
      message: messageText
    };
  }
}

/**
 * Process automatic WhatsApp delivery for a newly created bill
 */
async function processBillWhatsApp(bill, settings) {
  const enabled = (settings.whatsapp_enabled ?? '1') === '1';
  if (!enabled) {
    return { success: false, status: 'disabled', error: 'WhatsApp delivery is disabled in settings' };
  }

  const rawMobile = bill.customer_mobile_snapshot || (bill.customer && bill.customer.mobile);
  if (!rawMobile) {
    return { success: false, status: 'skipped', error: 'No mobile number provided (walk-in customer)' };
  }

  const normalized = normalizeIndianMobile(rawMobile);
  if (!normalized || normalized.length !== 10) {
    return { success: false, status: 'failed', error: 'Invalid 10-digit mobile number' };
  }

  const baseUrl = (settings.invoice_base_url || 'http://127.0.0.1:4000').replace(/\/$/, '');
  const invoiceUrl = bill.invoice_token 
    ? `${baseUrl}/invoice/${bill.invoice_token}` 
    : `${baseUrl}/api/bills/${bill.id}/pdf`;

  const dispatchResult = await sendViaWhatsAppBot(normalized, bill, invoiceUrl, settings);

  // Insert into whatsapp_logs table
  let logId = null;
  try {
    const insertLog = db.prepare(`
      INSERT INTO whatsapp_logs (
        bill_id, bill_number, customer_id, customer_name, mobile_number,
        message, provider_message_id, status, error_message, sent_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    const logRes = insertLog.run(
      bill.id,
      bill.bill_number,
      bill.customer_id || null,
      bill.customer_name_snapshot || 'Valued Customer',
      normalized,
      dispatchResult.message || formatWhatsAppMessage(bill, invoiceUrl, settings),
      dispatchResult.messageId || null,
      dispatchResult.status,
      dispatchResult.error || null,
      dispatchResult.status === 'sent' ? new Date().toISOString() : null
    );

    logId = logRes.lastInsertRowid;

    // If queued, also write to whatsapp_queue for background delivery
    if (dispatchResult.status === 'queued') {
      db.prepare(`
        INSERT INTO whatsapp_queue (
          bill_id, customer_id, mobile_number, message, pdf_url, status
        ) VALUES (
          ?, ?, ?, ?, ?, 'pending'
        )
      `).run(
        bill.id,
        bill.customer_id || null,
        normalized,
        dispatchResult.message || '',
        invoiceUrl
      );
    }
  } catch (dbErr) {
    console.error('[WhatsApp] Failed to save log entry:', dbErr);
  }

  return {
    ...dispatchResult,
    logId
  };
}

/**
 * Resend bill invoice via WhatsApp
 */
async function resendBillWhatsApp(billId, settings) {
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId);
  if (!bill) {
    throw new Error(`Bill ID ${billId} not found`);
  }

  if (!bill.customer_mobile_snapshot) {
    throw new Error('Customer mobile number is missing on this invoice');
  }

  return await processBillWhatsApp(bill, settings);
}

/**
 * Send a test WhatsApp message to verify bot connection
 */
async function sendTestWhatsApp(mobile, settings) {
  const normalized = normalizeIndianMobile(mobile);
  if (!normalized || normalized.length !== 10) {
    throw new Error('Please enter a valid 10-digit Indian mobile number');
  }

  const dummyBill = {
    id: 0,
    bill_number: 'TEST-000001',
    final_amount: 100.00,
    customer_name_snapshot: 'Test Customer',
    payment_method: 'Cash',
    created_at: new Date().toISOString()
  };

  const invoiceUrl = `${(settings.invoice_base_url || 'http://127.0.0.1:4000').replace(/\/$/, '')}/test`;
  const result = await sendViaWhatsAppBot(normalized, dummyBill, invoiceUrl, settings);

  // Record test message in logs
  db.prepare(`
    INSERT INTO whatsapp_logs (
      bill_id, bill_number, customer_id, customer_name, mobile_number,
      message, provider_message_id, status, error_message, sent_at
    ) VALUES (
      null, 'TEST-000001', null, 'Test Customer', ?,
      ?, ?, ?, ?, ?
    )
  `).run(
    normalized,
    result.message || 'Test message',
    result.messageId || null,
    result.status,
    result.error || null,
    result.status === 'sent' ? new Date().toISOString() : null
  );

  return result;
}

/**
 * Background worker to drain the WhatsApp queue when bot comes online
 */
function startWhatsAppQueueWorker(getSettingsFn) {
  setInterval(async () => {
    try {
      const pendingQueue = db.prepare(`
        SELECT wq.*, b.bill_number, b.final_amount, b.customer_name_snapshot, b.invoice_token, b.created_at
        FROM whatsapp_queue wq
        JOIN bills b ON wq.bill_id = b.id
        WHERE wq.status = 'pending' AND wq.attempts < 5
        LIMIT 5
      `).all();

      if (pendingQueue.length === 0) return;

      const settings = getSettingsFn();
      for (const item of pendingQueue) {
        db.prepare("UPDATE whatsapp_queue SET status = 'processing', attempts = attempts + 1, last_attempt_at = datetime('now', 'localtime') WHERE id = ?")
          .run(item.id);

        const baseUrl = (settings.invoice_base_url || 'http://127.0.0.1:4000').replace(/\/$/, '');
        const invoiceUrl = item.invoice_token 
          ? `${baseUrl}/invoice/${item.invoice_token}` 
          : `${baseUrl}/api/bills/${item.bill_id}/pdf`;

        const res = await sendViaWhatsAppBot(item.mobile_number, item, invoiceUrl, settings);

        if (res.success && res.status === 'sent') {
          db.prepare("DELETE FROM whatsapp_queue WHERE id = ?").run(item.id);
          db.prepare(`
            UPDATE whatsapp_logs 
            SET status = 'sent', provider_message_id = ?, sent_at = datetime('now', 'localtime'), error_message = null
            WHERE bill_id = ? AND status = 'queued'
          `).run(res.messageId, item.bill_id);
        } else {
          db.prepare("UPDATE whatsapp_queue SET status = 'pending', error = ? WHERE id = ?")
            .run(res.error || 'Retry delivery failed', item.id);
        }
      }
    } catch (err) {
      // Background worker errors logged quietly
      console.warn('[WhatsApp Queue Worker] Error:', err.message);
    }
  }, 25000);
}

module.exports = {
  formatWhatsAppMessage,
  sendViaWhatsAppBot,
  processBillWhatsApp,
  resendBillWhatsApp,
  sendTestWhatsApp,
  startWhatsAppQueueWorker
};
