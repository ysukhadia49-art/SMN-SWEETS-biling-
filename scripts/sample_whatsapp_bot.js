/**
 * SMN SWEET'S — Standalone WhatsApp Bot Listener / Bridge Sample
 * 
 * Run with: node scripts/sample_whatsapp_bot.js
 * Default Port: 3001
 * 
 * This server receives invoice dispatch requests from the SMN SWEET'S billing software
 * and prints them to the terminal. In production, connect this endpoint to your
 * WhatsApp provider (Baileys, whatsapp-web.js, or Cloud API).
 */

const http = require('http');

const PORT = 3001;

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Health check / status
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'online', bot: 'SMN Sweets WhatsApp Bot Bridge' }));
  }

  // Invoice sending endpoint
  if (req.method === 'POST' && (req.url === '/api/send' || req.url === '/send')) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const authHeader = req.headers['authorization'];

        console.log('\n======================================================');
        console.log('📨 [WHATSAPP BOT] NEW INVOICE MESSAGE RECEIVED:');
        console.log('------------------------------------------------------');
        console.log(`👤 Customer : ${payload.customerName || 'N/A'}`);
        console.log(`📱 Recipient: +${payload.to} (${payload.mobile})`);
        console.log(`🧾 Bill No  : ${payload.billNumber}`);
        console.log(`💰 Amount   : ₹${payload.amount}`);
        console.log(`🔗 PDF Link : ${payload.pdfUrl}`);
        if (authHeader) {
          console.log(`🔑 Auth     : ${authHeader}`);
        }
        console.log('------------------------------------------------------');
        console.log('💬 Formatted Message:');
        console.log(payload.message);
        console.log('======================================================\n');

        // Respond with success and simulated message ID
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          status: 'sent',
          messageId: `wamid.SMN_${Date.now()}`,
          timestamp: new Date().toISOString()
        }));
      } catch (err) {
        console.error('❌ [WHATSAPP BOT] Error parsing payload:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 SMN SWEET'S WhatsApp Bot Bridge running on:`);
  console.log(`   http://127.0.0.1:${PORT}/api/send`);
  console.log(`   Ready to receive invoices from billing software!`);
  console.log(`======================================================\n`);
});

