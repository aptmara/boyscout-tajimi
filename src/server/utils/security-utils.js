const crypto = require('crypto');

function isApiPath(value) {
  return typeof value === 'string' && (value === '/api' || value.startsWith('/api/'));
}

function isApiRequest(req) {
  return isApiPath(req?.originalUrl)
    || isApiPath(req?.baseUrl)
    || isApiPath(req?.path)
    || isApiPath(req?.url);
}

function resolveSessionSecret(env = process.env) {
  const secret = typeof env?.SESSION_SECRET === 'string'
    ? env.SESSION_SECRET.trim()
    : '';
  if (secret) return secret;

  if (env?.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set in production');
  }

  return crypto.randomBytes(32).toString('hex');
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
