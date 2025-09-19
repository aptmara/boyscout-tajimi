// dynamic-index.js
// トップページの「最近の活動」「お知らせ」を最新データで描画

document.addEventListener('DOMContentLoaded', () => {
  try { loadIndexActivities(); } catch(e){ console.error(e); }
  try { loadIndexNews(); } catch(e){ console.error(e); }
});

function escapeHTML(str){
  if (typeof str !== 'string') return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function formatDateJP(dateString){
  const d = new Date(dateString);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric' });
}

function pickFirstImage(imageUrls, fallbackText, fallbackColor = '4A934A', textColor = 'FFFFFF'){
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

function buildHighlightCard({ imageUrl, altText, dateText, badges = [], title, detailUrl, summary, ctaText = '詳細を見る' }) {
  const safeTitle = escapeHTML(title || '');
  const safeAlt = escapeHTML(altText || title || '');
  const safeSummary = escapeHTML(summary || '');
  const metaLeft = dateText ? `<p class="text-sm text-gray-500">${escapeHTML(dateText)}</p>` : '';
  const badgeHtml = Array.isArray(badges) && badges.length
    ? `<div class="flex flex-wrap gap-2">${badges.map(b => `<span class="${b.className || 'bg-green-600 text-white text-xs font-semibold px-3 py-1 rounded-full'}">${escapeHTML(b.text || '')}</span>`).join('')}</div>`
    : '';
  let metaHtml = '';
  if (metaLeft && badgeHtml) {
    metaHtml = `<div class="flex items-center justify-between gap-3 mb-2">${metaLeft}${badgeHtml}</div>`;
  } else if (metaLeft || badgeHtml) {
    metaHtml = `<div class="mb-2">${metaLeft || badgeHtml}</div>`;
  }
  return `
      <div class="bg-white rounded-xl shadow-xl overflow-hidden card-hover-effect group">
        <div class="relative">
          <img src="${imageUrl}" alt="${safeAlt}" class="w-full h-60 object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy">
          <div class="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300"></div>
        </div>
        <div class="p-6">
          ${metaHtml}
          <h3 class="text-2xl font-semibold mb-3">
            <a href="${detailUrl}" class="hover:text-green-700 transition-colors">${safeTitle}</a>
          </h3>
          <p class="text-gray-700 mb-4 leading-relaxed line-clamp-3">${safeSummary}</p>
          <a href="${detailUrl}" class="inline-block text-green-600 hover:text-green-800 font-semibold transition-colors duration-300 group">${escapeHTML(ctaText)} <span class="transition-transform duration-300 inline-block group-hover:translate-x-1">&rarr;</span></a>
        </div>
      </div>`;
}

async function loadIndexActivities(){
  const grid = document.getElementById('index-activities');
  if (!grid) return;
  try {
    grid.innerHTML = '';
    const res = await fetch('/api/activities?limit=3');
    if (!res.ok) throw new Error('failed');
    const items = await res.json();
    if (!Array.isArray(items) || !items.length) {
      grid.innerHTML = '<p class="col-span-full text-center text-gray-500">活動記録はまだ登録されていません</p>';
      return;
    }
    const html = items.map(item => {
      const img = pickFirstImage(item.image_urls, item.category || item.title || '活動');
      const dateStr = item.activity_date ? formatDateJP(item.activity_date) : (item.created_at ? formatDateJP(item.created_at) : '');
      const detailUrl = `activity-detail-placeholder.html?id=${item.id}`;
      const summary = buildSummary(item.content, 120);
      return buildHighlightCard({
        imageUrl: img,
        altText: item.title,
        dateText: dateStr,
        title: item.title,
        detailUrl,
        summary,
        ctaText: '詳細を見る'
      });
    }).join('');
    grid.innerHTML = html;
  } catch (e) {
    console.error('loadIndexActivities error:', e);
    grid.innerHTML = '<p class="col-span-full text-center text-red-500">情報の読み込みに失敗しました</p>';
  }
}

async function loadIndexNews(){
  const grid = document.getElementById('index-news-list');
  if (!grid) return;
  try {
    grid.innerHTML = '';
    const res = await fetch('/api/news?limit=3');
    if (!res.ok) throw new Error('failed');
    const items = await res.json();
    if (!Array.isArray(items) || !items.length){
      grid.innerHTML = '<p class="col-span-full text-center text-gray-500">お知らせはまだ登録されていません</p>';
      return;
    }
    const html = items.map(n => {
      const detailUrl = `news-detail-placeholder.html?id=${n.id}`;
      const summary = buildSummary(n.content, 110);
      const dateStr = n.created_at ? formatDateJP(n.created_at) : '';
      const badges = [];
      if (n.category) badges.push({ text: n.category, className: 'bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full' });
      if (n.unit) badges.push({ text: n.unit, className: 'bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-green-200' });
      const img = pickFirstImage(n.image_urls, n.category || n.title || 'NEWS', '3B82F6');
      return buildHighlightCard({
        imageUrl: img,
        altText: n.title,
        dateText: dateStr,
        badges,
        title: n.title,
        detailUrl,
        summary,
        ctaText: '詳しく読む'
      });
    }).join('');
    grid.innerHTML = html;
  } catch(e){
    console.error('loadIndexNews error:', e);
    grid.innerHTML = '<p class="col-span-full text-center text-red-500">お知らせの読み込みに失敗しました</p>';
  }
}
