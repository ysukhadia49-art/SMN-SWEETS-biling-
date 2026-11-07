const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Determine data directory
const DATA_DIR = process.env.APPDATA 
  ? path.join(process.env.APPDATA, 'SMN_Sweets')
  : path.join(__dirname, '../../data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const INVOICES_DIR = path.join(DATA_DIR, 'invoices');
if (!fs.existsSync(INVOICES_DIR)) {
  fs.mkdirSync(INVOICES_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'smn_sweets.db');

console.log(`[DB] Initializing SQLite database at: ${DB_PATH}`);
const db = new DatabaseSync(DB_PATH);

// Enable foreign keys and WAL mode for maximum performance and crash resilience
db.exec('PRAGMA foreign_keys = ON;');

function initSchema() {
  // First ensure base tables exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner', 'cashier')),
      full_name TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      gujarati_name TEXT,
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      gujarati_name TEXT,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      unit TEXT NOT NULL DEFAULT 'kg' CHECK(unit IN ('kg', 'g', 'piece', 'box', 'packet')),
      barcode TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      old_price REAL NOT NULL,
      new_price REAL NOT NULL,
      changed_by TEXT,
      changed_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      normalized_mobile TEXT UNIQUE NOT NULL,
      secondary_mobile TEXT,
      address TEXT,
      notes TEXT,
      total_bills INTEGER DEFAULT 0,
      total_spent REAL DEFAULT 0,
      last_purchase_at TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_uuid TEXT,
      shop_id TEXT DEFAULT 'smn_ahmedabad',
      terminal_id TEXT DEFAULT 'term_01',
      bill_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER,
      customer_name_snapshot TEXT NOT NULL,
      customer_mobile_snapshot TEXT,
      subtotal REAL NOT NULL,
      discount_type TEXT DEFAULT 'fixed' CHECK(discount_type IN ('fixed', 'percentage')),
      discount_value REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      final_amount REAL NOT NULL,
      amount_minor INTEGER,
      payment_method TEXT NOT NULL,
      split_details TEXT,
      payment_status TEXT NOT NULL DEFAULT 'paid',
      status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed', 'cancelled')),
      cancellation_reason TEXT,
      cancelled_by TEXT,
      cancelled_at TEXT,
      cashier_id INTEGER,
      cashier_name TEXT NOT NULL,
      pdf_path TEXT,
      invoice_token TEXT UNIQUE,
      sync_status TEXT DEFAULT 'saved_locally',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS bill_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name_snapshot TEXT NOT NULL,
      gujarati_name_snapshot TEXT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      unit_price REAL NOT NULL,
      line_total REAL NOT NULL,
      notes TEXT,
      FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS payment_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_uuid TEXT UNIQUE NOT NULL,
      bill_id INTEGER,
      bill_uuid TEXT,
      order_ref TEXT NOT NULL,
      method TEXT NOT NULL CHECK(method IN ('upi', 'card', 'cash', 'split')),
      requested_amount REAL NOT NULL,
      amount_minor INTEGER NOT NULL,
      currency TEXT DEFAULT 'INR',
      merchant_vpa TEXT,
      qr_payload TEXT,
      status TEXT NOT NULL DEFAULT 'QR_READY' CHECK(status IN ('QR_READY', 'PAYMENT_PENDING', 'PROVIDER_VERIFIED_PAID', 'MANUALLY_CONFIRMED', 'CANCELLED', 'EXPIRED', 'FAILED')),
      provider_transaction_id TEXT,
      utr TEXT,
      superseded_by TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      expires_at TEXT,
      confirmed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_uuid TEXT UNIQUE NOT NULL,
      bill_id INTEGER,
      bill_uuid TEXT,
      attempt_uuid TEXT,
      amount REAL NOT NULL,
      amount_minor INTEGER NOT NULL,
      method TEXT NOT NULL,
      verification_type TEXT NOT NULL CHECK(verification_type IN ('provider_verified', 'manually_confirmed')),
      provider_transaction_id TEXT,
      utr TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      recorded_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS terminal_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_uuid TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      device_provider TEXT NOT NULL CHECK(device_provider IN ('bharatpe', 'generic_card', 'none')),
      device_model TEXT,
      capabilities TEXT,
      config_status TEXT NOT NULL DEFAULT 'NOT CONFIGURED / UNSUPPORTED',
      last_seen_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      op_uuid TEXT UNIQUE NOT NULL,
      entity_type TEXT NOT NULL,
      entity_uuid TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'syncing', 'synced', 'failed')),
      attempts INTEGER DEFAULT 0,
      last_error TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sms_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER,
      customer_id INTEGER,
      mobile_number TEXT NOT NULL,
      message TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_message_id TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending', 'queued', 'sent', 'delivered', 'failed', 'retrying')),
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      sent_at TEXT,
      delivered_at TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE SET NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS sms_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      customer_id INTEGER,
      mobile_number TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'failed')),
      attempts INTEGER DEFAULT 0,
      last_attempt_at TEXT,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
    );

    -- Active WhatsApp Bot Logs (Replaces SMS Logs)
    CREATE TABLE IF NOT EXISTS whatsapp_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER,
      bill_number TEXT,
      customer_id INTEGER,
      customer_name TEXT,
      mobile_number TEXT NOT NULL,
      message TEXT NOT NULL,
      provider_message_id TEXT,
      status TEXT NOT NULL CHECK(status IN ('queued', 'sent', 'delivered', 'failed', 'retrying', 'disabled', 'skipped')),
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      sent_at TEXT,
      delivered_at TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE SET NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );

    -- Offline WhatsApp Message Retry Queue
    CREATE TABLE IF NOT EXISTS whatsapp_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      customer_id INTEGER,
      mobile_number TEXT NOT NULL,
      message TEXT NOT NULL,
      pdf_url TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'failed')),
      attempts INTEGER DEFAULT 0,
      last_attempt_at TEXT,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Run migrations to ensure columns exist on older bills table
  runMigrations();

  // Create indexes now that all columns are guaranteed
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_customers_normalized_mobile ON customers(normalized_mobile);
    CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(customer_code);
    CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_bills_number ON bills(bill_number);
    CREATE INDEX IF NOT EXISTS idx_bills_uuid ON bills(bill_uuid);
    CREATE INDEX IF NOT EXISTS idx_bills_customer ON bills(customer_id);
    CREATE INDEX IF NOT EXISTS idx_bills_created ON bills(created_at);
    CREATE INDEX IF NOT EXISTS idx_payment_attempts_ref ON payment_attempts(order_ref);
    CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON payment_attempts(status);
    CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments(bill_id);
    CREATE INDEX IF NOT EXISTS idx_sync_outbox_status ON sync_outbox(status);
    CREATE INDEX IF NOT EXISTS idx_sms_records_bill ON sms_records(bill_id);
    CREATE INDEX IF NOT EXISTS idx_sms_queue_status ON sms_queue(status);
    CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_bill ON whatsapp_logs(bill_id);
    CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_mobile ON whatsapp_logs(mobile_number);
    CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_status ON whatsapp_queue(status);
  `);

  seedDefaults();
}

function runMigrations() {
  // Check and add columns to bills table if upgrading
  try {
    const tableInfo = db.prepare("PRAGMA table_info('bills')").all();
    const colNames = tableInfo.map(c => c.name);

    if (!colNames.includes('bill_uuid')) {
      db.exec("ALTER TABLE bills ADD COLUMN bill_uuid TEXT;");
    }
    if (!colNames.includes('shop_id')) {
      db.exec("ALTER TABLE bills ADD COLUMN shop_id TEXT DEFAULT 'smn_ahmedabad';");
    }
    if (!colNames.includes('terminal_id')) {
      db.exec("ALTER TABLE bills ADD COLUMN terminal_id TEXT DEFAULT 'term_01';");
    }
    if (!colNames.includes('amount_minor')) {
      db.exec("ALTER TABLE bills ADD COLUMN amount_minor INTEGER;");
    }
    if (!colNames.includes('sync_status')) {
      db.exec("ALTER TABLE bills ADD COLUMN sync_status TEXT DEFAULT 'saved_locally';");
    }
  } catch (err) {
    console.error('[DB] Migration error on bills table:', err);
  }
}

function seedDefaults() {
  const defaultSettings = [
    ['shop_name', 'Sukhadiya Manilal Nathalal'],
    ['shop_tagline', 'ચોખ્ખા ઘી ની મીઠાઈઓ અને કાજુની આઈટમ હોલસેલ ભાવે મળશે'],
    ['shop_address', 'દુકાન નં.: ૯, ૧૦, ૧૫, કંડોઈ ઓળ, માણેકચોક, અમદાવાદ | વર્કશોપ: ૨૮૫, નાગોરીશાળા, રતનપોળ, અમદાવાદ'],
    ['shop_mobile', '+91 8238773681'],
    ['shop_whatsapp', '+91 8238773681'],
    ['shop_email', 'contact@smnsweets.in'],
    ['est_year', '1849'],
    ['bill_footer', 'Thank you for shopping at Sukhadiya Manilal Nathalal (SMN SWEET\'S)! Visit Again!'],
    ['bill_footer_gujarati', 'સુખડિયા મણીલાલ નથ્થાલાલ (SMN SWEET\'S) ની મુલાકાત બદલ આભાર! ફરી પધારશો!'],
    ['bill_prefix', 'SMN-'],
    ['bill_next_number', '1'],
    ['default_pdf_format', 'format_a'], // 'format_a' (Standard) or 'format_b' (Thermal Receipt)
    ['receipt_width', '80mm'], // '58mm' or '80mm'
    ['language', 'en'], // 'en' or 'gu'
    ['whatsapp_enabled', '1'],
    ['whatsapp_bot_url', 'http://127.0.0.1:3001/api/send'],
    ['whatsapp_bot_token', 'smn_wa_secret_token_123'],
    ['invoice_base_url', 'http://127.0.0.1:4000'],
    ['theme', 'maroon_gold'],
    ['default_payment_method', 'cash'],
    ['max_discount_cashier', '100'],
    ['setup_completed', '1'],
    // Card Terminal Configuration
    ['card_terminal_status', 'STANDALONE / MANUAL CONFIRMATION'],
    ['card_terminal_id', ''],
    // Google Cloud Configuration
    ['gcp_project_id', 'smn-sweets-production'],
    ['gcp_invoices_bucket', 'smn-sweets-invoices'],
    ['gcp_backups_bucket', 'smn-sweets-backups'],
    ['gcp_sync_enabled', '0'],
    ['gcp_backend_url', 'https://api.smnsweets.in'],
    ['gcp_last_synced_at', '']
  ];

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of defaultSettings) {
    insertSetting.run(key, value);
  }

  // Cleanly purge deprecated SMS and Dynamic QR settings from database
  db.prepare(`
    DELETE FROM settings WHERE key IN (
      'sms_enabled', 'sms_provider', 'sms_api_key', 'sms_sender_id',
      'sms_template_id', 'sms_dlt_pe_id', 'sms_custom_endpoint',
      'merchant_upi_vpa', 'merchant_upi_name', 'bharatpe_terminal_id',
      'bharatpe_device_status', 'upi_qr_timeout_seconds'
    )
  `).run();

  // Categories
  const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  if (catCount === 0) {
    const categories = [
      ['Peda', 'પેડા', 1],
      ['Barfi', 'બરફી', 2],
      ['Halwa', 'હલવો', 3],
      ['Laddu', 'લાડુ', 4],
      ['Ghari', 'ઘારી', 5],
      ['Kaju ni Mithai', 'કાજુ ની મીઠાઈ', 6],
      ['Badam ni Mithai', 'બદામ ની મીઠાઈ', 7],
      ['Mithai', 'મીઠાઈ', 8]
    ];
    const insertCat = db.prepare('INSERT INTO categories (name, gujarati_name, sort_order) VALUES (?, ?, ?)');
    for (const [name, guj, order] of categories) {
      insertCat.run(name, guj, order);
    }
  }

  // Products
  const prodCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  if (prodCount === 0) {
    const smnProducts = [
      // 1. Peda (પેડા)
      ['PRD-001', 'Safed Peda', 'સફેદ પેડા', 'Peda', 560, 'kg'],
      ['PRD-002', 'Kesar Peda', 'કેસર પેડા', 'Peda', 600, 'kg'],
      ['PRD-003', 'Mathura Peda', 'મથુરા પેડા', 'Peda', 520, 'kg'],
      ['PRD-004', 'Kathiyawadi Peda', 'કાઠીયાવાડી પેડા', 'Peda', 520, 'kg'],

      // 2. Barfi (બરફી)
      ['PRD-005', 'Safed Barfi', 'સફેદ બરફી', 'Barfi', 600, 'kg'],
      ['PRD-006', 'Kesar Barfi', 'કેસર બરફી', 'Barfi', 640, 'kg'],
      ['PRD-007', 'Pineapple Barfi', 'પાઈનેપલ બરફી', 'Barfi', 680, 'kg'],
      ['PRD-008', 'Butterscotch Barfi', 'બટરસ્કોચ બરફી', 'Barfi', 720, 'kg'],
      ['PRD-009', 'Pista Barfi', 'પિસ્તા બરફી', 'Barfi', 720, 'kg'],

      // 3. Halwa (હલવો)
      ['PRD-010', 'Badam Dryfruit Halwa', 'બદામ ડ્રાયફ્રુટ હલવો', 'Halwa', 800, 'kg'],
      ['PRD-011', 'Anjir Halwa', 'અંજીર હલવો', 'Halwa', 760, 'kg'],
      ['PRD-012', 'Narangi Halwa', 'નારંગી હલવો', 'Halwa', 600, 'kg'],
      ['PRD-013', 'Dudhi Halwa', 'દૂધી હલવો', 'Halwa', 600, 'kg'],
      ['PRD-014', 'Bombay Ice Halwa', 'બોમ્બે આઈસ હલવો', 'Halwa', 720, 'kg'],
      ['PRD-015', 'Karachi Halwa', 'કરાચી હલવો', 'Halwa', 520, 'kg'],
      ['PRD-016', 'Dudh Halwa', 'દૂધનો હલવો', 'Halwa', 680, 'kg'],

      // 4. Laddu (લાડુ)
      ['PRD-017', 'Moti Chur Laddu', 'મોતીચૂર લાડુ', 'Laddu', 780, 'kg'],
      ['PRD-018', 'Besan Laddu', 'બેસન લાડુ', 'Laddu', 780, 'kg'],
      ['PRD-019', 'Churma Laddu', 'ચુરમાના લાડુ', 'Laddu', 680, 'kg'],
      ['PRD-020', 'Orange Topra Laddu', 'ઓરેન્જ ટોપરા લાડુ', 'Laddu', 680, 'kg'],
      ['PRD-021', 'Lakrashi Laddu', 'લાકરશી લાડુ', 'Laddu', 360, 'kg'],

      // 5. Ghari (ઘારી)
      ['PRD-022', 'Mawa Mava Ghari', 'માવા ઘારી', 'Ghari', 800, 'kg'],
      ['PRD-023', 'Kesar Ghari', 'કેસર ઘારી', 'Ghari', 860, 'kg'],
      ['PRD-024', 'Pista Ghari', 'પિસ્તા ઘારી', 'Ghari', 1120, 'kg'],

      // 6. Kaju ni Mithai (કાજુ ની મીઠાઈ)
      ['PRD-025', 'Kaju Mix Mithai', 'કાજુ મિક્સ મીઠાઈ', 'Kaju ni Mithai', 1280, 'kg'],
      ['PRD-026', 'Kajukatri', 'કાજુકતરી', 'Kaju ni Mithai', 1180, 'kg'],
      ['PRD-027', 'Kesar Kaju Katri', 'કેસર કાજુ કતરી', 'Kaju ni Mithai', 1220, 'kg'],
      ['PRD-028', 'Strawberry Kaju Katri', 'સ્ટ્રોબેરી કાજુ કતરી', 'Kaju ni Mithai', 1220, 'kg'],
      ['PRD-029', 'Dryfruit Kaju Katri', 'ડ્રાયફ્રુટ કાજુ કતરી', 'Kaju ni Mithai', 1380, 'kg'],
      ['PRD-030', 'Pista Roll', 'પિસ્તા રોલ', 'Kaju ni Mithai', 1320, 'kg'],
      ['PRD-031', 'Anjir Roll', 'અંજીર રોલ', 'Kaju ni Mithai', 1180, 'kg'],
      ['PRD-032', 'Kaju Kasata', 'કાજુ કસાટા', 'Kaju ni Mithai', 1200, 'kg'],
      ['PRD-033', 'Kaju Apple', 'કાજુ એપલ', 'Kaju ni Mithai', 1280, 'kg'],
      ['PRD-034', 'Kaju Tadbu', 'કાજુ તડબુચ', 'Kaju ni Mithai', 1280, 'kg'],
      ['PRD-035', 'Kaju Maysur', 'કાજુ મેસુર', 'Kaju ni Mithai', 1120, 'kg'],
      ['PRD-036', 'Mix Delight', 'મિક્સ ડીલાઈટ', 'Kaju ni Mithai', 1300, 'kg'],
      ['PRD-037', 'Mix Bites', 'મિક્સ બાઈટ્સ', 'Kaju ni Mithai', 1300, 'kg'],
      ['PRD-038', 'Mix Crunch', 'મિક્સ ક્રંચ', 'Kaju ni Mithai', 1300, 'kg'],

      // 7. Badam ni Mithai (બદામ ની મીઠાઈ)
      ['PRD-039', 'Badam Katri', 'બદામ કટરી', 'Badam ni Mithai', 1380, 'kg'],
      ['PRD-040', 'Akhrot Chocolate Bike', 'અખરોટ ચોકલેટ બાઈક', 'Badam ni Mithai', 1380, 'kg'],

      // 8. Mithai (મીઠાઈ / Mawa & General Sweets)
      ['PRD-041', 'Mawa Mix Mithai', 'માવા મિક્સ મીઠાઈ', 'Mithai', 720, 'kg'],
      ['PRD-042', 'Mawa Fancy Mithai', 'માવા ફેન્સી મીઠાઈ', 'Mithai', 800, 'kg'],
      ['PRD-043', 'Magaj', 'મગજ', 'Mithai', 760, 'kg'],
      ['PRD-044', 'Kesar Mohanthal', 'કેસર મોહનથાળ', 'Mithai', 840, 'kg'],
      ['PRD-045', 'Son Papdi', 'સોન પાપડી', 'Mithai', 680, 'kg'],
      ['PRD-046', 'Coprapak', 'કોપરાપાક', 'Mithai', 680, 'kg'],
      ['PRD-047', 'Halvason', 'હલવાસન', 'Mithai', 720, 'kg'],
      ['PRD-048', 'Ghelfa', 'ગલેફા', 'Mithai', 680, 'kg'],
      ['PRD-049', 'Saado Mesur', 'સાદો મેસૂર', 'Mithai', 800, 'kg']
    ];

    const insertProd = db.prepare(`
      INSERT INTO products (product_code, name, gujarati_name, category, price, unit)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const p of smnProducts) {
      insertProd.run(...p);
    }
  }

  // Users
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const salt = bcrypt.genSaltSync(10);
    const ownerHash = bcrypt.hashSync('smn@123', salt);
    const cashierHash = bcrypt.hashSync('cashier@123', salt);

    const insertUser = db.prepare(`
      INSERT INTO users (username, password_hash, role, full_name)
      VALUES (?, ?, ?, ?)
    `);

    insertUser.run('owner', ownerHash, 'owner', 'Owner - SMN Sweets');
    insertUser.run('cashier', cashierHash, 'cashier', 'Shift Cashier');
  }
}

// Mobile normalizer utility
function normalizeIndianMobile(rawMobile) {
  if (!rawMobile) return '';
  let digits = rawMobile.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}

initSchema();

module.exports = {
  db,
  DATA_DIR,
  INVOICES_DIR,
  DB_PATH,
  normalizeIndianMobile
};
