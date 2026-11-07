const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const { db, normalizeIndianMobile, DATA_DIR, INVOICES_DIR } = require('./database/db');
const { createBill, cancelBill, getNextBillNumber, roundToTwo } = require('./services/billingService');
const { generateInvoicePDF } = require('./services/pdfService');
const { processBillWhatsApp, resendBillWhatsApp, sendTestWhatsApp, startWhatsAppQueueWorker } = require('./services/whatsappService');
const { startLocalBotServer } = require('./services/localBotService');
const { createBackup, restoreBackup, listBackups } = require('./services/backupService');
const googleCloudService = require('./services/googleCloudService');
const eventBus = require('./services/eventBus');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static assets (e.g. logo, fonts)
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// In-memory active user sessions
const activeSessions = new Map();

// Helper: Get settings as key-value object
function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const r of rows) {
    settings[r.key] = r.value;
  }
  return settings;
}

// Start background WhatsApp bot queue worker
startWhatsAppQueueWorker(getSettings);

// Ensure local WhatsApp bot service is available on port 3001 (yields if external bot is already running)
startLocalBotServer(3001);

// Authentication Middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Session missing' });
  }

  const token = authHeader.split(' ')[1];
  const session = activeSessions.get(token);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
  }

  if (Date.now() - session.timestamp > 12 * 60 * 60 * 1000) {
    activeSessions.delete(token);
    return res.status(401).json({ error: 'Session timed out. Please log in again.' });
  }

  session.timestamp = Date.now();
  req.user = session.user;
  next();
}

function requireOwner(req, res, next) {
  if (req.user && req.user.role === 'owner') {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden: Owner role required for this action' });
  }
}

// ==========================================
// 1. REAL-TIME EVENT STREAM (SSE)
// ==========================================

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial connected ping
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

  const eventListener = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  eventBus.on('app_event', eventListener);

  // Heartbeat ping every 25 seconds
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'HEARTBEAT', timestamp: new Date().toISOString() })}\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.removeListener('app_event', eventListener);
  });
});

// ==========================================
// 2. PUBLIC INVOICE DOWNLOAD HOSTING & RESOLVER
// ==========================================

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: "SMN SWEET'S Billing System", version: '1.0.0' });
});

// Short URL resolver for SMS: /i/:token
app.get('/i/:token', (req, res) => {
  res.redirect(`/invoice/${req.params.token}`);
});

// Secure public URL for customer: /invoice/:token
app.get('/invoice/:token', (req, res) => {
  const token = req.params.token;
  if (!token) return res.status(400).send('Invalid invoice link');

  const bill = db.prepare('SELECT * FROM bills WHERE invoice_token = ?').get(token);
  if (!bill) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice Not Found — SMN SWEET'S</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            body { font-family: system-ui, sans-serif; background: #FFFDF9; color: #2C1810; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; }
            .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(107,17,36,0.1); border-top: 5px solid #6B1124; max-width: 450px; }
            h1 { color: #6B1124; margin-bottom: 8px; }
            p { color: #6B7280; font-size: 15px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>SMN SWEET'S</h1>
            <h3>Invoice Not Found</h3>
            <p>The requested invoice does not exist or may have been removed.</p>
          </div>
        </body>
      </html>
    `);
  }

  if (bill.pdf_path && fs.existsSync(bill.pdf_path)) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${bill.bill_number}.pdf"`);
    fs.createReadStream(bill.pdf_path).pipe(res);
  } else {
    // Regenerate on the fly
    const fullBill = db.prepare('SELECT * FROM bills WHERE id = ?').get(bill.id);
    fullBill.items = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(bill.id);
    const settings = getSettings();

    generateInvoicePDF(fullBill, settings, settings.default_pdf_format || 'format_a')
      .then((generatedPath) => {
        db.prepare('UPDATE bills SET pdf_path = ? WHERE id = ?').run(generatedPath, bill.id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${bill.bill_number}.pdf"`);
        fs.createReadStream(generatedPath).pipe(res);
      })
      .catch((err) => {
        res.status(500).send('Error generating invoice PDF: ' + err.message);
      });
  }
});

// Download PDF directly by bill ID
app.get('/api/bills/:id/pdf', authenticate, (req, res) => {
  const billId = req.params.id;
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });

  if (bill.pdf_path && fs.existsSync(bill.pdf_path)) {
    res.download(bill.pdf_path, `${bill.bill_number}.pdf`);
  } else {
    const fullBill = db.prepare('SELECT * FROM bills WHERE id = ?').get(bill.id);
    fullBill.items = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(bill.id);
    const settings = getSettings();

    generateInvoicePDF(fullBill, settings, settings.default_pdf_format || 'format_a')
      .then((generatedPath) => {
        db.prepare('UPDATE bills SET pdf_path = ? WHERE id = ?').run(generatedPath, bill.id);
        res.download(generatedPath, `${bill.bill_number}.pdf`);
      })
      .catch((err) => {
        res.status(500).json({ error: 'Failed to generate PDF: ' + err.message });
      });
  }
});

