const https = require('https');
const http = require('http');

const agent = new https.Agent({ rejectUnauthorized: false });

async function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ 
        status: res.statusCode, 
        headers: res.headers, 
        body: data 
      }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'DRPCIV Relay running' }));
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { plateNumber, recaptchaToken } = JSON.parse(body);
      console.log('Request for plate:', plateNumber);

      // Body-ul exact pe care îl trimite Angular
      const postData = JSON.stringify({ 
        plateNumber: plateNumber.toUpperCase(),
        userEmail: '',
        language: 'RO',
        reCaptchaKey: recaptchaToken  // câmpul corect!
      });

      const apiRes = await httpsRequest({
        hostname: 'dgpci.mai.gov.ro',
        port: 443,
        path: '/drpciv-forms-api/plate-status',  // URL-ul corect!
        method: 'POST',
        agent,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Origin': 'https://dgpci.mai.gov.ro',
          'Referer': 'https://dgpci.mai.gov.ro/drpciv-forms/plate-number',
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'ro-RO,ro;q=0.9',
          'X-Requested-With': 'XMLHttpRequest',
        }
      }, postData);

      console.log('DRPCIV status:', apiRes.status);
      console.log('DRPCIV response:', apiRes.body.substring(0, 300));

      let result;
      try {
        result = JSON.parse(apiRes.body);
      } catch (e) {
        result = { raw: apiRes.body.substring(0, 500), error: 'HTML_RESPONSE' };
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));

    } catch (err) {
      console.error('Relay error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`DRPCIV Relay running on port ${PORT}`));
