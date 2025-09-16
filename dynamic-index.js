// dynamic-index.js
// トップページの「活動ハイライト」「お知らせ」を最新データで動的表示

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

function pickFirstImage(imageUrls, fallbackText){
  if (Array.isArray(imageUrls) && imageUrls.length && typeof imageUrls[0] === 'string' && imageUrls[0].trim()) {
    return imageUrls[0];
  }
  const text = encodeURIComponent((fallbackText || '活動').slice(0, 16));
  return `https://placehold.co/600x400/4A934A/FFFFFF?text=${text}`;
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
      grid.innerHTML = '<p class="col-span-full text-center text-gray-500">活動がまだありません</p>';
      return;
    }
    const html = items.map(item => {
      const img = pickFirstImage(item.image_urls, item.category || item.title || '活動');
      const dateStr = item.activity_date ? formatDateJP(item.activity_date) : (item.created_at ? formatDateJP(item.created_at) : '');
      const detailUrl = `activity-detail-placeholder.html?id=${item.id}`;
      const summary = String(item.content || '').replace(/<[^>]+>/g, '').slice(0, 120) + (item.content && item.content.length > 120 ? '…' : '');
      return `
      <div class="bg-white rounded-xl shadow-xl overflow-hidden card-hover-effect group">
        <div class="relative">
          <img src="${img}" alt="${escapeHTML(item.title || '')}" class="w-full h-60 object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy">
          <div class="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300"></div>
        </div>
        <div class="p-6">
          ${dateStr ? `<p class="text-sm text-gray-500 mb-2">${dateStr}</p>` : ''}
          <h3 class="text-2xl font-semibold mb-3">
            <a href="${detailUrl}" class="hover:text-green-700 transition-colors">${escapeHTML(item.title || '')}</a>
          </h3>
          <p class="text-gray-700 mb-4 leading-relaxed line-clamp-3">${escapeHTML(summary)}</p>
          <a href="${detailUrl}" class="inline-block text-green-600 hover:text-green-800 font-semibold transition-colors duration-300 group">活動報告を見る <span class="transition-transform duration-300 inline-block group-hover:translate-x-1">&rarr;</span></a>
        </div>
      </div>`;
    }).join('');
    grid.innerHTML = html;
  } catch (e) {
    console.error('loadIndexActivities error:', e);
    grid.innerHTML = '<p class="col-span-full text-center text-red-500">活動の読み込みに失敗しました</p>';
  }
}

async function loadIndexNews(){
  const list = document.getElementById('index-news-list');
  if (!list) return;
  try {
    list.innerHTML = '';
    const res = await fetch('/api/news?limit=3');
    if (!res.ok) throw new Error('failed');
    const items = await res.json();
    if (!Array.isArray(items) || !items.length){
      list.innerHTML = '<p class="text-center text-gray-500">お知らせはまだありません</p>';
      return;
    }
    const html = items.map(n => {
      const detailUrl = `news-detail-placeholder.html?id=${n.id}`;
      const summary = String(n.content || '').replace(/<[^>]+>/g, '').slice(0, 100) + (n.content && n.content.length > 100 ? '…' : '');
      const cat = n.category ? `<span class="bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full self-start sm:self-center">${escapeHTML(n.category)}</span>` : '';
      const dateStr = n.created_at ? formatDateJP(n.created_at) : '';
      return `
      <article class="bg-gray-50 p-6 sm:p-8 rounded-xl shadow-lg card-hover-effect border-l-4 border-blue-500">
        <div class="flex flex-col sm:flex-row justify-between sm:items-center mb-3">
          <p class="text-sm text-gray-500 mb-1 sm:mb-0">${dateStr}</p>
          ${cat}
        </div>
        <h3 class="text-xl md:text-2xl font-semibold text-gray-800 mb-3 hover:text-blue-600 transition-colors duration-300">
          <a href="${detailUrl}">${escapeHTML(n.title || '')}</a>
        </h3>
        <p class="text-gray-700 leading-relaxed line-clamp-3">${escapeHTML(summary)}</p>
      </article>`;
    }).join('');
    list.innerHTML = html;
  } catch(e){
    console.error('loadIndexNews error:', e);
    list.innerHTML = '<p class="text-center text-red-500">お知らせの読み込みに失敗しました</p>';
  }
}

