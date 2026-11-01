import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3456;
const INDEX_PATH = path.join(__dirname, 'index.html');

// One document serves both views. /cart and /checkout are real, reloadable URLs; anything else is a 404.
const VIEWS = new Set(['/cart', '/checkout']);

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  if (pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  // The front door is the cart. Keep ?scenario= so the redirect doesn't lose it.
  if (pathname === '/') {
    res.writeHead(302, { Location: `/cart${url.search}` });
    res.end();
    return;
  }

  if (!VIEWS.has(pathname)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  // Read per request so edits show up on refresh during the demo.
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(INDEX_PATH, 'utf-8'));
});

server.listen(PORT, () => {
  console.log(`🛒 TechGear Store running at http://localhost:${PORT}`);
});
