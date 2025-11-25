// list-dashboard-base.js
// ニュース・活動記録一覧ページの共通基底クラス

class BaseListDashboard {
  /**
   * @param {string} prefix - DOM IDのプレフィックス (例: 'news', 'activity')
   * @param {string} apiUrl - データ取得APIのベースURL
   * @param {string} storageKey - セッションストレージのキー
   */
  constructor(prefix, apiUrl, storageKey) {
    this.prefix = prefix;
    this.apiUrl = apiUrl;
    this.storageKey = storageKey;

    this.container = document.getElementById(`${prefix}-list-container`) || document.getElementById(`${prefix}-log-container`);
    if (!this.container) return;

    // DOM Elements
    this.paginationContainer = document.getElementById(`${prefix}-pagination-container`);
    this.noResultsDiv = document.getElementById(`no-${prefix}-results`);
    this.resultsCount = document.getElementById(`${prefix}-results-count`);

    this.catSelect = document.getElementById(`${prefix}-category-chips`);
    this.unitSelect = document.getElementById(`${prefix}-unit-chips`);
    this.tagBar = document.getElementById(`${prefix}-tag-bar`);
    this.searchInput = document.getElementById(`${prefix}-search`);
    this.dateInput = document.getElementById(`${prefix}-date-filter`);
    this.sortSelect = document.getElementById(`${prefix}-sort-chips`);
    this.resetBtn = document.getElementById(`${prefix}-reset-filters`);
    this.activeFilterBar = document.getElementById(`${prefix}-active-filter-bar`);
    this.activeFilters = document.getElementById(`${prefix}-active-filters`);
    this.tagModeToggle = document.getElementById(`${prefix}-tag-mode-toggle`);
    this.loadMoreButton = document.getElementById(`${prefix}-load-more-button`); // もしあれば

    // Config
    this.ITEMS_PER_PAGE = 6;

    // State
    this.allItems = [];
    this.filteredItems = [];
    this.state = {
      page: 1,
      category: '',
      unit: '',
      tags: [],
      tagMode: 'or',
      ym: '',
      search: '',
      sort: 'newest'
    };

    this.isLoading = false;
    this.searchDebounceTimer = null;

    this.loadingSpinner = document.getElementById(`${prefix}-list-loading`);

    this.init();
  }

  async init() {
    this.renderSkeletons();
    this.loadStateFromURL();
    await this.fetchData();
    this.bindEvents();
    this.applyFilters();
  }

  loadStateFromURL() {
    const params = new URLSearchParams(window.location.search);
    this.state.page = parseInt(params.get('page')) || 1;
    this.state.category = params.get('category') || '';
    this.state.unit = params.get('unit') || '';
    this.state.ym = params.get('ym') || '';
    this.state.search = params.get('q') || '';
    this.state.sort = params.get('sort') || 'newest';
    this.state.tagMode = params.get('tagMode') || 'or';

    const tagsParam = params.get('tags');
    if (tagsParam) {
      this.state.tags = tagsParam.split(',').filter(Boolean);
    }

    // UIに反映
    if (this.searchInput) this.searchInput.value = this.state.search;
    if (this.dateInput) this.dateInput.value = this.state.ym;
    this.updateTagModeDisplay();
  }

