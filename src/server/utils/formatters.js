function normalizeSlug(s) {
  return String(s || '').trim().toLowerCase();
}

function normalizeTags(input) {
  if (Array.isArray(input)) {
    return input.map(normalizeSlug).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input.split(/[\s,]+/).map(normalizeSlug).filter(Boolean);
  }
  return [];
}

module.exports = {
    normalizeSlug,
    normalizeTags,
};