// ==========================================
// 3. AUTHENTICATION & USERS
// ==========================================

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const sessionToken = crypto.randomBytes(32).toString('hex');
  const safeUser = {
    id: user.id,
    username: user.username,
    role: user.role,
    full_name: user.full_name
  };

  activeSessions.set(sessionToken, {
    user: safeUser,
    timestamp: Date.now()
  });

  db.prepare(`
    INSERT INTO audit_logs (user_id, username, action, details)
    VALUES (?, ?, 'LOGIN', 'User logged in successfully')
  `).run(user.id, user.username);

  res.json({
    token: sessionToken,
    user: safeUser
  });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', authenticate, (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader.split(' ')[1];
  activeSessions.delete(token);

  db.prepare(`
    INSERT INTO audit_logs (user_id, username, action, details)
    VALUES (?, ?, 'LOGOUT', 'User logged out')
  `).run(req.user.id, req.user.username);

  res.json({ success: true });
});

app.post('/api/auth/change-password', authenticate, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Both old and new passwords are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
    return res.status(400).json({ error: 'Incorrect current password' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);

  db.prepare(`
    INSERT INTO audit_logs (user_id, username, action, details)
    VALUES (?, ?, 'CHANGE_PASSWORD', 'User changed password')
  `).run(req.user.id, req.user.username);

  res.json({ success: true, message: 'Password updated successfully' });
});

// Users management (Owner only)
app.get('/api/users', authenticate, requireOwner, (req, res) => {
  const users = db.prepare('SELECT id, username, role, full_name, active, created_at FROM users').all();
  res.json(users);
});

app.post('/api/users', authenticate, requireOwner, (req, res) => {
  const { username, password, role, full_name } = req.body;
  if (!username || !password || !role || !full_name) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (exists) {
    return res.status(400).json({ error: 'Username already taken' });
  }

  const hash = bcrypt.hashSync(password, 10);
  db.prepare(`
    INSERT INTO users (username, password_hash, role, full_name)
    VALUES (?, ?, ?, ?)
  `).run(username.trim(), hash, role, full_name.trim());

  res.json({ success: true, message: 'User created' });
});

// ==========================================
// 4. CUSTOMER REGISTRATION & DATABASE
// ==========================================

function getNextCustomerCode() {
  const last = db.prepare('SELECT customer_code FROM customers ORDER BY id DESC LIMIT 1').get();
  if (!last || !last.customer_code) return 'CUST-00001';
  const numPart = parseInt(last.customer_code.replace(/\D/g, ''), 10);
  const nextNum = isNaN(numPart) ? 1 : numPart + 1;
  return `CUST-${String(nextNum).padStart(5, '0')}`;
}

