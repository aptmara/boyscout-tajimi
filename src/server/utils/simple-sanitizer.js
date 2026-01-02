/**
 * Simple HTML Sanitizer
 * Removes dangerous tags and attributes to prevent basic XSS.
 * Intended for use where external libraries like 'sanitize-html' cannot be added.
 */

function sanitizeHtml(html) {
    if (!html) return '';
    let clean = String(html);

    // 1. Remove dangerous tags completely (content included)
    // script, style, iframe, object, embed, applet
    clean = clean.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");
    clean = clean.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "");
    clean = clean.replace(/<iframe\b[^>]*>([\s\S]*?)<\/iframe>/gim, "");
    clean = clean.replace(/<object\b[^>]*>([\s\S]*?)<\/object>/gim, "");
    clean = clean.replace(/<embed\b[^>]*>([\s\S]*?)<\/embed>/gim, "");
    clean = clean.replace(/<applet\b[^>]*>([\s\S]*?)<\/applet>/gim, "");

    // 2. Remove event handlers from all tags (e.g., onclick, onload, onerror)
    // Matches on*="value" or on*='value' or on*=value
    clean = clean.replace(/ on\w+=(".*?"|'.*?'|\S*)/gim, "");

    // 3. Remove javascript: URIs in href or src
    clean = clean.replace(/(href|src)=["']javascript:[^"']*["']/gim, '$1="#"');
    clean = clean.replace(/(href|src)=javascript:[^ >]*/gim, '$1="#"');

    return clean;
}

/**
 * Sanitize common scalar fields in a payload
 */
function sanitizePayload(payload, fields = ['title', 'content', 'category', 'unit']) {
    const sanitized = { ...payload };
    for (const field of fields) {
        if (sanitized[field] && typeof sanitized[field] === 'string') {
            sanitized[field] = sanitizeHtml(sanitized[field]);
        }
    }
    return sanitized;
}

module.exports = {
    sanitizeHtml,
    sanitizePayload
};
