const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { promisify } = require('node:util');
const { sanitizeHtml, escapeHtml } = require('./simple-sanitizer');

const execute = promisify(execFile);
const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 80 * 1024 * 1024;
const MAX_HTML_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
const MAX_TEXT_BYTES = 5 * 1024 * 1024;
const MAX_PDF_PAGES = 20;
const COMMAND_TIMEOUT = 25000;
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
  <item oor:path="/org.openoffice.Office.Calc/Content/Update">
    <prop oor:name="Link" oor:op="fuse"><value>1</value></prop>
  </item>
</oor:items>`;

class WordImportError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.status = status;
  }
}

// kind: 'docx' | 'xlsx' | 'pdf'。エラーコードは `<kind>_...` の形に揃える
function decodeBase64(base64, kind) {
  if (typeof base64 !== 'string' || !base64 || base64.length > Math.ceil(MAX_INPUT_BYTES / 3) * 4) {
    throw new WordImportError('invalid_' + kind);
  }
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length < 22 || buffer.length > MAX_INPUT_BYTES || buffer.toString('base64') !== base64) {
    throw new WordImportError('invalid_' + kind);
  }
  return buffer;
}

function decodeOoxml(base64, kind, requiredEntry) {
  const buffer = decodeBase64(base64, kind);

  // Inspect ZIP metadata before opening the package in LibreOffice.
  const invalid = new WordImportError('invalid_' + kind);
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
      || (kind === 'xlsx' && /^xl\/externalLinks\//i.test(name)) || entries.has(name) || /(?:^|\/)vbaproject(?:signature)?\.bin$/i.test(name)) throw invalid;
    entries.add(name);
    offset = next;
  }
  if (offset !== end || !entries.has('[Content_Types].xml') || !entries.has(requiredEntry)) throw invalid;
  return buffer;
}

async function readOutput(filename, limit, kind) {
  const entry = await fs.lstat(filename);
  if (!entry.isFile() || entry.size > limit) throw new WordImportError(kind + '_output_too_large');
  return fs.readFile(filename);
}

// 一時ディレクトリで処理し、WordImportError 以外は <kind>_conversion_failed に丸めて必ず後始末する
async function withTempDirectory(kind, work) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tajimi-' + kind + '-'));
  try {
    return await work(directory);
  } catch (error) {
    if (error instanceof WordImportError) throw error;
    throw new WordImportError(kind + '_conversion_failed');
  } finally {
    await fs.rm(directory, { force: true, recursive: true });
  }
}

async function runCommand(executable, args, kind) {
  try {
    return await execute(executable, args, { timeout: COMMAND_TIMEOUT, windowsHide: true });
  } catch (error) {
    if (error.code === 'ENOENT') throw new WordImportError(kind + '_converter_unavailable', 503);
    throw error;
  }
}

// LibreOffice で directory/activity.<extension> を directory/activity.html に変換する
async function convertWithSoffice(directory, document, { kind, extension, infilter, filter }) {
  const input = path.join(directory, 'activity.' + extension);
  const profile = path.join(directory, 'profile');
  await fs.mkdir(path.join(profile, 'user'), { recursive: true });
  await Promise.all([
    fs.writeFile(input, document),
    fs.writeFile(path.join(profile, 'user', 'registrymodifications.xcu'), PROFILE_SETTINGS),
  ]);

  const executable = process.platform === 'win32' ? 'soffice.com' : 'soffice';
  try {
    await runCommand(executable, [
      '-env:UserInstallation=' + pathToFileURL(profile).href,
      '--headless', '--norestore', '--infilter=' + infilter,
      '--convert-to', filter, '--outdir', directory, input,
    ], kind);
  } catch (error) {
    if (error instanceof WordImportError) throw error;
    throw new WordImportError(kind + '_conversion_failed');
  }
  return (await readOutput(path.join(directory, 'activity.html'), MAX_HTML_BYTES, kind)).toString('utf8');
}

const visibleText = (html) => html.replace(/<[^>]*>|&nbsp;/gi, '').trim();

async function convertExcelToHtml(base64) {
  const workbook = decodeOoxml(base64, 'xlsx', 'xl/workbook.xml');

  return withTempDirectory('xlsx', async (directory) => {
    const exported = await convertWithSoffice(directory, workbook, {
      kind: 'xlsx',
      extension: 'xlsx',
      infilter: 'Calc MS Excel 2007 XML',
      filter: 'html:HTML (StarCalc):UTF8',
    });
    const body = exported.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
    if (!body) throw new WordImportError('xlsx_conversion_failed');

    // 目次・区切り線・コメント・画像を除き、シート見出しを h3 に置き換える（シートが1つなら見出しなし）
    let sheets = 0;
    const html = body[1]
      .replace(/<!--[\s\S]*?-->|<hr\b[^>]*>|<img\b[^>]*>|<comment\b[^>]*>[\s\S]*?<\/comment>|<a\s+class="comment-indicator"[^>]*>\s*<\/a>/gi, '')
      .replace(/(<font\b[^>]*?)\s+face=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '$1')
      .replace(/(?:<p\b[^>]*>\s*)?<center\b[^>]*>[\s\S]*?<\/center>(?:\s*<\/p>)?/gi, '')
      .replace(/<a\s+name="table\d+"\s*>\s*<h1\b[^>]*>[\s\S]*?<em>([\s\S]*?)<\/em>\s*<\/h1>\s*<\/a>/gi, (match, name) => {
        sheets++;
        return '<h3>' + name + '</h3>';
      });
    const article = sheets === 1 ? html.replace(/<h3>[\s\S]*?<\/h3>/i, '') : html;

    const content = sanitizeHtml(article, { wordCss: new Map(), wordImage: () => 0 });
    if (!visibleText(content.replace(/<h3>[\s\S]*?<\/h3>/gi, ''))) throw new WordImportError('empty_xlsx');

    return { content: '<div class="word-article"><div class="excel-article">' + content + '</div></div>', images: [] };
  });
}

async function convertPdfToHtml(base64) {
  const buffer = decodeBase64(base64, 'pdf');
  if (buffer.toString('latin1', 0, 5) !== '%PDF-') throw new WordImportError('invalid_pdf');

  return withTempDirectory('pdf', async (directory) => {
    const input = path.join(directory, 'activity.pdf');
    await fs.writeFile(input, buffer);

    let info;
    try {
      info = (await runCommand('pdfinfo', [input], 'pdf')).stdout;
    } catch (error) {
      if (error instanceof WordImportError) throw error;
      if (/Incorrect password/i.test(String(error.stderr))) throw new WordImportError('pdf_encrypted');
      throw new WordImportError('invalid_pdf');
    }
    if (/^Encrypted:\s+yes/im.test(info)) throw new WordImportError('pdf_encrypted');
    const pageCount = Number((info.match(/^Pages:\s+(\d+)/m) || [])[1]);
    if (!pageCount) throw new WordImportError('invalid_pdf');
    if (pageCount > MAX_PDF_PAGES) throw new WordImportError('pdf_too_many_pages');

    const pagesDirectory = path.join(directory, 'pages');
    await fs.mkdir(pagesDirectory);
    await runCommand('pdftoppm', ['-scale-to', '1600', '-png', '-f', '1', '-l', String(pageCount), input,
      path.join(pagesDirectory, 'page')], 'pdf');
    const files = (await fs.readdir(pagesDirectory))
      .map((name) => ({ name, number: Number((name.match(/^page-(\d+)\.png$/) || [])[1]) }))
      .filter((file) => file.number)
      .sort((a, b) => a.number - b.number);
    if (!files.length) throw new WordImportError('pdf_conversion_failed');

    const images = [];
    let remainingBytes = MAX_IMAGE_BYTES;
    for (const file of files) {
      const data = await readOutput(path.join(pagesDirectory, file.name), remainingBytes, 'pdf');
      remainingBytes -= data.length;
      if (remainingBytes < 0 || data.length === 0) throw new WordImportError('pdf_output_too_large');
      images.push({ data: data.toString('base64'), kind: 'pdf-page' });
    }

    const textFile = path.join(directory, 'activity.txt');
    await runCommand('pdftotext', ['-raw', '-enc', 'UTF-8', input, textFile], 'pdf');
    const pageTexts = (await readOutput(textFile, MAX_TEXT_BYTES, 'pdf')).toString('utf8').split('\f');

    const figures = images.map((_, i) => '<figure class="pdf-page"><img data-image-index="' + i
      + '" alt="' + (i + 1) + 'ページ目" loading="lazy"></figure>').join('');
    const sections = images.map((_, i) => {
      const lines = (pageTexts[i] || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      return lines.length
        ? '<section><h4>' + (i + 1) + 'ページ</h4><p>' + lines.map((line) => escapeHtml(line.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, ''))).join('<br>') + '</p></section>'
        : '';
    }).join('');
    const text = sections ? '<details class="pdf-text"><summary>テキストで読む</summary>' + sections + '</details>' : '';

    return { content: '<div class="word-article"><div class="pdf-article">' + figures + text + '</div></div>', images };
  });
}

module.exports = {
  WordImportError,
  ImportError: WordImportError,
  MAX_IMAGE_BYTES,
  decodeOoxml,
  readOutput,
  withTempDirectory,
  convertWithSoffice,
  convertExcelToHtml,
  convertPdfToHtml,
};