app.get('/api/customers', authenticate, (req, res) => {
  const { search, limit = 50, offset = 0 } = req.query;
  let query = 'SELECT * FROM customers WHERE active = 1';
  const params = [];

  if (search) {
    const s = `%${search.trim()}%`;
    const norm = normalizeIndianMobile(search.trim());
    query += ` AND (name LIKE ? OR customer_code LIKE ? OR normalized_mobile LIKE ? OR mobile LIKE ?)`;
    params.push(s, s, `%${norm}%`, s);
  }

  query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit, 10), parseInt(offset, 10));

  const customers = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as count FROM customers WHERE active = 1').get().count;

  res.json({ customers, total });
});

app.post('/api/customers', authenticate, (req, res) => {
  const { name, mobile, secondary_mobile, address, notes } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Customer name is required' });
  }

  const normalized = normalizeIndianMobile(mobile);
  if (!normalized || normalized.length !== 10) {
    return res.status(400).json({ error: 'Valid 10-digit Indian mobile number is required' });
  }

  // Prevent duplicate registration using normalized mobile
  const existing = db.prepare('SELECT * FROM customers WHERE normalized_mobile = ?').get(normalized);
  if (existing) {
    return res.status(400).json({
      error: `Customer with mobile ${normalized} is already registered as ${existing.name} (${existing.customer_code})`,
      existingCustomer: existing
    });
  }

  const code = getNextCustomerCode();
  const insert = db.prepare(`
    INSERT INTO customers (
      customer_code, name, mobile, normalized_mobile, secondary_mobile, address, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = insert.run(
    code,
    name.trim(),
    mobile.trim(),
    normalized,
    secondary_mobile ? secondary_mobile.trim() : null,
    address ? address.trim() : null,
    notes ? notes.trim() : null
  );

  const newCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);

  // Append to sync_outbox
  db.prepare(`
    INSERT INTO sync_outbox (op_uuid, entity_type, entity_uuid, action, payload)
    VALUES (?, 'customer', ?, 'create', ?)
  `).run(
    'op_cust_' + crypto.randomBytes(12).toString('hex'),
    code,
    JSON.stringify(newCustomer)
  );

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (user_id, username, action, details)
    VALUES (?, ?, 'REGISTER_CUSTOMER', ?)
  `).run(req.user.id, req.user.username, `Registered customer ${newCustomer.name} (${code})`);

  // Broadcast real-time event
  eventBus.broadcast('CUSTOMER_CREATED', {
    id: newCustomer.id,
    customer_code: newCustomer.customer_code,
    name: newCustomer.name,
    mobile: newCustomer.normalized_mobile
  });

  res.json({ success: true, customer: newCustomer });
});

