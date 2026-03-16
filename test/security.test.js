const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  isApiRequest,
  resolveSessionSecret,
  extractGoogleMapsEmbedUrl,
  buildGoogleMapsEmbedHtml,
} = require('../src/server/utils/security-utils');
const {
  sanitizePayload,
  sanitizePlainText,
} = require('../src/server/utils/simple-sanitizer');
const {
  authMiddleware,
  adminOnlyMiddleware,
} = require('../src/server/middleware/auth.middleware');

function createResponseRecorder() {
  return {
    statusCode: null,
    jsonBody: null,
    redirectTarget: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.jsonBody = body;
      return this;
    },
    redirect(target) {
      this.redirectTarget = target;
      return this;
    },
  };
}

test('isApiRequest detects mounted API routes from originalUrl', () => {
  assert.equal(isApiRequest({
    path: '/audit-logs',
    baseUrl: '/api/admin',
    originalUrl: '/api/admin/audit-logs',
  }), true);
  assert.equal(isApiRequest({
    path: '/admin',
    baseUrl: '',
    originalUrl: '/admin',
  }), false);
});

test('authMiddleware returns JSON 401 for API requests even when router is mounted', () => {
  const req = {
    path: '/audit-logs',
    baseUrl: '/api/admin',
    originalUrl: '/api/admin/audit-logs',
    session: null,
  };
  const res = createResponseRecorder();

  authMiddleware(req, res, () => {
    throw new Error('next should not be called');
  });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonBody, { error: 'Authentication required' });
  assert.equal(res.redirectTarget, null);
});

test('adminOnlyMiddleware returns JSON 403 for non-admin API requests', () => {
  const req = {
    path: '/summary',
    baseUrl: '/api/admin',
    originalUrl: '/api/admin/summary',
    session: { user: { role: 'editor' } },
  };
  const res = createResponseRecorder();

  adminOnlyMiddleware(req, res, () => {
    throw new Error('next should not be called');
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.jsonBody.error, 'Admin access required');
});

test('resolveSessionSecret prefers env and uses deterministic file fallback in production', () => {
  assert.equal(resolveSessionSecret({
    NODE_ENV: 'development',
    SESSION_SECRET: ' dev-secret ',
  }).secret, 'dev-secret');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tajimi-session-secret-'));
  const secretFilePath = path.join(tempDir, '.session-secret');

  const firstResult = resolveSessionSecret(
    { NODE_ENV: 'production' },
    { secretFilePath }
  );
  const secondResult = resolveSessionSecret(
    { NODE_ENV: 'production' },
    { secretFilePath }
  );

  assert.equal(firstResult.source, 'file');
  assert.equal(secondResult.source, 'file');
  assert.match(firstResult.secret, /^[a-f0-9]{64}$/);
  assert.equal(secondResult.secret, firstResult.secret);
  assert.equal(fs.readFileSync(secretFilePath, 'utf8').trim(), firstResult.secret);
  assert.match(resolveSessionSecret({ NODE_ENV: 'development' }).secret, /^[a-f0-9]{64}$/);
});

test('Google Maps helper extracts only safe embed URLs', () => {
  const embedHtml = '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d123" width="600"></iframe>';
  assert.equal(
    extractGoogleMapsEmbedUrl(embedHtml),
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d123'
  );
  assert.equal(extractGoogleMapsEmbedUrl('https://evil.example.com/maps/embed?pb=123'), '');
  assert.match(buildGoogleMapsEmbedHtml(embedHtml), /^<iframe src="https:\/\/www\.google\.com\/maps\/embed\?pb=/);
});

test('sanitizePayload strips active content while preserving safe placeholders', () => {
  const payload = sanitizePayload({
    title: '<img src=x onerror=alert(1)>Title',
    content: '<p onclick="evil()">Hi<script>alert(1)</script><img src="https://example.com/a.png" data-image-index="0" onerror="x"><a href="javascript:alert(1)" target="_blank">x</a><a href="/safe" target="_blank">safe</a></p>',
  });

  assert.equal(sanitizePlainText('<b>hello</b>'), 'hello');
  assert.match(payload.title, /^Title$/);
  assert.ok(payload.content.includes('<p>Hi'));
  assert.ok(payload.content.includes('data-image-index="0"'));
  assert.ok(payload.content.includes('<a href="/safe" target="_blank" rel="noopener noreferrer">safe</a>'));
  assert.ok(!payload.content.includes('<script'));
  assert.ok(!payload.content.includes('onerror'));
  assert.ok(!payload.content.includes('onclick'));
  assert.ok(!payload.content.includes('javascript:'));
});
