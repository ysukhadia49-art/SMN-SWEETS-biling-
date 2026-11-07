# SMN SWEET'S — Professional Billing & PDF Invoice Management System

A complete, production-grade Windows desktop billing and invoice management system built specifically for **SMN SWEET'S**, a traditional Indian sweet shop in Ahmedabad, Gujarat.

Designed with traditional elegance and modern POS ergonomics, this software features **Strict Non-GST billing**, weight-based pricing calculations, high-resolution PDF generation with Gujarati Unicode script, automatic Indian SMS delivery with secure token download links, persistent offline queues, comprehensive daily/monthly sales reports, and one-click ZIP backup and restore.

---

## 🌟 Key Capabilities & Architectural Highlights

1. **Strict Non-GST Billing Mode**:
   - Zero GST, CGST, SGST, IGST calculations or tax fields anywhere in the application or invoices.
   - All sweet prices reflect the final customer selling price.

2. **Accurate Weight-Based Pricing**:
   - Instant calculation for standard weights: **50g, 100g, 250g, 500g, 750g, 1kg, 1.25kg, 1.5kg, 2kg**, and custom decimal kilograms.
   - Example: Kesar Peda ₹600/kg → 250g = ₹150.00.
   - Eliminates floating-point inaccuracies using decimal rounding.

3. **Customer Database & Normalized Mobile Numbers**:
   - Unique customer IDs (`CUST-00001`, `CUST-00002`).
   - Normalizes 10-digit Indian numbers (`+91`, `0`, spaces stripped) to prevent duplicate registrations.
   - In-billing Quick Registration modal (**F7**): Register new customers in < 5 seconds without leaving the billing screen.
   - Supports walk-in customers without mandatory registration.

4. **Professional Dual-Format PDF Invoices**:
   - **Format A (Customer Invoice)**: Premium A4/A5 invoice styled with SMN SWEET'S deep maroon and gold branding, store logo, customer details, itemized table with English and Gujarati names, subtotal, discounts, total, and QR code.
   - **Format B (Thermal Receipt)**: Compact 58mm / 80mm receipt tailored for thermal POS receipt printers.
   - **Gujarati Unicode Font**: Powered by bundled `Noto Sans Gujarati` font. No broken characters or square boxes.
   - Invoices organized automatically on disk by Year and Month: `Invoices/YYYY/MM/SMN-XXXXXX.pdf`.

5. **Automatic Indian SMS Delivery & Secure Token Download**:
   - Integrates with legitimate Indian SMS gateways: **Fast2SMS**, **MSG91**, **Twilio India**, and **Generic DLT HTTP Gateways**.
   - Generates unique cryptographic tokens for each invoice (`smn_xxxxxxxxxxxxxxxx`).
   - Built-in invoice hosting: serves the authentic PDF directly to customer smartphones when the SMS link is clicked.
   - **Offline SMS Queue**: If internet connectivity drops, billing continues seamlessly locally. The SMS is marked "Pending" and queued in an offline SQLite persistence table. The background worker automatically delivers queued SMS messages as soon as internet connection is restored.

6. **Daily Sales & Monthly Reporting**:
   - Real database analytics for today's sales, average bill value, cash vs. UPI vs. card breakdowns, discounts, and cancelled bills.
   - Item-wise sweet sales volume table (total grams / kg / boxes sold per item).
   - Export reports to CSV.

7. **Dual Language Support (English & Gujarati)**:
   - Instant toggle between English and ગુજરાતી in the top bar.

8. **Keyboard Shortcuts for Fast POS Billing**:
   - **F1**: New Bill
   - **F2**: Focus Product Search
   - **F3**: Focus Customer Search
   - **F4**: Payment Mode
   - **F5**: Print / Reprint Invoice
   - **F6**: Complete & Print Bill
   - **F7**: Register Customer
   - **F8**: Apply Discount
   - **Esc**: Close Dialog / Modal
   - **Enter**: Confirm action

9. **Role-Based Access Control**:
   - **Owner**: Full access to all business settings, SMS API keys, user management, backup/restore, and bill cancellations.
   - **Cashier**: Access to billing, customer registration, invoice reprint, and search. Cannot delete bills or alter settings.
   - Passwords securely hashed with `bcryptjs` (never stored in plaintext).

10. **One-Click Backup & Restore**:
    - Complete snapshot of SQLite database, PDF invoices, settings, and audit logs into a timestamped `.zip` archive.
    - Safety pre-backup taken automatically before any restore operation.

---

## 🚀 How to Run the Application on Windows

### Option 1: Desktop Shortcut (Recommended for Shop Owner & Cashier)
Simply double-click the **`SMN SWEET'S Billing`** shortcut created directly on your Windows Desktop!

### Option 2: 1-Click Batch Launcher
Double-click `Launch-SMN-Sweets.bat` located inside this directory:
```bat
C:\Users\yug sukhadia\.gemini\antigravity\scratch\smn-sweets-billing\Launch-SMN-Sweets.bat
```
This automatically initializes the local backend server and opens the desktop interface.

### Option 3: Terminal / Development Mode
To run in terminal:
```bash
# 1. Start the server (serves both React UI and backend APIs on port 4000)
npm start

# 2. Open in browser or Electron
npm run electron:start
```
Or open [http://127.0.0.1:4000](http://127.0.0.1:4000) in any web browser.

---

## 🔑 Default Credentials

- **Owner Account**:
  - Username: `owner`
  - Password: `smn@123`
- **Cashier Account**:
  - Username: `cashier`
  - Password: `cashier@123`

*(Passwords can be changed at any time in Settings > Security)*

---

## 📱 Indian SMS Gateway Configuration Guide

To activate real SMS delivery to customer mobile phones:
1. Log in as **Owner**.
2. Navigate to **Settings** → **Indian SMS Gateway**.
3. Select your provider:
   - **Fast2SMS**: Enter your Fast2SMS API Authorization Key. Sender ID: `SMNSWT`.
   - **MSG91**: Enter your MSG91 AuthKey and Flow Template ID.
   - **Twilio**: Enter your Account SID and Auth Token (`SID:TOKEN`).
   - **Custom HTTP Gateway**: Enter your provider's HTTP GET/POST URL with placeholder variables (`{apiKey}`, `{mobile}`, `{message}`, `{senderId}`).
4. Use the **Test Gateway** tool in **SMS Logs** to verify delivery with your mobile number.
5. Click **Save SMS Configuration**.

---

## 📁 Database & Invoice File Storage

- **SQLite Database**: `C:\Users\yug sukhadia\AppData\Roaming\SMN_Sweets\smn_sweets.db`
- **PDF Invoices**: `C:\Users\yug sukhadia\AppData\Roaming\SMN_Sweets\invoices\YYYY\MM\`
- **ZIP Backups**: `C:\Users\yug sukhadia\AppData\Roaming\SMN_Sweets\backups\`

