const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { promisify } = require('node:util');
const { sanitizeHtml } = require('./simple-sanitizer');

const execute = promisify(execFile);
const MAX_DOCX_BYTES = 10 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 80 * 1024 * 1024;
const MAX_HTML_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
const PROFILE_SETTINGS = `<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry">
  <item oor:path="/org.openoffice.Office.Common/Security/Scripting">
    <prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop>
    <prop oor:name="DisableMacrosExecution" oor:op="fuse"><value>true</value></prop>
  </item>
  <item oor:path="/org.openoffice.Office.Writer/Content/Update">
    <prop oor:name="Link" oor:op="fuse"><value>2</value></prop>
    <prop oor:name="Field" oor:op="fuse"><value>false</value></prop>
    <prop oor:name="Chart" oor:op="fuse"><value>false</value></prop>
  </item>
</oor:items>`;

class WordImportError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.status = status;
  }
}

function decodeDocx(base64) {
  if (typeof base64 !== 'string' || !base64 || base64.length > Math.ceil(MAX_DOCX_BYTES / 3) * 4) {
    throw new WordImportError('invalid_docx');
  }

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length < 22 || buffer.length > MAX_DOCX_BYTES || buffer.toString('base64') !== base64) {
    throw new WordImportError('invalid_docx');
  }

  // Inspect ZIP metadata before opening the package in Writer.
  const invalid = new WordImportError('invalid_docx');
  const minimumEnd = Math.max(0, buffer.length - 22 - 65535);
  let end = buffer.length - 22;
  while (end >= minimumEnd) {
    if (buffer.readUInt32LE(end) === 0x06054b50 && end + 22 + buffer.readUInt16LE(end + 20) === buffer.length) break;
    end--;
  }
  if (end < minimumEnd || buffer.readUInt32LE(end + 4) !== 0) throw invalid;

  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const directoryStart = offset;
  if (count === 0 || count > 2000 || count !== buffer.readUInt16LE(end + 8)
    || offset + buffer.readUInt32LE(end + 12) !== end) throw invalid;

  const entries = new Set();
  let unpackedBytes = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) throw invalid;
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const size = buffer.readUInt32LE(offset + 20);
    unpackedBytes += buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const next = offset + 46 + nameLength + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    if (next > end || local + 30 > directoryStart || buffer.readUInt32LE(local) !== 0x04034b50
      || (flags & 1) !== 0 || (method !== 0 && method !== 8) || unpackedBytes > MAX_UNPACKED_BYTES) throw invalid;

    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    const localNameLength = buffer.readUInt16LE(local + 26);
    if (local + 30 + localNameLength + buffer.readUInt16LE(local + 28) + size > directoryStart
      || nameLength !== localNameLength || name !== buffer.toString('utf8', local + 30, local + 30 + localNameLength)
      || buffer.readUInt16LE(local + 6) !== flags || buffer.readUInt16LE(local + 8) !== method
      || !name || /[\\:\u0000]/.test(name) || name.startsWith('/') || name.split('/').includes('..')
      || entries.has(name) || /(?:^|\/)vbaproject(?:signature)?\.bin$/i.test(name)) throw invalid;
    entries.add(name);
    offset = next;
  }
  if (offset !== end || !entries.has('[Content_Types].xml') || !entries.has('word/document.xml')) throw invalid;
  return buffer;
}

async function readOutput(filename, limit) {
  const entry = await fs.lstat(filename);
  if (!entry.isFile() || entry.size > limit) throw new WordImportError('docx_output_too_large');
  return fs.readFile(filename);
}

async function convertWordToHtml(base64) {
  const document = decodeDocx(base64);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tajimi-docx-'));

  try {
    const input = path.join(directory, 'activity.docx');
    const profile = path.join(directory, 'profile');
    await fs.mkdir(path.join(profile, 'user'), { recursive: true });
    await Promise.all([
      fs.writeFile(input, document),
      fs.writeFile(path.join(profile, 'user', 'registrymodifications.xcu'), PROFILE_SETTINGS),
    ]);

    let executable = 'soffice';
    if (process.platform === 'win32') executable = 'soffice.com';
    try {
      await execute(executable, [
        '-env:UserInstallation=' + pathToFileURL(profile).href,
        '--headless', '--norestore', '--infilter=MS Word 2007 XML',
        '--convert-to', 'html:HTML (StarWriter):UTF8', '--outdir', directory, input,
      ], { timeout: 25000, windowsHide: true });
    } catch (error) {
      if (error.code === 'ENOENT') throw new WordImportError('docx_converter_unavailable', 503);
      throw new WordImportError('docx_conversion_failed');
    }

    const exported = (await readOutput(path.join(directory, 'activity.html'), MAX_HTML_BYTES)).toString('utf8');
    const body = exported.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
    if (!body) throw new WordImportError('docx_conversion_failed');

    const css = new Map();
    for (const block of exported.slice(0, body.index).matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
      for (const rule of block[1].matchAll(/^\s*([a-z][a-z0-9]*(?:\.[a-z][a-z0-9_-]*)?)\s*\{([^{}]*)\}/gim)) {
        css.set(rule[1].toLowerCase(), rule[2]);
      }
    }

    const sources = new Map();
    const content = sanitizeHtml(body[1], {
      wordCss: css,
      wordImage(src) {
        if (!sources.has(src)) sources.set(src, sources.size);
        return sources.get(src);
      },
    });
    if (!content.replace(/<[^>]*>|&nbsp;/gi, '').trim() && !sources.size) {
      throw new WordImportError('empty_docx');
    }

    const images = [];
    let remainingBytes = MAX_IMAGE_BYTES;
    for (const src of sources.keys()) {
      let data;
      const embedded = src.match(/^data:image\/(?:png|jpe?g|gif|bmp|webp|tiff);base64,([a-z0-9+/]+={0,2})$/i);
      if (embedded) {
        data = Buffer.from(embedded[1], 'base64');
      } else if (/^activity_html_[a-z0-9_-]+\.(?:png|jpe?g|gif|bmp|webp|tiff?)$/i.test(src)) {
        data = await readOutput(path.join(directory, src), remainingBytes);
      } else {
        throw new WordImportError('unsupported_docx_image');
      }
      remainingBytes -= data.length;
      if (remainingBytes < 0 || data.length === 0) throw new WordImportError('docx_output_too_large');
      images.push({ data: data.toString('base64') });
    }

    return { content: '<div class="word-article">' + content + '</div>', images };
  } catch (error) {
    if (error instanceof WordImportError) throw error;
    throw new WordImportError('docx_conversion_failed');
  } finally {
    await fs.rm(directory, { force: true, recursive: true });
  }
}

module.exports = { convertWordToHtml, WordImportError };
