const HISTORY_QUERY_KEY = 'activity-last-query';
const SCROLL_STORAGE_KEY = 'activity-scroll-position';

const ICON_SET = {
  camp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19h18L12 5 3 19z"></path><path d="M12 5v14"></path></svg>',
  megaphone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v2a2 2 0 002 2h1l3 4v-12l-3 4H5a2 2 0 00-2 2z"></path><path d="M15 9l6-3v12l-6-3"></path></svg>',
  compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M15 9l-2 6-6 2 2-6 6-2z"></path></svg>'
};

const collator = new Intl.Collator('ja');

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('activity-log-container')) {
    new ActivityDashboard();
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

function stripHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').trim();
}

function formatDateForDisplay(dateObj) {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.valueOf())) return '';
  try {
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(dateObj);
  } catch {
    return dateObj.toLocaleDateString();
  }
}

function formatMonthLabel(ym) {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return `${y}年${m}月`;
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

function normalizeActivity(item) {
  if (!item || typeof item !== 'object') return null;
  const normalized = { ...item };
  const tags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
  normalized.tags = tags;
  normalized._tags = tags;
  normalized._tagsLower = tags.map(tag => String(tag).toLowerCase());
  const plain = stripHtml(item.content || '');
  normalized._plain = plain;
  const summaryLength = 160;
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
  normalized._displayDate = normalized._dateObj ? formatDateForDisplay(normalized._dateObj) : '';
  normalized._isoDate = normalized._dateObj ? normalized._dateObj.toISOString() : '';
  normalized._month = normalized._dateObj ? `${normalized._dateObj.getFullYear()}-${String(normalized._dateObj.getMonth() + 1).padStart(2, '0')}` : '';
  normalized._isImportant = Boolean(item.is_important) || normalized._tagsLower.some(tag => tag.includes('重要') || tag.includes('urgent'));
  const now = new Date();
  normalized._isRecent = normalized._dateObj ? ((now - normalized._dateObj) / (1000 * 60 * 60 * 24)) <= 21 : false;
  normalized.kind = item.kind || item.type || '';
  return normalized;
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
  const category = String(item?.category || '').toLowerCase();
  const type = String(item?.kind || '').toLowerCase();
  if (type.includes('news') || /お知らせ|告知|重要|募集/.test(category)) {
    return {
      ...base,
      color: '#0284c7',
      icon: 'megaphone',
      typeLabel: 'お知らせ',
      iconBg: 'rgba(2, 132, 199, 0.18)',
      badgeBg: 'rgba(191, 219, 254, 0.7)',
      badgeColor: '#1e3a8a',
      tagBg: 'rgba(191, 219, 254, 0.68)',
      tagColor: '#1d4ed8',
      tagActiveBg: 'rgba(30, 64, 175, 0.22)',
      tagActiveColor: '#1e3a8a',
      typeColor: '#1d4ed8'
    };
  }
  if (/キャンプ|野営|ハイキング|登山|自然/.test(category)) {
    return {
      ...base,
      color: '#ea580c',
      icon: 'camp',
      iconBg: 'rgba(250, 146, 73, 0.2)',
      badgeBg: 'rgba(254, 215, 170, 0.7)',
      badgeColor: '#7c2d12',
      tagBg: 'rgba(254, 215, 170, 0.7)',
      tagColor: '#9a3412',
      tagActiveBg: 'rgba(234, 88, 12, 0.22)',
      tagActiveColor: '#7c2d12',
      typeColor: '#ea580c'
    };
  }
  if (/技能|スキル|章|訓練|チャレンジ/.test(category)) {
    return {
      ...base,
      color: '#7c3aed',
      icon: 'compass',
      iconBg: 'rgba(167, 139, 250, 0.22)',
      badgeBg: 'rgba(221, 214, 254, 0.75)',
      badgeColor: '#5b21b6',
      tagBg: 'rgba(221, 214, 254, 0.7)',
      tagColor: '#5b21b6',
      tagActiveBg: 'rgba(109, 40, 217, 0.22)',
      tagActiveColor: '#4c1d95',
      typeColor: '#7c3aed'
    };
  }
  if (/奉仕|ボランティア|地域|清掃|sdgs/.test(category)) {
    return {
      ...base,
      color: '#0ea5e9',
      icon: 'compass',
      iconBg: 'rgba(125, 211, 252, 0.22)',
      badgeBg: 'rgba(186, 230, 253, 0.75)',
      badgeColor: '#0c4a6e',
      tagBg: 'rgba(186, 230, 253, 0.7)',
      tagColor: '#075985',
      tagActiveBg: 'rgba(14, 165, 233, 0.22)',
      tagActiveColor: '#075985',
      typeColor: '#0ea5e9'
    };
  }
  if (/団行事|式典|交流|イベント|発表/.test(category)) {
    return {
      ...base,
      color: '#ec4899',
      icon: 'camp',
      iconBg: 'rgba(244, 114, 182, 0.22)',
      badgeBg: 'rgba(251, 207, 232, 0.75)',
      badgeColor: '#9d174d',
      tagBg: 'rgba(251, 207, 232, 0.7)',
      tagColor: '#9d174d',
      tagActiveBg: 'rgba(236, 72, 153, 0.22)',
      tagActiveColor: '#9d174d',
      typeColor: '#ec4899'
    };
  }
  return base;
}

class ActivityDashboard {
  constructor() {
    this.container = document.getElementById('activity-log-container');
    if (!this.container) return;

    this.loadingIndicator = document.getElementById('activity-list-loading');
    this.noResults = document.getElementById('no-activity-results');
    this.resultsCount = document.getElementById('activity-results-count');
    this.loadMoreButton = document.getElementById('activity-load-more-button');
    this.listEnd = document.getElementById('activity-list-end');
    this.sentinel = document.getElementById('activity-load-more-sentinel');
    this.tagBar = document.getElementById('activity-tag-bar');
    this.categoryChips = document.getElementById('activity-category-chips');
    this.unitChips = document.getElementById('activity-unit-chips');
    this.sortChips = document.getElementById('activity-sort-chips');
    this.searchInput = document.getElementById('activity-search');
    this.monthInput = document.getElementById('activity-date-filter');
    this.tagModeToggle = document.getElementById('activity-tag-mode-toggle');
    this.resetButton = document.getElementById('activity-reset-filters');
    this.activeFilterBar = document.getElementById('activity-active-filter-bar');
    this.activeFilters = document.getElementById('activity-active-filters');

    this.defaultState = {
      category: '',
      unit: '',
      tags: [],
      tagMode: 'or',
      ym: '',
      search: '',
      sort: 'newest',
      page: 1
    };

    this.state = { ...this.defaultState, ...this.parseStateFromURL() };

    this.allItems = [];
    this.filteredItems = [];
    this.visibleCount = 0;
    this.batchSize = 9;

    this.categoryChipMap = new Map();
    this.unitChipMap = new Map();
    this.tagChipMap = new Map();
    this.sortChipMap = new Map();

    this.intersectionObserver = null;
    this.pendingScroll = null;
    this.searchDebounceTimer = null;

    this.container.setAttribute('aria-live', 'polite');
    this.container.setAttribute('aria-busy', 'true');

    this.setupEventListeners();
    this.setupPopState();
    this.setupScrollStorage();
    this.loadData();
  }

  parseStateFromURL() {
    const params = new URLSearchParams(window.location.search);
    const state = {};
    const cat = params.get('category') || params.get('type');
    if (cat) state.category = cat;
    const unit = params.get('unit');
    if (unit) state.unit = unit;
    const tagsParam = params.get('tags') || params.get('tag');
    if (tagsParam) state.tags = tagsParam.split(/[\s,]+/).filter(Boolean);
    const tagMode = params.get('tagMode');
    if (tagMode === 'and' || tagMode === 'or') state.tagMode = tagMode;
    const ym = params.get('ym') || params.get('month');
    if (ym && /^\d{4}-\d{2}$/.test(ym)) state.ym = ym;
    const search = params.get('search') || params.get('q');
    if (search) state.search = search;
    const sort = params.get('sort');
    if (['newest', 'oldest', 'title'].includes(sort)) state.sort = sort;
    const page = parseInt(params.get('page'), 10);
    if (!Number.isNaN(page) && page > 0) state.page = page;
    return state;
  }

  setupEventListeners() {
    if (this.categoryChips) {
      this.categoryChips.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-value]');
        if (!chip) return;
        const value = chip.dataset.value || '';
        this.toggleCategory(value);
      });
    }

    if (this.unitChips) {
      this.unitChips.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-value]');
        if (!chip) return;
        const value = chip.dataset.value || '';
        this.toggleUnit(value);
      });
    }

    if (this.sortChips) {
      this.sortChips.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-value]');
        if (!chip) return;
        const value = chip.dataset.value || 'newest';
        this.setSort(value);
      });
    }

    if (this.tagBar) {
      this.tagBar.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-value]');
        if (!chip) return;
        const tag = chip.dataset.value || '';
        this.toggleTag(tag);
      });
    }

    if (this.searchInput) {
      this.searchInput.value = this.state.search;
      this.searchInput.addEventListener('input', () => {
        const value = this.searchInput.value;
        if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
          this.state.search = value.trim();
          this.state.page = 1;
          this.applyFilters({ replaceHistory: true });
        }, 260);
      });
    }

    if (this.monthInput) {
      this.monthInput.value = this.state.ym;
      this.monthInput.addEventListener('change', () => {
        const value = this.monthInput.value;
        this.state.ym = value;
        this.state.page = 1;
        this.applyFilters({ replaceHistory: true });
      });
    }

    if (this.tagModeToggle) {
      this.tagModeToggle.addEventListener('click', () => {
        this.state.tagMode = this.state.tagMode === 'and' ? 'or' : 'and';
        this.state.page = 1;
        this.syncTagModeToggle();
        this.applyFilters({ replaceHistory: true });
      });
    }

    if (this.resetButton) {
      this.resetButton.addEventListener('click', () => {
        this.resetFilters();
      });
    }

    if (this.activeFilters) {
      this.activeFilters.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-remove]');
        if (!btn) return;
        const key = btn.dataset.remove;
        const value = btn.dataset.value || '';
        this.removeFilter(key, value);
      });
    }

    if (this.loadMoreButton) {
      this.loadMoreButton.addEventListener('click', () => {
        this.loadNextBatch();
      });
    }

    this.container.addEventListener('click', (event) => {
      const tagBtn = event.target.closest('[data-filter-tag]');
      if (tagBtn) {
        event.preventDefault();
        this.toggleTag(tagBtn.dataset.filterTag || '');
        return;
      }
      const unitBtn = event.target.closest('[data-filter-unit]');
      if (unitBtn) {
        event.preventDefault();
        this.toggleUnit(unitBtn.dataset.filterUnit || '');
        return;
      }
      const categoryBtn = event.target.closest('[data-filter-category]');
      if (categoryBtn) {
        event.preventDefault();
        this.toggleCategory(categoryBtn.dataset.filterCategory || '');
        return;
      }
      const detailLink = event.target.closest('a[href*="activity-detail-placeholder.html"]');
      if (detailLink) {
        this.storeScrollPosition();
        try {
          sessionStorage.setItem(HISTORY_QUERY_KEY, window.location.search || '');
        } catch {}
      }
    });

    this.container.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target.closest('[role="button"]');
      if (target) {
        event.preventDefault();
        target.click();
      }
    });
  }

  setupPopState() {
    window.addEventListener('popstate', () => {
      this.state = { ...this.defaultState, ...this.parseStateFromURL() };
      this.state.page = Math.max(1, this.state.page || 1);
      this.syncInputsFromState();
      this.applyFilters({ updateHistory: false, reset: true });
    });
  }

  setupScrollStorage() {
    try {
      window.history.scrollRestoration = 'manual';
    } catch {}
    try {
      const stored = sessionStorage.getItem(SCROLL_STORAGE_KEY);
      if (stored) {
        const value = parseInt(stored, 10);
        if (!Number.isNaN(value)) this.pendingScroll = value;
      }
    } catch {}
    const save = () => this.storeScrollPosition();
    window.addEventListener('beforeunload', save);
    window.addEventListener('pagehide', save);
  }

  async loadData() {
    try {
      this.showLoading(true);
      const resp = await fetch('/api/activities?limit=500');
      if (!resp.ok) throw new Error('Network response was not ok');
      const data = await resp.json();
      this.allItems = Array.isArray(data) ? data.map(normalizeActivity).filter(Boolean) : [];
      this.buildFilterOptions();
      this.syncInputsFromState();
      this.applyFilters({ updateHistory: false, reset: true });
      this.updateURL({ push: false, replace: true });
    } catch (error) {
      console.error('Failed to fetch activities:', error);
      if (this.resultsCount) this.resultsCount.textContent = '活動の読み込みに失敗しました。';
      this.container.innerHTML = '<p class="text-center text-red-500">活動の読み込みに失敗しました。</p>';
    } finally {
      this.showLoading(false);
      this.container.setAttribute('aria-busy', 'false');
    }
  }

  buildFilterOptions() {
    const categories = this.collectUnique('category');
    const units = this.collectUnique('unit');
    const tagCounts = this.collectTagCounts();

    if (this.categoryChips) {
      this.categoryChips.innerHTML = '';
      this.categoryChipMap.clear();
      const fragment = document.createDocumentFragment();
      const allChip = this.createChip('すべて', '', this.state.category === '');
      allChip.dataset.value = '';
      fragment.appendChild(allChip);
      this.categoryChipMap.set('', allChip);
      categories.forEach((category) => {
        const chip = this.createChip(category, category, this.state.category === category);
        chip.dataset.value = category;
        fragment.appendChild(chip);
        this.categoryChipMap.set(category, chip);
      });
      this.categoryChips.appendChild(fragment);
    }

    if (this.unitChips) {
      this.unitChips.innerHTML = '';
      this.unitChipMap.clear();
      const fragment = document.createDocumentFragment();
      const allChip = this.createChip('すべて', '', this.state.unit === '');
      allChip.dataset.value = '';
      fragment.appendChild(allChip);
      this.unitChipMap.set('', allChip);
      units.forEach((unit) => {
        const chip = this.createChip(unit, unit, this.state.unit === unit);
        chip.dataset.value = unit;
        fragment.appendChild(chip);
        this.unitChipMap.set(unit, chip);
      });
      this.unitChips.appendChild(fragment);
    }

    if (this.sortChips) {
      this.sortChips.innerHTML = '';
      this.sortChipMap.clear();
      const options = [
        { value: 'newest', label: '新着順' },
        { value: 'oldest', label: '古い順' },
        { value: 'title', label: 'タイトル順' }
      ];
      const fragment = document.createDocumentFragment();
      options.forEach((opt) => {
        const chip = this.createChip(opt.label, opt.value, this.state.sort === opt.value, ['chip--outline']);
        chip.dataset.value = opt.value;
        fragment.appendChild(chip);
        this.sortChipMap.set(opt.value, chip);
      });
      this.sortChips.appendChild(fragment);
    }

    if (this.tagBar) {
      this.tagBar.innerHTML = '';
      this.tagChipMap.clear();
      const fragment = document.createDocumentFragment();
      tagCounts.slice(0, 24).forEach(([tag, count]) => {
        const chip = this.createChip(`#${tag}`, tag, this.state.tags.includes(tag), ['chip--outline']);
        chip.dataset.value = tag;
        chip.innerHTML = `<span>#${escapeHTML(tag)}</span><span class="chip__count">${count}</span>`;
        chip.setAttribute('aria-pressed', this.state.tags.includes(tag) ? 'true' : 'false');
        fragment.appendChild(chip);
        this.tagChipMap.set(tag, chip);
      });
      if (!fragment.children.length) {
        const empty = document.createElement('p');
        empty.className = 'text-sm text-gray-500';
        empty.textContent = 'タグ情報はまだありません。';
        this.tagBar.appendChild(empty);
      } else {
        this.tagBar.appendChild(fragment);
      }
    }

    this.syncTagModeToggle();
  }

  collectUnique(key) {
    const set = new Set();
    this.allItems.forEach((item) => {
      const value = (item && item[key]) ? String(item[key]).trim() : '';
      if (value) set.add(value);
    });
    return Array.from(set).sort((a, b) => collator.compare(a, b));
  }

  collectTagCounts() {
    const map = new Map();
    this.allItems.forEach((item) => {
      const tags = Array.isArray(item?._tags) ? item._tags : [];
      tags.forEach((tag) => {
        const key = String(tag).trim();
        if (!key) return;
        map.set(key, (map.get(key) || 0) + 1);
      });
    });
    return Array.from(map.entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return collator.compare(a[0], b[0]);
    });
  }

  createChip(label, value, isActive, extraClasses = []) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = ['chip', ...extraClasses].join(' ');
    if (isActive) button.classList.add('chip--active');
    button.dataset.value = value;
    button.textContent = label;
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    return button;
  }

  toggleChipActive(chip, isActive) {
    if (!chip) return;
    chip.classList.toggle('chip--active', Boolean(isActive));
    chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  }

  syncTagModeToggle() {
    if (!this.tagModeToggle) return;
    const isAnd = this.state.tagMode === 'and';
    this.tagModeToggle.classList.toggle('chip--active', isAnd);
    this.tagModeToggle.setAttribute('aria-pressed', isAnd ? 'true' : 'false');
    this.tagModeToggle.textContent = `タグ条件: ${isAnd ? 'AND (全て含む)' : 'OR (いずれか含む)'}`;
  }

  syncInputsFromState() {
    this.categoryChipMap.forEach((chip, value) => this.toggleChipActive(chip, this.state.category === value));
    this.unitChipMap.forEach((chip, value) => this.toggleChipActive(chip, this.state.unit === value));
    this.sortChipMap.forEach((chip, value) => this.toggleChipActive(chip, this.state.sort === value));
    this.tagChipMap.forEach((chip, value) => {
      const active = this.state.tags.includes(value);
      this.toggleChipActive(chip, active);
      chip.classList.toggle('is-muted', this.state.tags.length > 0 && !active);
    });
    if (this.searchInput && this.searchInput.value !== this.state.search) {
      this.searchInput.value = this.state.search;
    }
    if (this.monthInput && this.monthInput.value !== this.state.ym) {
      this.monthInput.value = this.state.ym;
    }
    this.syncTagModeToggle();
  }

  applyFilters({ updateHistory = true, replaceHistory = false, reset = true } = {}) {
    this.filteredItems = this.filterItems();
    if (!this.filteredItems.length) {
      this.state.page = 1;
    }
    const maxPage = Math.max(1, Math.ceil(Math.max(this.filteredItems.length, 1) / this.batchSize));
    if (this.state.page > maxPage) this.state.page = maxPage;
    if (reset) {
      this.container.innerHTML = '';
      this.visibleCount = 0;
    }
    this.render({ reset });
    this.updateResultsCount();
    this.updateActiveFilters();
    if (updateHistory) this.updateURL({ push: !replaceHistory, replace: replaceHistory });
  }

  filterItems() {
    const { category, unit, tags, tagMode, ym, search, sort } = this.state;
    const normalizedTags = Array.isArray(tags) ? tags.map(tag => String(tag)) : [];
    const searchWords = search ? search.trim().toLowerCase().split(/\s+/).filter(Boolean) : [];
    const isAnd = tagMode === 'and';
    return this.allItems.filter((item) => {
      if (category && String(item.category || '') !== category) return false;
      if (unit && String(item.unit || '') !== unit) return false;
      if (ym && item._month !== ym) return false;
      if (normalizedTags.length) {
        const lowerTags = item._tagsLower || [];
        if (isAnd) {
          const every = normalizedTags.every(tag => lowerTags.includes(tag.toLowerCase()));
          if (!every) return false;
        } else {
          const some = normalizedTags.some(tag => lowerTags.includes(tag.toLowerCase()));
          if (!some) return false;
        }
      }
      if (searchWords.length) {
        const blob = item._searchBlob || '';
        const ok = searchWords.every(word => blob.includes(word));
        if (!ok) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sort === 'oldest') {
        return (a._dateObj ? a._dateObj.getTime() : 0) - (b._dateObj ? b._dateObj.getTime() : 0);
      }
      if (sort === 'title') {
        return collator.compare(a.title || '', b.title || '');
      }
      return (b._dateObj ? b._dateObj.getTime() : 0) - (a._dateObj ? a._dateObj.getTime() : 0);
    });
  }

  render({ reset = false } = {}) {
    this.showLoading(false);
    if (!this.filteredItems.length) {
      if (reset) this.container.innerHTML = '';
      this.noResults?.classList?.remove('hidden');
      this.loadMoreButton?.classList?.add('hidden');
      this.listEnd?.classList?.add('hidden');
      if (this.sentinel) this.sentinel.classList.add('hidden');
      return;
    }
    this.noResults?.classList?.add('hidden');

    const totalShouldDisplay = Math.min(this.filteredItems.length, this.state.page * this.batchSize);
    const fragment = document.createDocumentFragment();
    for (let i = this.visibleCount; i < totalShouldDisplay; i += 1) {
      const card = this.createCard(this.filteredItems[i]);
      fragment.appendChild(card);
    }
    if (fragment.children.length) {
      this.container.appendChild(fragment);
    }
    this.visibleCount = totalShouldDisplay;

    const hasMore = this.visibleCount < this.filteredItems.length;
    if (hasMore) {
      this.loadMoreButton?.classList?.remove('hidden');
      this.listEnd?.classList?.add('hidden');
      if (this.sentinel) this.sentinel.classList.remove('hidden');
    } else {
      this.loadMoreButton?.classList?.add('hidden');
      this.listEnd?.classList?.remove('hidden');
      if (this.sentinel) this.sentinel.classList.add('hidden');
    }

    this.setupIntersectionObserver();
    this.restoreScrollIfNeeded();
  }

  createCard(item) {
    const accent = resolveAccentTheme(item);
    const card = document.createElement('article');
    card.className = 'activity-card';
    card.dataset.activityId = String(item.id || '');
    card.style.setProperty('--accent-color', accent.color);
    card.style.setProperty('--icon-color', accent.color);
    card.style.setProperty('--icon-bg', accent.iconBg);
    card.style.setProperty('--type-color', accent.typeColor || accent.color);
    card.style.setProperty('--tag-bg', accent.tagBg);
    card.style.setProperty('--tag-color', accent.tagColor);
    card.style.setProperty('--tag-active-bg', accent.tagActiveBg);
    card.style.setProperty('--tag-active-color', accent.tagActiveColor);
    card.style.setProperty('--badge-bg', accent.badgeBg);
    card.style.setProperty('--badge-color', accent.badgeColor);

    const statusBadges = [];
    if (item._isImportant) {
      statusBadges.push('<span class="activity-card__status" aria-label="重要なお知らせ">重要</span>');
    }
    if (item._isRecent && !item._isImportant) {
      statusBadges.push('<span class="activity-card__status" style="color:#1d4ed8;background:rgba(59,130,246,0.16)">NEW</span>');
    }

    const unitBadge = item.unit ? `<span class="activity-card__badge" role="button" tabindex="0" data-filter-unit="${escapeHTML(item.unit)}" style="--badge-bg:rgba(191,219,254,0.7);--badge-color:#1d4ed8;">${escapeHTML(item.unit)}</span>` : '';
    const categoryBadge = item.category ? `<span class="activity-card__badge" role="button" tabindex="0" data-filter-category="${escapeHTML(item.category)}">${escapeHTML(item.category)}</span>` : '';

    const tags = Array.isArray(item._tags) ? item._tags.slice(0, 8) : [];
    const tagsHtml = tags.map((tag) => {
      const label = String(tag);
      const active = this.state.tags.includes(label);
      return `<button type="button" class="activity-card__tag${active ? ' is-active' : ''}" data-filter-tag="${escapeHTML(label)}" aria-pressed="${active ? 'true' : 'false'}">#${escapeHTML(label)}</button>`;
    }).join('');

    const url = `activity-detail-placeholder.html?id=${encodeURIComponent(item.id)}`;

    card.innerHTML = `
      <div class="activity-card__accent"></div>
      <div class="activity-card__type">
        <span class="activity-card__icon" aria-hidden="true">${ICON_SET[accent.icon] || ICON_SET.camp}</span>
        <span class="activity-card__type-label">${escapeHTML(accent.typeLabel)}</span>
        ${statusBadges.join('')}
      </div>
      <h3 class="activity-card__title">
        <a href="${url}">${escapeHTML(item.title || '')}</a>
      </h3>
      <p class="activity-card__summary">${escapeHTML(item._summary || '')}</p>
      <div class="activity-card__meta">
        <div class="activity-card__badges">${unitBadge}${categoryBadge}</div>
        <time datetime="${escapeHTML(item._isoDate || '')}">${escapeHTML(item._displayDate || '')}</time>
      </div>
      ${tagsHtml ? `<div class="activity-card__tags">${tagsHtml}</div>` : ''}
      <a class="activity-card__link" href="${url}" aria-label="${escapeHTML(item.title || '')}の詳細を読む">続きを読む<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path></svg></a>
    `;
    return card;
  }

  updateResultsCount() {
    if (!this.resultsCount) return;
    if (!this.filteredItems.length) {
      this.resultsCount.textContent = '該当する活動はありません。条件を変更してみてください。';
      return;
    }
    const total = this.filteredItems.length;
    const visible = this.visibleCount;
    const tagModeLabel = this.state.tags.length > 1 ? `（タグ条件: ${this.state.tagMode.toUpperCase()}）` : '';
    this.resultsCount.textContent = `${total}件中 ${visible}件を表示中${tagModeLabel}`;
  }

  updateActiveFilters() {
    if (!this.activeFilters || !this.activeFilterBar) return;
    const chips = [];
    if (this.state.category) chips.push(this.createActiveFilterChip('カテゴリ', this.state.category, 'category'));
    if (this.state.unit) chips.push(this.createActiveFilterChip('隊', this.state.unit, 'unit'));
    if (this.state.ym) chips.push(this.createActiveFilterChip('活動月', formatMonthLabel(this.state.ym), 'ym'));
    if (this.state.search) chips.push(this.createActiveFilterChip('キーワード', this.state.search, 'search'));
    this.state.tags.forEach((tag) => chips.push(this.createActiveFilterChip(`#${tag}`, tag, 'tag')));
    if (this.state.sort !== 'newest') chips.push(this.createActiveFilterChip('並び順', this.getSortLabel(this.state.sort), 'sort'));
    if (this.state.tagMode === 'and' && this.state.tags.length > 1) chips.push(this.createActiveFilterChip('タグ条件 AND', 'and', 'tagMode'));

    this.activeFilters.innerHTML = '';
    chips.forEach((chip) => this.activeFilters.appendChild(chip));
    if (chips.length) {
      this.activeFilterBar.classList.remove('hidden');
    } else {
      this.activeFilterBar.classList.add('hidden');
    }
  }

  createActiveFilterChip(label, value, key) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip chip--outline';
    button.dataset.remove = key;
    if (value) button.dataset.value = value;
    button.innerHTML = `<span>${escapeHTML(label)}${value && key !== 'tagMode' && !label.startsWith('#') ? `: ${escapeHTML(value)}` : ''}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M6 18L18 6"></path></svg>`;
    button.setAttribute('aria-label', `${label}を解除`);
    return button;
  }

  getSortLabel(value) {
    if (value === 'oldest') return '古い順';
    if (value === 'title') return 'タイトル順';
    return '新着順';
  }

  updateURL({ push = true, replace = false } = {}) {
    const params = new URLSearchParams();
    if (this.state.category) params.set('category', this.state.category);
    if (this.state.unit) params.set('unit', this.state.unit);
    if (this.state.tags.length) params.set('tags', this.state.tags.join(','));
    if (this.state.tagMode === 'and') params.set('tagMode', 'and');
    if (this.state.ym) params.set('ym', this.state.ym);
    if (this.state.search) params.set('search', this.state.search);
    if (this.state.sort !== 'newest') params.set('sort', this.state.sort);
    if (this.state.page > 1) params.set('page', String(this.state.page));
    const query = params.toString();
    const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
    try {
      if (replace) {
        window.history.replaceState({}, '', newUrl);
      } else if (push) {
        window.history.pushState({}, '', newUrl);
      } else {
        window.history.replaceState({}, '', newUrl);
      }
      sessionStorage.setItem(HISTORY_QUERY_KEY, query ? `?${query}` : '');
    } catch (error) {
      console.warn('Failed to update history state', error);
    }
  }

  toggleCategory(value) {
    this.state.category = this.state.category === value ? '' : value;
    this.state.page = 1;
    this.syncInputsFromState();
    this.applyFilters({ replaceHistory: true });
  }

  toggleUnit(value) {
    this.state.unit = this.state.unit === value ? '' : value;
    this.state.page = 1;
    this.syncInputsFromState();
    this.applyFilters({ replaceHistory: true });
  }

  setSort(value) {
    if (!['newest', 'oldest', 'title'].includes(value)) value = 'newest';
    this.state.sort = value;
    this.state.page = 1;
    this.syncInputsFromState();
    this.applyFilters({ replaceHistory: true });
  }

  toggleTag(tag) {
    const value = String(tag).trim();
    if (!value) return;
    const has = this.state.tags.includes(value);
    this.state.tags = has ? this.state.tags.filter(t => t !== value) : [...this.state.tags, value];
    this.state.page = 1;
    this.syncInputsFromState();
    this.applyFilters({ replaceHistory: true });
  }

  removeFilter(key, value) {
    switch (key) {
      case 'category':
        this.state.category = '';
        break;
      case 'unit':
        this.state.unit = '';
        break;
      case 'ym':
        this.state.ym = '';
        if (this.monthInput) this.monthInput.value = '';
        break;
      case 'search':
        this.state.search = '';
        if (this.searchInput) this.searchInput.value = '';
        break;
      case 'tag':
        this.state.tags = this.state.tags.filter(tag => tag !== value);
        break;
      case 'sort':
        this.state.sort = 'newest';
        break;
      case 'tagMode':
        this.state.tagMode = 'or';
        break;
      default:
        break;
    }
    this.state.page = 1;
    this.syncInputsFromState();
    this.applyFilters({ replaceHistory: true });
  }

  resetFilters() {
    this.state = { ...this.defaultState };
    if (this.searchInput) this.searchInput.value = '';
    if (this.monthInput) this.monthInput.value = '';
    this.syncInputsFromState();
    this.applyFilters({ replaceHistory: true });
  }

  loadNextBatch() {
    if (this.visibleCount >= this.filteredItems.length) return;
    this.state.page += 1;
    this.render({ reset: false });
    this.updateResultsCount();
    this.updateURL({ push: false, replace: true });
  }

  setupIntersectionObserver() {
    if (!this.sentinel || !('IntersectionObserver' in window)) return;
    if (!this.intersectionObserver) {
      this.intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.loadNextBatch();
          }
        });
      }, { rootMargin: '120px' });
    }
    this.intersectionObserver.disconnect();
    if (this.visibleCount < this.filteredItems.length) {
      this.intersectionObserver.observe(this.sentinel);
    }
  }

  showLoading(active) {
    if (!this.loadingIndicator) return;
    this.loadingIndicator.style.display = active ? 'flex' : 'none';
  }

  storeScrollPosition() {
    try {
      sessionStorage.setItem(SCROLL_STORAGE_KEY, String(Math.round(window.scrollY || 0)));
    } catch {}
  }

  restoreScrollIfNeeded() {
    if (this.pendingScroll == null) return;
    const y = this.pendingScroll;
    this.pendingScroll = null;
    setTimeout(() => {
      window.scrollTo(0, y);
    }, 80);
    try {
      sessionStorage.removeItem(SCROLL_STORAGE_KEY);
    } catch {}
  }
}

