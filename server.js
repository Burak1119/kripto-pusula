// Yerelde veya Render/Railway gibi sunucularda çalıştırmak için: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const routes = { '/api/coins': require('./api/coins'), '/api/news': require('./api/news'), '/api/exchanges': require('./api/exchanges') };
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
};

http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://x').pathname;
  if (routes[pathname]) {
    try { await routes[pathname](req, res); }
    catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: String(e.message || e) })); }
    return;
  }
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.statusCode = 404; res.end('Bulunamadı'); return;
  }
  res.setHeader('content-type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log('Kripto Pusula: http://localhost:' + PORT));