app.put('/api/customers/:id', authenticate, (req, res) => {
  const customerId = req.params.id;
  const { name, mobile, secondary_mobile, address, notes } = req.body;

  const current = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!current) return res.status(404).json({ error: 'Customer not found' });

  const normalized = normalizeIndianMobile(mobile);
  if (!normalized || normalized.length !== 10) {
    return res.status(400).json({ error: 'Valid 10-digit Indian mobile number is required' });
  }

  const duplicate = db.prepare('SELECT * FROM customers WHERE normalized_mobile = ? AND id != ?').get(normalized, customerId);
  if (duplicate) {
    return res.status(400).json({ error: `Mobile number already in use by ${duplicate.name} (${duplicate.customer_code})` });
  }

  db.prepare(`
    UPDATE customers 
    SET name = ?, mobile = ?, normalized_mobile = ?, secondary_mobile = ?, address = ?, notes = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    name.trim(),
    mobile.trim(),
    normalized,
    secondary_mobile ? secondary_mobile.trim() : null,
    address ? address.trim() : null,
    notes ? notes.trim() : null,
    customerId
  );

  const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);

  eventBus.broadcast('CUSTOMER_UPDATED', {
    id: updated.id,
    customer_code: updated.customer_code,
    name: updated.name,
    mobile: updated.normalized_mobile
  });

  res.json({ success: true, customer: updated });
});

// Customer profile & bill history
app.get('/api/customers/:id', authenticate, (req, res) => {
  const customerId = req.params.id;
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const bills = db.prepare(`
    SELECT id, bill_number, subtotal, discount_amount, final_amount, payment_method, status, pdf_path, invoice_token, created_at
    FROM bills 
    WHERE customer_id = ? 
    ORDER BY id DESC
  `).all(customerId);

  const stats = db.prepare(`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(final_amount), 0) as total_spent,
      MAX(created_at) as last_bill_date
    FROM bills 
    WHERE customer_id = ? AND status = 'completed'
  `).get(customerId);

  res.json({
    customer,
    bills,
    stats: {
      total_bills: stats.count,
      total_spent: stats.total_spent,
      last_bill_date: stats.last_bill_date
    }
  });
});

// ==========================================
// 5. PRODUCTS & CATEGORIES
// ==========================================

app.get('/api/categories', authenticate, (req, res) => {
  const categories = db.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY sort_order ASC, name ASC').all();
  res.json(categories);
});

app.post('/api/categories', authenticate, requireOwner, (req, res) => {
  const { name, gujarati_name } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });

  const exists = db.prepare('SELECT id FROM categories WHERE name = ?').get(name.trim());
  if (exists) return res.status(400).json({ error: 'Category already exists' });

  db.prepare('INSERT INTO categories (name, gujarati_name) VALUES (?, ?)').run(name.trim(), gujarati_name ? gujarati_name.trim() : null);
  
  eventBus.broadcast('CATEGORY_UPDATED', { name: name.trim() });
  res.json({ success: true });
});

app.get('/api/products', authenticate, (req, res) => {
  const { category, search, activeOnly = '1' } = req.query;
  let query = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (activeOnly === '1') {
    query += ' AND active = 1';
  }

  if (category && category !== 'All') {
    query += ' AND category = ?';
    params.push(category);
  }

  if (search) {
    const s = `%${search.trim()}%`;
    query += ' AND (name LIKE ? OR gujarati_name LIKE ? OR product_code LIKE ?)';
    params.push(s, s, s);
  }

  query += ' ORDER BY category ASC, name ASC';
  const products = db.prepare(query).all(...params);
  res.json(products);
});

app.post('/api/products', authenticate, requireOwner, (req, res) => {
  const { name, gujarati_name, category, price, unit = 'kg', barcode } = req.body;

  if (!name || !category || price === undefined) {
    return res.status(400).json({ error: 'Name, category, and price are required' });
  }

  const last = db.prepare('SELECT product_code FROM products ORDER BY id DESC LIMIT 1').get();
  const numPart = last ? parseInt(last.product_code.replace(/\D/g, ''), 10) : 0;
  const nextCode = `PRD-${String(numPart + 1).padStart(3, '0')}`;

  const insert = db.prepare(`
    INSERT INTO products (product_code, name, gujarati_name, category, price, unit, barcode)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = insert.run(
    nextCode,
    name.trim(),
    gujarati_name ? gujarati_name.trim() : null,
    category.trim(),
    Number(price),
    unit,
    barcode ? barcode.trim() : null
  );

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);

  eventBus.broadcast('PRODUCT_CREATED', { product });
  res.json({ success: true, product });
});

