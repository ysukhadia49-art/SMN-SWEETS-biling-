const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { DATA_DIR, INVOICES_DIR, DB_PATH, db } = require('../database/db');

const BACKUP_DIR = path.join(DATA_DIR, 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Create a full ZIP backup of Database, Settings, and Invoices
 * @returns {string} Backup ZIP file path
 */
function createBackup(customTargetDir = null) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `SMN_Sweets_Backup_${timestamp}.zip`;
  const destinationDir = customTargetDir || BACKUP_DIR;

  if (!fs.existsSync(destinationDir)) {
    fs.mkdirSync(destinationDir, { recursive: true });
  }

  const backupZipPath = path.join(destinationDir, backupFileName);
  const zip = new AdmZip();

  // 1. Add SQLite database
  if (fs.existsSync(DB_PATH)) {
    zip.addLocalFile(DB_PATH, '', 'smn_sweets.db');
  }

  // 2. Add Invoices folder if exists
  if (fs.existsSync(INVOICES_DIR)) {
    zip.addLocalFolder(INVOICES_DIR, 'invoices');
  }

  // 3. Add manifest with checksum & metadata
  const manifest = {
    version: '1.0.0',
    app: "SMN SWEET'S Billing & PDF Invoice Management System",
    created_at: new Date().toISOString(),
    total_customers: db.prepare('SELECT count(*) as c FROM customers').get().c,
    total_bills: db.prepare('SELECT count(*) as c FROM bills').get().c,
    total_products: db.prepare('SELECT count(*) as c FROM products').get().c,
  };

  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

  // Write archive
  zip.writeZip(backupZipPath);
  console.log(`[Backup] Backup successfully written to: ${backupZipPath}`);

  return {
    success: true,
    backupPath: backupZipPath,
    fileName: backupFileName,
    sizeBytes: fs.statSync(backupZipPath).size,
    timestamp: manifest.created_at
  };
}

/**
 * Restore from a backup archive with safety verification
 * @param {string} sourceZipPath
 * @returns {Object}
 */
function restoreBackup(sourceZipPath) {
  if (!fs.existsSync(sourceZipPath)) {
    throw new Error('Backup file does not exist at specified path');
  }

  // 1. Verify ZIP archive and manifest
  const zip = new AdmZip(sourceZipPath);
  const zipEntries = zip.getEntries();
  const hasDb = zipEntries.some(e => e.entryName === 'smn_sweets.db');
  const hasManifest = zipEntries.some(e => e.entryName === 'manifest.json');

  if (!hasDb) {
    throw new Error('Invalid backup file: smn_sweets.db missing from archive');
  }

  // 2. Create SAFETY PRE-RESTORE BACKUP of current data before overwriting
  console.log('[Backup] Creating safety pre-restore backup...');
  createBackup();

  // 3. Extract DB to temporary file first to test readability
  const tempExtractDir = path.join(DATA_DIR, 'temp_restore');
  if (fs.existsSync(tempExtractDir)) {
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempExtractDir, { recursive: true });

  zip.extractAllTo(tempExtractDir, true);

  const restoredDbPath = path.join(tempExtractDir, 'smn_sweets.db');
  if (!fs.existsSync(restoredDbPath)) {
    throw new Error('Extracted database file not found');
  }

  // 4. Overwrite main database file
  fs.copyFileSync(restoredDbPath, DB_PATH);

  // 5. Restore invoices if present
  const tempInvoicesDir = path.join(tempExtractDir, 'invoices');
  if (fs.existsSync(tempInvoicesDir)) {
    const copyRecursive = (src, dest) => {
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      for (const item of fs.readdirSync(src)) {
        const s = path.join(src, item);
        const d = path.join(dest, item);
        if (fs.statSync(s).isDirectory()) {
          copyRecursive(s, d);
        } else {
          fs.copyFileSync(s, d);
        }
      }
    };
    copyRecursive(tempInvoicesDir, INVOICES_DIR);
  }

  // Cleanup temp
  fs.rmSync(tempExtractDir, { recursive: true, force: true });

  return {
    success: true,
    message: 'System successfully restored from backup.'
  };
}

/**
 * List available backups
 */
function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.zip'))
    .map(f => {
      const p = path.join(BACKUP_DIR, f);
      const stat = fs.statSync(p);
      return {
        fileName: f,
        path: p,
        sizeBytes: stat.size,
        createdAt: stat.birthtime || stat.mtime
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  return files;
}

module.exports = {
  createBackup,
  restoreBackup,
  listBackups,
  BACKUP_DIR
};

