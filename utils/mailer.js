const net = require('node:net');
const tls = require('node:tls');
const os = require('node:os');
const { randomBytes } = require('node:crypto');

const DEFAULT_SMTP_TIMEOUT = 15000;

function parseBoolean(value, defaultValue = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function sanitizeHeaderValue(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

function encodeHeader(header, value) {
  const sanitized = sanitizeHeaderValue(value);
  if (!/[\u0080-\uFFFF]/.test(sanitized)) {
    return `${header}: ${sanitized}`;
  }
  const base64 = Buffer.from(sanitized, 'utf8').toString('base64');
  return `${header}: =?UTF-8?B?${base64}?=`;
}

function extractEmailAddress(address) {
  if (!address) return '';
  const match = /<([^>]+)>/.exec(address);
  const value = match ? match[1] : address;
  return sanitizeHeaderValue(value);
}

function buildMessageId(domain) {
  const host = sanitizeHeaderValue(domain || os.hostname() || 'localhost');
  const id = `${Date.now().toString(36)}.${randomBytes(8).toString('hex')}`;
  return `<${id}@${host}>`;
}

function buildMessage({ from, to, subject, text, replyTo }) {
  const recipients = Array.isArray(to) ? to : [to];
  const headerLines = [
    `From: ${sanitizeHeaderValue(from)}`,
    `To: ${recipients.map(sanitizeHeaderValue).join(', ')}`,
    encodeHeader('Subject', subject || ''),
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${buildMessageId()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
  ];

  if (replyTo) {
    headerLines.splice(2, 0, `Reply-To: ${sanitizeHeaderValue(replyTo)}`);
  }

  const rawText = String(text || '');
  const bodyLines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => (line.startsWith('.') ? `.${line}` : line));

  return `${headerLines.join('\r\n')}\r\n\r\n${bodyLines.join('\r\n')}`;
}

class SMTPClient {
  constructor(options) {
    this.options = options;
    this.socket = null;
    this.currentHost = options.host;
    this.timeout = options.timeout || DEFAULT_SMTP_TIMEOUT;
    this.secure = Boolean(options.secure);
    this.rejectUnauthorized = parseBoolean(options.rejectUnauthorized, true);
  }

  async connect() {
    if (this.socket) return;
    const { host, port = 587 } = this.options;

    await new Promise((resolve, reject) => {
      const onError = (err) => {
        cleanup();
        reject(err);
      };

      const onConnect = () => {
        cleanup();
        this.socket.setTimeout(this.timeout);
        resolve();
      };

      const cleanup = () => {
        if (!this.socket) return;
        this.socket.off('error', onError);
        this.socket.off('timeout', onTimeout);
      };

      const onTimeout = () => {
        cleanup();
        reject(new Error('SMTP connection timed out'));
      };

      if (this.secure) {
        this.socket = tls.connect(
          {
            host,
            port,
            servername: host,
            rejectUnauthorized: this.rejectUnauthorized,
            timeout: this.timeout,
          },
          onConnect,
        );
      } else {
        this.socket = net.createConnection({ host, port }, onConnect);
      }

      this.socket.once('error', onError);
      this.socket.once('timeout', onTimeout);
    });
  }

  async upgradeToTLS() {
    if (!this.socket) throw new Error('Socket is not initialized');

    this.socket = await new Promise((resolve, reject) => {
      const secureSocket = tls.connect(
        {
          socket: this.socket,
          servername: this.currentHost,
          rejectUnauthorized: this.rejectUnauthorized,
          timeout: this.timeout,
        },
        () => {
          secureSocket.setTimeout(this.timeout);
          resolve(secureSocket);
        },
      );
      secureSocket.once('error', (err) => {
        secureSocket.destroy();
        reject(err);
      });
    });

    this.secure = true;
  }

  async write(command) {
    if (!this.socket) throw new Error('Socket is not initialized');
    await new Promise((resolve, reject) => {
      this.socket.write(command, 'utf8', (err) => {
        if (err) return reject(err);
        return resolve();
      });
    });
  }

  async readResponse() {
    if (!this.socket) throw new Error('Socket is not initialized');

    return new Promise((resolve, reject) => {
      let buffer = '';

      const onData = (chunk) => {
        buffer += chunk.toString('utf8');
        if (!buffer.includes('\n')) return;

        const lines = buffer.split(/\r?\n/);
        let idx = lines.length - 1;
        while (idx >= 0 && lines[idx] === '') idx--;
        if (idx < 0) return;

        const line = lines[idx];
        const match = line.match(/^(\d{3})([ -])(.*)$/);
        if (!match) return;
        if (match[2] === '-') {
          return;
        }

        cleanup();
        const responseLines = lines.slice(0, idx + 1).filter((l) => l);
        resolve({
          code: Number(match[1]),
          lines: responseLines,
        });
      };

      const onError = (err) => {
        cleanup();
        reject(err);
      };

      const onClose = () => {
        cleanup();
        reject(new Error('SMTP connection closed unexpectedly'));
      };

      const onTimeout = () => {
        cleanup();
        reject(new Error('SMTP response timeout'));
      };

      const cleanup = () => {
        if (!this.socket) return;
        this.socket.off('data', onData);
        this.socket.off('error', onError);
        this.socket.off('close', onClose);
        this.socket.off('timeout', onTimeout);
      };

      this.socket.on('data', onData);
      this.socket.once('error', onError);
      this.socket.once('close', onClose);
      this.socket.once('timeout', onTimeout);
    });
  }

  async sendCommand(command, acceptedCodes) {
    await this.write(`${command}\r\n`);
    const response = await this.readResponse();
    if (acceptedCodes && !acceptedCodes.includes(response.code)) {
      const preview = response.lines.join('\n');
      throw new Error(`Unexpected SMTP response to "${command}": ${response.code} ${preview}`);
    }
    return response;
  }

  async sendData(data) {
    const normalized = data.replace(/\r?\n/g, '\r\n');
    const withEnding = normalized.endsWith('\r\n') ? normalized : `${normalized}\r\n`;
    await this.write(`${withEnding}.\r\n`);
    return this.readResponse();
  }

  async quit() {
    try {
      await this.sendCommand('QUIT', [221]);
    } catch (err) {
      // Ignore quit errors
    }
    if (this.socket) {
      this.socket.end();
      this.socket = null;
    }
  }
}

function parseEhloCapabilities(lines) {
  const caps = { auth: [], features: [] };
  lines.forEach((line) => {
    const cleaned = line.replace(/^250[ -]/, '');
    caps.features.push(cleaned.toUpperCase());
    const authMatch = cleaned.match(/^AUTH\s+(.*)$/i);
    if (authMatch) {
      caps.auth = authMatch[1]
        .split(/\s+/)
        .map((method) => method.trim().toUpperCase())
        .filter(Boolean);
    }
  });
  return caps;
}

async function authenticate(client, auth, capabilities) {
  if (!auth || !auth.user) return;
  const methods = capabilities.auth || [];
  const password = auth.pass || '';

  if (methods.includes('PLAIN')) {
    const token = Buffer.from(`\u0000${auth.user}\u0000${password}`, 'utf8').toString('base64');
    const response = await client.sendCommand(`AUTH PLAIN ${token}`, [235, 503]);
    if (response.code === 235 || response.code === 503) return;
  }

  if (methods.includes('LOGIN')) {
    const first = await client.sendCommand('AUTH LOGIN', [334, 503]);
    if (first.code === 503) return;
    if (first.code !== 334) {
      throw new Error('SMTP AUTH LOGIN rejected');
    }
    const userResponse = await client.sendCommand(Buffer.from(auth.user, 'utf8').toString('base64'), [334]);
    if (userResponse.code !== 334) {
      throw new Error('SMTP AUTH LOGIN username rejected');
    }
    await client.sendCommand(Buffer.from(password, 'utf8').toString('base64'), [235]);
    return;
  }

  if (methods.length > 0) {
    throw new Error('SMTP server does not support AUTH PLAIN or AUTH LOGIN');
  }

  // Some servers do not advertise AUTH. Attempt PLAIN as a best-effort fallback.
  const token = Buffer.from(`\u0000${auth.user}\u0000${password}`, 'utf8').toString('base64');
  await client.sendCommand(`AUTH PLAIN ${token}`, [235, 503]);
}

function getMailerConfigFromEnv() {
  const host = process.env.SMTP_HOST && process.env.SMTP_HOST.trim();
  if (!host) {
    throw new Error('SMTP_HOST is not configured');
  }

  const port = Number(process.env.SMTP_PORT || (parseBoolean(process.env.SMTP_SECURE, false) ? 465 : 587));
  const secure = parseBoolean(process.env.SMTP_SECURE, port === 465);
  const startTLS = parseBoolean(process.env.SMTP_STARTTLS, !secure);
  const requireTLS = parseBoolean(process.env.SMTP_REQUIRE_TLS, false);
  const rejectUnauthorized = parseBoolean(process.env.SMTP_TLS_REJECT_UNAUTHORIZED, true);
  const timeout = Number(process.env.SMTP_TIMEOUT_MS || DEFAULT_SMTP_TIMEOUT);
  const clientHostname = process.env.SMTP_CLIENT_HOSTNAME || os.hostname() || 'localhost';

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const auth = user ? { user, pass: pass || '' } : null;

  return {
    host,
    port,
    secure,
    startTLS,
    requireTLS,
    rejectUnauthorized,
    timeout,
    auth,
    clientHostname,
  };
}

async function sendMail(messageOptions, overrideConfig) {
  const baseConfig = overrideConfig || getMailerConfigFromEnv();
  const toList = Array.isArray(messageOptions.to) ? messageOptions.to : [messageOptions.to];
  if (!messageOptions.from) {
    throw new Error('Missing "from" address');
  }
  if (!toList.length || !toList[0]) {
    throw new Error('Missing "to" address');
  }

  const envelopeFrom = sanitizeHeaderValue(
    messageOptions.envelopeFrom || extractEmailAddress(messageOptions.from),
  );
  const envelopeRecipients = toList.map((addr) => sanitizeHeaderValue(extractEmailAddress(addr)));

  const client = new SMTPClient(baseConfig);

  const message = buildMessage({
    from: messageOptions.from,
    to: toList,
    subject: messageOptions.subject || '',
    text: messageOptions.text || '',
    replyTo: messageOptions.replyTo,
  });

  try {
    await client.connect();
    const greeting = await client.readResponse();
    if (greeting.code !== 220) {
      throw new Error(`SMTP greeting failed: ${greeting.lines.join(' ')}`);
    }

    let ehloResponse;
    try {
      ehloResponse = await client.sendCommand(`EHLO ${sanitizeHeaderValue(baseConfig.clientHostname)}`, [250]);
    } catch (err) {
      ehloResponse = await client.sendCommand(`HELO ${sanitizeHeaderValue(baseConfig.clientHostname)}`, [250]);
    }

    let capabilities = parseEhloCapabilities(ehloResponse.lines);

    if (!client.secure && baseConfig.startTLS) {
      const supportsStartTLS = capabilities.features.some((feature) => feature.includes('STARTTLS'));
      if (!supportsStartTLS) {
        if (baseConfig.requireTLS) {
          throw new Error('SMTP server does not support STARTTLS');
        }
      } else {
        await client.sendCommand('STARTTLS', [220]);
        await client.upgradeToTLS();
        const ehloAfterTls = await client.sendCommand(`EHLO ${sanitizeHeaderValue(baseConfig.clientHostname)}`, [250]);
        capabilities = parseEhloCapabilities(ehloAfterTls.lines);
      }
    }

    if (baseConfig.auth) {
      await authenticate(client, baseConfig.auth, capabilities);
    }

    await client.sendCommand(`MAIL FROM:<${envelopeFrom}>`, [250, 251]);
    for (const recipient of envelopeRecipients) {
      await client.sendCommand(`RCPT TO:<${recipient}>`, [250, 251, 252]);
    }
    await client.sendCommand('DATA', [354]);
    const dataResponse = await client.sendData(message);
    if (dataResponse.code !== 250) {
      throw new Error(`SMTP message rejected: ${dataResponse.lines.join(' ')}`);
    }
    await client.quit();
  } catch (error) {
    try {
      await client.quit();
    } catch {
      // ignore
    }
    throw error;
  }
}

module.exports = {
  sendMail,
  getMailerConfigFromEnv,
  parseBoolean,
};
