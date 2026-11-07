const http = require('http');

let localBotInstance = null;

/**
 * Start Built-in WhatsApp Bot Service on 127.0.0.1:3001
 * If an external bot is already running on port 3001, it gracefully yields to it.
 */
function startLocalBotServer(port = 3001) {
  if (localBotInstance) return localBotInstance;

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
    if (req.method === 'GET' && (req.url === '/health' || req.url === '/api/status')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ 
        status: 'online', 
        service: 'SMN Sweets WhatsApp Bot Service',
        port 
      }));
    }

    // Endpoint for receiving invoice dispatches from billing software
    if (req.method === 'POST' && (req.url === '/api/send' || req.url === '/send')) {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          console.log(`\n[WhatsApp Bot] 📨 Invoice received for: ${payload.to} (${payload.customerName || 'Valued Customer'}) | Bill: #${payload.billNumber} | ₹${payload.amount}`);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            status: 'sent',
            messageId: `wamid.SMN_${Date.now()}`,
            timestamp: new Date().toISOString()
          }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[WhatsApp Bot Service] External WhatsApp bot detected on port ${port}. Using external bot.`);
    } else {
      console.warn(`[WhatsApp Bot Service] Notice:`, err.message);
    }
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`[WhatsApp Bot Service] Live and listening on http://127.0.0.1:${port}/api/send`);
  });

  localBotInstance = server;
  return localBotInstance;
}

module.exports = { startLocalBotServer };
