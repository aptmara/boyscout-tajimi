const crypto = require('crypto');

const authMiddleware = (req, res, next) => {
  if (req.session && req.session.user) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  return res.redirect('/admin/login.html');
};

function verifyHmacSignature({ bodyRaw, timestamp, signature }) {
  const secret = process.env.WEBHOOK_SECRET || '';
  if (!secret) return false;

  const tol = parseInt(process.env.HMAC_TOLERANCE_SEC || '300', 10);
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(String(timestamp || ''), 10);
  if (!ts || Math.abs(now - ts) > tol) return false;

  const m =
    String(signature || '').match(/^sha256=([0-9a-fA-F]{64})$/) ||
    String(signature || '').match(/^([0-9a-fA-F]{64})$/);
  if (!m) return false;
  const gotBuf = Buffer.from(m[1], 'hex');
  if (gotBuf.length !== 32) return false;

  const expBuf = crypto.createHmac('sha256', secret).update(`${ts}.${bodyRaw}`, 'utf8').digest();
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[SIG_DEBUG]', {
      expSigHead: expBuf.toString('hex').slice(0,16),
      gotSigHead: gotBuf.toString('hex').slice(0,16),
      ts: String(ts),
      bodyLen: Buffer.byteLength(bodyRaw, 'utf8')
    });
  }
  return gotBuf.length === expBuf.length && crypto.timingSafeEqual(gotBuf, expBuf);
}

function webhookAuth(req, res, next) {
  try {
    const secret = process.env.WEBHOOK_SECRET || '';
    if (!secret) return res.status(500).json({ error: 'server misconfigured' });

    const timestamp = req.get('X-Timestamp');
    const signature = req.get('X-Signature');

    const bodyRaw = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : JSON.stringify(req.body || {});

    if (!verifyHmacSignature({ bodyRaw, timestamp, signature })) {
      const bodySha = crypto.createHash('sha256').update(bodyRaw, 'utf8').digest('hex');
      const sigHex = String(signature || '').replace(/^sha256=/i, '').trim();
      const now = Math.floor(Date.now() / 1000);
      const ts = parseInt(String(timestamp || '0'), 10);
      const skew = isFinite(ts) ? Math.abs(now - ts) : null;
      console.warn('[SIG_FAIL]', {
        ts: timestamp,
        skew,
        gotSigHead: (sigHex || '').slice(0, 16),
        bodyLen: bodyRaw.length,
        bodySha256: bodySha,
      });
      return res.status(401).json({ error: 'invalid signature' });
    }

    if (Buffer.isBuffer(req.body)) {
      try {
        req.body = JSON.parse(bodyRaw);
      } catch {
        return res.status(400).json({ error: 'bad json' });
      }
    }
    return next();
  } catch (e) {
    console.error('[webhookAuth:error]', e);
    return res.status(401).json({ error: 'unauthorized' });
  }
}

module.exports = {
  authMiddleware,
  webhookAuth,
};
