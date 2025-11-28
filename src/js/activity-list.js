// activity-list.js
// 活動記録一覧（BaseListDashboard継承）

const ACTIVITY_HISTORY_QUERY_KEY = 'activity-last-query';
const ACTIVITY_ICON_SET = {
  camp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19h18L12 5 3 19z"></path><path d="M12 5v14"></path></svg>',
  megaphone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v2a2 2 0 002 2h1l3 4v-12l-3 4H5a2 2 0 00-2 2z"></path><path d="M15 9l6-3v12l-6-3"></path></svg>',
  compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M15 9l-2 6-6 2 2-6 6-2z"></path></svg>'
};

document.addEventListener('DOMContentLoaded', () => {
  // BaseListDashboardが読み込まれているか確認
  if (typeof BaseListDashboard !== 'function') {
    console.error('BaseListDashboard is not defined. Make sure list-dashboard-base.js is loaded first.');
    return;
  }

  if (document.getElementById('activity-log-container')) {
    new ActivityDashboard();
  }
  if (document.getElementById('activity-article-container')) {
    loadDynamicActivityDetail();
  }
});

class ActivityDashboard extends BaseListDashboard {
  constructor() {
    super('activity', '/api/activities', ACTIVITY_HISTORY_QUERY_KEY);
  }

