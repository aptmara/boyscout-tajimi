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

function sanitizeHtml(html) {
  if (!html) return '';

  const output = [];
  const blockedStack = [];

  for (const token of tokenizeHtml(html)) {
    const parsedTag = parseTag(token);

    if (!parsedTag) {
      if (blockedStack.length === 0) {
        output.push(escapeHtml(token));
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

    if (!ALLOWED_TAGS.has(parsedTag.tagName)) {
      continue;
    }

    if (parsedTag.isClosing) {
      if (!VOID_TAGS.has(parsedTag.tagName)) {
        output.push(`</${parsedTag.tagName}>`);
      }
      continue;
    }

    const sanitizedAttributes = [];
    let hasBlankTarget = false;

    for (const attribute of getAttributes(parsedTag.rawAttributes)) {
      if (attribute.name === 'target' && attribute.value.trim() === '_blank') {
        hasBlankTarget = true;
      }
      const sanitizedAttribute = sanitizeAttribute(parsedTag.tagName, attribute);
      if (sanitizedAttribute) {
        sanitizedAttributes.push(sanitizedAttribute);
      }
    }

    if (parsedTag.tagName === 'a' && hasBlankTarget) {
      sanitizedAttributes.push('rel="noopener noreferrer"');
    }

    output.push(
      sanitizedAttributes.length > 0
        ? `<${parsedTag.tagName} ${sanitizedAttributes.join(' ')}>`
        : `<${parsedTag.tagName}>`
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
  sanitizeHtml,
  sanitizePlainText,
  sanitizePayload,
};
