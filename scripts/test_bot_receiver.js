const http = require('http');

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/send') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const parsed = JSON.parse(body);
      const auth = req.headers['authorization'];
      console.log('\n[Bot Server Received Request]');
      console.log('  Authorization Header:', auth);
      console.log('  Recipient (To):', parsed.to);
      console.log('  Customer:', parsed.customerName);
      console.log('  Bill Number:', parsed.billNumber);
      console.log('  Amount:', parsed.amount);
      console.log('  PDF URL:', parsed.pdfUrl);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        messageId: 'wa_live_' + Date.now(),
        status: 'delivered'
      }));
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(3001, '127.0.0.1', () => {
  console.log('[Bot Server] Running on http://127.0.0.1:3001/api/send');
  
  // Trigger a test dispatch from billing backend
  const postData = JSON.stringify({ mobile: '9825012345' });
  const triggerReq = http.request({
    hostname: '127.0.0.1',
    port: 4000,
    path: '/api/whatsapp/test',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.argv[2]
    }
  }, (res) => {
    let resp = '';
    res.on('data', chunk => { resp += chunk; });
    res.on('end', () => {
      console.log('\n[Billing Backend Response to Test Dispatch]:', resp);
      server.close(() => {
        console.log('[Bot Server] Closed.');
        process.exit(0);
      });
    });
  });

  triggerReq.on('error', (err) => {
    console.error('Trigger request error:', err);
    server.close();
    process.exit(1);
  });

  triggerReq.write(postData);
  triggerReq.end();
});

