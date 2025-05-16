const express = require("express");
const fetch = require("node-fetch");

const app = express();

// Middleware to parse JSON and URL-encoded bodies.
// This is necessary for `req.body` to be populated for POST/PUT etc.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.all("*", async (req, res) => {
  // 1. Construct the backend URL using the original path and query from the client
  const clientPathAndQuery = req.originalUrl; // e.g., /some/path?query=value
//   const backendURL = `https://graph-ongyy.kinsta.app${clientPathAndQuery}`;
  const backendURL = `http://localhost:4001${clientPathAndQuery}`;

  console.log(`[${new Date().toISOString()}] PROXY ${req.method} ${clientPathAndQuery} -> ${backendURL}`);*

  // 2. Prepare headers for the backend request
  const forwardHeaders = {};
  // Headers to exclude from forwarding to the backend
  const headersToExclude = [
    'host',             // Will be set explicitly or by fetch based on backendURL's hostname
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailers',
    'transfer-encoding', // Let fetch handle this based on the body
    'upgrade',
    'content-length',   // Let fetch calculate this based on the body
    // Add any other client-specific headers you don't want to forward
  ];

  for (const key in req.headers) {
    if (!headersToExclude.includes(key.toLowerCase())) {
      forwardHeaders[key] = req.headers[key];
    }
  }
  // Set the Host header for the backend to ensure it routes correctly
  forwardHeaders.host = "graph-ongyy.kinsta.app";
  // Optionally, add X-Forwarded-* headers if your backend uses them
  // forwardHeaders['X-Forwarded-For'] = req.ip;
  // forwardHeaders['X-Forwarded-Proto'] = req.protocol;

  // 3. Prepare the body
  let bodyToSend;
  // Only send a body if the method is not GET or HEAD and req.body exists
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
    const contentType = req.headers['content-type'];
    if (contentType && contentType.includes('application/json') && typeof req.body === 'object') {
      // If express.json() parsed it, and it's an object, stringify for fetch.
      // node-fetch usually handles this automatically if 'Content-Type' is json,
      // but being explicit can prevent issues.
      bodyToSend = JSON.stringify(req.body);
    } else if (Buffer.isBuffer(req.body) || typeof req.body === 'string') {
      // If body is already a buffer or string (e.g. from express.raw() or express.text())
      bodyToSend = req.body;
    } else if (typeof req.body === 'object' && contentType && contentType.includes('application/x-www-form-urlencoded')) {
      // For form data, node-fetch can often handle the object directly if Content-Type is correct.
      // Or, you might need to use URLSearchParams:
      // bodyToSend = new URLSearchParams(req.body).toString();
      bodyToSend = req.body; // Let fetch handle it if it can
    } else {
      // Fallback for other parsed types or if unsure
      bodyToSend = req.body;
    }
  }

  try {
    const backendResponse = await fetch(backendURL, {
      method: req.method,
      headers: forwardHeaders,
      body: bodyToSend,
      redirect: 'manual', // Important: Do not follow redirects automatically.
                          // The client should handle redirects if the backend sends one.
      compress: true,     // Request compressed response from backend if available
    });

    console.log(`[${new Date().toISOString()}] BACKEND ${req.method} ${clientPathAndQuery} -> ${backendResponse.status} ${backendResponse.statusText}`);

    // 4. Forward backend response headers to the client
    const excludedResponseHeaders = [
      'transfer-encoding',
      'connection',
      'content-encoding', // If 'compress: true' was used with fetch, it handles decompression.
                          // The original Content-Encoding from backend might not apply to the now-decompressed stream.
                          // Let Express/Node handle Content-Encoding for the final client response if re-compression happens.
      'strict-transport-security', // Usually set by the front-most server
      // 'content-length', // Let the streaming process determine the final content length
    ];

    backendResponse.headers.forEach((value, name) => {
      if (!excludedResponseHeaders.includes(name.toLowerCase())) {
        res.setHeader(name, value);
      }
    });

    res.status(backendResponse.status);

    // 5. Stream the backend response body to the client
    if (backendResponse.body) {
      backendResponse.body.pipe(res);
    } else {
      res.end();
    }

  } catch (error) {
    console.error(`[${new Date().toISOString()}] PROXY_ERROR ${req.method} ${clientPathAndQuery} -> ${error.message}`, error.stack);
    // Distinguish between network errors to backend vs. backend returning an error
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
        res.status(503).send({ error: "Service unavailable", details: error.message }); // Service Unavailable
    } else if (error.name === 'AbortError' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        res.status(504).send({ error: "Gateway timeout", details: error.message }); // Gateway Timeout
    }
    else {
        res.status(502).send({ error: "Bad gateway", details: error.message }); // Bad Gateway for other errors
    }
  }
});

module.exports = app;

// To run this (e.g., save as server.js):
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`Proxy server listening on port ${PORT}`);
//   console.log(`Forwarding all requests to https://graph-ongyy.kinsta.app`);
// });