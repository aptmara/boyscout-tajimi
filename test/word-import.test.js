const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { sanitizeHtml } = require('../src/server/utils/simple-sanitizer');
const { convertWordToHtml } = require('../src/server/utils/word-to-html');

test('Word HTML keeps supported styles and drops active content and arbitrary CSS', () => {
  const input = '<h1 class="cjk" onclick="test()">題 &amp; 記事</h1>'
    + '<p style="font-size:18pt;color:#125599;position:fixed;background-image:url(x)">'
    + '<img src="activity_html_123.png" data-image-index="9" width="96" onerror="test()"></p>'
    + '<script>test()</script><a href="file:///test">link</a>';
  const html = sanitizeHtml(input, {
    wordCss: new Map([['h1.cjk', 'font-weight:bold;color:#365f91']]),
    wordImage(src) {
      assert.equal(src, 'activity_html_123.png');
      return 0;
    },
  });

  assert.equal(html, '<h2 style="font-weight:bold;color:#365f91">題 &amp; 記事</h2>'
    + '<p style="font-size:18pt;color:#125599"><img data-image-index="0" width="96"></p><a>link</a>');
  assert.equal(sanitizeHtml('<p style="font-size:18pt">既存本文</p>'), '<p>既存本文</p>');
});

test('Word import rejects malformed uploads before invoking LibreOffice', async () => {
  for (const invalid of [null, 'garbage', Buffer.alloc(22).toString('base64')]) {
    await assert.rejects(convertWordToHtml(invalid), { message: 'invalid_docx' });
  }
});

test('LibreOffice retains Japanese text, merged cells, styles and the positions of both images', {
  skip: !process.env.TEST_LIBREOFFICE,
}, async () => {
  const docx = fs.readFileSync(path.join(__dirname, 'activity-word.docx'), 'base64');
  const { content, images } = await convertWordToHtml(docx);

  assert.match(content, /活動報告[\s\S]*&amp;[\s\S]*見出し/);
  assert.match(content, /color:#125599[\s\S]*font-size:18pt[\s\S]*色付き文字/);
  assert.match(content, /text-align:center/);
  assert.match(content, /<ul>[\s\S]*箇条書き/);
  assert.match(content, /border:1px solid #000000[\s\S]*colspan="2"[\s\S]*結合セル/);
  assert.match(content, /data-image-index="0"[\s\S]*<table\b[\s\S]*data-image-index="1"[\s\S]*<\/table>[\s\S]*画像の後/);
  assert.equal(images.length, 2);
  assert.notEqual(images[0].data, images[1].data);
});
