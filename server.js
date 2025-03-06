const express = require('express');
const httpProxy = require('http-proxy');
const SocksProxyAgent = require('socks-proxy-agent');
const request = require('request');
const { JSDOM } = require('jsdom');
const path = require('path');
const exphbs = require('express-handlebars');

const app = express();
const port = process.env.PORT || 3000;

// Function to apply ROT13 transformation
function rot13(str) {
    return str.replace(/[a-zA-Z]/g, function (char) {
        return String.fromCharCode(
            char.charCodeAt(0) + (char.toLowerCase() < 'n' ? 13 : -13)
        );
    });
}

// Set up Handlebars as the view engine
app.engine('.hbs', exphbs.engine({
    extname: '.hbs',
    layoutsDir: path.join(__dirname, 'src', 'pages', 'layouts'),
    defaultLayout: 'main'
}));
app.set('view engine', '.hbs');
app.set('views', path.join(__dirname, 'src', 'pages'));

// Route to render index.hbs
app.get('/', (req, res) => {
    res.render('index', { title: "Callm3batman's WebProxy" });
});

// Proxy endpoint
app.get('/proxy', (req, res) => {
    const encodedUrl = req.query.url;
    if (!encodedUrl) {
        return res.status(400).send('URL parameter is required');
    }

    const url = rot13(decodeURIComponent(encodedUrl)); // Decode the ROT13 URL

    console.log(`Proxying request to: ${url}`);

    // Define the SOCKS proxy URL
    const socksProxyUrl = 'socks://127.0.0.1:1080';

    // Create a SOCKS proxy agent
    const agent = new SocksProxyAgent(socksProxyUrl);

    // Request the target URL through the SOCKS proxy
    request({ url, agent }, (error, response, body) => {
        if (error) {
            console.error('Error fetching the URL:', error);
            return res.status(500).send('Error fetching the URL');
        }

        // Log response status and headers for debugging
        console.log('Response status:', response.statusCode);
        console.log('Response headers:', response.headers);

        // Inject Eruda script if the response is HTML
        if (response.headers['content-type'] && response.headers['content-type'].includes('text/html')) {
            const dom = new JSDOM(body);
            const document = dom.window.document;
            const baseUrl = new URL(url);

            // Rewrite all anchor tags
            document.querySelectorAll('a').forEach(anchor => {
                const href = anchor.getAttribute('href');
                if (href && !href.startsWith('#')) {
                    const absoluteUrl = new URL(href, baseUrl).href;
                    anchor.setAttribute('href', `/proxy?url=${encodeURIComponent(rot13(absoluteUrl))}`);
                }
            });

            // Rewrite all src attributes (for scripts and images)
            document.querySelectorAll('[src]').forEach(element => {
                const src = element.getAttribute('src');
                if (src) {
                    const absoluteUrl = new URL(src, baseUrl).href;
                    element.setAttribute('src', `/proxy/asset?url=${encodeURIComponent(rot13(absoluteUrl))}`);
                }
            });

            // Inject Eruda script
            const erudaScript = `
                <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
                <script>eruda.init();</script>
            `;
            const bodyElement = document.querySelector('body');
            if (bodyElement) {
                bodyElement.insertAdjacentHTML('beforeend', erudaScript);
            }

            res.send(dom.serialize());
        } else {
            res.send(body);
        }
    });
});

// Proxy endpoint for assets
app.get('/proxy/asset', (req, res) => {
    const encodedUrl = req.query.url;
    if (!encodedUrl) {
        return res.status(400).send('URL parameter is required');
    }

    const url = rot13(decodeURIComponent(encodedUrl)); // Decode the ROT13 URL

    console.log(`Proxying asset request to: ${url}`);
    request(url).pipe(res);
});

app.listen(port, () => {
    console.log(`Proxy server is running on port ${port}`);
});
