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
  // 署名デバッグログ（本番環境でも出力）
  console.log('[SIG_DEBUG]', {
    expSigHead: expBuf.toString('hex').slice(0, 16),
    gotSigHead: gotBuf.toString('hex').slice(0, 16),
    ts: String(ts),
    bodyLen: Buffer.byteLength(bodyRaw, 'utf8')
  });
  return gotBuf.length === expBuf.length && crypto.timingSafeEqual(gotBuf, expBuf);
}

function webhookAuth(req, res, next) {
  try {
    const secret = process.env.WEBHOOK_SECRET || '';
    if (!secret) return res.status(500).json({ error: 'server misconfigured' });

    const timestamp = req.get('X-Timestamp');
    const signature = req.get('X-Signature');

    // デバッグ：受信ヘッダーとbody型
    console.log('[Webhook] Received:', {
      timestamp,
      signature,
      contentType: req.get('Content-Type'),
      bodyType: Buffer.isBuffer(req.body) ? 'Buffer' : typeof req.body,
      bodyIsBuffer: Buffer.isBuffer(req.body)
    });

    const bodyRaw = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : JSON.stringify(req.body || {});

    // デバッグ：Body内容（先頭のみ）
    console.log('[Webhook] BodyRaw Preview:', bodyRaw.substring(0, 100));

    if (!verifyHmacSignature({ bodyRaw, timestamp, signature })) {
      const bodySha = crypto.createHash('sha256').update(bodyRaw, 'utf8').digest('hex');
      const sigHex = String(signature || '').replace(/^sha256=/i, '').trim();

      console.error('[SIG_FAIL] Validation Failed:', {
        timestamp,
        receivedSig: sigHex,
        bodySha256: bodySha, // これと比較すればわかる
        bodyLength: bodyRaw.length
      });
      return res.status(401).json({ error: 'invalid signature' });
    }

    if (Buffer.isBuffer(req.body)) {
      try {
        req.body = JSON.parse(bodyRaw);
      } catch (e) {
        console.error('[Webhook] JSON Parse Error:', e.message);
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
