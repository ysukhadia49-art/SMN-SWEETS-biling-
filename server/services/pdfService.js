const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { INVOICES_DIR } = require('../database/db');

const GUJARATI_FONT_PATH = path.join(__dirname, '../../assets/fonts/NotoSansGujarati.ttf');
const LOGO_PATH = path.join(__dirname, '../../assets/smn-logo.png');

/**
 * Generate PDF Invoice
 * @param {Object} bill Full bill object with items
 * @param {Object} settings Shop settings
 * @param {string} format 'format_a' (standard customer) or 'format_b' (thermal receipt)
 * @returns {Promise<string>} Saved PDF file path
 */
async function generateInvoicePDF(bill, settings, format = 'format_a') {
  const billDate = new Date(bill.created_at || Date.now());
  const year = billDate.getFullYear().toString();
  const month = (billDate.getMonth() + 1).toString().padStart(2, '0');

  // Year/Month subfolder structure
  const targetDir = path.join(INVOICES_DIR, year, month);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const safeBillNum = (bill.bill_number || 'SMN-000000').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = path.join(targetDir, `${safeBillNum}.pdf`);

  // Generate QR code for online download link
  const invoiceUrl = bill.invoice_token 
    ? `${settings.invoice_base_url || 'http://127.0.0.1:4000'}/invoice/${bill.invoice_token}`
    : `${settings.invoice_base_url || 'http://127.0.0.1:4000'}/bills/${bill.id}`;
  
  let qrBuffer = null;
  try {
    qrBuffer = await QRCode.toBuffer(invoiceUrl, { margin: 1, width: 120 });
  } catch (err) {
    console.error('[PDF] QR code generation error:', err);
  }

  if (format === 'format_b') {
    return generateThermalReceipt(bill, settings, filePath, qrBuffer);
  } else {
    return generateCustomerInvoice(bill, settings, filePath, qrBuffer);
  }
}

/**
 * Format A: Premium Customer Invoice (A4 / A5)
 */
