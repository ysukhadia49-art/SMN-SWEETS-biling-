import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Download, 
  RotateCcw, 
  ShieldCheck, 
  HardDrive, 
  AlertTriangle, 
  CheckCircle2, 
  FolderArchive,
  Clock
} from 'lucide-react';
import { api } from '../../services/api';
import { User } from '../../types';
import { translations, Language } from '../../translations';

interface BackupViewProps {
  user: User | null;
  lang: Language;
}

export const BackupView: React.FC<BackupViewProps> = ({ user, lang }) => {
  const t = translations[lang];

  const [backups, setBackups] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Restore confirmation modal
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState<any | null>(null);

  const loadBackups = async () => {
    try {
      const res = await api.getBackups();
      setBackups(res || []);
    } catch (e) {
      console.error('Failed to load backups:', e);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const res = await api.createBackup();
      if (res.success) {
        setStatusMessage(`Backup created successfully: ${res.fileName} (${(res.sizeBytes / 1024).toFixed(1)} KB)`);
        loadBackups();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!selectedBackupForRestore) return;
    setRestoring(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const res = await api.restoreBackup(selectedBackupForRestore.path);
      if (res.success) {
        setStatusMessage('System database and invoices restored successfully. Please reload the app.');
        setSelectedBackupForRestore(null);
        loadBackups();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const isOwner = user?.role === 'owner';

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto h-[calc(100vh-64px)] flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif font-bold text-2xl text-smn-maroon flex items-center gap-2">
            <Database className="w-6 h-6 text-smn-gold" />
            <span>{t.backup}</span>
          </h2>
          <p className="text-xs text-gray-500">
            Export complete business database, customers, bills, settings, and PDF invoices to portable ZIP
          </p>
        </div>

        {isOwner && (
          <button
            onClick={handleCreateBackup}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-smn-maroon to-smn-red text-white text-xs font-bold rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-smn-gold-light" />
            <span>{creating ? 'Creating Archive...' : 'Create Instant Backup (.ZIP)'}</span>
          </button>
        )}
      </div>

      {/* Notifications */}
      {statusMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2.5 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2.5 shadow-sm">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Backup Principles Card */}
      <div className="p-4 bg-white rounded-2xl border border-smn-beige-dark shadow-sm flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-smn-gold flex-shrink-0 mt-0.5" />
        <div className="text-xs text-smn-brown space-y-1">
          <h4 className="font-bold">Automated Safety Guarantee:</h4>
          <p className="text-gray-600 leading-relaxed">
            Before any backup archive is restored, the system automatically creates a safety snapshot of the current database. All customers, product prices, invoices, and audit logs are safely packaged into self-contained zip archives.
          </p>
        </div>
      </div>

      {/* Backups List Table */}
      <div className="flex-1 bg-white rounded-2xl border border-smn-beige-dark shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 px-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderArchive className="w-4 h-4 text-smn-maroon" />
            <h3 className="font-bold text-sm text-smn-brown">Available Business Backups</h3>
          </div>
          <span className="text-xs text-gray-400 font-mono">{backups.length} archives</span>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-smn-cream text-gray-500 uppercase font-semibold border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="p-3.5 pl-6">Backup File Name</th>
                <th className="p-3.5">Created Date & Time</th>
                <th className="p-3.5">Archive Size</th>
                {isOwner && <th className="p-3.5 pr-6 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {backups.length > 0 ? (
                backups.map((b, idx) => (
                  <tr key={idx} className="hover:bg-amber-50/40 transition-colors">
                    <td className="p-3.5 pl-6 font-mono font-bold text-smn-brown flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-smn-maroon" />
                      <span>{b.fileName}</span>
                    </td>
                    <td className="p-3.5 text-gray-600">
                      {new Date(b.createdAt).toLocaleString('en-IN')}
                    </td>
                    <td className="p-3.5 font-mono text-gray-500">
                      {(b.sizeBytes / 1024).toFixed(1)} KB
                    </td>
                    {isOwner && (
                      <td className="p-3.5 pr-6 text-right">
                        <button
                          onClick={() => setSelectedBackupForRestore(b)}
                          className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-smn-maroon border border-amber-300 rounded-lg font-semibold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3 text-smn-gold" />
                          <span>Restore</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-400">
                    No backup archives found. Click "Create Instant Backup" above to generate a safe archive.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {selectedBackupForRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-amber-400 p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-amber-700 font-bold text-sm border-b border-gray-100 pb-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>Confirm System Restore</span>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to restore data from <span className="font-mono font-bold">{selectedBackupForRestore.fileName}</span>?
              <br /><br />
              A safety pre-restore backup will be created automatically before this operation.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedBackupForRestore(null)}
                className="px-3.5 py-1.5 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                disabled={restoring}
                className="px-4 py-1.5 bg-smn-maroon hover:bg-smn-red text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
              >
                {restoring ? 'Restoring...' : 'Confirm & Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

