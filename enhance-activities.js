// enhance-activities.js
// 既存 dynamic-activities.v2.js を上書きする改良版（同名関数を再定義）

document.addEventListener('DOMContentLoaded', () => {
  // ここでは何もしない（元スクリプトのハンドラが新関数を呼ぶ）
});

function escapeHTML(str){
  if (typeof str !== 'string') return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

async function loadDynamicActivityList(){
  const container = document.getElementById('activity-log-container');
  if (!container) return;
  const pagination = document.getElementById('activity-pagination-container');
  const noResults = document.getElementById('no-activity-results');
  const ITEMS_PER_PAGE = 6;
  let currentPage = 1;
  let allItems = [];
  let settingsCache = null;

  const fmtDate = (d) => new Date(d).toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric' });

  const renderCard = (item) => {
    const plain = (item.content || '').replace(/<[^>]+>/g,'');
    const summary = (plain.length > 140 ? plain.substring(0,140) + '…' : plain);
    const url = `activity-detail-placeholder.html?id=${item.id}`;
    const dateLabel = item.activity_date ? fmtDate(item.activity_date) : fmtDate(item.created_at);
    const tags = Array.isArray(item.tags) ? item.tags : [];
    const tagBadges = tags.slice(0,6).map(t=>`<span class="badge badge--tag mr-2 mb-2">#${escapeHTML(t)}</span>`).join('');
    const unitBadge = item.unit ? `<span class="badge badge--unit mr-2">${escapeHTML(item.unit)}</span>` : '';
    const catBadge  = item.category ? `<span class="badge badge--category">${escapeHTML(item.category)}</span>` : '';
    const img = (Array.isArray(item.image_urls) && item.image_urls[0]) ? item.image_urls[0] : `https://placehold.co/720x405/4A934A/FFFFFF?text=${encodeURIComponent(item.category || 'ACTIVITY')}`;
    return `
      <div class="bg-white rounded-xl shadow-xl overflow-hidden card-hover-effect group">
        <div class="relative">
          <img src="${img}" alt="${escapeHTML(item.title||'')}" class="w-full h-56 object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy">
          <div class="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300"></div>
        </div>
        <div class="p-6">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2 flex-wrap">${unitBadge}${catBadge}</div>
            <p class="text-sm text-gray-500">${dateLabel}</p>
          </div>
          <h3 class="text-xl font-semibold mb-2 line-clamp-2"><a href="${url}" class="hover:text-green-700 transition-colors">${escapeHTML(item.title||'')}</a></h3>
          <p class="text-gray-700 mb-3 leading-relaxed line-clamp-3">${escapeHTML(summary)}</p>
          <div class="flex flex-wrap mb-2">${tagBadges}</div>
          <a href="${url}" class="inline-block text-green-600 hover:text-green-800 font-semibold transition-colors duration-300 group" aria-label="続きを読む"><span class="transition-transform duration-300 inline-block group-hover:translate-x-1">&rarr;</span></a>
        </div>
      </div>`;
  };

  const renderPagination = (total, page) => {
    if (!pagination) return;
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
    if (totalPages <= 1) { pagination.innerHTML = ''; return; }
    let html = '<ul class="inline-flex items-center -space-x-px shadow-sm rounded-md">';
    html += `<li><button data-page="${page-1}" aria-label="前のページへ" class="activity-page-btn pagination-button ${page===1?'pagination-disabled':''}"><span class="sr-only">前へ</span><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg></button></li>`;
    for (let i=1;i<=totalPages;i++){
      const isActive = i===page;
      html += `<li><button data-page="${i}" ${isActive?'aria-current="page"':''} aria-label="${i}ページ目" class="activity-page-btn pagination-button ${isActive?'pagination-active':''}">${i}</button></li>`;
    }
    html += `<li><button data-page="${page+1}" aria-label="次のページへ" class="activity-page-btn pagination-button ${page===totalPages?'pagination-disabled':''}"><span class="sr-only">次へ</span><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path></svg></button></li>`;
    html += '</ul>';
    pagination.innerHTML = html;
    pagination.querySelectorAll('.activity-page-btn').forEach(btn=>{
      btn.addEventListener('click',(e)=>{
        const p = parseInt(e.currentTarget.dataset.page,10);
        const totalPages2 = Math.ceil(allItems.length / ITEMS_PER_PAGE);
        if (p && p!==currentPage && p>0 && p<=totalPages2){ currentPage=p; draw(allItems); container.scrollIntoView({behavior:'smooth'}); }
      });
    });
  };

  const draw = (arr) => {
    container.innerHTML = '';
    if (!arr || arr.length===0){ if (noResults) noResults.classList.remove('hidden'); if (pagination) pagination.innerHTML=''; return; }
    if (noResults) noResults.classList.add('hidden');
    const start = (currentPage-1)*ITEMS_PER_PAGE;
    const items = arr.slice(start, start+ITEMS_PER_PAGE);
    container.innerHTML = items.map(renderCard).join('');
    renderPagination(arr.length, currentPage);
  };

  const renderSkeletons = (n=6) => {
    const cards=[];
    for (let i=0;i<n;i++) cards.push(`<div class="bg-white rounded-xl shadow-xl overflow-hidden"><div class="skeleton skeleton-thumb"></div><div class="p-6"><div class="skeleton skeleton-text" style="width:40%"></div><div class="skeleton skeleton-text" style="width:90%"></div><div class="skeleton skeleton-text" style="width:80%"></div></div></div>`);
    container.innerHTML = cards.join('');
  };

  const readQuery = () => {
    const sp = new URLSearchParams(location.search);
    return { q: sp.get('q')||'', category: sp.get('category')||'all', unit: sp.get('unit')||'', tags_any: (sp.get('tags_any')||'').split(',').filter(Boolean), ym: sp.get('ym')||'' };
  };
  const writeQuery = (state) => {
    const sp = new URLSearchParams();
    if (state.q) sp.set('q', state.q);
    if (state.category && state.category!=='all') sp.set('category', state.category);
    if (state.unit) sp.set('unit', state.unit);
    if (state.tags_any && state.tags_any.length) sp.set('tags_any', state.tags_any.join(','));
    if (state.ym) sp.set('ym', state.ym);
    history.replaceState(null, '', `${location.pathname}?${sp.toString()}`);
  };

  const loadSettings = async () => {
    try {
      const r = await fetch('/api/settings/all');
      if (!r.ok) return;
      const rows = await r.json();
      settingsCache = rows.reduce((acc, it) => (acc[it.key]=it.value, acc), {});
      const units = JSON.parse(settingsCache.units_json || '[]');
      const unitSel = document.getElementById('activity-unit-filter');
      if (unitSel) unitSel.innerHTML = '<option value="">すべての隊</option>' + (Array.isArray(units)?units.map(u=>`<option value="${u.slug}">${u.label||u.slug}</option>`).join(''): '');
      const tags = JSON.parse(settingsCache.activity_tags_json || '[]');
      const tagSel = document.getElementById('activity-tags-filter');
      if (tagSel) tagSel.innerHTML = (Array.isArray(tags)?tags.map(t=>`<option value="${t.slug}">${t.label||t.slug}</option>`).join(''):'');
    } catch {}
  };

  try {
    renderSkeletons();
    await loadSettings();
    const qs = location.search || '';
    const resp = await fetch(`/api/activities${qs}`);
    if (!resp.ok) throw new Error('Network response was not ok');
    allItems = await resp.json();
    // 初期クエリをUIに反映
    const q = readQuery();
    const catSel = document.getElementById('activity-category-filter');
    const unitSel = document.getElementById('activity-unit-filter');
    const tagSel = document.getElementById('activity-tags-filter');
    const monthInp = document.getElementById('activity-date-filter');
    const searchInp = document.getElementById('activity-search');
    if (catSel && q.category) catSel.value = q.category;
    if (unitSel && q.unit) unitSel.value = q.unit;
    if (Array.isArray(q.tags_any) && tagSel) Array.from(tagSel.options).forEach(o=>o.selected = q.tags_any.includes(o.value));
    if (q.ym && monthInp) monthInp.value = q.ym;
    if (q.q && searchInp) searchInp.value = q.q;
    draw(allItems);
  } catch (err) {
    console.error('Failed to fetch activities:', err);
    container.innerHTML = '<p class="text-center text-red-500">活動の読み込みに失敗しました。</p>';
  }

  // フィルタ適用
  const btn = document.getElementById('activity-filter-button');
  const catSel = document.getElementById('activity-category-filter');
  const monthInp = document.getElementById('activity-date-filter');
  const unitSel = document.getElementById('activity-unit-filter');
  const tagSel = document.getElementById('activity-tags-filter');
  const searchInp = document.getElementById('activity-search');
  const btnText = document.getElementById('activity-filter-button-text');
  const spinner = document.getElementById('activity-filter-loading-spinner');
  if (btn) btn.addEventListener('click', () => {
    try {
      spinner?.classList?.remove('hidden'); if (btnText) btnText.textContent = '絞り込み中...';
      const cat  = (catSel?.value || 'all').trim();
      const ym   = (monthInp?.value || '').trim();
      const unit = (unitSel?.value || '').trim().toLowerCase();
      const q    = (searchInp?.value || '').trim().toLowerCase();
      const tags = tagSel ? Array.from(tagSel.options).filter(o=>o.selected).map(o=>o.value) : [];
      currentPage = 1;
      const filtered = allItems.filter(n => {
        let ok = true;
        if (cat && cat !== 'all') ok = ok && String(n.category||'') === cat;
        if (unit) ok = ok && String(n.unit||'').toLowerCase() === unit;
        if (q) {
          const hay = `${(n.title||'')} ${(n.category||'')} ${(n.unit||'')} ${(Array.isArray(n.tags)?n.tags.join(' '):'')} ${(n.content||'').replace(/<[^>]+>/g,'')}`.toLowerCase();
          ok = ok && hay.includes(q);
        }
        if (tags && tags.length) { const set = new Set(Array.isArray(n.tags)?n.tags:[]); ok = ok && tags.some(t=>set.has(t)); }
        if (ym) { const d=new Date(n.activity_date||n.created_at); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); ok = ok && `${y}-${m}`===ym; }
        return ok;
      });
      writeQuery({ q, category: cat, unit, tags_any: tags, ym });
      draw(filtered);
    } finally {
      spinner?.classList?.add('hidden'); if (btnText) btnText.textContent = '絞り込む';
    }
  });
}

