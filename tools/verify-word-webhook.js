const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('dotenv');

async function verifyWordWebhook() {
  const envPath = path.join(__dirname, '../.env');
  const localEnv = fs.existsSync(envPath) ? parse(fs.readFileSync(envPath)) : {};
  const secret = process.env.WEBHOOK_SECRET || localEnv.WEBHOOK_SECRET;
  if (!secret) throw new Error('Webhook secret is unavailable for readiness check');

  const docx = fs.readFileSync(path.join(__dirname, '../test/empty-activity-word.docx'), 'base64');
  const body = JSON.stringify({ title: 'Word converter readiness check', docx });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', secret).update(timestamp + '.' + body).digest('hex');
  const response = await fetch('http://127.0.0.1:3000/api/activities/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Timestamp': String(timestamp),
      'X-Signature': 'sha256=' + signature,
    },
    body,
  });

  const code = (await response.json().catch(() => ({}))).error;
  if (response.status !== 422 || code !== 'empty_docx') {
    throw new Error('Unexpected Word endpoint result: HTTP ' + response.status + ' (' + (code || 'no error code') + ')');
  }
  assert.equal(code, 'empty_docx');
  console.log('Word webhook: running server converted the blank document and did not publish it.');
}

verifyWordWebhook().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
