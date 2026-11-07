export type UserRole = 'owner' | 'cashier';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  full_name: string;
  active?: number;
  created_at?: string;
}

export interface Customer {
  id: number;
  customer_code: string;
  name: string;
  mobile: string;
  normalized_mobile: string;
  secondary_mobile?: string | null;
  address?: string | null;
  notes?: string | null;
  total_bills: number;
  total_spent: number;
  last_purchase_at?: string | null;
  active: number;
  created_at: string;
  updated_at?: string;
}

export interface Category {
  id: number;
  name: string;
  gujarati_name?: string | null;
  sort_order: number;
  active: number;
}

export type ProductUnit = 'kg' | 'g' | 'piece' | 'box' | 'packet';

export interface Product {
  id: number;
  product_code: string;
  name: string;
  gujarati_name?: string | null;
  category: string;
  price: number;
  unit: ProductUnit;
  barcode?: string | null;
  active: number;
  created_at?: string;
  updated_at?: string;
}

export interface CartItem {
  product_id: number;
  product_code?: string;
  product_name: string;
  gujarati_name?: string | null;
  quantity: number; // in unit (e.g. 0.25 for 250g if unit is kg)
  unit: ProductUnit;
  unit_price: number; // price per unit (e.g. ₹600/kg)
  line_total: number;
  notes?: string;
}

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'split';
export type DiscountType = 'fixed' | 'percentage';

export interface Bill {
  id: number;
  bill_number: string;
  customer_id?: number | null;
  customer_name_snapshot: string;
  customer_mobile_snapshot?: string | null;
  subtotal: number;
  discount_type: DiscountType;
  discount_value: number;
  discount_amount: number;
  final_amount: number;
  payment_method: PaymentMethod;
  bill_type?: 'retail' | 'wholesale';
  split_details?: string | null;
  payment_status: 'paid' | 'pending';
  status: 'completed' | 'cancelled';
  cancellation_reason?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  cashier_id?: number;
  cashier_name: string;
  pdf_path?: string | null;
  invoice_token?: string | null;
  created_at: string;
  items?: BillItem[];
  whatsapp_status?: string;
  sms_status?: string;
}

export interface BillItem {
  id: number;
  bill_id: number;
  product_id?: number | null;
  product_name_snapshot: string;
  gujarati_name_snapshot?: string | null;
  quantity: number;
  unit: ProductUnit;
  unit_price: number;
  line_total: number;
  notes?: string | null;
}

export interface WhatsAppRecord {
  id: number;
  bill_id?: number | null;
  bill_number?: string;
  customer_id?: number | null;
  customer_name?: string;
  mobile_number: string;
  message: string;
  provider_message_id?: string | null;
  status: 'pending' | 'queued' | 'sent' | 'delivered' | 'failed' | 'retrying';
  error_message?: string | null;
  retry_count: number;
  sent_at?: string | null;
  created_at: string;
}

export type SMSRecord = WhatsAppRecord;

export interface Settings {
  shop_name: string;
  shop_tagline: string;
  shop_address: string;
  shop_mobile: string;
  shop_whatsapp: string;
  shop_email: string;
  est_year: string;
  bill_footer: string;
  bill_footer_gujarati: string;
  bill_prefix: string;
  bill_next_number: string;
  default_pdf_format: 'format_a' | 'format_b';
  receipt_width: '58mm' | '80mm';
  language: 'en' | 'gu';
  whatsapp_enabled: string;
  whatsapp_bot_url: string;
  whatsapp_bot_token: string;
  invoice_base_url: string;
  theme: string;
  default_payment_method: PaymentMethod;
  max_discount_cashier: string;
  setup_completed: string;
  gcp_project_id?: string;
  gcp_storage_bucket?: string;
  gcp_sync_enabled?: string;
}

export interface PaymentRecord {
  id?: number;
  bill_id?: number | null;
  payment_method: PaymentMethod;
  amount: number;
  status: string;
  utr?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface GcpDiagnostics {
  configured: boolean;
  projectId: string;
  bucketName: string;
  firestoreDatabase: string;
  syncOutboxCount: number;
  recentSyncedCount: number;
  lastSyncCheck: string;
}

export interface DashboardStats {
  today_sales: number;
  today_bills: number;
  avg_bill_value: number;
  today_customers: number;
  today_whatsapp_sent: number;
  today_whatsapp_failed: number;
  today_sms_sent?: number;
  today_sms_failed?: number;
  total_customers: number;
  total_products: number;
}

