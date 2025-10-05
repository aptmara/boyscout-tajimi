function formatDateJP(dateString) {
  const d = new Date(dateString);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
}

function pickFirstImage(imageUrls, fallbackText, fallbackColor = '4A934A', textColor = 'FFFFFF') {
  if (Array.isArray(imageUrls) && imageUrls.length && typeof imageUrls[0] === 'string' && imageUrls[0].trim()) {
    return imageUrls[0];
  }
  const text = encodeURIComponent((fallbackText || '活動').slice(0, 16));
  return `https://placehold.co/600x400/${fallbackColor}/${textColor}?text=${text}`;
}

function buildSummary(raw, maxLength = 120) {
  const plain = String(raw || '').replace(/<[^>]+>/g, '').trim();
  if (!plain) return '';
  return plain.length > maxLength ? plain.slice(0, maxLength).trim() + '…' : plain;
}

module.exports = {
  formatDateJP,
  pickFirstImage,
  buildSummary,
};