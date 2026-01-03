// news-list.js
// ニュース一覧（BaseListDashboard継承）

const NEWS_HISTORY_QUERY_KEY = 'news-last-query';
const NEWS_ICON_SET = {
  megaphone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v2a2 2 0 0 0 2 2h1l3 4V7l-3 4H5a2 2 0 0 0-2 2Z"></path><path d="M15 9l6-3v12l-6-3"></path></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 19V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12"></path><path d="M16 3v4"></path><path d="M8 3v4"></path><path d="M3 11h18"></path><path d="M5 16h.01"></path><path d="M9 16h.01"></path><path d="M13 16h.01"></path><path d="M17 16h.01"></path></svg>',
  compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36Z"></path></svg>'
};

document.addEventListener('DOMContentLoaded', () => {
  // BaseListDashboardが読み込まれているか確認
  if (typeof BaseListDashboard !== 'function') {
    console.error('BaseListDashboard is not defined. Make sure list-dashboard-base.js is loaded first.');
    return;
  }

  if (document.getElementById('news-list-container')) {
    new NewsDashboard();
  }
  if (document.getElementById('news-article-container')) {
    loadDynamicNewsDetail();
  }
});

class NewsDashboard extends BaseListDashboard {
  constructor() {
    super('news', '/api/news', NEWS_HISTORY_QUERY_KEY);
  }

