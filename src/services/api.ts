const API_BASE = 'http://127.0.0.1:4000/api';

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('smn_auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('smn_auth_token', token);
    } else {
      localStorage.removeItem('smn_auth_token');
    }
  }

  getToken() {
    return this.token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
      });

      if (response.status === 401) {
        this.setToken(null);
        window.dispatchEvent(new Event('smn-unauthorized'));
        throw new Error('Session expired. Please log in again.');
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `HTTP error ${response.status}`);
      }

      return data;
    } catch (err: any) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  }

  // Auth
  async login(credentials: { username: string; password: string }) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  async changePassword(passwords: { oldPassword: string; newPassword: string }) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(passwords)
    });
  }

  // Customers
  async getCustomers(params?: { search?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/customers?${query}`);
  }

  async registerCustomer(customerData: any) {
    return this.request('/customers', {
      method: 'POST',
      body: JSON.stringify(customerData)
    });
  }

  async updateCustomer(id: number, customerData: any) {
    return this.request(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(customerData)
    });
  }

  async getCustomerProfile(id: number) {
    return this.request(`/customers/${id}`);
  }

  // Products & Categories
  async getProducts(params?: { category?: string; search?: string; activeOnly?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/products?${query}`);
  }

  async addProduct(productData: any) {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(productData)
    });
  }

  async updateProduct(id: number, productData: any) {
    return this.request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData)
    });
  }

  async bulkUpdatePrices(updates: Array<{ id: number; price: number }>) {
    return this.request('/products/bulk-price', {
      method: 'POST',
      body: JSON.stringify({ updates })
    });
  }

  async getCategories() {
    return this.request('/categories');
  }

  async addCategory(categoryData: { name: string; gujarati_name?: string }) {
    return this.request('/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData)
    });
  }

  // Bills
  async createBill(billData: any) {
    return this.request('/bills', {
      method: 'POST',
      body: JSON.stringify(billData)
    });
  }

  async getBills(params?: any) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/bills?${query}`);
  }

  async getBillDetails(id: number) {
    return this.request(`/bills/${id}`);
  }

  async cancelBill(id: number, reason: string) {
    return this.request(`/bills/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  async sendBillWhatsApp(id: number) {
    return this.request(`/bills/${id}/send-whatsapp`, {
      method: 'POST'
    });
  }

  // Alias for backward compatibility
  async resendBillSMS(id: number) {
    return this.sendBillWhatsApp(id);
  }

  async regenerateBillPDF(id: number) {
    return this.request(`/bills/${id}/regenerate-pdf`, {
      method: 'POST'
    });
  }

  // Dashboard & Reports
  async getDashboardStats() {
    return this.request('/dashboard/stats');
  }

  async getDashboardCharts() {
    return this.request('/dashboard/charts');
  }

  async getDailySalesReport(date?: string) {
    const q = date ? `?date=${date}` : '';
    return this.request(`/reports/daily${q}`);
  }

  // WhatsApp Bot Logs & Controls
  async getWhatsAppLogs(params?: { search?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/whatsapp/logs?${query}`);
  }

  async sendTestWhatsApp(mobile: string) {
    return this.request('/whatsapp/test', {
      method: 'POST',
      body: JSON.stringify({ mobile })
    });
  }

  async getWhatsAppStatus() {
    return this.request('/whatsapp/status');
  }

  // Historical SMS Archive (preserves historical data)
  async getSmsArchive(params?: any) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/sms/history?${query}`);
  }

  // Legacy alias redirects to WhatsApp logs
  async getSMSHistory(params?: any) {
    return this.getWhatsAppLogs(params);
  }

  async sendTestSMS(mobile: string) {
    return this.sendTestWhatsApp(mobile);
  }

  // Settings
  async getSettings() {
    return this.request('/settings');
  }

  async updateSettings(settings: any) {
    return this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  }

  // Backups
  async getBackups() {
    return this.request('/backups');
  }

  async createBackup() {
    return this.request('/backups/create', { method: 'POST' });
  }

  async restoreBackup(backupPath: string) {
    return this.request('/backups/restore', {
      method: 'POST',
      body: JSON.stringify({ backupPath })
    });
  }

  // Google Cloud Diagnostics & Sync
  async getGcpDiagnostics() {
    return this.request('/gcp/diagnostics');
  }

  async syncGcpNow() {
    return this.request('/gcp/sync-now', {
      method: 'POST'
    });
  }
}

export const api = new ApiService();