function generateCustomerInvoice(bill, settings, filePath, qrBuffer) {
  return new Promise((resolve, reject) => {
    // 595.28 x 841.89 is A4. Margin 36 (0.5 inch)
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 36, bottom: 36, left: 36, right: 36 }
    });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Register Gujarati font
    const hasGujaratiFont = fs.existsSync(GUJARATI_FONT_PATH);
    if (hasGujaratiFont) {
      doc.registerFont('NotoGujarati', GUJARATI_FONT_PATH);
    }

    const primaryMaroon = '#6B1124';
    const darkMaroon = '#4D0C1A';
    const goldColor = '#D97706';
    const softGold = '#FEF3C7';
    const creamBg = '#FFFDF9';
    const textBrown = '#2C1810';
    const lightGray = '#E5E7EB';

    // 1. Header Banner
    doc.rect(36, 36, 523, 105).fill(primaryMaroon);

    // Gold accent top border
    doc.rect(36, 36, 523, 4).fill(goldColor);

    // Shop Logo if exists
    if (fs.existsSync(LOGO_PATH)) {
      try {
        doc.image(LOGO_PATH, 48, 46, { width: 85, height: 85, fit: [85, 85] });
      } catch (e) {
        console.error('[PDF] Logo render error:', e);
      }
    }

    // Shop Title & Details in Header
    const textStartX = 145;
    doc.fillColor('#FFFFFF')
       .fontSize(22)
       .font('Helvetica-Bold')
       .text(settings.shop_name || "SMN SWEET'S", textStartX, 48);

    if (hasGujaratiFont) {
      doc.font('NotoGujarati')
         .fontSize(12)
         .fillColor('#FDE68A')
         .text('શુદ્ધતા અને સ્વાદની પરંપરા - Since ' + (settings.est_year || '1849'), textStartX, 74);
    }

    doc.font('Helvetica')
       .fontSize(9)
       .fillColor('#F3F4F6')
       .text(settings.shop_address || 'Opp. Town Hall, Station Road, Ahmedabad, Gujarat', textStartX, 92, { width: 280 })
       .text(`Mobile: ${settings.shop_mobile || ''} | WhatsApp: ${settings.shop_whatsapp || ''}`, textStartX, 114);

    // Right-aligned INVOICE box inside banner
    doc.rect(435, 46, 114, 85).fill(darkMaroon);
    doc.rect(435, 46, 114, 85).strokeColor(goldColor).lineWidth(1).stroke();
    
    doc.fillColor('#FDE68A')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('RETAIL INVOICE', 440, 58, { width: 104, align: 'center' });

    doc.fillColor('#FFFFFF')
       .fontSize(11)
       .font('Helvetica-Bold')
       .text(bill.bill_number, 440, 84, { width: 104, align: 'center' });

    const formattedDate = new Date(bill.created_at || Date.now()).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
    const formattedTime = new Date(bill.created_at || Date.now()).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    doc.fontSize(8)
       .fillColor('#D1D5DB')
       .font('Helvetica')
       .text(`${formattedDate}`, 440, 102, { width: 104, align: 'center' })
       .text(`${formattedTime}`, 440, 114, { width: 104, align: 'center' });

    // 2. Customer & Cashier Section
    const metaY = 152;
    doc.rect(36, metaY, 523, 50).fillAndStroke(creamBg, lightGray);

    doc.fillColor(primaryMaroon)
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('BILLED TO (CUSTOMER DETAILS):', 48, metaY + 8);

    doc.fillColor(textBrown)
       .fontSize(10)
       .font('Helvetica-Bold')
       .text(bill.customer_name_snapshot || 'Walk-in Customer', 48, metaY + 22);

    doc.font('Helvetica')
       .fontSize(9)
       .fillColor('#4B5563')
       .text(`Mobile: ${bill.customer_mobile_snapshot ? '+91 ' + bill.customer_mobile_snapshot : 'N/A'}`, 48, metaY + 36);

    // Right side meta: Payment & Cashier
    doc.fillColor(primaryMaroon)
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('PAYMENT DETAILS:', 340, metaY + 8);

    doc.fillColor(textBrown)
       .fontSize(9)
       .font('Helvetica')
       .text(`Mode: ${(bill.payment_method || 'CASH').toUpperCase()}`, 340, metaY + 22)
       .text(`Cashier: ${bill.cashier_name || 'Staff'}`, 340, metaY + 36);

    doc.fillColor('#059669')
       .fontSize(9)
       .font('Helvetica-Bold')
       .text(`Status: ${bill.payment_status ? bill.payment_status.toUpperCase() : 'PAID'}`, 440, metaY + 22);

    // 3. Products Table
    const tableTop = 215;
    const colSr = 48;
    const colName = 80;
    const colQty = 320;
    const colRate = 405;
    const colAmount = 485;

    // Table Header
    doc.rect(36, tableTop, 523, 24).fill(primaryMaroon);
    doc.fillColor('#FFFFFF')
       .font('Helvetica-Bold')
       .fontSize(9);

    doc.text('Sr.', colSr, tableTop + 7);
    doc.text('Item Description (Sweet Name)', colName, tableTop + 7);
    doc.text('Quantity / Unit', colQty, tableTop + 7, { align: 'right', width: 75 });
    doc.text('Rate', colRate, tableTop + 7, { align: 'right', width: 70 });
    doc.text('Amount (₹)', colAmount, tableTop + 7, { align: 'right', width: 65 });

    let currentY = tableTop + 24;
    const items = bill.items || [];

    items.forEach((item, index) => {
      const isEven = index % 2 === 0;
      doc.rect(36, currentY, 523, 22).fill(isEven ? '#FFFFFF' : '#FDFBF7');

      doc.fillColor(textBrown)
         .fontSize(9)
         .font('Helvetica');

      // Sr No
      doc.text((index + 1).toString(), colSr, currentY + 6);

      // Product Name with Gujarati if available
      const nameText = item.gujarati_name_snapshot 
        ? `${item.product_name_snapshot} (${item.gujarati_name_snapshot})`
        : item.product_name_snapshot;

      if (hasGujaratiFont && item.gujarati_name_snapshot) {
        doc.font('NotoGujarati')
           .text(nameText, colName, currentY + 6, { width: 230, lineBreak: false });
      } else {
        doc.font('Helvetica')
           .text(nameText, colName, currentY + 6, { width: 230, lineBreak: false });
      }

      // Format Quantity nicely
      let qtyStr = `${item.quantity} ${item.unit}`;
      if (item.unit === 'kg' && item.quantity < 1) {
        qtyStr = `${Math.round(item.quantity * 1000)}g`;
      }

      // Quantity
      doc.font('Helvetica')
         .text(qtyStr, colQty, currentY + 6, { align: 'right', width: 75 });

      // Rate
      const rateStr = `₹${parseFloat(item.unit_price).toFixed(2)}/${item.unit}`;
      doc.text(rateStr, colRate, currentY + 6, { align: 'right', width: 70 });

      // Amount
      const amountStr = `₹${parseFloat(item.line_total).toFixed(2)}`;
      doc.font('Helvetica-Bold')
         .text(amountStr, colAmount, currentY + 6, { align: 'right', width: 65 });

      // Row bottom divider
      doc.rect(36, currentY + 22, 523, 0.5).fill('#F3F4F6');
      currentY += 22;
    });

    // 4. Totals & Summary Box
    currentY += 8;
    const summaryX = 330;
    const summaryWidth = 229;

    doc.rect(summaryX, currentY, summaryWidth, 80).fillAndStroke('#FFFDF9', lightGray);

    doc.fontSize(9).font('Helvetica').fillColor('#4B5563');
    doc.text('Subtotal:', summaryX + 15, currentY + 12);
    doc.font('Helvetica-Bold').fillColor(textBrown)
       .text(`₹${parseFloat(bill.subtotal).toFixed(2)}`, summaryX + 100, currentY + 12, { align: 'right', width: 105 });

    if (bill.discount_amount > 0) {
      doc.fontSize(9).font('Helvetica').fillColor('#DC2626');
      const discLabel = bill.discount_type === 'percentage' 
        ? `Discount (${bill.discount_value}%):` 
        : 'Discount:';
      doc.text(discLabel, summaryX + 15, currentY + 28);
      doc.font('Helvetica-Bold')
         .text(`- ₹${parseFloat(bill.discount_amount).toFixed(2)}`, summaryX + 100, currentY + 28, { align: 'right', width: 105 });
    }

    // Final Total Bar
    doc.rect(summaryX, currentY + 46, summaryWidth, 34).fill(primaryMaroon);
    doc.fillColor('#FDE68A')
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('NET TOTAL:', summaryX + 15, currentY + 57);

    doc.fillColor('#FFFFFF')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text(`₹${parseFloat(bill.final_amount).toFixed(2)}`, summaryX + 85, currentY + 55, { align: 'right', width: 130 });

    // 5. Left bottom area: QR Code + Thank you message
    if (qrBuffer) {
      try {
        doc.image(qrBuffer, 48, currentY, { width: 72, height: 72 });
        doc.fontSize(7.5)
           .font('Helvetica')
           .fillColor('#6B7280')
           .text('Scan to view / download digital invoice', 126, currentY + 24, { width: 190 });
      } catch (e) {
        console.error('[PDF] QR draw error:', e);
      }
    }

    // 6. Footer Thank you Note
    const footerY = 740;
    doc.rect(36, footerY, 523, 40).fill(creamBg);
    doc.rect(36, footerY, 523, 1).fill(goldColor);

    doc.fillColor(primaryMaroon)
       .fontSize(10)
       .font('Helvetica-Bold')
       .text(settings.bill_footer || "Thank you for shopping at SMN SWEET'S! Visit Again!", 36, footerY + 10, {
         align: 'center', width: 523
       });

    if (hasGujaratiFont && settings.bill_footer_gujarati) {
      doc.font('NotoGujarati')
         .fontSize(9)
         .fillColor(goldColor)
         .text(settings.bill_footer_gujarati, 36, footerY + 24, {
           align: 'center', width: 523
         });
    }

    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', (err) => reject(err));
  });
}

