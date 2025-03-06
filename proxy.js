const express = require('express');
const httpProxy = require('http-proxy');
const SocksProxyAgent = require('socks-proxy-agent');
const request = require('request');

// Create a new Express application
const app = express();

// Create a new HTTP proxy server
const proxy = httpProxy.createProxyServer({});

// Serve static files from the "public" directory
app.use(express.static('public'));

// Proxy middleware
app.use('/proxy', (req, res) => {
  // Extract the target URL from the query parameter
  const target = req.query.url;

  if (!target) {
    res.status(400).send('URL parameter is missing');
    return;
  }

  // Define the SOCKS proxy URL
  const socksProxyUrl = 'socks://127.0.0.1:1080';

  // Create a SOCKS proxy agent
  const agent = new SocksProxyAgent(socksProxyUrl);

  // Request the target URL through the SOCKS proxy
  request({ url: target, agent }, (error, response, body) => {
    if (error) {
      console.error('Proxy error:', error);
      res.status(500).send('Proxy error');
      return;
    }

    // Inject Eruda script if the response is HTML
    if (response.headers['content-type'] && response.headers['content-type'].includes('text/html')) {
      body = body.replace('</body>', `
        <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
        <script>eruda.init();</script>
        </body>
      `);
    }

    // Send the modified response to the client
    res.set(response.headers);
    res.send(body);
  });
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Socks proxy server is running on port ${port}`);
});
