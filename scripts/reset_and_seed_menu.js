const fs = require('fs');
const path = require('path');
const os = require('os');
const { DatabaseSync } = require('node:sqlite');

function runReset() {
  console.log('=== SMN SWEET\'S — DATABASE RESET & OFFICIAL MENU SEEDING ===\n');

  const appData = process.env.APPDATA || (
    process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support')
      : path.join(os.homedir(), '.config')
  );

  const dbDir = path.join(appData, 'SMN_Sweets');
  const dbPath = path.join(dbDir, 'smn_sweets.db');

  if (!fs.existsSync(dbPath)) {
    console.error(`Database not found at ${dbPath}`);
    process.exit(1);
  }

  // 1. Safety Backup
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(dbDir, `smn_sweets_backup_${timestamp}.db`);
  fs.copyFileSync(dbPath, backupPath);
  console.log(`[1] Created safety backup at:\n    ${backupPath}\n`);

  // 2. Open DB
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = OFF;');

  console.log('[2] Clearing all previous transactional/test data...');
  db.exec('BEGIN TRANSACTION;');

  try {
    const tablesToClear = [
      'bills', 'bill_items', 'payments', 'payment_attempts',
      'customers', 'whatsapp_logs', 'whatsapp_queue',
      'sms_records', 'sms_queue', 'sync_outbox',
      'audit_logs', 'price_history', 'products', 'categories'
    ];
    for (const tbl of tablesToClear) {
      try {
        db.exec(`DELETE FROM ${tbl};`);
      } catch (e) {
        // Table might not exist or already empty, ignore safely
      }
    }

    // Reset sqlite_sequence if table exists
    try {
      db.exec("DELETE FROM sqlite_sequence WHERE name IN ('bills', 'bill_items', 'payments', 'customers', 'whatsapp_logs', 'whatsapp_queue', 'products', 'categories');");
    } catch (e) {
      // ignore
    }

    console.log('    ✓ Cleared bills, customers, payments, logs, and previous products.');

    // 3. Insert the 8 Official Categories from the menu card
    console.log('\n[3] Seeding 8 Official Categories from Menu Card...');
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

    const insertCat = db.prepare('INSERT INTO categories (name, gujarati_name, sort_order, active) VALUES (?, ?, ?, 1)');
    for (const [name, guj, sort] of categories) {
      insertCat.run(name, guj, sort);
      console.log(`    + Category: ${name} (${guj})`);
    }

    // 4. Insert All 49 Authentic Products from the Photo Menu Cards
    console.log('\n[4] Seeding 49 Authentic Sweets from Menu Cards...');
    const products = [
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
      INSERT INTO products (product_code, name, gujarati_name, category, price, unit, active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    for (const p of products) {
      insertProd.run(...p);
      console.log(`    + [${p[0]}] ${p[1]} / ${p[2]} — ₹${p[4]}/${p[5]} (${p[3]})`);
    }

    // 5. Update Business Settings from the Card
    console.log('\n[5] Updating Business Settings to match official card...');
    const updateSetting = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', 'localtime')
    `);

    const shopSettings = [
      ['shop_name', 'Sukhadiya Manilal Nathalal'],
      ['shop_tagline', 'ચોખ્ખા ઘી ની મીઠાઈઓ અને કાજુની આઈટમ હોલસેલ ભાવે મળશે'],
      ['shop_address', 'દુકાન નં.: ૯, ૧૦, ૧૫, કંડોઈ ઓળ, માણેકચોક, અમદાવાદ | વર્કશોપ: ૨૮૫, નાગોરીશાળા, રતનપોળ, અમદાવાદ'],
      ['shop_mobile', '+91 8238773681'],
      ['shop_whatsapp', '+91 8238773681'],
      ['shop_email', 'contact@smnsweets.in'],
      ['est_year', '1849'],
      ['bill_prefix', 'SMN-'],
      ['bill_next_number', '1'],
      ['bill_footer', 'Thank you for shopping at Sukhadiya Manilal Nathalal (SMN SWEET\'S)! Visit Again!'],
      ['bill_footer_gujarati', 'સુખડિયા મણીલાલ નથ્થાલાલ (SMN SWEET\'S) ની મુલાકાત બદલ આભાર! ફરી પધારશો!'],
      ['setup_completed', '1']
    ];

    for (const [k, v] of shopSettings) {
      updateSetting.run(k, v);
      console.log(`    ✓ ${k} = "${v}"`);
    }

    db.exec('COMMIT;');
    console.log('\n✓ Transaction successfully committed!');
    console.log(`✓ 8 Categories seeded.`);
    console.log(`✓ ${products.length} Products seeded.`);
    console.log(`✓ Bill numbering reset to start at SMN-000001.`);
    console.log(`✓ Clean database ready for daily shop operations.`);

  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('❌ Failed to reset database:', err);
    process.exit(1);
  } finally {
    db.close();
  }
}

runReset();