app.put('/api/products/:id', authenticate, requireOwner, (req, res) => {
  const prodId = req.params.id;
  const { name, gujarati_name, category, price, unit, barcode, active } = req.body;

  const current = db.prepare('SELECT * FROM products WHERE id = ?').get(prodId);
  if (!current) return res.status(404).json({ error: 'Product not found' });

  const newPrice = Number(price);
  if (current.price !== newPrice) {
    db.prepare(`
      INSERT INTO price_history (product_id, old_price, new_price, changed_by)
      VALUES (?, ?, ?, ?)
    `).run(prodId, current.price, newPrice, req.user.username);
  }

  db.prepare(`
    UPDATE products
    SET name = ?, gujarati_name = ?, category = ?, price = ?, unit = ?, barcode = ?, active = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    name.trim(),
    gujarati_name ? gujarati_name.trim() : null,
    category.trim(),
    newPrice,
    unit || current.unit,
    barcode !== undefined ? barcode : current.barcode,
    active !== undefined ? (active ? 1 : 0) : current.active,
    prodId
  );

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(prodId);

  eventBus.broadcast('PRODUCT_UPDATED', { product: updated });
  res.json({ success: true, product: updated });
});

app.post('/api/products/bulk-price', authenticate, requireOwner, (req, res) => {
  const { updates } = req.body;
  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({ error: 'Updates array required' });
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    for (const u of updates) {
      const current = db.prepare('SELECT price FROM products WHERE id = ?').get(u.id);
      if (current && current.price !== Number(u.price)) {
        db.prepare('INSERT INTO price_history (product_id, old_price, new_price, changed_by) VALUES (?, ?, ?, ?)')
          .run(u.id, current.price, Number(u.price), req.user.username);
        db.prepare('UPDATE products SET price = ?, updated_at = datetime("now", "localtime") WHERE id = ?')
          .run(Number(u.price), u.id);
      }
    }
    db.exec('COMMIT;');

    eventBus.broadcast('PRODUCTS_BULK_PRICE_UPDATED', { count: updates.length });
    res.json({ success: true, message: 'Bulk price update completed' });
  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. GOOGLE CLOUD STORAGE & SYNC DIAGNOSTICS
// ==========================================

app.get('/api/gcp/diagnostics', authenticate, (req, res) => {
  res.json(googleCloudService.getDiagnostics());
});

app.post('/api/gcp/sync-now', authenticate, requireOwner, async (req, res) => {
  try {
    await googleCloudService.processSyncOutbox();
    res.json({ success: true, diagnostics: googleCloudService.getDiagnostics() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 8. BILLING & INVOICING
// ==========================================

app.post('/api/bills', authenticate, async (req, res) => {
  try {
    const result = await createBill(req.body, req.user, getSettings);
    res.json(result);
  } catch (err) {
    console.error('[API] createBill error:', err);
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/bills', authenticate, (req, res) => {
  const { search, customer_id, filter = 'all', from_date, to_date, limit = 50, offset = 0 } = req.query;

  let query = 'SELECT * FROM bills WHERE 1=1';
  const params = [];

  if (customer_id) {
    query += ' AND customer_id = ?';
    params.push(customer_id);
  }

  if (search) {
    const s = `%${search.trim()}%`;
    query += ' AND (bill_number LIKE ? OR customer_name_snapshot LIKE ? OR customer_mobile_snapshot LIKE ?)';
    params.push(s, s, s);
  }

  if (filter === 'today') {
    query += " AND date(created_at) = date('now', 'localtime')";
  } else if (filter === 'yesterday') {
    query += " AND date(created_at) = date('now', '-1 day', 'localtime')";
  } else if (filter === 'last_7_days') {
    query += " AND date(created_at) >= date('now', '-7 days', 'localtime')";
  } else if (filter === 'this_month') {
    query += " AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')";
  } else if (from_date && to_date) {
    query += " AND date(created_at) BETWEEN ? AND ?";
    params.push(from_date, to_date);
  }

  query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit, 10), parseInt(offset, 10));

  const bills = db.prepare(query).all(...params);

  for (const b of bills) {
    const latestWa = db.prepare('SELECT status, error_message FROM whatsapp_logs WHERE bill_id = ? ORDER BY id DESC LIMIT 1').get(b.id);
    b.whatsapp_status = latestWa ? latestWa.status : 'none';
  }

  const total = db.prepare('SELECT COUNT(*) as c FROM bills').get().c;
  res.json({ bills, total });
});

app.get('/api/bills/:id', authenticate, (req, res) => {
  const billId = req.params.id;
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });

  bill.items = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(billId);
  bill.whatsapp_logs = db.prepare('SELECT * FROM whatsapp_logs WHERE bill_id = ? ORDER BY id DESC').all(billId);
  bill.payments = db.prepare('SELECT * FROM payments WHERE bill_id = ?').all(billId);

  res.json(bill);
});

// Cancel bill
app.post('/api/bills/:id/cancel', authenticate, (req, res) => {
  const billId = req.params.id;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Cancellation reason is required' });
  }

  try {
    const result = cancelBill(billId, reason.trim(), req.user);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Send / Resend WhatsApp Bill Invoice
app.post(['/api/bills/:id/send-whatsapp', '/api/bills/:id/resend-whatsapp', '/api/bills/:id/resend-sms'], authenticate, async (req, res) => {
  const billId = req.params.id;
  try {
    const result = await resendBillWhatsApp(billId, getSettings());
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Regenerate PDF
app.post('/api/bills/:id/regenerate-pdf', authenticate, async (req, res) => {
  const billId = req.params.id;
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });

  bill.items = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(billId);
  const settings = getSettings();

  try {
    const newPdfPath = await generateInvoicePDF(bill, settings, settings.default_pdf_format || 'format_a');
    db.prepare('UPDATE bills SET pdf_path = ? WHERE id = ?').run(newPdfPath, billId);
    res.json({ success: true, pdfPath: newPdfPath });
  } catch (err) {
    res.status(500).json({ error: 'Failed to regenerate PDF: ' + err.message });
  }
});

// ==========================================
// 9. DASHBOARD & SALES REPORTS
// ==========================================

app.get('/api/dashboard/stats', authenticate, (req, res) => {
  const todaySales = db.prepare(`
    SELECT 
      COALESCE(SUM(final_amount), 0) as total_sales,
      COUNT(*) as total_bills,
      COALESCE(AVG(final_amount), 0) as avg_bill_value
    FROM bills 
    WHERE date(created_at) = date('now', 'localtime') AND status = 'completed'
  `).get();

  const todayCust = db.prepare(`
    SELECT COUNT(*) as count FROM customers 
    WHERE date(created_at) = date('now', 'localtime')
  `).get().count;

  const todayWhatsApp = db.prepare(`
    SELECT 
      SUM(CASE WHEN status IN ('sent', 'delivered') THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM whatsapp_logs
    WHERE date(created_at) = date('now', 'localtime')
  `).get() || {};

  const totalCust = db.prepare('SELECT COUNT(*) as count FROM customers WHERE active = 1').get().count;
  const totalProd = db.prepare('SELECT COUNT(*) as count FROM products WHERE active = 1').get().count;

  res.json({
    today_sales: roundToTwo(todaySales.total_sales),
    today_bills: todaySales.total_bills,
    avg_bill_value: roundToTwo(todaySales.avg_bill_value),
    today_customers: todayCust,
    today_whatsapp_sent: todayWhatsApp.sent || 0,
    today_whatsapp_failed: todayWhatsApp.failed || 0,
    today_sms_sent: todayWhatsApp.sent || 0,
    today_sms_failed: todayWhatsApp.failed || 0,
    total_customers: totalCust,
    total_products: totalProd
  });
});

app.get('/api/dashboard/charts', authenticate, (req, res) => {
  const last7Days = db.prepare(`
    SELECT 
      date(created_at) as sale_date,
      COALESCE(SUM(final_amount), 0) as total,
      COUNT(*) as bills_count
    FROM bills 
    WHERE status = 'completed' AND date(created_at) >= date('now', '-6 days', 'localtime')
    GROUP BY date(created_at)
    ORDER BY sale_date ASC
  `).all();

  const todayHourly = db.prepare(`
    SELECT 
      strftime('%H:00', created_at) as hour,
      COALESCE(SUM(final_amount), 0) as total,
      COUNT(*) as count
    FROM bills 
    WHERE status = 'completed' AND date(created_at) = date('now', 'localtime')
    GROUP BY strftime('%H:00', created_at)
    ORDER BY hour ASC
  `).all();

  const monthlySales = db.prepare(`
    SELECT 
      strftime('%Y-%m', created_at) as month,
      COALESCE(SUM(final_amount), 0) as total,
      COUNT(*) as bills_count
    FROM bills 
    WHERE status = 'completed' AND strftime('%Y', created_at) = strftime('%Y', 'now', 'localtime')
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month ASC
  `).all();

  res.json({
    last_7_days: last7Days,
    today_hourly: todayHourly,
    monthly: monthlySales
  });
});

app.get('/api/reports/daily', authenticate, (req, res) => {
  const targetDate = req.query.date || new Date().toISOString().split('T')[0];

  const summary = db.prepare(`
    SELECT 
      COUNT(*) as total_bills,
      COALESCE(SUM(final_amount), 0) as total_sales,
      COALESCE(SUM(discount_amount), 0) as total_discounts,
      COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN final_amount ELSE 0 END), 0) as cash_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'upi' THEN final_amount ELSE 0 END), 0) as upi_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'card' THEN final_amount ELSE 0 END), 0) as card_sales,
      COALESCE(SUM(CASE WHEN payment_method NOT IN ('cash', 'upi', 'card') THEN final_amount ELSE 0 END), 0) as other_sales
    FROM bills 
    WHERE date(created_at) = date(?) AND status = 'completed'
  `).get(targetDate);

  const cancelledCount = db.prepare(`
    SELECT COUNT(*) as c FROM bills WHERE date(created_at) = date(?) AND status = 'cancelled'
  `).get(targetDate).c;

  const itemSales = db.prepare(`
    SELECT 
      bi.product_name_snapshot,
      bi.unit,
      SUM(bi.quantity) as total_quantity,
      SUM(bi.line_total) as total_amount
    FROM bill_items bi
    JOIN bills b ON bi.bill_id = b.id
    WHERE date(b.created_at) = date(?) AND b.status = 'completed'
    GROUP BY bi.product_name_snapshot, bi.unit
    ORDER BY total_amount DESC
  `).all(targetDate);

  res.json({
    date: targetDate,
    summary: {
      total_bills: summary.total_bills,
      total_sales: roundToTwo(summary.total_sales),
      total_discounts: roundToTwo(summary.total_discounts),
      cash_sales: roundToTwo(summary.cash_sales),
      upi_sales: roundToTwo(summary.upi_sales),
      card_sales: roundToTwo(summary.card_sales),
      other_sales: roundToTwo(summary.other_sales),
      cancelled_bills: cancelledCount
    },
    itemSales
  });
});

app.get('/api/reports/export-csv', authenticate, (req, res) => {
  const { from_date, to_date } = req.query;
  let query = 'SELECT bill_number, customer_name_snapshot, customer_mobile_snapshot, subtotal, discount_amount, final_amount, payment_method, payment_status, status, cashier_name, created_at FROM bills WHERE 1=1';
  const params = [];

  if (from_date && to_date) {
    query += ' AND date(created_at) BETWEEN ? AND ?';
    params.push(from_date, to_date);
  }

  query += ' ORDER BY id DESC';
  const rows = db.prepare(query).all(...params);

  let csv = 'Bill Number,Customer Name,Mobile,Subtotal (INR),Discount (INR),Final Total (INR),Payment Mode,Payment Status,Status,Cashier,Date\n';
  for (const r of rows) {
    csv += `"${r.bill_number}","${r.customer_name_snapshot || ''}","${r.customer_mobile_snapshot || ''}",${r.subtotal},${r.discount_amount},${r.final_amount},"${r.payment_method}","${r.payment_status}","${r.status}","${r.cashier_name}","${r.created_at}"\n`;
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="SMN_Sweets_Sales_Report.csv"');
  res.send(csv);
});

// ==========================================
// 10. WHATSAPP LOGS & BOT CONTROLS
// ==========================================

app.get('/api/whatsapp/logs', authenticate, (req, res) => {
  const { search, limit = 50, offset = 0 } = req.query;
  let query = `
    SELECT 
      wl.*,
      b.bill_number,
      c.name as customer_name
    FROM whatsapp_logs wl
    LEFT JOIN bills b ON wl.bill_id = b.id
    LEFT JOIN customers c ON wl.customer_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    const s = `%${search.trim()}%`;
    query += ' AND (wl.mobile_number LIKE ? OR b.bill_number LIKE ? OR wl.customer_name LIKE ?)';
    params.push(s, s, s);
  }

  query += ' ORDER BY wl.id DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit, 10), parseInt(offset, 10));

  const records = db.prepare(query).all(...params);
  const queuePendingCount = db.prepare("SELECT COUNT(*) as c FROM whatsapp_queue WHERE status = 'pending'").get().c;

  res.json({ records, queuePendingCount });
});

