const https = require('https');
const http = require('http');

const agent = new https.Agent({ rejectUnauthorized: false });

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
    res.writeHead(405);
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { plateNumber, recaptchaToken } = JSON.parse(body);

      const postData = JSON.stringify({ plateNumber: plateNumber.toUpperCase(), recaptchaToken });

      const options = {
        hostname: 'dgpci.mai.gov.ro',
        port: 443,
        path: '/drpciv-forms/api/plate-status',
        method: 'POST',
        agent,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Origin': 'https://dgpci.mai.gov.ro',
          'Referer': 'https://dgpci.mai.gov.ro/drpciv-forms/plate-number',
          'Accept': 'application/json',
        }
      };

      const result = await new Promise((resolve, reject) => {
        const request = https.request(options, (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => {
            try { resolve(JSON.parse(data)); }
            catch (e) { resolve({ raw: data }); }
          });
        });
        request.on('error', reject);
        request.write(postData);
        request.end();
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));

    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Relay running on port ${PORT}`));