  normalizeItem(item) {
    if (!item) return null;
    const normalized = { ...item };
    const tags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
    normalized.tags = tags;
    normalized._tagsLower = tags.map(tag => String(tag).toLowerCase());
    
    const div = document.createElement('div');
    div.innerHTML = item.content || '';
    const plain = (div.textContent || div.innerText || '').trim();
    normalized._plain = plain;
    
    const summaryLength = 140;
    normalized._summary = plain.length > summaryLength ? `${plain.slice(0, summaryLength)}…` : plain;

    const searchParts = [
      String(item.title || '').toLowerCase(),
      plain.toLowerCase(),
      normalized._tagsLower.join(' '),
      String(item.category || '').toLowerCase(),
      String(item.unit || '').toLowerCase()
    ];
    normalized._searchBlob = searchParts.join(' ');

    const dateStr = item.activity_date || item.created_at;
    const dateObj = dateStr ? new Date(dateStr) : null;
    normalized._dateObj = (dateObj && !Number.isNaN(dateObj.valueOf())) ? dateObj : null;
    
    if (normalized._dateObj) {
      try {
        normalized._displayDate = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }).format(normalized._dateObj);
      } catch {
        normalized._displayDate = normalized._dateObj.toLocaleDateString('ja-JP');
      }
    } else {
      normalized._displayDate = '';
    }

    normalized._isImportant = Boolean(item.is_important) || normalized._tagsLower.some(tag => tag.includes('重要') || tag.includes('urgent'));
    const now = new Date();
    normalized._isRecent = normalized._dateObj ? ((now - normalized._dateObj) / (1000 * 60 * 60 * 24)) <= 21 : false;

    return normalized;
  }

  renderFilterOptions(settings) {
    // カテゴリ（動的生成）
    // ベースクラスではデータ取得後にrenderFilterOptionsを呼ぶ設計にしていないため（改善の余地あり）、
    // ここでは allItems から動的に抽出して表示するロジックを追加する、あるいは固定値にする。
    // BaseListDashboardのfetchDataでは、settings取得 -> renderFilterOptions -> データ取得 の順。
    // データからカテゴリを作るなら、データ取得後にもう一度renderFilterOptionsを呼ぶ必要がある。
    
    // 今回は固定値 + サーバー設定があればそれを使う、という形にするが、
    // 理想的には BaseListDashboard を改修してデータロード後のフックを作るべき。
    // ここでは簡易的に、このメソッド内ではなく、データロード完了後（renderListの直前など）に
    // カテゴリ抽出ロジックを入れる手もあるが、UX的には先にフィルタが出ている方が良い。
    
    const categories = ['キャンプ', 'ハイキング', '奉仕活動', '技能訓練', 'その他'];
    this.renderChips(this.catSelect, categories, 'category');

    // 隊
    try {
      const units = JSON.parse(settings.units_json || '[]');
      this.renderChips(this.unitSelect, units.map(u => u.slug), 'unit', units.map(u => u.label || u.slug));
    } catch {}

    // タグ
    try {
      const tags = JSON.parse(settings.activity_tags_json || '[]');
      this.renderChips(this.tagBar, tags.map(t => t.slug), 'tag', tags.map(t => `#${t.label||t.slug}`));
    } catch {}

    // ソート
    this.renderChips(this.sortSelect, [
      { val: 'newest', label: '新しい順' },
      { val: 'oldest', label: '古い順' }
    ], 'sort');
  }

  // データ取得後にカテゴリを再構築したい場合（オーバーライド）
  async fetchData() {
    await super.fetchData();
    // データからユニークなカテゴリを抽出してフィルタに追加（既存の固定値に追加）
    if (this.allItems.length) {
      const cats = new Set();
      this.allItems.forEach(i => { if(i.category) cats.add(i.category); });
      // 既存のチップをクリアするか、マージするか。今回はシンプルに再描画
      const sortedCats = Array.from(cats).sort();
      if (sortedCats.length > 0) {
        this.renderChips(this.catSelect, sortedCats, 'category');
      }
    }
  }

  renderItem(item) {
    const accent = resolveAccentTheme(item);
    const detailUrl = `/activity/${item.id}`;
    const unitBadge = item.unit ? `<span class="badge badge--unit mr-2">${escapeHTML(item.unit)}</span>` : '';
    const catBadge = item.category ? `<span class="badge badge--category">${escapeHTML(item.category)}</span>` : '';
    const tagHtml = (item.tags || []).slice(0,6).map(t=>`<span class="badge badge--tag mr-2 mb-2">#${escapeHTML(t)}</span>`).join('');
    
    let img = `https://placehold.co/720x405/4A934A/FFFFFF?text=${encodeURIComponent(item.category||'ACTIVITY')}`;
    if (Array.isArray(item.image_urls) && item.image_urls.length > 0) {
      img = item.image_urls[0];
    }

    return `
      <div class="bg-white rounded-xl shadow-xl overflow-hidden card-hover-effect group fade-in-section is-visible">
        <div class="relative">
          <img src="${img}" alt="${escapeHTML(item.title||'')}" class="w-full h-56 object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy">
          <div class="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300"></div>
        </div>
        <div class="p-6">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2 flex-wrap">${unitBadge}${catBadge}</div>
            <p class="text-sm text-gray-500">${item._displayDate}</p>
          </div>
          <h3 class="text-xl font-semibold mb-2 line-clamp-2">
            <a href="${detailUrl}" class="hover:text-green-700 transition-colors">${escapeHTML(item.title||'')}</a>
          </h3>
          <p class="text-gray-700 mb-3 leading-relaxed line-clamp-3">${escapeHTML(item._summary)}</p>
          <div class="flex flex-wrap mb-2">${tagHtml}</div>
          <a href="${detailUrl}" class="inline-block text-green-600 hover:text-green-800 font-semibold transition-colors duration-300 group" aria-label="続きを読む">
            <span class="transition-transform duration-300 inline-block group-hover:translate-x-1">&rarr;</span>
          </a>
        </div>
      </div>`;
  }

  renderSkeletons() {
    const cards = []; 
    for(let i=0; i<this.ITEMS_PER_PAGE; i++){ 
      cards.push(`
        <div class="bg-white rounded-xl shadow-xl overflow-hidden animate-pulse">
          <div class="bg-gray-200 h-56 w-full"></div>
          <div class="p-6 space-y-3">
            <div class="h-4 bg-gray-200 rounded w-1/3"></div>
            <div class="h-6 bg-gray-200 rounded w-3/4"></div>
            <div class="h-4 bg-gray-200 rounded w-full"></div>
            <div class="h-4 bg-gray-200 rounded w-full"></div>
          </div>
        </div>
      `);
    }
    this.container.innerHTML = cards.join('');
  }
}