/**
 * Format B: Compact Thermal Receipt (58mm or 80mm)
 */
function generateThermalReceipt(bill, settings, filePath, qrBuffer) {
  return new Promise((resolve, reject) => {
    // 80mm printer paper width ~ 226 points (at 72 dpi)
    const is58mm = (settings.receipt_width || '80mm') === '58mm';
    const pageWidth = is58mm ? 164 : 226;
    const margin = 10;
    const usableWidth = pageWidth - (margin * 2);

    // Calculate dynamic height based on item count
    const itemCount = (bill.items || []).length;
    const dynamicHeight = 350 + (itemCount * 22);

    const doc = new PDFDocument({
      size: [pageWidth, dynamicHeight],
      margins: { top: margin, bottom: margin, left: margin, right: margin }
    });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const hasGujaratiFont = fs.existsSync(GUJARATI_FONT_PATH);
    if (hasGujaratiFont) {
      doc.registerFont('NotoGujarati', GUJARATI_FONT_PATH);
    }

    // Shop Header
    doc.font('Helvetica-Bold')
       .fontSize(12)
       .fillColor('#000000')
       .text(settings.shop_name || "SMN SWEET'S", margin, margin + 4, { align: 'center', width: usableWidth });

    doc.font('Helvetica')
       .fontSize(7.5)
       .text(settings.shop_address || 'Ahmedabad, Gujarat', margin, doc.y, { align: 'center', width: usableWidth })
       .text(`Tel: ${settings.shop_mobile || ''}`, margin, doc.y, { align: 'center', width: usableWidth });

    doc.text('----------------------------------------------------', margin, doc.y + 2, { align: 'center', width: usableWidth });

    // Bill Info
    const billDate = new Date(bill.created_at || Date.now());
    const dateFormatted = billDate.toLocaleDateString('en-IN') + ' ' + billDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    doc.fontSize(8)
       .font('Helvetica-Bold')
       .text(`Bill No: ${bill.bill_number}`, margin, doc.y + 2)
       .font('Helvetica')
       .fontSize(7.5)
       .text(`Date: ${dateFormatted}`, margin, doc.y)
       .text(`Customer: ${bill.customer_name_snapshot || 'Walk-in'}`, margin, doc.y);

    if (bill.customer_mobile_snapshot) {
      doc.text(`Mobile: +91 ${bill.customer_mobile_snapshot}`, margin, doc.y);
    }

    doc.text('----------------------------------------------------', margin, doc.y + 2, { align: 'center', width: usableWidth });

    // Item Header
    doc.font('Helvetica-Bold')
       .fontSize(7.5);
    doc.text('Item', margin, doc.y + 2);
    doc.text('Qty', margin + (usableWidth * 0.45), doc.y - 9, { width: usableWidth * 0.25, align: 'right' });
    doc.text('Amt (₹)', margin + (usableWidth * 0.70), doc.y - 9, { width: usableWidth * 0.30, align: 'right' });

    doc.text('----------------------------------------------------', margin, doc.y + 2, { align: 'center', width: usableWidth });

    // Item rows
    const items = bill.items || [];
    items.forEach((item) => {
      let qtyStr = `${item.quantity} ${item.unit}`;
      if (item.unit === 'kg' && item.quantity < 1) {
        qtyStr = `${Math.round(item.quantity * 1000)}g`;
      }

      const currentY = doc.y + 2;
      doc.font('Helvetica')
         .fontSize(7.5)
         .text(item.product_name_snapshot, margin, currentY, { width: usableWidth * 0.45, lineBreak: false });

      doc.text(qtyStr, margin + (usableWidth * 0.45), currentY, { width: usableWidth * 0.25, align: 'right' });
      doc.font('Helvetica-Bold')
         .text(`₹${parseFloat(item.line_total).toFixed(2)}`, margin + (usableWidth * 0.70), currentY, { width: usableWidth * 0.30, align: 'right' });
    });

    doc.text('----------------------------------------------------', margin, doc.y + 4, { align: 'center', width: usableWidth });

    // Subtotal & Total
    doc.font('Helvetica')
       .fontSize(8)
       .text('Subtotal:', margin, doc.y + 2);
    doc.text(`₹${parseFloat(bill.subtotal).toFixed(2)}`, margin + (usableWidth * 0.5), doc.y - 9, { width: usableWidth * 0.5, align: 'right' });

    if (bill.discount_amount > 0) {
      doc.text('Discount:', margin, doc.y + 2);
      doc.text(`- ₹${parseFloat(bill.discount_amount).toFixed(2)}`, margin + (usableWidth * 0.5), doc.y - 9, { width: usableWidth * 0.5, align: 'right' });
    }

    doc.font('Helvetica-Bold')
       .fontSize(10)
       .text('NET TOTAL:', margin, doc.y + 4);
    doc.text(`₹${parseFloat(bill.final_amount).toFixed(2)}`, margin + (usableWidth * 0.5), doc.y - 12, { width: usableWidth * 0.5, align: 'right' });

    doc.fontSize(7.5)
       .font('Helvetica')
       .text(`Payment: ${(bill.payment_method || 'CASH').toUpperCase()} (PAID)`, margin, doc.y + 4, { align: 'center', width: usableWidth });

    doc.text('----------------------------------------------------', margin, doc.y + 2, { align: 'center', width: usableWidth });

    // QR Code for online bill
    if (qrBuffer) {
      try {
        const qrSize = is58mm ? 60 : 75;
        const qrX = margin + ((usableWidth - qrSize) / 2);
        doc.image(qrBuffer, qrX, doc.y + 4, { width: qrSize, height: qrSize });
      } catch (e) {
        console.error('[PDF] Thermal QR draw error:', e);
      }
    }

    doc.font('Helvetica')
       .fontSize(7)
       .text(settings.bill_footer || "Thank you for visiting SMN SWEET'S!", margin, doc.y + 4, { align: 'center', width: usableWidth });

    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', (err) => reject(err));
  });
}

module.exports = {
  generateInvoicePDF
};