  async fetchData() {
    try {
      // 設定取得 (サブクラスでオーバーライド可能だが、基本は共通)
      const settingsRes = await fetch('/api/settings/all');
      let settings = {};
      if (settingsRes.ok) {
        settings = (await settingsRes.json()).reduce((acc, it) => (acc[it.key] = it.value, acc), {});
      }
      this.renderFilterOptions(settings);

      // データ取得
      const res = await fetch(this.apiUrl + (this.apiUrl.includes('?') ? '&' : '?') + 'limit=1000');
      if (!res.ok) throw new Error('Network response was not ok');

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('API Response is not JSON. Status:', res.status, 'Body:', text.substring(0, 500));
        throw new Error('Invalid JSON response');
      }

      if (Array.isArray(data)) {
        this.allItems = data;
      } else if (data && Array.isArray(data.items)) {
        this.allItems = data.items;
      } else {
        this.allItems = [];
        console.warn('Unexpected API response format:', data);
      }
    } catch (error) {
      console.error(`Failed to fetch data for ${this.prefix}:`, error);
      this.container.innerHTML = '<p class="text-center text-red-500 py-8">データの読み込みに失敗しました。</p>';
    } finally {
      if (this.loadingSpinner) {
        this.loadingSpinner.classList.add('hidden');
      }
    }
  }

  // サブクラスで実装すべきメソッド
  renderFilterOptions(settings) { }
  renderItem(item) { return ''; }
  normalizeItem(item) { return item; }

  // 共通フィルタリングロジック
  applyFilters() {
    const { category, unit, tags, tagMode, ym, search, sort } = this.state;

    let filtered = this.allItems.map(item => this.normalizeItem(item)).filter(item => {
      if (category && item.category !== category) return false;
      if (unit && item.unit !== unit) return false;

      if (ym) {
        // normalizeItemで _dateObj を作っておくことを推奨
        const d = item._dateObj || new Date(item.activity_date || item.created_at);
        if (!isNaN(d)) {
          const itemYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (itemYm !== ym) return false;
        }
      }

      if (search) {
        const q = search.toLowerCase();
        // normalizeItemで _searchBlob を作っておくことを推奨
        const text = item._searchBlob || `${item.title} ${item.content}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      if (tags.length > 0) {
        const itemTags = Array.isArray(item.tags) ? item.tags : [];
        if (tagMode === 'and') {
          if (!tags.every(t => itemTags.includes(t))) return false;
        } else {
          if (!tags.some(t => itemTags.includes(t))) return false;
        }
      }
      return true;
    });

    filtered.sort((a, b) => {
      const dateA = a._dateObj || new Date(a.activity_date || a.created_at);
      const dateB = b._dateObj || new Date(b.activity_date || b.created_at);
      if (sort === 'title') {
        return (a.title || '').localeCompare(b.title || '', 'ja');
      }
      return sort === 'oldest' ? dateA - dateB : dateB - dateA;
    });

    this.filteredItems = filtered;
    this.updateUI();
    this.updateURL();
  }

  updateUI() {
    // チップ状態更新
    document.querySelectorAll(`.chip[data-type]`).forEach(btn => {
      // 自分のコンテナ内のチップだけ対象にする
      if (btn.closest(`#${this.prefix}-filter-panel`)) {
        this.updateChipState(btn, btn.dataset.type, btn.dataset.value);
      }
    });

    if (this.resultsCount) {
      this.resultsCount.textContent = `${this.filteredItems.length}件`;
    }

    this.renderActiveFilters();

    const totalPages = Math.ceil(this.filteredItems.length / this.ITEMS_PER_PAGE) || 1;
    if (this.state.page > totalPages) this.state.page = 1;

    const start = (this.state.page - 1) * this.ITEMS_PER_PAGE;
    const pageItems = this.filteredItems.slice(start, start + this.ITEMS_PER_PAGE);

    this.renderList(pageItems);
    this.renderPagination(totalPages);
  }

  renderList(items) {
    this.container.innerHTML = '';

    if (items.length === 0) {
      if (this.noResultsDiv) this.noResultsDiv.classList.remove('hidden');
      return;
    }
    if (this.noResultsDiv) this.noResultsDiv.classList.add('hidden');

    const fragment = document.createDocumentFragment();
    items.forEach(item => {
      const el = document.createElement('div');
      el.innerHTML = this.renderItem(item);
      // 直下の子要素を取り出す（ラッパーdivを排除）
      while (el.firstChild) fragment.appendChild(el.firstChild);
    });
    this.container.appendChild(fragment);
  }

  renderPagination(totalPages) {
    if (!this.paginationContainer) return;
    this.paginationContainer.innerHTML = '';
    if (totalPages <= 1) return;

    const createBtn = (page, label, isDisabled = false, isActive = false) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = `${this.prefix}-pagination-button pagination-button ${isActive ? 'pagination-active' : ''} ${isDisabled ? 'pagination-disabled' : ''}`;
      btn.innerHTML = label;
      if (!isDisabled) {
        btn.addEventListener('click', () => {
          this.state.page = page;
          this.updateUI();
          this.container.scrollIntoView({ behavior: 'smooth', block: 'start' });
          this.updateURL();
        });
      }
      li.appendChild(btn);
      return li;
    };

    const ul = document.createElement('ul');
    ul.className = 'inline-flex items-center -space-x-px shadow-sm rounded-md';

    ul.appendChild(createBtn(this.state.page - 1, '<span class="sr-only">前へ</span>←', this.state.page === 1));
    for (let i = 1; i <= totalPages; i++) {
      // ページ数が多い場合の省略ロジックは今回割愛（必要なら追加）
      ul.appendChild(createBtn(i, i, false, i === this.state.page));
    }
    ul.appendChild(createBtn(this.state.page + 1, '<span class="sr-only">次へ</span>→', this.state.page === totalPages));

    this.paginationContainer.appendChild(ul);
  }

  renderActiveFilters() {
    if (!this.activeFilters || !this.activeFilterBar) return;
    this.activeFilters.innerHTML = '';

    const addBadge = (label, type, value = '') => {
      const btn = document.createElement('button');
      btn.className = 'chip chip--outline text-xs flex items-center gap-1 pr-2';
      // SVGは共通
      btn.innerHTML = `<span>${escapeHTML(label)}</span><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
      btn.dataset.type = type;
      btn.dataset.value = value;
      this.activeFilters.appendChild(btn);
    };

    if (this.state.search) addBadge(`検索: ${this.state.search}`, 'search');
    if (this.state.category) addBadge(`カテゴリ: ${this.state.category}`, 'category');
    if (this.state.unit) addBadge(`隊: ${this.state.unit}`, 'unit');
    if (this.state.ym) addBadge(`年月: ${this.state.ym}`, 'ym');
    this.state.tags.forEach(tag => addBadge(`#${tag}`, 'tag', tag));

    if (this.activeFilters.children.length > 0) {
      this.activeFilterBar.classList.remove('hidden');
    } else {
      this.activeFilterBar.classList.add('hidden');
    }
  }

  // --- Event Handlers & Helpers ---

  bindEvents() {
    // 検索
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
          this.state.search = e.target.value.trim();
          this.state.page = 1;
          this.applyFilters();
        }, 300);
      });
    }
    // 日付
    if (this.dateInput) {
      this.dateInput.addEventListener('change', (e) => {
        this.state.ym = e.target.value;
        this.state.page = 1;
        this.applyFilters();
      });
    }
    // リセット
    if (this.resetBtn) {
      this.resetBtn.addEventListener('click', () => {
        this.state = {
          page: 1, category: '', unit: '', tags: [],
          tagMode: 'or', ym: '', search: '', sort: 'newest'
        };
        if (this.searchInput) this.searchInput.value = '';
        if (this.dateInput) this.dateInput.value = '';
        this.applyFilters();
      });
    }
    // タグモード
    if (this.tagModeToggle) {
      this.tagModeToggle.addEventListener('click', () => {
        this.state.tagMode = this.state.tagMode === 'or' ? 'and' : 'or';
        this.updateTagModeDisplay();
        this.applyFilters();
      });
    }
    // アクティブフィルタ削除
    if (this.activeFilters) {
      this.activeFilters.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const type = btn.dataset.type;
        const value = btn.dataset.value;

        if (type === 'tag') {
          this.state.tags = this.state.tags.filter(t => t !== value);
        } else if (type === 'search') {
          this.state.search = '';
          if (this.searchInput) this.searchInput.value = '';
        } else if (type === 'ym') {
          this.state.ym = '';
          if (this.dateInput) this.dateInput.value = '';
        } else {
          this.state[type] = '';
        }
        this.state.page = 1;
        this.applyFilters();
      });
    }
  }

  updateTagModeDisplay() {
    if (this.tagModeToggle) {
      const isAnd = this.state.tagMode === 'and';
      this.tagModeToggle.textContent = `タグ条件: ${isAnd ? 'AND (全て含む)' : 'OR (いずれか含む)'}`;
      this.tagModeToggle.classList.toggle('chip--active', isAnd);
      this.tagModeToggle.classList.toggle('chip--outline', !isAnd);
    }
  }

  updateURL() {
    const params = new URLSearchParams();
    if (this.state.page > 1) params.set('page', this.state.page);
    if (this.state.category) params.set('category', this.state.category);
    if (this.state.unit) params.set('unit', this.state.unit);
    if (this.state.ym) params.set('ym', this.state.ym);
    if (this.state.search) params.set('q', this.state.search);
    if (this.state.sort !== 'newest') params.set('sort', this.state.sort);
    if (this.state.tags.length > 0) params.set('tags', this.state.tags.join(','));
    if (this.state.tagMode !== 'or') params.set('tagMode', this.state.tagMode);

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);
    try { sessionStorage.setItem(this.storageKey, window.location.search); } catch { }
  }

  renderChips(container, items, type, labels = []) {
    if (!container) return;
    container.innerHTML = '';
    items.forEach((item, index) => {
      const value = typeof item === 'object' ? item.val : item;
      const label = typeof item === 'object' ? item.label : (labels[index] || item);

      const btn = document.createElement('button');
      btn.className = 'chip chip--outline text-xs';
      btn.dataset.type = type;
      btn.dataset.value = value;
      btn.textContent = label;
      this.updateChipState(btn, type, value);
      btn.addEventListener('click', () => this.handleChipClick(type, value));
      container.appendChild(btn);
    });
  }

  updateChipState(btn, type, value) {
    let isActive = false;
    if (type === 'tag') {
      isActive = this.state.tags.includes(value);
    } else {
      isActive = this.state[type] === value;
    }
    if (isActive) {
      btn.classList.remove('chip--outline');
      btn.classList.add('chip--active');
    } else {
      btn.classList.add('chip--outline');
      btn.classList.remove('chip--active');
    }
  }

  handleChipClick(type, value) {
    if (type === 'tag') {
      if (this.state.tags.includes(value)) {
        this.state.tags = this.state.tags.filter(t => t !== value);
      } else {
        this.state.tags.push(value);
      }
    } else if (type === 'sort') {
      this.state.sort = value;
    } else {
      this.state[type] = this.state[type] === value ? '' : value;
    }
    this.state.page = 1;
    this.applyFilters();
  }

  renderSkeletons() {
    // Default implementation
    const cards = [];
    for (let i = 0; i < this.ITEMS_PER_PAGE; i++) {
      cards.push(`<div class="bg-white rounded-xl shadow-lg overflow-hidden animate-pulse p-6 h-60"></div>`);
    }
    this.container.innerHTML = cards.join('');
  }
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function (match) {
    const escape = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return escape[match];
  });
}

window.BaseListDashboard = BaseListDashboard;
window.escapeHTML = escapeHTML; // サブクラスで使うため
