// serve.ts — tiny dev server for local playtesting (Node 22, stdlib only).
// Serves game/ at / and screenshots/ at /screenshots/. Usage:
//   node serve.ts [port]   (default 8080)
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || 8080);
const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml',
};

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
  const roots = url.startsWith('/screenshots/') ? [here] : [join(here, 'game')];
  const file = normalize(join(roots[0], rel));
  if (!file.startsWith(roots[0]) || !existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
server.listen(port, () => console.log(`Golden Hour dev server: http://localhost:${port}/`));
