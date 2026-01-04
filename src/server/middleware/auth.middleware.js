const crypto = require('crypto');

/**
 * 基本認証ミドルウェア
 * セッションにユーザーがいるかチェック
 */
const authMiddleware = (req, res, next) => {
  if (req.session && req.session.user) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  return res.redirect('/admin/login.html');
};

/**
 * 管理者専用ミドルウェア
 * role が 'admin' でなければアクセス拒否
 */
const adminOnlyMiddleware = (req, res, next) => {
  const role = req.session?.user?.role || 'editor';
  if (role !== 'admin') {
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({ error: 'Admin access required', message: 'この操作は管理者のみ実行できます。' });
    }
    return res.redirect('/admin?error=forbidden');
  }
  return next();
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

    // デバッグログ（本番運用中は無効化またはレベル調整）
    // console.log('[Webhook] Received:', { ts: timestamp, len: bodyRaw.length });

    const bodyRaw = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : JSON.stringify(req.body || {});

    if (!verifyHmacSignature({ bodyRaw, timestamp, signature })) {
      console.warn('[SIG_FAIL] Invalid Signature:', { ts: timestamp, len: bodyRaw.length });
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
  adminOnlyMiddleware,
  webhookAuth,
};