// Historical SMS Archive access (preserves historical records safely)
app.get('/api/sms/history', authenticate, (req, res) => {
  const { search, limit = 50, offset = 0 } = req.query;
  let query = 'SELECT * FROM sms_records WHERE 1=1';
  const params = [];
  if (search) {
    query += ' AND mobile_number LIKE ?';
    params.push(`%${search.trim()}%`);
  }
  query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit, 10), parseInt(offset, 10));
  const records = db.prepare(query).all(...params);
  res.json({ records, queuePendingCount: 0 });
});

app.post('/api/whatsapp/test', authenticate, requireOwner, async (req, res) => {
  const { mobile } = req.body;
  try {
    const result = await sendTestWhatsApp(mobile, getSettings());
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/whatsapp/status', authenticate, (req, res) => {
  const settings = getSettings();
  res.json({
    enabled: settings.whatsapp_enabled === '1',
    botUrl: settings.whatsapp_bot_url || 'http://127.0.0.1:3001/api/send',
    configured: Boolean(settings.whatsapp_bot_url)
  });
});

// ==========================================
// 11. SETTINGS MANAGEMENT
// ==========================================

app.get('/api/settings', authenticate, (req, res) => {
  const settings = getSettings();
  if (req.user.role === 'cashier' && settings.whatsapp_bot_token) {
    settings.whatsapp_bot_token = '••••••••••••••••';
  }
  res.json(settings);
});

app.put('/api/settings', authenticate, requireOwner, (req, res) => {
  const updates = req.body;
  db.exec('BEGIN TRANSACTION;');
  try {
    const updateStmt = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', 'localtime')
    `);

    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined && val !== null) {
        if (key === 'whatsapp_bot_token' && val === '••••••••••••••••') continue;
        updateStmt.run(key, String(val));
      }
    }

    db.exec('COMMIT;');

    db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, details)
      VALUES (?, ?, 'UPDATE_SETTINGS', 'Shop settings updated')
    `).run(req.user.id, req.user.username);

    eventBus.broadcast('SETTINGS_UPDATED', { updatedKeys: Object.keys(updates) });

    res.json({ success: true, settings: getSettings() });
  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 12. BACKUP & RESTORE
// ==========================================

app.get('/api/backups', authenticate, requireOwner, (req, res) => {
  const backups = listBackups();
  res.json(backups);
});

app.post('/api/backups/create', authenticate, requireOwner, (req, res) => {
  try {
    const result = createBackup();
    eventBus.broadcast('BACKUP_CREATED', { fileName: result.fileName });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backups/restore', authenticate, requireOwner, (req, res) => {
  const { backupPath } = req.body;
  try {
    const result = restoreBackup(backupPath);
    eventBus.broadcast('BACKUP_RESTORED', { timestamp: new Date().toISOString() });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend build if dist folder exists
const DIST_DIR = path.join(__dirname, '../dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/invoice') || req.path.startsWith('/i/')) {
      return next();
    }
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] SMN SWEET'S Billing Server running at http://127.0.0.1:${PORT}`);
});

module.exports = app;