async function loadDynamicActivityDetail() {
  const container = document.getElementById('activity-article-container');
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) return;

  const breadcrumbTitle = document.getElementById('activity-title-breadcrumb');
  const pageTitle = document.getElementById('page-title');
  const notFound = document.getElementById('article-not-found');

  try {
    container.innerHTML = '<p class="text-center text-gray-500">読み込み中...</p>';
    const resp = await fetch(`/api/activities/${encodeURIComponent(id)}`);
    if (!resp.ok) throw new Error('Network response was not ok');
    const activity = await resp.json();
    if (!activity || !activity.id) throw new Error('Not found');

    const normalized = normalizeActivity(activity);
    if (breadcrumbTitle) breadcrumbTitle.textContent = normalized.title || '活動報告';
    if (pageTitle) pageTitle.textContent = `${normalized.title || '活動報告詳細'} - ボーイスカウト多治見第一団`;

    container.innerHTML = buildActivityDetailTemplate(normalized);
    enhanceActivityArticle(container, normalized);
  } catch (error) {
    console.error('Failed to fetch activity detail:', error);
    container.innerHTML = '';
    if (notFound) notFound.classList.remove('hidden');
  }
}

function buildActivityDetailTemplate(item) {
  const accent = resolveAccentTheme(item);
  const tags = Array.isArray(item._tags) ? item._tags : [];
  const tagsHtml = tags.map((tag) => `<a href="activity-log.html?tags=${encodeURIComponent(tag)}" class="activity-card__tag" data-tag-link="${escapeHTML(tag)}">#${escapeHTML(tag)}</a>`).join('');
  const tagSection = tagsHtml ? `<div class="activity-detail-tags">${tagsHtml}</div>` : '';
  let backLink = 'activity-log.html';
  try {
    const lastQuery = sessionStorage.getItem(HISTORY_QUERY_KEY);
    if (lastQuery) backLink += lastQuery;
  } catch {}
  const metaParts = [];
  if (item._displayDate) metaParts.push(`<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7V3M16 7V3M4.5 11h15M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"></path></svg>${escapeHTML(item._displayDate)}</span>`);
  if (item.unit) metaParts.push(`<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z"></path><path d="M6 20a6 6 0 0112 0"></path></svg>${escapeHTML(item.unit)}</span>`);
  if (item.category) metaParts.push(`<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18"></path><path d="M5 7v14h14V7"></path><path d="M9 7V5a3 3 0 016 0v2"></path></svg>${escapeHTML(item.category)}</span>`);

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
        <div class="space-y-8" id="activity-article-main">
          <div id="activity-hero-media"></div>
          <div class="lg:hidden">
            <details class="activity-toc-mobile hidden" id="activity-toc-mobile">
              <summary>目次 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"></path></svg></summary>
              <nav id="activity-toc-mobile-list" class="activity-toc-list mt-3"></nav>
            </details>
          </div>
          <div class="prose max-w-none prose-lg leading-relaxed">${item.content || ''}</div>
          <div>
            <a href="${backLink}" class="return-link">← 条件を保持して一覧へ戻る</a>
          </div>
        </div>
        <aside class="activity-toc-sticky space-y-5 hidden lg:block">
          <div class="activity-toc-card hidden" id="activity-toc-card">
            <p class="activity-toc-title">目次</p>
            <nav id="activity-toc" class="activity-toc-list"></nav>
          </div>
          <div class="activity-toc-card" id="activity-meta-card">
            <p class="activity-toc-title">この記事について</p>
            <div class="space-y-3 text-sm text-gray-600">
              ${item._displayDate ? `<p>公開日: <time datetime="${escapeHTML(item._isoDate || '')}">${escapeHTML(item._displayDate)}</time></p>` : ''}
              ${item.unit ? `<p>所属: ${escapeHTML(item.unit)}</p>` : ''}
              ${item.category ? `<p>カテゴリ: ${escapeHTML(item.category)}</p>` : ''}
            </div>
          </div>
        </aside>
      </div>
    </div>
  `;
}

function enhanceActivityArticle(container, item) {
  const hero = container.querySelector('#activity-hero-media');
  if (hero) {
    buildGallery(hero, item);
  }
  const prose = container.querySelector('.prose');
  if (prose) {
    buildTableOfContents(prose, container);
  }
}

function buildGallery(wrapper, item) {
  const images = Array.isArray(item.image_urls) ? item.image_urls : [];
  if (!images.length) {
    wrapper.remove();
    return;
  }
  const normalized = images.map(normalizeImageUrl).filter(Boolean);
  if (!normalized.length) {
    wrapper.remove();
    return;
  }
  const main = normalized[0];
  const others = normalized.slice(1, 6);
  const mainHtml = `<div class="overflow-hidden rounded-2xl shadow-xl border border-gray-200"><img src="${escapeHTML(main)}" alt="${escapeHTML(item.title || '')}" class="w-full h-auto max-h-[70vh] object-cover"></div>`;
  const thumbs = others.length ? `<div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">${others.map((url) => `<a href="${escapeHTML(url)}" target="_blank" rel="noopener" class="block overflow-hidden rounded-xl border border-gray-200 hover:border-green-400 transition"><img src="${escapeHTML(url)}" alt="${escapeHTML(item.title || '')}" class="w-full h-32 sm:h-36 object-cover"></a>`).join('')}</div>` : '';
  wrapper.innerHTML = `${mainHtml}${thumbs}`;
}

function buildTableOfContents(prose, root) {
  const headings = Array.from(prose.querySelectorAll('h2, h3')).filter((heading) => heading.textContent && heading.textContent.trim().length > 0);
  const tocCard = root.querySelector('#activity-toc-card');
  const tocList = tocCard?.querySelector('#activity-toc');
  const mobileWrapper = root.querySelector('#activity-toc-mobile');
  const mobileList = root.querySelector('#activity-toc-mobile-list');
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
