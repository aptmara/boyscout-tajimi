const sanitizeHtmlLib = require('sanitize-html');

const RICH_TEXT_OPTIONS = {
    allowedTags: [
        'a', 'blockquote', 'br', 'code', 'div', 'em', 'figcaption', 'figure',
        'h2', 'h3', 'h4', 'hr', 'img', 'li', 'ol', 'p', 'pre', 'span',
        'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul'
    ],
    allowedAttributes: {
        a: ['href', 'name', 'target', 'rel'],
        img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'data-image-index'],
        td: ['colspan', 'rowspan'],
        th: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
        img: ['http', 'https', 'data'],
    },
    disallowedTagsMode: 'discard',
    enforceHtmlBoundary: true,
    transformTags: {
        a: (tagName, attribs) => {
            const nextAttribs = { ...attribs };
            if (nextAttribs.target === '_blank') {
                nextAttribs.rel = 'noopener noreferrer';
            } else {
                delete nextAttribs.target;
                delete nextAttribs.rel;
            }
            return {
                tagName,
                attribs: nextAttribs,
            };
        },
    },
};

function sanitizeHtml(html) {
    if (!html) return '';
    return sanitizeHtmlLib(String(html), RICH_TEXT_OPTIONS).trim();
}

function sanitizePlainText(value) {
    if (!value) return '';
    return sanitizeHtmlLib(String(value), {
        allowedTags: [],
        allowedAttributes: {},
    }).trim();
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
    sanitizePayload
};
