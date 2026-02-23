export default async function handler(req, res) {
  try {
    const base = process.env.BACKEND_URL;
    if (!base) {
      res.status(500).json({ error: 'BACKEND_URL not configured' });
      return;
    }
    const originalUrl = req.url || '';
    const path = originalUrl.replace(/^\/api/, '');
    const url = `${base}${path}`;

    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      // Pass through important headers; skip hop-by-hop
      if (['connection', 'content-length', 'host'].includes(key)) continue;
      headers[key] = value;
    }

    let body = undefined;
    if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = Buffer.concat(chunks);
    }

    const resp = await fetch(url, {
      method: req.method,
      headers,
      body
    });

    // Copy response headers
    resp.headers.forEach((v, k) => {
      if (k.toLowerCase() === 'transfer-encoding') return;
      res.setHeader(k, v);
    });

    const buf = Buffer.from(await resp.arrayBuffer());
    res.status(resp.status).send(buf);
  } catch (e) {
    res.status(502).json({ error: 'Upstream error', detail: String(e?.message || e) });
  }
}
