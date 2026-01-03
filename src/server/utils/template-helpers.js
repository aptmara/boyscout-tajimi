function formatDateJP(dateString) {
  const d = new Date(dateString);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
}

function pickFirstImage(imageUrls, fallbackText, fallbackColor = '4A934A', textColor = 'FFFFFF') {
  if (Array.isArray(imageUrls) && imageUrls.length && typeof imageUrls[0] === 'string' && imageUrls[0].trim()) {
    return imageUrls[0];
  }
  // 画像がない場合はnullを返し、テンプレート側でプレースホルダを表示する
  // 外部サービス(placehold.co)への依存を削減
  return null;
}

function buildSummary(raw, maxLength = 120) {
  const plain = String(raw || '').replace(/<[^>]+>/g, '').trim();
  if (!plain) return '';
  return plain.length > maxLength ? plain.slice(0, maxLength).trim() + '…' : plain;
}

// Icons
const ICONS = {
  megaphone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v2a2 2 0 0 0 2 2h1l3 4V7l-3 4H5a2 2 0 0 0-2 2Z"></path><path d="M15 9l6-3v12l-6-3"></path></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 19V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12"></path><path d="M16 3v4"></path><path d="M8 3v4"></path><path d="M3 11h18"></path><path d="M5 16h.01"></path><path d="M9 16h.01"></path><path d="M13 16h.01"></path><path d="M17 16h.01"></path></svg>',
  compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36Z"></path></svg>',
  camp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19h18L12 5 3 19z"></path><path d="M12 5v14"></path></svg>'
};

function resolveNewsAccentTheme(category) {
  const base = {
    color: '#0ea5e9',
    icon: ICONS.megaphone,
    typeLabel: 'ニュース',
    iconBg: 'rgba(14, 165, 233, 0.16)',
    badgeBg: 'rgba(191, 219, 254, 0.7)',
    badgeColor: '#1d4ed8',
    tagBg: 'rgba(191, 219, 254, 0.6)',
    tagColor: '#1d4ed8',
    tagActiveBg: 'rgba(30, 63, 175, 0.2)',
    tagActiveColor: '#1d4ed8',
    typeColor: '#0369a1'
  };
  const cat = String(category || '').toLowerCase();
  if (/イベント|集会|活動報告/.test(cat)) {
    return { ...base, color: '#16a34a', icon: ICONS.compass, typeLabel: '活動・イベント', iconBg: 'rgba(34, 197, 94, 0.16)', badgeBg: 'rgba(187, 247, 208, 0.7)', badgeColor: '#166534' };
  }
  if (/募集|参加者/.test(cat)) {
    return { ...base, color: '#f97316', icon: ICONS.megaphone, typeLabel: '募集', iconBg: 'rgba(249, 115, 22, 0.18)', badgeBg: 'rgba(254, 215, 170, 0.7)', badgeColor: '#9a3412' };
  }
  if (/報告|メディア|広報/.test(cat)) {
    return { ...base, color: '#9333ea', icon: ICONS.calendar, typeLabel: '広報', iconBg: 'rgba(221, 214, 254, 0.2)', badgeBg: 'rgba(233, 213, 255, 0.75)', badgeColor: '#7520ea' };
  }
  return base;
}

function resolveActivityAccentTheme(category) {
  // Currently simple theme for all activities
  return {
    color: '#16a34a',
    icon: ICONS.camp,
    typeLabel: '活動報告',
    iconBg: 'rgba(16, 185, 129, 0.16)',
    badgeBg: 'rgba(187, 247, 208, 0.7)',
    badgeColor: '#14532d',
    tagBg: 'rgba(187, 247, 208, 0.65)',
    tagColor: '#166534',
    tagActiveBg: 'rgba(16, 185, 129, 0.25)',
    tagActiveColor: '#14532d',
    typeColor: '#0f172a'
  };
}

// Unit Labels
const UNIT_LABELS = {
  beaver: 'ビーバー隊',
  cub: 'カブ隊',
  boy: 'ボーイ隊',
  venture: 'ベンチャー隊',
  rover: 'ローバー隊',
  all: '団全体'
};

function formatUnitLabel(unitSlug) {
  if (!unitSlug) return '';
  // カンマ区切りの場合もあるので対応
  return unitSlug.split(',')
    .map(slug => UNIT_LABELS[slug.trim()] || slug)
    .join('・');
}

module.exports = {
  formatDateJP,
  pickFirstImage,
  buildSummary,
  resolveNewsAccentTheme,
  resolveActivityAccentTheme,
  formatUnitLabel
};