// dynamic-activities.v2.js

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('activity-log-container')) {
    loadDynamicActivityList();
  }
  if (document.getElementById('activity-article-container')) {
    loadDynamicActivityDetail();
  }
});

function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function loadDynamicActivityList() {
  const container = document.getElementById('activity-log-container');
  if (!container) return;

  const pagination = document.getElementById('activity-pagination-container');
  const noResults = document.getElementById('no-activity-results');
  const ITEMS_PER_PAGE = 6;
  let currentPage = 1;
  let allItems = [];

  const fmtDate = (d) => new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

  const renderCard = (item) => {
    const summary = (item.content || '').replace(/<[^>]+>/g, '').substring(0, 120) + '...';
    const url = `activity-detail-placeholder.html?id=${item.id}`;
    const dateLabel = item.activity_date ? fmtDate(item.activity_date) : fmtDate(item.created_at);
    const tags = Array.isArray(item.tags) ? item.tags : [];
    const tagBadges = tags.slice(0, 6).map(t => `<span class="badge badge--tag mr-2 mb-2">#${escapeHTML(t)}</span>`).join('');
    const unitBadge = item.unit ? `<span class="badge badge--unit mr-2">${escapeHTML(item.unit)}</span>` : '';
    const catBadge  = item.category ? `<span class="badge badge--category">${escapeHTML(item.category)}</span>` : '';
    return `
      <div class="bg-white rounded-xl shadow-xl overflow-hidden card-hover-effect group">
        <div class="relative">
          <img src="https://placehold.co/600x360/4A934A/FFFFFF?text=${escapeHTML(item.category || '活動')}" alt="${escapeHTML(item.title || '')}" class="w-full h-56 object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy">
          <div class="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300"></div>
        </div>
        <div class="p-6">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2 flex-wrap">${unitBadge}${catBadge}</div>
            <p class="text-sm text-gray-500">${dateLabel}</p>
          </div>
          <h3 class="text-xl font-semibold mb-2">
            <a href="${url}" class="hover:text-green-700 transition-colors">${escapeHTML(item.title || '')}</a>
          </h3>
          <p class="text-gray-700 mb-3 leading-relaxed line-clamp-3">${escapeHTML(summary)}</p>
          <div class="flex flex-wrap mb-2">${tagBadges}</div>
          <a href="${url}" class="inline-block text-green-600 hover:text-green-800 font-semibold transition-colors duration-300 group" aria-label="続きを読む">
            <span class="transition-transform duration-300 inline-block group-hover:translate-x-1">&rarr;</span>
          </a>
        </div>
      </div>`;
  };

  const renderPagination = (total, page) => {
    if (!pagination) return;
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
    if (totalPages <= 1) { pagination.innerHTML = ''; return; }
    let html = '<ul class="inline-flex items-center -space-x-px shadow-sm rounded-md">';
    html += `<li><button data-page="${page - 1}" aria-label="前のページへ" class="activity-page-btn pagination-button ${page === 1 ? 'pagination-disabled' : ''}"><span class="sr-only">前へ</span><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20  20"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg></button></li>`;
    for (let i = 1; i <= totalPages; i++) {
      const isActive = i === page;
      html += `<li><button data-page="${i}" ${isActive ? 'aria-current="page"' : ''} aria-label="${i}ページ目へ" class="activity-page-btn pagination-button ${isActive ? 'pagination-active' : ''}">${i}</button></li>`;
    }
    html += `<li><button data-page="${page + 1}" aria-label="次のページへ" class="activity-page-btn pagination-button ${page === totalPages ? 'pagination-disabled' : ''}"><span class="sr-only">次へ</span><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path></svg></button></li>`;
    html += '</ul>';
    pagination.innerHTML = html;
    pagination.querySelectorAll('.activity-page-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const p = parseInt(e.currentTarget.dataset.page);
        const totalPages2 = Math.ceil(allItems.length / ITEMS_PER_PAGE);
        if (p && p !== currentPage && p > 0 && p <= totalPages2) {
          currentPage = p;
          draw(allItems);
          container.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  };

  const draw = (arr) => {
    container.innerHTML = '';
    if (!arr || arr.length === 0) {
      if (noResults) noResults.classList.remove('hidden');
      if (pagination) pagination.innerHTML = '';
      return;
    }
    if (noResults) noResults.classList.add('hidden');
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const items = arr.slice(start, start + ITEMS_PER_PAGE);
    container.innerHTML = items.map(renderCard).join('');
    renderPagination(arr.length, currentPage);
  };

  try {
    container.innerHTML = '<p class="text-center">読み込み中...</p>';
    const qs = window.location.search || '';
    const resp = await fetch(`/api/activities${qs}`);
    if (!resp.ok) throw new Error('Network response was not ok');
    allItems = await resp.json();
    draw(allItems);
  } catch (err) {
    console.error('Failed to fetch activities:', err);
    container.innerHTML = '<p class="text-center text-red-500">活動の読み込みに失敗しました。</p>';
  }

  // フィルタ（カテゴリ + 月）
  const btn = document.getElementById('activity-filter-button');
  const catSel = document.getElementById('activity-category-filter');
  const monthInp = document.getElementById('activity-date-filter');
  const btnText = document.getElementById('activity-filter-button-text');
  const spinner = document.getElementById('activity-filter-loading-spinner');
  if (btn && catSel && monthInp) {
    btn.addEventListener('click', () => {
      try {
        spinner?.classList?.remove('hidden');
        if (btnText) btnText.textContent = '絞り込み中...';
        const cat = (catSel.value || 'all').trim();
        const ym = (monthInp.value || '').trim(); // YYYY-MM
        currentPage = 1;
        const filtered = allItems.filter(n => {
          let ok = true;
          if (cat && cat !== 'all') ok = ok && String(n.category || '') === cat;
          if (ym) {
            const base = n.activity_date || n.created_at;
            const d = new Date(base);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            ok = ok && `${y}-${m}` === ym;
          }
          return ok;
        });
        draw(filtered);
      } finally {
        spinner?.classList?.add('hidden');
        if (btnText) btnText.textContent = '絞り込み';
      }
    });
  }
}

async function loadDynamicActivityDetail() {
  const container = document.getElementById('activity-article-container');
  if (!container) return;
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');
  if (!id) return;

  const pageTitle = document.getElementById('page-title');
  const notFound = document.getElementById('article-not-found');
  const fmtDate = (d) => new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

  try {
    container.innerHTML = '<p class="text-center">読み込み中...</p>';
    const resp = await fetch(`/api/activities/${encodeURIComponent(id)}`);
    if (!resp.ok) throw new Error('Network response was not ok');
    const a = await resp.json();
    if (!a || !a.id) throw new Error('Not found');
    if (pageTitle) pageTitle.textContent = a.title || '';
    const tags = Array.isArray(a.tags) ? a.tags : [];
    const tagBadges = tags.slice(0, 12).map(t => `<span class="badge badge--tag mr-2 mb-2">#${escapeHTML(t)}</span>`).join('');
    const unitBadge = a.unit ? `<span class="badge badge--unit mr-2">${escapeHTML(a.unit)}</span>` : '';
    const catBadge  = a.category ? `<span class="badge badge--category">${escapeHTML(a.category)}</span>` : '';
    const dateLabel = a.activity_date ? fmtDate(a.activity_date) : fmtDate(a.created_at);
    container.innerHTML = `
      <article class="bg-white p-6 rounded-xl shadow-lg">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2 flex-wrap">${unitBadge}${catBadge}</div>
          <div class="text-sm text-gray-500">${dateLabel}</div>
        </div>
        <h1 class="text-2xl font-bold mb-4">${escapeHTML(a.title || '')}</h1>
        <div class="mb-4 flex flex-wrap">${tagBadges}</div>
        <div class="prose max-w-none">${a.content || ''}</div>
      </article>`;
  } catch (err) {
    console.error('Failed to fetch activity detail:', err);
    if (notFound) notFound.classList.remove('hidden');
    container.innerHTML = '';
  }
}

