const ALLOWED_TAGS = new Set([
  'a', 'blockquote', 'br', 'code', 'div', 'em', 'figcaption', 'figure',
  'h2', 'h3', 'h4', 'hr', 'img', 'li', 'ol', 'p', 'pre', 'span',
  'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul',
]);

const VOID_TAGS = new Set(['br', 'hr', 'img']);
const BLOCKED_CONTENT_TAGS = new Set([
  'applet', 'embed', 'iframe', 'math', 'noscript', 'object', 'script',
  'style', 'svg', 'template',
]);

const ALLOWED_ATTRIBUTES = {
  a: new Set(['href', 'name', 'target']),
  img: new Set(['src', 'alt', 'title', 'width', 'height', 'loading', 'data-image-index']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function stripBlockedSections(value) {
  return String(value).replace(
    /<(script|style|iframe|object|embed|applet|noscript|svg|math|template)\b[^>]*>[\s\S]*?<\/\1>/gim,
    ' '
  );
}

function tokenizeHtml(html) {
  return String(html).match(/<\/?[^>]+>|[^<]+/g) || [];
}

function parseTag(token) {
  const match = token.match(/^<\s*(\/)?\s*([a-zA-Z0-9:-]+)([\s\S]*?)>$/);
  if (!match) return null;

  return {
    isClosing: Boolean(match[1]),
    tagName: match[2].toLowerCase(),
    rawAttributes: match[3] || '',
    isSelfClosing: /\/\s*>$/.test(token),
  };
}

function getAttributes(rawAttributes) {
  const attributes = [];
  const attributePattern = /([^\s"'=<>`/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;

  while ((match = attributePattern.exec(rawAttributes)) !== null) {
    attributes.push({
      name: match[1].toLowerCase(),
      value: match[2] ?? match[3] ?? match[4] ?? '',
    });
  }

  return attributes;
}

function isSafeUrl(value, allowedSchemes, { allowDataImage = false } = {}) {
  const normalized = String(value || '').trim();
  if (!normalized) return false;

  if (normalized.startsWith('#')
    || normalized.startsWith('/')
    || normalized.startsWith('./')
    || normalized.startsWith('../')) {
    return true;
  }

  if (allowDataImage && /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(normalized)) {
    return true;
  }

  const schemeMatch = normalized.match(/^([a-z0-9+.-]+):/i);
  if (!schemeMatch) return true;

  return allowedSchemes.has(schemeMatch[1].toLowerCase());
}

function sanitizeAttribute(tagName, attribute) {
  const allowedAttributes = ALLOWED_ATTRIBUTES[tagName] || new Set();
  if (!allowedAttributes.has(attribute.name)) return null;
  if (attribute.name.startsWith('on')) return null;

  const value = String(attribute.value || '').trim();

  switch (attribute.name) {
    case 'href':
      if (!isSafeUrl(value, new Set(['http', 'https', 'mailto']))) return null;
      return `${attribute.name}="${escapeAttribute(value)}"`;
    case 'src':
      if (!isSafeUrl(value, new Set(['http', 'https']), { allowDataImage: tagName === 'img' })) {
        return null;
      }
      return `${attribute.name}="${escapeAttribute(value)}"`;
    case 'target':
      return value === '_blank' ? 'target="_blank"' : null;
    case 'data-image-index':
      return /^\d+$/.test(value) ? `data-image-index="${value}"` : null;
    case 'width':
    case 'height':
    case 'colspan':
    case 'rowspan':
      return /^\d{1,4}$/.test(value) ? `${attribute.name}="${value}"` : null;
    case 'loading':
      return /^(lazy|eager)$/i.test(value) ? `loading="${value.toLowerCase()}"` : null;
    case 'alt':
    case 'title':
    case 'name':
      return `${attribute.name}="${escapeAttribute(value)}"`;
    default:
      return null;
  }
}

const WORD_TAGS = {
  b: 'strong', i: 'em', font: 'span', h1: 'h2', h5: 'h4', h6: 'h4',
  u: 'u', s: 's', sub: 'sub', sup: 'sup', caption: 'caption', tfoot: 'tfoot',
  col: 'col', colgroup: 'colgroup',
};

const WORD_COLOR = /^(?:#[a-f0-9]{3}(?:[a-f0-9]{3})?|[a-z]{3,20})$/i;
const WORD_SIZE = /^(?:0|\d{1,4}(?:\.\d{1,2})?(?:px|pt|%|cm|mm|in))$/i;
const WORD_PADDING = /^(?:0|\d{1,3}(?:\.\d{1,2})?(?:px|pt|%|cm|mm|in))(?:\s+(?:0|\d{1,3}(?:\.\d{1,2})?(?:px|pt|%|cm|mm|in))){0,3}$/i;
const WORD_BORDER = /^(?:0|none|(?:\d{1,2}(?:\.\d{1,2})?(?:px|pt)\s+)?(?:solid|dotted|dashed|double)(?:\s+#[a-f0-9]{3}(?:[a-f0-9]{3})?)?)$/i;
const WORD_STYLES = {
  color: WORD_COLOR,
  'background-color': WORD_COLOR,
  'font-size': WORD_SIZE,
  'font-family': /^[\p{L}\p{N} ,'"_.-]{1,120}$/u,
  'font-weight': /^(?:normal|bold|[1-9]00)$/,
  'font-style': /^(?:normal|italic|oblique)$/,
  'text-decoration': /^(?:none|underline|line-through|underline line-through)$/,
  'text-align': /^(?:left|right|center|justify)$/,
  'vertical-align': /^(?:top|middle|bottom|baseline|sub|super)$/,
  'line-height': /^(?:normal|\d(?:\.\d{1,2})?|\d{1,3}(?:\.\d{1,2})?(?:px|pt|%))$/,
  width: WORD_SIZE,
  height: WORD_SIZE,
  'margin-top': WORD_SIZE,
  'margin-bottom': WORD_SIZE,
  'margin-left': WORD_SIZE,
  'margin-right': WORD_SIZE,
  'text-indent': WORD_SIZE,
  padding: WORD_PADDING,
  border: WORD_BORDER,
  'border-top': WORD_BORDER,
  'border-right': WORD_BORDER,
  'border-bottom': WORD_BORDER,
  'border-left': WORD_BORDER,
  'border-collapse': /^(?:collapse|separate)$/,
  'list-style-type': /^(?:disc|circle|square|decimal|lower-alpha|upper-alpha|lower-roman|upper-roman)$/,
  float: /^(?:left|right|none)$/,
};

function wordStyles(tag, attributes, css) {
  const styles = new Map();
  const add = (property, value) => {
    if (Object.hasOwn(WORD_STYLES, property) && WORD_STYLES[property].test(value)) {
      styles.set(property, value);
    }
  };
  const read = (declarations) => {
    for (const declaration of declarations.split(';')) {
      const delimiter = declaration.indexOf(':');
      if (delimiter === -1) continue;
      add(declaration.slice(0, delimiter).trim().toLowerCase(), declaration.slice(delimiter + 1).trim());
    }
  };

  read(css.get(tag) || '');
  for (const name of (attributes.class || '').toLowerCase().split(/\s+/)) {
    read(css.get(tag + '.' + name) || '');
  }
  add('text-align', attributes.align || '');
  add('vertical-align', attributes.valign || '');
  add('background-color', attributes.bgcolor || '');
  if (tag === 'img') add('float', attributes.align || '');
  if (['table', 'td', 'th', 'col'].includes(tag)) {
    const width = attributes.width || '';
    add('width', /^\d{1,4}$/.test(width) ? width + 'px' : width);
  }
  if (tag === 'table') {
    add('border-collapse', 'collapse');
  }
  if (tag === 'font') {
    add('color', attributes.color || '');
    add('font-family', attributes.face || '');
    const sizes = ['8pt', '10pt', '12pt', '14pt', '18pt', '24pt', '36pt'];
    add('font-size', sizes[Number(attributes.size) - 1] || '');
  }

  read(attributes.style || '');

  if (tag === 'img') styles.delete('height');
  return [...styles].map(([property, value]) => property + ':' + value).join(';');
}

function sanitizeHtml(html, { wordImage, wordCss } = {}) {
  if (!html) return '';

  const output = [];
  const blockedStack = [];

  const tokens = wordImage
    ? String(html).match(/<!--[\s\S]*?-->|<\/?[a-z][^<>"']*(?:(?:"[^"]*"|'[^']*')[^<>"']*)*>|[^<]+|</gi) || []
    : tokenizeHtml(html);

  for (const token of tokens) {
    if (wordImage && token.startsWith('<!--')) continue;
    const parsedTag = parseTag(token);

    if (!parsedTag) {
      if (blockedStack.length === 0) {
        let text = escapeHtml(token);
        if (wordImage) text = text.replace(/&amp;((?:#[\dxXa-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);)/g, '&$1');
        output.push(text);
      }
      continue;
    }

    if (BLOCKED_CONTENT_TAGS.has(parsedTag.tagName)) {
      if (parsedTag.isClosing) {
        const index = blockedStack.lastIndexOf(parsedTag.tagName);
        if (index !== -1) {
          blockedStack.splice(index, 1);
        }
      } else if (!parsedTag.isSelfClosing) {
        blockedStack.push(parsedTag.tagName);
      }
      continue;
    }

    if (blockedStack.length > 0) {
      continue;
    }

    let tagName = parsedTag.tagName;
    if (wordImage && Object.hasOwn(WORD_TAGS, tagName)) tagName = WORD_TAGS[tagName];
    if (!ALLOWED_TAGS.has(tagName) && (!wordImage || !Object.hasOwn(WORD_TAGS, tagName))) {
      continue;
    }

    if (parsedTag.isClosing) {
      if (!VOID_TAGS.has(tagName) && tagName !== 'col') {
        output.push(`</${tagName}>`);
        if (wordImage && tagName === 'table') output.push('</div>');
      }
      continue;
    }

    const sanitizedAttributes = [];
    let hasBlankTarget = false;

    const attributes = getAttributes(parsedTag.rawAttributes);
    if (wordImage) {
      const values = Object.fromEntries(attributes.map(({ name, value }) => [name, value]));
      if (tagName === 'img') {
        if (!values.src) continue;
        sanitizedAttributes.push('data-image-index="' + wordImage(values.src) + '"');
      }
      const style = wordStyles(parsedTag.tagName, values, wordCss);
      if (style) sanitizedAttributes.push('style="' + escapeAttribute(style) + '"');
      if (tagName === 'ol' && /^\d{1,5}$/.test(values.start || '')) {
        sanitizedAttributes.push('start="' + values.start + '"');
      }
    }

    for (const attribute of attributes) {
      if (wordImage && (attribute.name === 'src' || attribute.name === 'data-image-index')) continue;
      if (wordImage && attribute.name === 'href') {
        attribute.value = attribute.value.replace(/&amp;/gi, '&');
        if (!/^(?:https?:\/\/|mailto:|#)/i.test(attribute.value)) continue;
      }
      if (attribute.name === 'target' && attribute.value.trim() === '_blank') {
        hasBlankTarget = true;
      }
      const sanitizedAttribute = sanitizeAttribute(tagName, attribute);
      if (sanitizedAttribute) {
        sanitizedAttributes.push(sanitizedAttribute);
      }
    }

    if (tagName === 'a' && hasBlankTarget) {
      sanitizedAttributes.push('rel="noopener noreferrer"');
    }

    if (wordImage && tagName === 'table') output.push('<div class="word-table">');
    output.push(
      sanitizedAttributes.length > 0
        ? `<${tagName} ${sanitizedAttributes.join(' ')}>`
        : `<${tagName}>`
    );
  }

  return output.join('').trim();
}

function sanitizePlainText(value) {
  if (!value) return '';

  return stripBlockedSections(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizePayload(payload, fields = ['title', 'content', 'category', 'unit']) {
  const sanitized = { ...payload };
  for (const field of fields) {
    if (!sanitized[field] || typeof sanitized[field] !== 'string') continue;
    sanitized[field] = field === 'content'
      ? sanitizeHtml(sanitized[field])
      : sanitizePlainText(sanitized[field]);
  }
  return sanitized;
}

module.exports = {
  escapeHtml,
  sanitizeHtml,
  sanitizePlainText,
  sanitizePayload,
};
