const path = require('node:path');
const { sanitizeHtml } = require('./simple-sanitizer');
const {
  WordImportError, MAX_IMAGE_BYTES, decodeOoxml, readOutput, withTempDirectory, convertWithSoffice,
} = require('./document-import');

async function convertWordToHtml(base64) {
  const document = decodeOoxml(base64, 'docx', 'word/document.xml');

  return withTempDirectory('docx', async (directory) => {
    const exported = await convertWithSoffice(directory, document, {
      kind: 'docx',
      extension: 'docx',
      infilter: 'MS Word 2007 XML',
      filter: 'html:HTML (StarWriter):UTF8',
    });
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
        data = await readOutput(path.join(directory, src), remainingBytes, 'docx');
      } else {
        throw new WordImportError('unsupported_docx_image');
      }
      remainingBytes -= data.length;
      if (remainingBytes < 0 || data.length === 0) throw new WordImportError('docx_output_too_large');
      images.push({ data: data.toString('base64') });
    }

    return { content: '<div class="word-article">' + content + '</div>', images };
  });
}

module.exports = { convertWordToHtml, WordImportError };
