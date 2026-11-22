const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { convertExcelToHtml, convertPdfToHtml } = require('../src/server/utils/document-import');

const fixture = (name) => fs.readFileSync(path.join(__dirname, name), 'base64');

test('Excel import rejects malformed uploads before invoking LibreOffice', async () => {
  const word = fixture('activity-word.docx');
  for (const invalid of [null, '', 'garbage', Buffer.alloc(22).toString('base64'), word]) {
    await assert.rejects(convertExcelToHtml(invalid), { message: 'invalid_xlsx' });
  }
});

test('PDF import rejects malformed uploads before invoking poppler', async () => {
  const notPdf = Buffer.from('this is definitely not a pdf file').toString('base64');
  for (const invalid of [null, '', 'garbage', notPdf, fixture('activity-excel.xlsx')]) {
    await assert.rejects(convertPdfToHtml(invalid), { message: 'invalid_pdf' });
  }
});

test('LibreOffice converts only visible Excel sheets, rows and columns to escaped tables', {
  skip: !process.env.TEST_LIBREOFFICE,
}, async () => {
  const { content, images } = await convertExcelToHtml(fixture('activity-excel.xlsx'));

  assert.ok(content.startsWith('<div class="word-article"><div class="excel-article">'));
  assert.deepEqual(images, []);
  assert.match(content, /<h3>日程<\/h3>[\s\S]*<h3>持ち物<\/h3>/);
  assert.match(content, /夏キャンプ日程表/);
  assert.match(content, /colspan="\d+"/);
  assert.match(content, /background-color:#FFEB9C/i);
  assert.match(content, /テント設営 &lt;script&gt;/);
  assert.ok(!content.includes('NOTE_SECRET'));
  assert.doesNotMatch(content, /<script|目次|<center|<hr|data-sheets|sdval|sdnum|<a\b/i);
  for (const hidden of ['非表示シートの個人情報', '非表示行の秘密', '非表示列の電話番号', '090-0000-0000']) {
    assert.ok(!content.includes(hidden), hidden);
  }
});

test('LibreOffice renders each PDF page as an image with collapsible extracted text', {
  skip: !process.env.TEST_LIBREOFFICE,
}, async () => {
  const { content, images } = await convertPdfToHtml(fixture('activity-pdf.pdf'));

  assert.ok(content.startsWith('<div class="word-article"><div class="pdf-article">'));
  assert.equal(images.length, 2);
  for (const image of images) {
    assert.equal(image.kind, 'pdf-page');
    assert.equal(Buffer.from(image.data, 'base64').subarray(1, 4).toString(), 'PNG');
  }
  assert.equal(content.match(/<figure class="pdf-page">/g).length, 2);
  assert.match(content, /data-image-index="0"[\s\S]*data-image-index="1"/);
  assert.match(content, /<details class="pdf-text"><summary>テキストで読む<\/summary>/);
  assert.match(content, /<h4>1ページ<\/h4><p>[\s\S]*夏キャンプ報告[\s\S]*郡上八幡[\s\S]*<h4>2ページ<\/h4><p>[\s\S]*ご協力ありがとうございました/);
});

// FODT を soffice で PDF にする（pages ページ分、必要なら開く用パスワード付き）
function buildPdf(pages, password) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tajimi-pdf-test-'));
  try {
    const paragraphs = Array.from({ length: pages }, (_, i) => '<text:p text:style-name="P2">ページ' + (i + 1) + '</text:p>').join('');
    fs.writeFileSync(path.join(directory, 'doc.fodt'), '<?xml version="1.0" encoding="UTF-8"?>'
      + '<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"'
      + ' xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"'
      + ' office:version="1.3" office:mimetype="application/vnd.oasis.opendocument.text"><office:automatic-styles>'
      + '<style:style style:name="P2" style:family="paragraph"><style:paragraph-properties fo:break-before="page"/></style:style>'
      + '</office:automatic-styles><office:body><office:text>' + paragraphs + '</office:text></office:body></office:document>');
    const filter = password
      ? 'pdf:writer_pdf_Export:{"EncryptFile":{"type":"boolean","value":"true"},"DocumentOpenPassword":{"type":"string","value":"' + password + '"}}'
      : 'pdf';
    execFileSync(process.platform === 'win32' ? 'soffice.com' : 'soffice', [
      '-env:UserInstallation=' + require('node:url').pathToFileURL(path.join(directory, 'profile')).href,
      '--headless', '--convert-to', filter, '--outdir', directory, path.join(directory, 'doc.fodt'),
    ], { timeout: 60000, windowsHide: true });
    return fs.readFileSync(path.join(directory, 'doc.pdf'), 'base64');
  } finally {
    fs.rmSync(directory, { force: true, recursive: true });
  }
}

test('PDF import rejects documents over 20 pages and encrypted documents', {
  skip: !process.env.TEST_LIBREOFFICE,
}, async () => {
  await assert.rejects(convertPdfToHtml(buildPdf(21)), { message: 'pdf_too_many_pages' });
  await assert.rejects(convertPdfToHtml(buildPdf(1, 'secret')), { message: 'pdf_encrypted' });
});

test('PDF page images are rendered with a bounded size', {
  skip: !process.env.TEST_LIBREOFFICE,
}, async () => {
  const { images } = await convertPdfToHtml(fixture('activity-pdf.pdf'));
  const png = Buffer.from(images[0].data, 'base64');
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  assert.ok(width >= 1100 && Math.max(width, height) <= 1600, width + 'x' + height);
});