async function loadDynamicActivityDetail(){
  const container = document.getElementById('activity-article-container');
  if (!container) return;
  const pageTitle = document.getElementById('page-title');
  const notFound = document.getElementById('article-not-found');
  const fmtDate = (d) => new Date(d).toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric' });
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) return;

  try {
    container.innerHTML = '<div class="bg-white p-6 rounded-xl shadow-lg"><div class="skeleton skeleton-text" style="width:30%"></div><div class="skeleton skeleton-text" style="width:90%"></div><div class="skeleton skeleton-text" style="width:80%"></div></div>';
    const resp = await fetch(`/api/activities/${encodeURIComponent(id)}`);
    if (!resp.ok) throw new Error('Network response was not ok');
    const a = await resp.json();
    if (!a || !a.id) throw new Error('Not found');
    if (pageTitle) pageTitle.textContent = a.title || '';
    const tags = Array.isArray(a.tags) ? a.tags : [];
    const tagBadges = tags.slice(0,12).map(t=>`<span class="badge badge--tag mr-2 mb-2">#${escapeHTML(t)}</span>`).join('');
    const unitBadge = a.unit ? `<span class="badge badge--unit mr-2">${escapeHTML(a.unit)}</span>` : '';
    const catBadge  = a.category ? `<span class="badge badge--category">${escapeHTML(a.category)}</span>` : '';
    const dateLabel = a.activity_date ? fmtDate(a.activity_date) : fmtDate(a.created_at);
    const hero = (Array.isArray(a.image_urls) && a.image_urls[0]) ? `<div class="mb-4"><img src="${escapeHTML(a.image_urls[0])}" alt="${escapeHTML(a.title||'')}" class="w-full h-auto rounded-lg"></div>` : '';
    const gallery = (Array.isArray(a.image_urls) && a.image_urls.length>1) ? `<div class="grid grid-cols-3 gap-3 mt-4" id="activity-gallery">${a.image_urls.slice(1,7).map((u,i)=>`<img src="${escapeHTML(u)}" alt="gallery ${i+1}" class="rounded-md cursor-zoom-in gallery-image-hover" data-full="${escapeHTML(u)}">`).join('')}</div>` : '';
    container.innerHTML = `
      <article class="bg-white p-6 rounded-xl shadow-lg">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2 flex-wrap">${unitBadge}${catBadge}</div>
          <div class="text-sm text-gray-500">${dateLabel}</div>
        </div>
        <h1 class="text-2xl font-bold mb-4">${escapeHTML(a.title||'')}</h1>
        <div class="mb-4 flex flex-wrap">${tagBadges}</div>
        ${hero}
        <div class="prose max-w-none prose-custom">${a.content || ''}</div>
        ${gallery}
      </article>
      <div id="related-activities" class="mt-10"></div>
      <div id="lightbox" class="fixed inset-0 bg-black/80 z-50 hidden items-center justify-center"><img id="lightbox-img" class="max-w-5xl max-h-[80vh] rounded-lg" alt="preview"><button id="lightbox-close" class="absolute top-4 right-4 text-white text-2xl">×</button></div>
    `;

    // Lightbox
    const lightbox = document.getElementById('lightbox');
    const lightImg = document.getElementById('lightbox-img');
    const closeBtn = document.getElementById('lightbox-close');
    container.querySelectorAll('#activity-gallery img').forEach(img=>{
      img.addEventListener('click',()=>{ lightImg.src = img.getAttribute('data-full'); lightbox.classList.remove('hidden'); lightbox.classList.add('flex'); });
    });
    closeBtn?.addEventListener('click',()=>{ lightbox.classList.add('hidden'); lightbox.classList.remove('flex'); });
    lightbox?.addEventListener('click',(e)=>{ if (e.target===lightbox){ lightbox.classList.add('hidden'); lightbox.classList.remove('flex'); } });

    // Related
    const related = document.getElementById('related-activities');
    try {
      let relUrl = '';
      if (a.unit) relUrl = `/api/activities?unit=${encodeURIComponent(a.unit)}&limit=6`;
      else if (tags.length) relUrl = `/api/activities?tags_any=${encodeURIComponent(tags.join(','))}&limit=6`;
      if (relUrl){
        const r = await fetch(relUrl);
        if (r.ok){
          const list = (await r.json()).filter(x=>String(x.id)!==String(a.id)).slice(0,3);
          if (list.length){ related.innerHTML = `<h2 class="text-xl font-bold mb-4">関連する活動</h2><div class="grid md:grid-cols-3 gap-6">${list.map(renderCard).join('')}</div>`; }
        }
      }
    } catch {}

    // JSON-LD
    try {
      const ld = { '@context':'https://schema.org', '@type':'Article', headline: a.title||'', datePublished: a.created_at, dateModified: a.activity_date||a.created_at, image: Array.isArray(a.image_urls)?a.image_urls:[], articleSection: a.category||undefined };
      const s = document.createElement('script'); s.type='application/ld+json'; s.textContent = JSON.stringify(ld); document.head.appendChild(s);
    } catch {}
  } catch (err) {
    console.error('Failed to fetch activity detail:', err);
    if (notFound) notFound.classList.remove('hidden');
    container.innerHTML = '';
  }
}

