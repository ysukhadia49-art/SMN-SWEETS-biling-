import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginModal } from './components/Login/LoginModal';
import { SetupWizard } from './components/SetupWizard/SetupWizard';
import { DashboardView } from './components/Dashboard/DashboardView';
import { BillingView } from './components/Billing/BillingView';
import { CustomersView } from './components/Customers/CustomersView';
import { ProductsView } from './components/Products/ProductsView';
import { BillsView } from './components/Bills/BillsView';
import { WhatsAppHistoryView } from './components/WhatsAppHistory/WhatsAppHistoryView';
import { DailySalesView } from './components/DailySales/DailySalesView';
import { SettingsView } from './components/Settings/SettingsView';
import { BackupView } from './components/Backup/BackupView';
import { InvoiceModal } from './components/Common/InvoiceModal';
import { NotificationToast, ToastMessage } from './components/Common/NotificationToast';
import { api } from './services/api';
import { User, Bill, Settings } from './types';
import { Language } from './translations';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('billing');
  const [lang, setLang] = useState<Language>(
    (localStorage.getItem('smn_lang') as Language) || 'en'
  );
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  // Active Invoice Modal
  const [previewBill, setPreviewBill] = useState<Bill | null>(null);

  // Global Toast Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Initial Check for Auth and Setup
  useEffect(() => {
    async function initApp() {
      try {
        if (api.getToken()) {
          const userRes = await api.getCurrentUser().catch(() => null);
          if (userRes && userRes.user) {
            setCurrentUser(userRes.user);
          }
        }

        // Check if first-time setup is needed
        const settingsRes = await api.getSettings().catch(() => null);
        if (settingsRes && settingsRes.setup_completed === '0') {
          setNeedsSetup(true);
        }
      } catch (err) {
        console.error('App init error:', err);
      } finally {
        setLoading(false);
      }
    }

    initApp();

    const handleUnauthorized = () => {
      setCurrentUser(null);
      addToast('warning', 'Session Expired', 'Please log in again to continue billing.');
    };

    window.addEventListener('smn-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('smn-unauthorized', handleUnauthorized);
  }, []);

  // Real-Time Server-Sent Events (SSE) Listener across all panels and connected terminals
  useEffect(() => {
    if (!currentUser) return;

    let eventSource: EventSource | null = null;
    let reconnectTimer: any = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('http://127.0.0.1:4000/api/events');

        eventSource.onopen = () => {
          console.log('[App] Connected to real-time events stream');
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'CONNECTED') return;

            // Dispatch global event for all active panels (Billing, Bills, Customers, Settings)
            window.dispatchEvent(new CustomEvent('smn-realtime-event', { detail: data }));

            // Notify user of relevant external events from another terminal/cashier
            if (data.type === 'BILL_CREATED' && data.cashier !== currentUser.full_name) {
              addToast('info', 'New Bill Recorded', `Bill #${data.bill?.bill_number} for ₹${data.amount?.toFixed(2)} created by ${data.cashier || 'Cashier'}`);
            } else if (data.type === 'PAYMENT_CONFIRMED') {
              addToast('success', 'Payment Settled', `Order ${data.orderRef} payment confirmed!`);
            }
          } catch (e) {
            console.error('[App] Failed to parse SSE message:', e);
          }
        };

        eventSource.onerror = () => {
          eventSource?.close();
          reconnectTimer = setTimeout(connectSSE, 4000);
        };
      } catch (err) {
        console.error('[App] SSE connection error:', err);
      }
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [currentUser]);

  const handleToggleLang = () => {
    const nextLang = lang === 'en' ? 'gu' : 'en';
    setLang(nextLang);
    localStorage.setItem('smn_lang', nextLang);
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    addToast('info', 'Logged Out', 'You have been safely signed out.');
  };

  const handleBillCompleted = (bill: Bill) => {
    setPreviewBill(bill);
    const waStatus = bill.whatsapp_status || bill.sms_status || 'queued';
    addToast(
      'success',
      `Bill ${bill.bill_number} Generated!`,
      `Total: ₹${bill.final_amount.toFixed(2)} • PDF saved • WhatsApp status: ${waStatus}`
    );
  };

  const handleSendWhatsApp = async (billId: number) => {
    const res = await api.sendBillWhatsApp(billId);
    if (res.success) {
      addToast('success', 'WhatsApp Dispatched', 'Invoice link sent to customer mobile number.');
    } else {
      addToast('error', 'WhatsApp Notice', res.error || 'Failed to dispatch via WhatsApp bot.');
      throw new Error(res.error || 'WhatsApp dispatch error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-smn-cream flex flex-col items-center justify-center space-y-4">
        <img src="/assets/smn-logo.png" alt="SMN" className="w-16 h-16 animate-pulse object-contain" />
        <h2 className="font-serif font-bold text-xl text-smn-maroon">SMN SWEET'S</h2>
        <p className="text-xs text-gray-500 font-mono">Initializing local billing engine & database...</p>
      </div>
    );
  }

  // If not logged in, show Login Screen
  if (!currentUser) {
    return (
      <>
        <LoginModal
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            addToast('success', `Welcome, ${user.full_name}!`, 'SMN Sweet\'s billing system is ready.');
          }}
          lang={lang}
        />
        <NotificationToast toasts={toasts} onDismiss={removeToast} />
      </>
    );
  }

  // If first-time setup not completed, show Setup Wizard
  if (needsSetup) {
    return (
      <>
        <SetupWizard
          onComplete={() => {
            setNeedsSetup(false);
            addToast('success', 'Setup Completed!', 'Shop details and billing prefix saved successfully.');
          }}
          lang={lang}
        />
        <NotificationToast toasts={toasts} onDismiss={removeToast} />
      </>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-smn-cream select-none">
      {/* Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        user={currentUser}
        onLogout={handleLogout}
        lang={lang}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header */}
        <Header
          user={currentUser}
          lang={lang}
          onToggleLang={handleToggleLang}
          onQuickBill={() => setCurrentTab('billing')}
        />

        {/* View Routing */}
        <main className="flex-1 overflow-hidden relative">
          {currentTab === 'dashboard' && (
            <DashboardView
              onNavigate={setCurrentTab}
              onOpenBill={setPreviewBill}
              lang={lang}
            />
          )}

          {currentTab === 'billing' && (
            <BillingView
              onBillCompleted={handleBillCompleted}
              lang={lang}
            />
          )}

          {currentTab === 'customers' && (
            <CustomersView
              onOpenBill={setPreviewBill}
              lang={lang}
            />
          )}

          {currentTab === 'products' && (
            <ProductsView
              user={currentUser}
              lang={lang}
            />
          )}

          {currentTab === 'bills' && (
            <BillsView
              onOpenBill={setPreviewBill}
              user={currentUser}
              lang={lang}
            />
          )}

          {(currentTab === 'whatsapp' || currentTab === 'sms') && (
            <WhatsAppHistoryView
              user={currentUser}
              lang={lang}
            />
          )}

          {currentTab === 'reports' && (
            <DailySalesView
              lang={lang}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              user={currentUser}
              lang={lang}
              onLanguageChange={setLang}
            />
          )}

          {currentTab === 'backup' && (
            <BackupView
              user={currentUser}
              lang={lang}
            />
          )}
        </main>
      </div>

      {/* Invoice Modal for Preview, Reprint, Download & WhatsApp */}
      {previewBill && (
        <InvoiceModal
          bill={previewBill}
          onClose={() => setPreviewBill(null)}
          onSendWhatsApp={handleSendWhatsApp}
          onResendSMS={handleSendWhatsApp}
          lang={lang}
        />
      )}

      {/* Floating Notifications */}
      <NotificationToast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