  normalizeItem(item) {
    // サーバーから軽量データ（summary, thumbnail）が来る前提
    if (!item) return null;
    const normalized = { ...item };
    const tags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
    normalized.tags = tags;
    normalized._tagsLower = tags.map(tag => String(tag).toLowerCase());

    // サーバーからsummaryが来る場合はそのまま使用、なければcontentから生成（詳細ページ用）
    if (item.summary !== undefined) {
      normalized._summary = item.summary || '';
      normalized._plain = item.summary || '';
    } else if (item.content) {
      const div = document.createElement('div');
      div.innerHTML = item.content || '';
      const plain = (div.textContent || div.innerText || '').trim();
      normalized._plain = plain;
      const summaryLength = 120;
      normalized._summary = plain.length > summaryLength ? `${plain.slice(0, summaryLength)}…` : plain;
    } else {
      normalized._summary = '';
      normalized._plain = '';
    }

    // 画像：thumbnailがあればimage_urlsとして扱う（一覧用）
    if (item.thumbnail !== undefined) {
      normalized.image_urls = Array.isArray(item.thumbnail) ? item.thumbnail : [];
    }

    const searchParts = [
      String(item.title || '').toLowerCase(),
      normalized._plain.toLowerCase(),
      normalized._tagsLower.join(' '),
      String(item.category || '').toLowerCase(),
      String(item.unit || '').toLowerCase()
    ];
    normalized._searchBlob = searchParts.join(' ');

    const dateStr = item.published_at || item.created_at;
    const dateObj = dateStr ? new Date(dateStr) : null;
    normalized._dateObj = (dateObj && !Number.isNaN(dateObj.valueOf())) ? dateObj : null;

    // 日付表示用
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

  /**
   * フィルターAPIからオプションを取得して描画
   * settingsは後方互換のため残すが、主にフィルターAPIを使用
   */
  async renderFilterOptions(settings) {
    // 隊スラッグ→日本語ラベルのマップ
    const unitLabels = {
      'all': '団全体',
      'beaver': 'ビーバー隊',
      'cub': 'カブ隊',
      'boy': 'ボーイ隊',
      'venture': 'ベンチャー隊',
      'rover': 'ローバー隊'
    };

    try {
      const res = await fetch('/api/news/filters');
      if (res.ok) {
        const filters = await res.json();

        // カテゴリ（APIから取得）
        if (filters.categories && filters.categories.length > 0) {
          this.renderChips(this.catSelect, filters.categories, 'category');
        }

        // 隊（APIから取得、日本語ラベル付き）
        if (filters.units && filters.units.length > 0) {
          const unitValues = filters.units;
          const unitDisplayLabels = unitValues.map(u => unitLabels[u] || u);
          this.renderChips(this.unitSelect, unitValues, 'unit', unitDisplayLabels);
        }

        // タグ（APIから取得）
        if (filters.tags && filters.tags.length > 0) {
          this.renderChips(this.tagBar, filters.tags, 'tag', filters.tags.map(t => `#${t}`));
        }
      }
    } catch (err) {
      console.warn('Failed to fetch news filters:', err);
      // フォールバック: 設定から取得を試みる
      try {
        const units = JSON.parse(settings.units_json || '[]');
        this.renderChips(this.unitSelect, units.map(u => u.slug), 'unit', units.map(u => u.label || u.slug));
      } catch { }
      try {
        const tags = JSON.parse(settings.news_tags_json || '[]');
        this.renderChips(this.tagBar, tags.map(t => t.slug), 'tag', tags.map(t => `#${t.label || t.slug}`));
      } catch { }
    }

    // ソート（固定）
    this.renderChips(this.sortSelect, [
      { val: 'newest', label: '新しい順' },
      { val: 'oldest', label: '古い順' }
    ], 'sort');
  }

  renderItem(news) {
    const detailUrl = `/news/${news.id}`;
    const unitBadge = news.unit ? `<span class="badge badge--unit mr-2">${escapeHTML(news.unit)}</span>` : '';
    const catBadge = news.category ? `<span class="badge badge--category">${escapeHTML(news.category)}</span>` : '';
    const tagHtml = (news.tags || []).slice(0, 6).map(t => `<span class="badge badge--tag">#${escapeHTML(t)}</span>`).join('');

    const hasImage = Array.isArray(news.image_urls) && news.image_urls.length > 0;
    const imgHtml = hasImage
      ? `<img src="${escapeHTML(news.image_urls[0])}" alt="${escapeHTML(news.title || '')}" class="w-full h-48 sm:h-full object-cover transition-transform duration-500 hover:scale-105" loading="lazy">`
      : `<div class="w-full h-48 sm:h-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
           <span class="text-white text-2xl font-bold opacity-80">${escapeHTML(news.category || 'NEWS')}</span>
         </div>`;

    return `
      <article class="bg-white rounded-xl shadow-lg overflow-hidden card-hover-effect flex flex-col sm:flex-row gap-6 fade-in-section is-visible">
        <div class="sm:w-2/5 relative overflow-hidden">
          <a href="${detailUrl}" class="block h-full">
            ${imgHtml}
          </a>
        </div>
        <div class="sm:w-3/5 p-6 sm:pl-0 flex flex-col justify-center">
          <div class="flex items-center justify-between mb-2">
            <div>${unitBadge}${catBadge}</div>
            <p class="text-xs text-gray-500">${news._displayDate}</p>
          </div>
          <h3 class="text-xl font-semibold text-gray-800 mb-2 line-clamp-2">
            <a href="${detailUrl}" class="hover:text-green-700 transition-colors duration-300">${escapeHTML(news.title || '')}</a>
          </h3>
          <p class="text-gray-600 leading-relaxed text-sm line-clamp-2 mb-3">${escapeHTML(news._summary)}</p>
          ${tagHtml ? `<div class="flex flex-wrap gap-2 mb-3">${tagHtml}</div>` : ''}
          <div class="mt-auto">
            <a href="${detailUrl}" class="text-sm text-green-600 hover:text-green-800 font-medium transition-colors duration-300 flex items-center">
              続きを読む <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </a>
          </div>
        </div>
      </article>`;
  }

  renderSkeletons() {
    const cards = [];
    for (let i = 0; i < this.ITEMS_PER_PAGE; i++) {
      cards.push(`
        <article class="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col sm:flex-row gap-6 p-4 animate-pulse">
          <div class="sm:w-2/5 bg-gray-200 h-40 rounded-lg"></div>
          <div class="sm:w-3/5 flex flex-col gap-3">
            <div class="h-4 bg-gray-200 rounded w-1/4"></div>
            <div class="h-6 bg-gray-200 rounded w-3/4"></div>
            <div class="h-4 bg-gray-200 rounded w-full"></div>
            <div class="h-4 bg-gray-200 rounded w-full"></div>
          </div>
        </article>
      `);
    }
    this.container.innerHTML = cards.join('');
  }
}

function resolveNewsAccentTheme(item) {
  const base = {
    color: '#0ea5e9',
    icon: 'megaphone',
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
  const category = String(item?.category || '').toLowerCase();
  if (/イベント|集会|活動報告/.test(category)) {
    return { ...base, color: '#16a34a', icon: 'compass', typeLabel: '活動・イベント', iconBg: 'rgba(34, 197, 94, 0.16)', badgeBg: 'rgba(187, 247, 208, 0.7)', badgeColor: '#166534' };
  }
  if (/募集|参加者/.test(category)) {
    return { ...base, color: '#f97316', icon: 'megaphone', typeLabel: '募集', iconBg: 'rgba(249, 115, 22, 0.18)', badgeBg: 'rgba(254, 215, 170, 0.7)', badgeColor: '#9a3412' };
  }
  if (/報告|メディア|広報/.test(category)) {
    return { ...base, color: '#9333ea', icon: 'calendar', typeLabel: '広報', iconBg: 'rgba(221, 214, 254, 0.2)', badgeBg: 'rgba(233, 213, 255, 0.75)', badgeColor: '#7520ea' };
  }
  return base;
}

// --- 詳細ページロジック (変更なし) ---
async function loadDynamicNewsDetail() {
  const articleContainer = document.getElementById('news-article-container');
  if (!articleContainer) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) return;

  const breadcrumbTitle = document.getElementById('news-title-breadcrumb');
  const pageTitle = document.getElementById('page-title-news');
  const notFound = document.getElementById('news-article-not-found');

  try {
    articleContainer.innerHTML = '<div class="bg-white p-6 rounded-xl shadow-lg"><div class="skeleton skeleton-text" style="width:30%"></div><div class="skeleton skeleton-text" style="width:90%"></div><div class="skeleton skeleton-text" style="width:80%"></div></div>';
    const resp = await fetch(`/api/news/${encodeURIComponent(id)}`);
    if (!resp.ok) throw new Error('Network response was not ok');
    const news = await resp.json();
    if (!news || !news.id) throw new Error('Not found');

    // 簡易正規化
    const d = new NewsDashboard(); // インスタンス化してnormalizeメソッドを借用（またはstaticメソッド化すべきだが）
    const normalized = d.normalizeItem(news);
    // Note: 本来はnormalizeItemをstaticにするかutilsに分けるべきだが、今回は簡易対応

    if (breadcrumbTitle) breadcrumbTitle.textContent = normalized.title || 'ニュース';
    if (pageTitle) pageTitle.textContent = `${normalized.title || 'ニュース詳細'} - 多治見第1団`;

    articleContainer.innerHTML = buildNewsDetailTemplate(normalized);
    enhanceNewsArticle(articleContainer, normalized);
  } catch (error) {
    console.error('Failed to fetch news detail:', error);
    articleContainer.innerHTML = '';
    if (notFound) notFound.classList.remove('hidden');
  }
}

function buildNewsDetailTemplate(item) {
  const accent = resolveNewsAccentTheme(item);
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const tagsHtml = tags.map((tag) => `<a href="news-list.html?tags=${encodeURIComponent(tag)}" class="activity-card__tag" data-tag-link="${escapeHTML(tag)}">#${escapeHTML(tag)}</a>`).join('');
  const tagSection = tagsHtml ? `<div class="activity-detail-tags">${tagsHtml}</div>` : '';
  let backLink = 'news-list.html';
  try {
    const lastQuery = sessionStorage.getItem(NEWS_HISTORY_QUERY_KEY);
    if (lastQuery) backLink += lastQuery;
  } catch { }

  const metaParts = [];
  if (item._displayDate) metaParts.push(`<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7V3M16 7V3M4.5 11h15M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"></path></svg>${escapeHTML(item._displayDate)}</span>`);
  if (item.unit) metaParts.push(`<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4Z"></path><path d="M6 20a6 6 0 0 1 12 0"></path></svg>${escapeHTML(item.unit)}</span>`);
  if (item.category) metaParts.push(`<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18"></path><path d="M5 7v14h14V7"></path><path d="M9 7V5a3 3 0 0 1 6 0v2"></path></svg>${escapeHTML(item.category)}</span>`);

  return `
    <div class="max-w-6xl mx-auto" style="--accent-color:${accent.color}">
      <div class="flex flex-col gap-4 mb-8">
        <div class="flex items-center gap-3 flex-wrap">
          <span class="activity-card__badge" style="--badge-bg:${accent.badgeBg};--badge-color:${accent.badgeColor};">${escapeHTML(accent.typeLabel)}</span>
          ${item._isImportant ? '<span class="activity-card__status" aria-label="重要なお知らせ">重要</span>' : ''}
          ${item._isRecent && !item._isImportant ? '<span class="activity-card__status" style="color:#1d4ed8;background:rgba(59,130,246,0.16)">NEW</span>' : ''}
        </div>
        <h1 class="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">${escapeHTML(item.title || '')}</h1>
        <div class="activity-detail-meta">${metaParts.join('')}</div>
        ${tagSection}
      </div>
      <div class="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(220px,1fr)]">
        <div class="space-y-8" id="news-article-main">
          <div id="news-hero-media"></div>
          <div class="lg:hidden">
            <details class="activity-toc-mobile hidden" id="news-toc-mobile">
              <summary>目次 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg></summary>
              <nav id="news-toc-mobile-list" class="activity-toc-list mt-3"></nav>
            </details>
          </div>
          <div class="prose max-w-none prose-lg leading-relaxed">${item.content || ''}</div>
          <div>
            <a href="${backLink}" class="return-link">← ニュース一覧へ戻る</a>
          </div>
        </div>
        <aside class="activity-toc-sticky space-y-5 hidden lg:block">
          <div class="activity-toc-card hidden" id="news-toc-card">
            <p class="activity-toc-title">目次</p>
            <nav id="news-toc" class="activity-toc-list"></nav>
          </div>
          <div class="activity-toc-card" id="news-meta-card">
            <p class="activity-toc-title">この記事について</p>
            <div class="space-y-3 text-sm text-gray-600">
              ${item._displayDate ? `<p>掲載日: <time datetime="${escapeHTML(item._isoDate || '')}">${escapeHTML(item._displayDate)}</time></p>` : ''}
              ${item.unit ? `<p>対象: ${escapeHTML(item.unit)}</p>` : ''}
              ${item.category ? `<p>カテゴリ: ${escapeHTML(item.category)}</p>` : ''}
            </div>
          </div>
        </aside>
      </div>
    </div>
  `;
}

function enhanceNewsArticle(container, item) {
  const hero = container.querySelector('#news-hero-media');
  if (hero) buildNewsGallery(hero, item);
  const prose = container.querySelector('.prose');
  if (prose) buildNewsTableOfContents(prose, container);
}

function normalizeImageUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.hostname.includes('drive.google.com')) {
      const fileMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
      const id = fileMatch ? fileMatch[1] : parsed.searchParams.get('id');
      if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
    }
    return parsed.href;
  } catch {
    return url;
  }
}

