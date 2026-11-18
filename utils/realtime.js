'use strict';

// Penyimpanan koneksi SSE. Setiap client adalah satu tab/browser yang sedang
// membuka halaman dan mendengarkan perubahan data.
const clients = new Set();
let nextClientId = 1;

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

function normalizePath(value) {
  return String(value || '')
    .split('?')[0]
    .replace(/\/+$/, '')
    .toLowerCase();
}

function pathStarts(path, prefixes) {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

// Memetakan path permintaan tulis ke entity yang berubah.
function entityForPath(rawPath) {
  const path = normalizePath(rawPath);

  if (pathStarts(path, ['/data-bahan-kain', '/data-kain-admin', '/guest/data-kain', '/katalog-vendor'])) {
    return 'data-kain';
  }
  if (pathStarts(path, ['/admin/vendor', '/user/vendor', '/guest/vendor']) || path === '/admin' || path === '/user') {
    return 'vendor';
  }
  if (pathStarts(path, ['/harga-dasar', '/harga-dasar-user', '/guest/harga-dasar'])) {
    return 'harga-dasar';
  }
  if (pathStarts(path, ['/stok-masuk', '/stok-masuk-user'])) {
    return 'stok-masuk';
  }
  if (pathStarts(path, ['/stok-keluar', '/stok-keluar-user'])) {
    return 'stok-keluar';
  }
  if (pathStarts(path, ['/stok-opname', '/stok-opname-user'])) {
    return 'stok-opname';
  }
  if (pathStarts(path, ['/laporan', '/laporan-user', '/guest/laporan'])) {
    return 'laporan';
  }
  if (pathStarts(path, ['/surat-jalan', '/surat-jalan-admin', '/surat-jalan-user'])) {
    return 'surat-jalan';
  }
  if (pathStarts(path, ['/lpj', '/lpj-admin', '/lpj-user'])) {
    return 'lpj';
  }
  if (pathStarts(path, ['/materi-approval-admin', '/materi-approval-user'])) {
    return 'materi-approval';
  }
  if (pathStarts(path, ['/payment-request-admin', '/payment-request-user', '/payment-request'])) {
    return 'payment-request';
  }

  return null;
}

function isWriteRequest(req) {
  const method = String(req.method || '').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return true;

  // Beberapa hapus data di project ini memakai GET /.../delete/... atau /.../hapus/...
  if (method === 'GET') {
    return /(^|\/)(delete|hapus)(\/|$)/i.test(req.path || req.originalUrl || '');
  }

  return false;
}

function normalizeSource(value) {
  if (Array.isArray(value)) value = value[0];
  if (value === undefined || value === null) return '';
  return String(value).slice(0, 100);
}

function getRequestSource(req) {
  const body = req.body || {};
  const query = req.query || {};

  return (
    normalizeSource(body._liveClientId) ||
    normalizeSource(query._liveClientId) ||
    normalizeSource(req.get && req.get('x-live-client-id')) ||
    ''
  );
}

function isFailureRedirect(res) {
  if (typeof res.getHeader !== 'function') return false;
  const location = res.getHeader('Location');
  if (!location) return false;
  const value = String(location);

  // Redirect karena gagal auth harusnya tidak memicu "data berubah".
  return /(^|\/)\?error=/i.test(value) || /^\/login(?:[?#]|$)/i.test(value);
}

function writeSse(res, event, payload) {
  if (!res || res.writableEnded || res.destroyed) return false;
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    return true;
  } catch (err) {
    return false;
  }
}

function removeClient(client) {
  if (!client || client.removed) return;
  client.removed = true;
  if (client.heartbeat) clearInterval(client.heartbeat);
  clients.delete(client);
}

function closeClient(client) {
  removeClient(client);
  try {
    if (client && client.res && !client.res.writableEnded) client.res.end();
  } catch (err) {
    // Koneksi sudah ditutup browser.
  }
}

function broadcast(entity, source = '') {
  const payload = {
    entity,
    source: normalizeSource(source),
    at: Date.now(),
  };

  for (const client of Array.from(clients)) {
    if (!client || client.removed || !client.res || client.res.writableEnded || client.res.destroyed) {
      removeClient(client);
      continue;
    }

    if (!writeSse(client.res, 'change', payload)) {
      removeClient(client);
    }
  }
}

function install(app) {
  // Endpoint SSE. Tidak memakai auth agar halaman guest juga bisa menerima update.
  app.get('/realtime/events', (req, res) => {
    Object.keys(SSE_HEADERS).forEach((key) => res.setHeader(key, SSE_HEADERS[key]));
    if (typeof res.status === 'function') res.status(200);

    try {
      if (req.socket && typeof req.socket.setNoDelay === 'function') req.socket.setNoDelay(true);
      if (req.socket && typeof req.socket.setTimeout === 'function') req.socket.setTimeout(0);
    } catch (err) {
      // Abaikan kalau socket sudah tidak tersedia.
    }

    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const id = nextClientId++;
    const client = { id, res, heartbeat: null, removed: false };
    clients.add(client);

    writeSse(res, 'ready', { at: Date.now() });

    client.heartbeat = setInterval(() => {
      if (!writeSse(res, 'ping', { at: Date.now() })) closeClient(client);
    }, 25000);

    req.on('close', () => closeClient(client));
    res.on('close', () => closeClient(client));
    res.on('error', () => closeClient(client));
  });

  // Broadcast setelah response selesai sehingga hanya perubahan yang berhasil
  // (status < 400 dan bukan redirect error) yang memberi notifikasi.
  app.use((req, res, next) => {
    if (!isWriteRequest(req)) return next();

    const entity = entityForPath(req.path || req.originalUrl);
    if (!entity) return next();

    res.once('finish', () => {
      if (res.statusCode >= 400 || isFailureRedirect(res)) return;
      const source = getRequestSource(req);
      broadcast(entity, source);
      console.log(`[live] perubahan ${entity} disiarkan (sumber: ${source || 'tanpa-id'})`);
    });

    return next();
  });

  return { broadcast, entityForPath };
}

module.exports = { install, broadcast, entityForPath };
