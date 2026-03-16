const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function isApiPath(value) {
  return typeof value === 'string' && (value === '/api' || value.startsWith('/api/'));
}

function isApiRequest(req) {
  return isApiPath(req?.originalUrl)
    || isApiPath(req?.baseUrl)
    || isApiPath(req?.path)
    || isApiPath(req?.url);
}

function ensurePersistentSessionSecret(secretFilePath) {
  if (typeof secretFilePath !== 'string' || !secretFilePath.trim()) {
    throw new Error('secretFilePath is required');
  }

  const normalizedPath = path.resolve(secretFilePath);
  if (fs.existsSync(normalizedPath)) {
    const existingSecret = fs.readFileSync(normalizedPath, 'utf8').trim();
    if (existingSecret) {
      return existingSecret;
    }
  }

  fs.mkdirSync(path.dirname(normalizedPath), { recursive: true });
  const generatedSecret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(normalizedPath, `${generatedSecret}\n`, { encoding: 'utf8', mode: 0o600 });
  try {
    fs.chmodSync(normalizedPath, 0o600);
  } catch {
    // Ignore chmod failures on platforms that do not support POSIX permissions.
  }
  return generatedSecret;
}

function resolveSessionSecret(env = process.env, options = {}) {
  const secret = typeof env?.SESSION_SECRET === 'string'
    ? env.SESSION_SECRET.trim()
    : '';
  if (secret) {
    return { secret, source: 'env' };
  }

  if (env?.NODE_ENV === 'production') {
    const secretFilePath = typeof options?.secretFilePath === 'string'
      ? options.secretFilePath.trim()
      : '';
    if (!secretFilePath) {
      throw new Error('SESSION_SECRET or secretFilePath must be set in production');
    }
    return {
      secret: ensurePersistentSessionSecret(secretFilePath),
      source: 'file',
    };
  }

  return {
    secret: crypto.randomBytes(32).toString('hex'),
    source: 'generated',
  };
}

function extractGoogleMapsEmbedUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';

  const iframeMatch = raw.match(/<iframe\b[^>]*\bsrc=(["'])(.*?)\1/i);
  const candidate = iframeMatch ? iframeMatch[2].trim() : raw;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:') return '';
    if (parsed.hostname !== 'www.google.com') return '';
    if (!parsed.pathname.startsWith('/maps/embed')) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function buildGoogleMapsEmbedHtml(value) {
  const embedUrl = extractGoogleMapsEmbedUrl(value);
  if (!embedUrl) return '';

  return `<iframe src="${embedUrl}" width="100%" height="100%" style="border:0;position:absolute;top:0;left:0;" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
}

module.exports = {
  isApiRequest,
  resolveSessionSecret,
  extractGoogleMapsEmbedUrl,
  buildGoogleMapsEmbedHtml,
};