function buildNewsGallery(wrapper, item) {
  const images = Array.isArray(item.image_urls) ? item.image_urls : [];
  if (!images.length) { wrapper.remove(); return; }
  const normalized = images.map(normalizeImageUrl).filter(Boolean);
  if (!normalized.length) { wrapper.remove(); return; }
  const main = normalized[0];
  const others = normalized.slice(1, 6);
  const mainHtml = `<div class="overflow-hidden rounded-2xl shadow-xl border border-gray-200"><img src="${escapeHTML(main)}" alt="${escapeHTML(item.title || '')}" class="w-full h-auto max-h-[70vh] object-cover"></div>`;
  const thumbs = others.length ? `<div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">${others.map((url) => `<a href="${escapeHTML(url)}" target="_blank" rel="noopener" class="block overflow-hidden rounded-xl border border-gray-200 hover:border-green-400 transition"><img src="${escapeHTML(url)}" alt="${escapeHTML(item.title || '')}" class="w-full h-32 sm:h-36 object-cover"></a>`).join('')}</div>` : '';
  wrapper.innerHTML = `${mainHtml}${thumbs}`;
}

function buildNewsTableOfContents(prose, root) {
  const headings = Array.from(prose.querySelectorAll('h2, h3')).filter((heading) => heading.textContent && heading.textContent.trim().length > 0);
  const tocCard = root.querySelector('#news-toc-card');
  const tocList = tocCard?.querySelector('#news-toc');
  const mobileWrapper = root.querySelector('#news-toc-mobile');
  const mobileList = mobileWrapper?.querySelector('#news-toc-mobile-list');
  if (!headings.length || !tocList) {
    tocCard?.classList?.add('hidden');
    mobileWrapper?.classList?.add('hidden');
    return;
  }
  tocCard.classList.remove('hidden');
  if (mobileWrapper) mobileWrapper.classList.remove('hidden');
  tocList.innerHTML = '';
  if (mobileList) mobileList.innerHTML = '';
  const fragment = document.createDocumentFragment();
  const mobileFragment = document.createDocumentFragment();
  headings.forEach((heading, index) => {
    if (!heading.id) heading.id = `section-${index + 1}`;
    const depth = heading.tagName === 'H3' ? 3 : 2;
    const text = heading.textContent.trim();
    const link = document.createElement('a');
    link.className = 'activity-toc-link';
    link.dataset.target = heading.id;
    link.dataset.depth = String(depth);
    link.href = `#${heading.id}`;
    link.textContent = text;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState({}, '', `#${heading.id}`);
    });
    fragment.appendChild(link);
    if (mobileList) {
      const mobileLink = link.cloneNode(true);
      mobileFragment.appendChild(mobileLink);
    }
  });
  tocList.appendChild(fragment);
  if (mobileList) mobileList.appendChild(mobileFragment);
  const tocLinks = tocList.querySelectorAll('.activity-toc-link');
  const mobileLinks = mobileList ? mobileList.querySelectorAll('.activity-toc-link') : [];
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      tocLinks.forEach((link) => {
        link.classList.toggle('is-active', link.dataset.target === id);
      });
      mobileLinks.forEach((link) => {
        link.classList.toggle('is-active', link.dataset.target === id);
      });
    });
  }, { rootMargin: '-55% 0px -35% 0px', threshold: [0, 0.25, 0.5, 1] });
  headings.forEach((heading) => observer.observe(heading));
}
