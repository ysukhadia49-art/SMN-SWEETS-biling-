const https = require('https');
const http = require('http');
const { db, normalizeIndianMobile } = require('../database/db');

/**
 * Check if the machine currently has active internet connectivity
 * @returns {Promise<boolean>}
 */
function checkInternetConnectivity() {
  return new Promise((resolve) => {
    // Attempt quick HTTP HEAD/GET request to a reliable public DNS or endpoint
    const req = https.get('https://1.1.1.1', { timeout: 2500 }, (res) => {
      resolve(true);
    });
    req.on('error', () => {
      // Fallback test
      const req2 = http.get('http://clients3.google.com/generate_204', { timeout: 2500 }, (res2) => {
        resolve(true);
      });
      req2.on('error', () => resolve(false));
      req2.on('timeout', () => {
        req2.destroy();
        resolve(false);
      });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Format SMS template with real bill parameters
 */
function formatSMSMessage(bill, invoiceUrl) {
  const formattedDate = new Date(bill.created_at || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  return (
`Thank you for shopping at SMN SWEET'S!

Your bill has been generated successfully.

Bill No: ${bill.bill_number}
Amount: ₹${parseFloat(bill.final_amount).toFixed(2)}
Date: ${formattedDate}

Download your invoice PDF:
${invoiceUrl}

Thank you for visiting SMN SWEET'S!`
  );
}

/**
 * Make an HTTP request helper
 */
function makeHttpRequest(urlStr, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const client = url.protocol === 'https:' ? https : http;

    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 10000
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
      reject(new Error('SMS Gateway request timed out'));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

/**
 * Send SMS using configured provider
 * @param {string} mobile 10-digit normalized Indian mobile
 * @param {string} message Text message
 * @param {Object} settings Settings dictionary
 * @returns {Promise<{success: boolean, messageId?: string, status: string, error?: string}>}
 */
async function sendViaGateway(mobile, message, settings) {
  const provider = (settings.sms_provider || 'fast2sms').toLowerCase();
  const apiKey = (settings.sms_api_key || '').trim();

  // If no API key configured, we fail gracefully with informative error
  if (!apiKey) {
    return {
      success: false,
      status: 'failed',
      error: 'SMS API Key not configured in Settings. Please set up your Indian SMS gateway.'
    };
  }

  const normalizedMobile = normalizeIndianMobile(mobile);
  if (!normalizedMobile || normalizedMobile.length !== 10) {
    return {
      success: false,
      status: 'failed',
      error: `Invalid Indian mobile number: ${mobile}. Must be 10 digits.`
    };
  }

  try {
    if (provider === 'fast2sms') {
      // Fast2SMS API integration
      // Route 'q' (Quick SMS) or DLT
      const payload = JSON.stringify({
        route: settings.sms_template_id ? 'dlt' : 'q',
        message: message,
        language: 'english',
        flash: 0,
        numbers: normalizedMobile,
        sender_id: settings.sms_sender_id || 'SMNSWT',
        template_id: settings.sms_template_id || undefined,
        entity_id: settings.sms_dlt_pe_id || undefined
      });

      const res = await makeHttpRequest('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization': apiKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, payload);

      const parsed = JSON.parse(res.body || '{}');
      if (res.statusCode === 200 && parsed.return === true) {
        return {
          success: true,
          messageId: parsed.request_id || parsed.message?.[0] || 'F2S-' + Date.now(),
          status: 'sent'
        };
      } else {
        return {
          success: false,
          status: 'failed',
          error: parsed.message ? parsed.message.toString() : `Fast2SMS Error (HTTP ${res.statusCode})`
        };
      }
    } 
    else if (provider === 'msg91') {
      // MSG91 API integration
      const payload = JSON.stringify({
        template_id: settings.sms_template_id || 'smn_bill_template',
        short_url: '0',
        recipients: [
          {
            mobiles: '91' + normalizedMobile,
            message: message
          }
        ]
      });

      const res = await makeHttpRequest('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: {
          'authkey': apiKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, payload);

      const parsed = JSON.parse(res.body || '{}');
      if (res.statusCode === 200 && (parsed.type === 'success' || parsed.status === 'success')) {
        return {
          success: true,
          messageId: parsed.request_id || 'MSG91-' + Date.now(),
          status: 'sent'
        };
      } else {
        return {
          success: false,
          status: 'failed',
          error: parsed.message || `MSG91 Error (HTTP ${res.statusCode})`
        };
      }
    }
    else if (provider === 'twilio') {
      // Twilio SMS
      const accountSid = apiKey.split(':')[0];
      const authToken = apiKey.split(':')[1];
      if (!accountSid || !authToken) {
        return {
          success: false,
          status: 'failed',
          error: 'Twilio requires API Key format: ACCOUNT_SID:AUTH_TOKEN'
        };
      }

      const postData = new URLSearchParams({
        To: '+91' + normalizedMobile,
        From: settings.sms_sender_id || '',
        Body: message
      }).toString();

      const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

      const res = await makeHttpRequest(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, postData);

      const parsed = JSON.parse(res.body || '{}');
      if (res.statusCode >= 200 && res.statusCode < 300) {
        return {
          success: true,
          messageId: parsed.sid,
          status: 'sent'
        };
      } else {
        return {
          success: false,
          status: 'failed',
          error: parsed.message || `Twilio Error (HTTP ${res.statusCode})`
        };
      }
    }
    else {
      // Custom Indian HTTP / DLT Gateway
      // Supports parameterized endpoint replacement: {apiKey}, {mobile}, {message}, {senderId}, {templateId}
      let endpoint = settings.sms_custom_endpoint || '';
      if (!endpoint) {
        return {
          success: false,
          status: 'failed',
          error: 'Custom Gateway endpoint URL is empty.'
        };
      }

      endpoint = endpoint
        .replace('{apiKey}', encodeURIComponent(apiKey))
        .replace('{mobile}', encodeURIComponent(normalizedMobile))
        .replace('{message}', encodeURIComponent(message))
        .replace('{senderId}', encodeURIComponent(settings.sms_sender_id || ''))
        .replace('{templateId}', encodeURIComponent(settings.sms_template_id || ''));

      const res = await makeHttpRequest(endpoint, { method: 'GET' });
      if (res.statusCode >= 200 && res.statusCode < 300) {
        return {
          success: true,
          messageId: 'CUST-' + Date.now(),
          status: 'sent'
        };
      } else {
        return {
          success: false,
          status: 'failed',
          error: `Custom Gateway responded with status: ${res.statusCode}: ${res.body.slice(0, 100)}`
        };
      }
    }
  } catch (error) {
    return {
      success: false,
      status: 'failed',
      error: error.message || 'Network error while contacting SMS gateway'
    };
  }
}

/**
 * High-level Send or Queue SMS for a Bill
 * Checks connectivity, updates sms_records, and handles offline queue
 */
async function processBillSMS(bill, settings) {
  // If automatic SMS is disabled or customer has no valid mobile, skip cleanly
  if (settings.sms_enabled === '0' || settings.sms_enabled === false) {
    return { queued: false, skipped: true, reason: 'SMS is disabled in Settings' };
  }

  const rawMobile = bill.customer_mobile_snapshot;
  const mobile = normalizeIndianMobile(rawMobile);
  if (!mobile || mobile.length !== 10) {
    return { queued: false, skipped: true, reason: 'Customer has no valid 10-digit Indian mobile number' };
  }

  const invoiceUrl = `${settings.invoice_base_url || 'http://127.0.0.1:4000'}/invoice/${bill.invoice_token}`;
  const message = formatSMSMessage(bill, invoiceUrl);
  const provider = settings.sms_provider || 'fast2sms';

  // 1. Check internet connectivity
  const isOnline = await checkInternetConnectivity();

  if (!isOnline) {
    console.log(`[SMS] Machine is offline. Enqueueing bill ${bill.bill_number} to SMS Queue.`);
    
    // Insert into sms_records with 'pending'
    const insertRecord = db.prepare(`
      INSERT INTO sms_records (bill_id, customer_id, mobile_number, message, provider, status, error_message)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `);
    insertRecord.run(bill.id, bill.customer_id, mobile, message, provider, 'Offline: waiting for internet connectivity');

    // Insert into persistent sms_queue
    const insertQueue = db.prepare(`
      INSERT INTO sms_queue (bill_id, customer_id, mobile_number, message, status)
      VALUES (?, ?, ?, ?, 'pending')
    `);
    insertQueue.run(bill.id, bill.customer_id, mobile, message);

    return {
      queued: true,
      offline: true,
      status: 'pending',
      userMessage: 'Bill generated successfully. SMS is pending because internet connectivity is unavailable.'
    };
  }

  // 2. We are online: send immediately
  const result = await sendViaGateway(mobile, message, settings);

  // Insert into sms_records
  const insertRecord = db.prepare(`
    INSERT INTO sms_records (bill_id, customer_id, mobile_number, message, provider, provider_message_id, status, error_message, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const sentAt = result.success ? new Date().toISOString() : null;
  insertRecord.run(
    bill.id,
    bill.customer_id,
    mobile,
    message,
    provider,
    result.messageId || null,
    result.status,
    result.error || null,
    sentAt
  );

  return {
    queued: false,
    offline: false,
    success: result.success,
    status: result.status,
    error: result.error,
    messageId: result.messageId
  };
}

/**
 * Resend SMS for a specific bill
 */
async function resendBillSMS(billId, settings) {
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId);
  if (!bill) throw new Error('Bill not found');

  const mobile = normalizeIndianMobile(bill.customer_mobile_snapshot);
  if (!mobile || mobile.length !== 10) {
    throw new Error('Customer mobile number is missing or invalid');
  }

  const invoiceUrl = `${settings.invoice_base_url || 'http://127.0.0.1:4000'}/invoice/${bill.invoice_token}`;
  const message = formatSMSMessage(bill, invoiceUrl);
  const provider = settings.sms_provider || 'fast2sms';

  const isOnline = await checkInternetConnectivity();
  if (!isOnline) {
    throw new Error('Cannot resend SMS: No internet connectivity.');
  }

  const result = await sendViaGateway(mobile, message, settings);

  const insertRecord = db.prepare(`
    INSERT INTO sms_records (bill_id, customer_id, mobile_number, message, provider, provider_message_id, status, error_message, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const sentAt = result.success ? new Date().toISOString() : null;
  insertRecord.run(
    bill.id,
    bill.customer_id,
    mobile,
    message,
    provider,
    result.messageId || null,
    result.status,
    result.error || null,
    sentAt
  );

  return result;
}

/**
 * Send a Test SMS to verify gateway configuration
 */
async function sendTestSMS(targetMobile, settings) {
  const mobile = normalizeIndianMobile(targetMobile);
  if (!mobile || mobile.length !== 10) {
    throw new Error('Please enter a valid 10-digit Indian mobile number for test SMS.');
  }

  const testMessage = `SMN SWEET'S: This is a test SMS from your billing system. SMS Gateway integration is working properly! Thank you.`;
  return await sendViaGateway(mobile, testMessage, settings);
}

/**
 * Background worker: Retries queued offline SMS messages when connectivity returns
 */
let workerInterval = null;
function startQueueWorker(getSettingsFn) {
  if (workerInterval) clearInterval(workerInterval);

  workerInterval = setInterval(async () => {
    try {
      const pendingItems = db.prepare(`
        SELECT * FROM sms_queue WHERE status = 'pending' AND attempts < 5 LIMIT 5
      `).all();

      if (pendingItems.length === 0) return;

      const isOnline = await checkInternetConnectivity();
      if (!isOnline) return;

      const settings = getSettingsFn();

      for (const item of pendingItems) {
        db.prepare('UPDATE sms_queue SET status = ?, attempts = attempts + 1, last_attempt_at = datetime("now", "localtime") WHERE id = ?')
          .run('processing', item.id);

        const result = await sendViaGateway(item.mobile_number, item.message, settings);

        if (result.success) {
          // Mark queue item complete (delete or mark processed)
          db.prepare('DELETE FROM sms_queue WHERE id = ?').run(item.id);

          // Update sms_records
          db.prepare(`
            UPDATE sms_records 
            SET status = 'sent', provider_message_id = ?, sent_at = datetime('now', 'localtime'), error_message = NULL
            WHERE bill_id = ? AND mobile_number = ?
          `).run(result.messageId || 'Q-' + Date.now(), item.bill_id, item.mobile_number);

          console.log(`[SMS Worker] Successfully sent queued SMS for bill ${item.bill_id} to ${item.mobile_number}`);
        } else {
          db.prepare('UPDATE sms_queue SET status = ?, error = ? WHERE id = ?')
            .run(item.attempts >= 4 ? 'failed' : 'pending', result.error || 'Retry failed', item.id);

          db.prepare(`
            UPDATE sms_records 
            SET status = 'retrying', error_message = ?, retry_count = retry_count + 1
            WHERE bill_id = ? AND mobile_number = ?
          `).run(result.error || 'Gateway error on retry', item.bill_id, item.mobile_number);
        }
      }
    } catch (e) {
      console.error('[SMS Worker] Error in queue processing:', e);
    }
  }, 15000); // Check every 15 seconds
}

module.exports = {
  checkInternetConnectivity,
  formatSMSMessage,
  sendViaGateway,
  processBillSMS,
  resendBillSMS,
  sendTestSMS,
  startQueueWorker
};

