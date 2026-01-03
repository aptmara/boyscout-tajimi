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

/**
 * 隊（unit）の複数選択を正規化
 * - カンマ区切り文字列または配列を受け付け
 * - 各値を小文字化して正規化
 * - 複数の場合はカンマ区切りで結合して返す
 * 
 * @param {string|string[]|null|undefined} input
 * @returns {string|null} - 正規化されたカンマ区切り文字列 or null
 */
function normalizeUnits(input) {
  if (!input) return null;

  let arr;
  if (Array.isArray(input)) {
    arr = input;
  } else if (typeof input === 'string') {
    arr = input.split(',');
  } else {
    return null;
  }

  const normalized = arr
    .map(s => String(s || '').trim().toLowerCase())
    .filter(Boolean);

  return normalized.length > 0 ? normalized.join(',') : null;
}

module.exports = {
  normalizeSlug,
  normalizeTags,
  normalizeUnits,
};