function resolveAccentTheme(item) {
  const base = {
    color: '#16a34a',
    icon: 'camp',
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
  // 簡易的なテーマ解決（詳細な分岐が必要ならここに追加）
  return base;
}

// --- 詳細ページロジック (変更なし・必要なヘルパーを含む) ---
async function loadDynamicActivityDetail(){
  const container = document.getElementById('activity-article-container');
  if (!container) return;
  const pageTitle = document.getElementById('page-title');
  const notFound = document.getElementById('article-not-found');
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) return;

  try {
    container.innerHTML = '<div class="bg-white p-6 rounded-xl shadow-lg"><div class="skeleton skeleton-text" style="width:30%"></div><div class="skeleton skeleton-text" style="width:90%"></div><div class="skeleton skeleton-text" style="width:80%"></div></div>';
    const resp = await fetch(`/api/activities/${encodeURIComponent(id)}`);
    if (!resp.ok) throw new Error('Network response was not ok');
    const a = await resp.json();
    if (!a || !a.id) throw new Error('Not found');
    
    // Normalize (簡易)
    const d = new ActivityDashboard();
    const normalized = d.normalizeItem(a);

    if (pageTitle) pageTitle.textContent = normalized.title || '';
    
    container.innerHTML = buildActivityDetailTemplate(normalized);
    enhanceActivityArticle(container, normalized);
  } catch (err) {
    console.error('Failed to fetch activity detail:', err);
    if (notFound) notFound.classList.remove('hidden');
    container.innerHTML = '';
  }
}

function buildActivityDetailTemplate(item) {
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const tagBadges = tags.slice(0,12).map(t=>`<span class="badge badge--tag mr-2 mb-2">#${escapeHTML(t)}</span>`).join('');
  const unitBadge = item.unit ? `<span class="badge badge--unit mr-2">${escapeHTML(item.unit)}</span>` : '';
  const catBadge  = item.category ? `<span class="badge badge--category">${escapeHTML(item.category)}</span>` : '';
  
  let backLink = 'activity-log.html';
  try { const lastQuery = sessionStorage.getItem(ACTIVITY_HISTORY_QUERY_KEY); if (lastQuery) backLink += lastQuery; } catch {}

  return `
    <article class="bg-white p-6 rounded-xl shadow-lg">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2 flex-wrap">${unitBadge}${catBadge}</div>
        <div class="text-sm text-gray-500">${item._displayDate}</div>
      </div>
      <h1 class="text-2xl font-bold mb-4">${escapeHTML(item.title||'')}</h1>
      <div class="mb-4 flex flex-wrap">${tagBadges}</div>
      <div id="activity-hero-media" class="mb-6"></div>
      <div class="prose max-w-none prose-custom">${item.content || ''}</div>
    </article>
    <div class="mt-8">
      <a href="${backLink}" class="return-link">← 一覧へ戻る</a>
    </div>
    <div id="lightbox" class="fixed inset-0 bg-black/80 z-50 hidden items-center justify-center"><img id="lightbox-img" class="max-w-5xl max-h-[80vh] rounded-lg" alt="preview"><button id="lightbox-close" class="absolute top-4 right-4 text-white text-2xl">×</button></div>
  `;
}

function enhanceActivityArticle(container, item) {
  const hero = container.querySelector('#activity-hero-media');
  if (hero && Array.isArray(item.image_urls) && item.image_urls.length > 0) {
    const main = item.image_urls[0];
    const others = item.image_urls.slice(1, 7);
    const mainHtml = `<div class="overflow-hidden rounded-2xl shadow-xl border border-gray-200"><img src="${escapeHTML(main)}" class="w-full h-auto max-h-[70vh] object-cover"></div>`;
    const thumbs = others.length ? `<div class="grid grid-cols-3 gap-3 mt-4">${others.map(u=>`<img src="${escapeHTML(u)}" class="rounded-md cursor-zoom-in gallery-image-hover" data-full="${escapeHTML(u)}">`).join('')}</div>` : '';
    hero.innerHTML = mainHtml + thumbs;
    
    // Lightbox logic (Simplified)
    const lb = document.getElementById('lightbox');
    const lbImg = document.getElementById('lightbox-img');
    container.querySelectorAll('img').forEach(img => {
        img.addEventListener('click', () => {
            if(img.dataset.full || img.src) {
                lbImg.src = img.dataset.full || img.src;
                lb.classList.remove('hidden'); lb.classList.add('flex');
            }
        });
    });
    document.getElementById('lightbox-close')?.addEventListener('click', () => { lb.classList.add('hidden'); lb.classList.remove('flex'); });
    lb?.addEventListener('click', (e) => { if(e.target===lb) { lb.classList.add('hidden'); lb.classList.remove('flex'); }});
  }
}
