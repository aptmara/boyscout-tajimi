// admin-app.js (modern admin shell)
(function () {
  const state = {
    activeView: null,
    palette: {
      open: false,
      items: [],
      filtered: [],
      selectedIndex: -1,
    },
    cache: {
      news: null,
      activities: null,
      settings: null,
      summary: null,
    },
  };

  const views = {
    dashboard: {
      title: 'ダッシュボード',
      subtitle: '活動とお知らせの指標をひと目で把握',
      render: renderDashboardView,
    },
    news: {
      title: 'お知らせ',
      subtitle: '最新のお知らせを作成・編集・公開管理',
      render: renderNewsView,
    },
    activities: {
      title: '活動記録',
      subtitle: '隊の活動ログを整理しアーカイブを構築',
      render: renderActivitiesView,
    },
    settings: {
      title: 'サイト設定',
      subtitle: '連絡先や画像などサイト全体の設定を管理',
      render: renderSettingsSummaryView,
    },
    branding: {
      title: 'ブランド資産',
      subtitle: 'ロゴ・写真・色などのビジュアル要素を確認',
      render: renderBrandingView,
    },
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    try {
      await ensureSession();
      setupLayout();
      initZoom();
      await initPalette();
      const initial = new URLSearchParams(location.search).get('view') || localStorage.getItem('admin.active') || 'dashboard';
      setActiveView(views[initial] ? initial : 'dashboard');
    } catch (err) {
      console.error('admin init failed', err);
      showToast('読み込みに失敗しました。再度ログインしてください。', 'error');
      location.replace('/admin/login.html');
    }
  }

  async function ensureSession() {
    const res = await fetch('/api/session', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('session check failed');
    const data = await res.json();
    if (!data.loggedIn) {
      throw new Error('unauthenticated');
    }
  }

  function setupLayout() {
    const sidebar = document.querySelector('.admin-sidebar');
    const navButtons = Array.from(document.querySelectorAll('.nav-btn'));

    navButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (!view) return;
        setActiveView(view);
        closeSidebar();
      });
    });

    document.getElementById('sidebar-open')?.addEventListener('click', () => {
      sidebar?.classList.add('open');
    });
    document.getElementById('sidebar-close')?.addEventListener('click', closeSidebar);

    function closeSidebar() {
      sidebar?.classList.remove('open');
    }

    document.getElementById('logout-btn')?.addEventListener('click', async () => {
      try {
        await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
      } finally {
        location.replace('/admin/login.html');
      }
    });

    document.getElementById('quick-actions-btn')?.addEventListener('click', toggleQuickActions);
    document.getElementById('new-item-btn')?.addEventListener('click', () => {
      openEditor('news');
    });

    document.getElementById('global-search')?.addEventListener('focus', () => openPalette(''));

    document.addEventListener('click', (event) => {
      const panel = document.getElementById('quick-actions-panel');
      if (!panel) return;
      const btn = document.getElementById('quick-actions-btn');
      if (panel.contains(event.target)) return;
      if (btn && btn.contains(event.target)) return;
      panel.classList.remove('open');
      btn?.setAttribute('aria-expanded', 'false');
    });
    document.getElementById('quick-actions-panel')?.addEventListener('click', (event) => {
      const target = event.target.closest('button[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      handleQuickAction(action);
      const panel = document.getElementById('quick-actions-panel');
      panel?.classList.remove('open');
      document.getElementById('quick-actions-btn')?.setAttribute('aria-expanded', 'false');
    });

    function toggleQuickActions() {
      const panel = document.getElementById('quick-actions-panel');
      const btn = document.getElementById('quick-actions-btn');
      if (!panel || !btn) return;
      const willOpen = !panel.classList.contains('open');
      panel.classList.toggle('open', willOpen);
      btn.setAttribute('aria-expanded', String(willOpen));
    }

    document.addEventListener('keydown', (event) => {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openPalette('');
      }
      if (event.key === 'Escape') {
        document.getElementById('quick-actions-panel')?.classList.remove('open');
        document.getElementById('quick-actions-btn')?.setAttribute('aria-expanded', 'false');
        closePalette();
        sidebar?.classList.remove('open');
      }
    });

    window.__adminShell = {
      refreshView: () => setActiveView(state.activeView, { force: true }),
      openEditor,
    };

    function handleQuickAction(action) {
      switch (action) {
        case 'news:new':
          openEditor('news');
          break;
        case 'activities:new':
          openEditor('activity');
          break;
        case 'settings':
          openSettingsPage();
          break;
        case 'branding':
          openBrandingPage();
          break;
        default:
          break;
      }
    }
  }

  function initZoom() {
    const root = document.documentElement;
    const clamp = (value) => Math.min(1.25, Math.max(0.85, Number(value) || 1));
    const read = () => clamp(parseFloat(localStorage.getItem('admin.zoom') || '1'));
    const apply = (value) => {
      const next = clamp(value);
      root.style.setProperty('--zoom', next.toString());
      localStorage.setItem('admin.zoom', next.toFixed(2));
    };
    apply(read());
    document.getElementById('zoom-inc')?.addEventListener('click', () => apply(read() + 0.05));
    document.getElementById('zoom-dec')?.addEventListener('click', () => apply(read() - 0.05));
  }


  async function setActiveView(viewId, { force = false } = {}) {
    if (!views[viewId]) viewId = 'dashboard';
    if (!force && state.activeView === viewId) return;

    state.activeView = viewId;
    localStorage.setItem('admin.active', viewId);

    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === viewId);
    });

    const view = views[viewId];
    document.getElementById('view-title').textContent = view.title;
    document.getElementById('view-subtitle').textContent = view.subtitle;

    renderSkeleton();
    try {
      await view.render(document.getElementById('view-root'));
      updatePaletteItems();
    } catch (err) {
      console.error('view render failed', err);
      renderError(err);
      showToast('データの取得に失敗しました。時間をおいて再度お試しください。', 'error');
    }
  }

  function renderSkeleton() {
    const root = document.getElementById('view-root');
    if (!root) return;
    root.innerHTML = `
      <section class="view-skeleton">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </section>
    `;
  }

  function renderError(error) {
    const root = document.getElementById('view-root');
    if (!root) return;
    const message = error && error.message ? escapeHtml(error.message) : '不明なエラーが発生しました。';
    root.innerHTML = `
      <section class="view-section">
        <div class="card empty-state">
          <h2>読み込みエラー</h2>
          <p>${message}</p>
          <button class="btn-primary" type="button" id="retry-view">再読み込み</button>
        </div>
      </section>
    `;
    document.getElementById('retry-view')?.addEventListener('click', () => setActiveView(state.activeView, { force: true }));
  }

  async function renderDashboardView(root) {
    const summary = await api.summary();
    state.cache.summary = summary;
    const { news, activities, settings } = summary;

    root.innerHTML = `
      <section class="view-section">
        <div class="section-heading">
          <h2>主要指標</h2>
          <p>最新の投稿状況と設定ステータス</p>
        </div>
        <div class="stats-grid">
          ${renderMetricCard('お知らせ件数', news.total, news.trendLabel, '📰')}
          ${renderMetricCard('活動記録', activities.total, activities.trendLabel, '🎒')}
          ${renderSettingsMetric(settings)}
        </div>
      </section>
      <section class="view-section">
        <div class="section-heading">
          <h2>最近のお知らせ</h2>
          <p>直近5件を表示します</p>
          <button class="btn-ghost" type="button" id="jump-to-news">一覧を開く</button>
        </div>
        ${renderNewsTable(news.recent)}
      </section>
      <section class="view-section">
        <div class="section-heading">
          <h2>最新の活動</h2>
          <p>直近の活動記録を確認</p>
          <button class="btn-ghost" type="button" id="jump-to-activities">一覧を開く</button>
        </div>
        ${renderActivityTable(activities.recent)}
      </section>
    `;

    document.getElementById('jump-to-news')?.addEventListener('click', () => setActiveView('news', { force: true }));
    document.getElementById('jump-to-activities')?.addEventListener('click', () => setActiveView('activities', { force: true }));
  }

  async function renderNewsView(root) {
    const data = await api.news();
    state.cache.news = data;

    const uniqueUnits = buildUniqueOptions(data.map((item) => item.unit));
    const uniqueCategories = buildUniqueOptions(data.map((item) => item.category));

    root.innerHTML = `
      <section class="view-section">
        <div class="section-heading">
          <h2>お知らせ一覧</h2>
          <button class="btn-primary" type="button" id="create-news">＋ 新規追加</button>
        </div>
        <div class="filter-bar">
          <input type="search" id="news-search" placeholder="キーワードで検索" aria-label="お知らせ検索">
          <select id="news-unit-filter" aria-label="隊で絞り込み">
            <option value="">すべての隊</option>
            ${uniqueUnits.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labelizeUnit(value))}</option>`).join('')}
          </select>
          <select id="news-category-filter" aria-label="カテゴリで絞り込み">
            <option value="">すべてのカテゴリ</option>
            ${uniqueCategories.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value || '未分類')}</option>`).join('')}
          </select>
        </div>
        <div id="news-table-wrap"></div>
      </section>
    `;

    document.getElementById('create-news')?.addEventListener('click', () => openEditor('news'));

    const searchInput = document.getElementById('news-search');
    const unitSelect = document.getElementById('news-unit-filter');
    const categorySelect = document.getElementById('news-category-filter');
    const tableWrap = document.getElementById('news-table-wrap');

    const update = () => {
      const query = (searchInput?.value || '').toLowerCase();
      const unit = unitSelect?.value || '';
      const category = categorySelect?.value || '';
      const filtered = data.filter((item) => {
        const matchesQuery = !query || (item.title || '').toLowerCase().includes(query) || (item.content || '').toLowerCase().includes(query);
        const matchesUnit = !unit || (item.unit || '') === unit;
        const matchesCategory = !category || (item.category || '') === category;
        return matchesQuery && matchesUnit && matchesCategory;
      });
      tableWrap.innerHTML = renderNewsTable(filtered, { showEmpty: true, showActions: true });
      bindNewsTableActions();
    };

    searchInput?.addEventListener('input', debounce(update, 200));
    unitSelect?.addEventListener('change', update);
    categorySelect?.addEventListener('change', update);
    update();
  }

  async function renderActivitiesView(root) {
    const data = await api.activities();
    state.cache.activities = data;

    const uniqueUnits = buildUniqueOptions(data.map((item) => item.unit));
    const uniqueCategories = buildUniqueOptions(data.map((item) => item.category));

    root.innerHTML = `
      <section class="view-section">
        <div class="section-heading">
          <h2>活動記録</h2>
          <button class="btn-primary" type="button" id="create-activity">＋ 新規追加</button>
        </div>
        <div class="filter-bar">
          <input type="search" id="activities-search" placeholder="キーワードで検索" aria-label="活動検索">
          <select id="activities-unit-filter" aria-label="隊で絞り込み">
            <option value="">すべての隊</option>
            ${uniqueUnits.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labelizeUnit(value))}</option>`).join('')}
          </select>
          <select id="activities-category-filter" aria-label="カテゴリで絞り込み">
            <option value="">すべてのカテゴリ</option>
            ${uniqueCategories.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value || '未分類')}</option>`).join('')}
          </select>
        </div>
        <div id="activities-table-wrap"></div>
      </section>
    `;

    document.getElementById('create-activity')?.addEventListener('click', () => openEditor('activity'));

    const searchInput = document.getElementById('activities-search');
    const unitSelect = document.getElementById('activities-unit-filter');
    const categorySelect = document.getElementById('activities-category-filter');
    const tableWrap = document.getElementById('activities-table-wrap');

    const update = () => {
      const query = (searchInput?.value || '').toLowerCase();
      const unit = unitSelect?.value || '';
      const category = categorySelect?.value || '';
      const filtered = data.filter((item) => {
        const matchesQuery = !query || (item.title || '').toLowerCase().includes(query) || (item.content || '').toLowerCase().includes(query);
        const matchesUnit = !unit || (item.unit || '') === unit;
        const matchesCategory = !category || (item.category || '') === category;
        return matchesQuery && matchesUnit && matchesCategory;
      });
      tableWrap.innerHTML = renderActivityTable(filtered, { showEmpty: true, showActions: true });
      bindActivityTableActions();
    };

    searchInput?.addEventListener('input', debounce(update, 200));
    unitSelect?.addEventListener('change', update);
    categorySelect?.addEventListener('change', update);
    update();
  }

  async function renderSettingsSummaryView(root) {
    const summary = state.cache.summary || await api.summary();
    const settingsSummary = summary.settings;
    const allSettings = await api.settings();
    state.cache.settings = allSettings;

    const missing = settingsSummary.missingKeys || [];

    root.innerHTML = `
      <section class="view-section">
        <div class="section-heading">
          <h2>設定の状態</h2>
          <button class="btn-primary" type="button" id="open-settings">設定を開く</button>
        </div>
        <div class="stats-grid">
          ${renderSettingsMetric(settingsSummary)}
          ${renderBrandPreview(allSettings)}
        </div>
      </section>
      <section class="view-section">
        <div class="section-heading">
          <h2>未設定項目</h2>
          <p>優先度の高いフィールドを確認</p>
        </div>
        ${missing.length ? `<ul class="card">
          ${missing.map((item) => `<li class="settings-missing">⚠️ ${escapeHtml(item.label || item.key)}</li>`).join('')}
        </ul>` : `
          <div class="card">
            <strong>すべて設定済みです。</strong>
            <p>ファビコンや画像が揃っており、公開準備が整っています。</p>
          </div>
        `}
      </section>
      <section class="view-section">
        <div class="section-heading">
          <h2>主要設定サマリー</h2>
        </div>
        ${renderSettingsSummaryTable(allSettings)}
      </section>
    `;

    document.getElementById('open-settings')?.addEventListener('click', openSettingsPage);
  }

  async function renderBrandingView(root) {
    const settings = state.cache.settings || await api.settings();
    const brandKeys = [
      ['site_favicon_url', 'ファビコン'],
      ['group_crest_url', '団章'],
      ['index_hero_image_url', 'トップヒーロー画像'],
      ['unit_beaver_logo_url', 'ビーバー隊ロゴ'],
      ['unit_cub_logo_url', 'カブ隊ロゴ'],
      ['unit_boy_logo_url', 'ボーイ隊ロゴ'],
      ['unit_venture_logo_url', 'ベンチャー隊ロゴ'],
      ['unit_rover_logo_url', 'ローバー隊ロゴ'],
    ];

    root.innerHTML = `
      <section class="view-section">
        <div class="section-heading">
          <h2>ブランドアセット</h2>
          <button class="btn-primary" type="button" id="open-branding">ブランド設定を開く</button>
        </div>
        <div class="stats-grid">
          ${brandKeys.map(([key, label]) => renderBrandCard(label, settings[key])).join('')}
        </div>
      </section>
    `;

    document.getElementById('open-branding')?.addEventListener('click', openBrandingPage);
  }

  function renderMetricCard(label, value, trendLabel, icon) {
    return `
      <article class="card">
        <div class="card-header">
          <h3 class="card-title">${escapeHtml(label)}</h3>
          <span>${icon || ''}</span>
        </div>
        <p class="card-metric">${Number(value || 0).toLocaleString('ja-JP')}</p>
        ${trendLabel ? `<p class="metric-trend">${escapeHtml(trendLabel)}</p>` : ''}
      </article>
    `;
  }

  function renderSettingsMetric(settings) {
    const complete = settings && settings.missingKeys && settings.missingKeys.length === 0;
    const caption = complete ? '主要項目はすべて設定済みです。' : `${settings.missingKeys.length} 件の項目が未設定です。`;
    const statusBadge = complete ? '<span class="badge green">整備済み</span>' : '<span class="badge rose">要対応</span>';
    return `
      <article class="card">
        <div class="card-header">
          <h3 class="card-title">サイト設定</h3>
          ${statusBadge}
        </div>
        <p class="card-metric">${complete ? '完了' : '要確認'}</p>
        <p class="metric-trend">${escapeHtml(caption)}</p>
      </article>
    `;
  }

  function renderNewsTable(list, { showEmpty = false, showActions = false } = {}) {
    if (!list || list.length === 0) {
      return showEmpty
        ? '<div class="empty-state">まだ記事がありません。\n          <div style="margin-top:16px"><button class="btn-secondary" type="button" id="empty-create-news">お知らせを作成</button></div>\n        </div>'
        : '<p class="empty-state">データがありません。</p>';
    }
    return `
      <div class="card">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 40%">タイトル</th>
              <th>カテゴリ</th>
              <th>隊</th>
              <th>作成日</th>
              ${showActions ? '<th>操作</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${list.map((item) => `
              <tr data-id="${item.id}">
                <td>${escapeHtml(item.title || '(無題)')}</td>
                <td>${escapeHtml(item.category || '未分類')}</td>
                <td>${escapeHtml(labelizeUnit(item.unit))}</td>
                <td>${formatDate(item.created_at)}</td>
                ${showActions ? renderNewsActionsCell(item.id) : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderNewsActionsCell(id) {
    return `
      <td>
        <div class="table-actions">
          <a href="/news-detail-placeholder.html?id=${id}" target="_blank" rel="noopener">公開</a>
          <button type="button" data-action="edit" data-id="${id}">編集</button>
          <button type="button" data-action="delete" data-id="${id}" class="btn-danger">削除</button>
        </div>
      </td>
    `;
  }

  function bindNewsTableActions() {
    document.querySelectorAll('#news-table-wrap .table-actions button[data-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (!id) return;
        if (action === 'edit') {
          window.open(`/admin/edit.html?id=${id}`, '_blank', 'noopener');
        }
        if (action === 'delete') {
          const confirmed = await confirmDestructive('お知らせを削除しますか？この操作は元に戻せません。');
          if (!confirmed) return;
          try {
            await api.deleteNews(id);
            showToast('お知らせを削除しました。', 'success');
            setActiveView('news', { force: true });
            state.cache.summary = null;
          } catch (err) {
            console.error(err);
            showToast('削除に失敗しました。', 'error');
          }
        }
      });
    });

    document.getElementById('empty-create-news')?.addEventListener('click', () => openEditor('news'));
  }
  function renderActivityTable(list, { showEmpty = false, showActions = false } = {}) {
    if (!list || list.length === 0) {
      return showEmpty
        ? '<div class="empty-state">活動記録がまだありません。<div style="margin-top:16px"><button class="btn-secondary" type="button" id="empty-create-activity">活動を作成</button></div></div>'
        : '<p class="empty-state">データがありません。</p>';
    }
    return `
      <div class="card">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 40%">タイトル</th>
              <th>カテゴリ</th>
              <th>隊</th>
              <th>実施日</th>
              ${showActions ? '<th>操作</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${list.map((item) => `
              <tr data-id="${item.id}">
                <td>${escapeHtml(item.title || '(無題)')}</td>
                <td>${escapeHtml(item.category || '未分類')}</td>
                <td>${escapeHtml(labelizeUnit(item.unit))}</td>
                <td>${formatDate(item.activity_date || item.created_at)}</td>
                ${showActions ? renderActivityActionsCell(item.id) : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderActivityActionsCell(id) {
    return `
      <td>
        <div class="table-actions">
          <a href="/activity-detail-placeholder.html?id=${id}" target="_blank" rel="noopener">公開</a>
          <button type="button" data-action="edit" data-id="${id}">編集</button>
          <button type="button" data-action="delete" data-id="${id}" class="btn-danger">削除</button>
        </div>
      </td>
    `;
  }

  function bindActivityTableActions() {
    document.querySelectorAll('#activities-table-wrap .table-actions button[data-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (!id) return;
        if (action === 'edit') {
          window.open(`/admin/activity-edit.html?id=${id}`, '_blank', 'noopener');
        }
        if (action === 'delete') {
          const confirmed = await confirmDestructive('活動記録を削除しますか？');
          if (!confirmed) return;
          try {
            await api.deleteActivity(id);
            showToast('活動記録を削除しました。', 'success');
            setActiveView('activities', { force: true });
            state.cache.summary = null;
          } catch (err) {
            console.error(err);
            showToast('削除に失敗しました。', 'error');
          }
        }
      });
    });

    document.getElementById('empty-create-activity')?.addEventListener('click', () => openEditor('activity'));
  }

  function renderBrandPreview(settings) {
    const crest = settings.group_crest_url;
    const favicon = settings.site_favicon_url;
    return `
      <article class="card">
        <div class="card-header">
          <h3 class="card-title">ブランド概要</h3>
          ${crest ? '<span class="badge blue">画像あり</span>' : '<span class="badge rose">未設定</span>'}
        </div>
        <div style="display:flex; gap:16px; align-items:center;">
          <div style="width:72px; height:72px; border-radius:16px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; overflow:hidden;">
            ${crest ? `<img src="${escapeAttribute(crest)}" alt="団章プレビュー" style="max-width:72px; max-height:72px;">` : '---'}
          </div>
          <div>
            <p style="margin:0 0 6px; font-weight:600;">団章</p>
            <p style="margin:0; font-size:13px; color:#64748b;">${crest ? '公開用の団章画像が設定されています。' : '団章画像が未設定です。'}</p>
            <p style="margin:10px 0 0; font-size:13px; color:#64748b;">ファビコン: ${favicon ? '設定済み ✅' : '未設定 ⚠️'}</p>
          </div>
        </div>
      </article>
    `;
  }

  function renderBrandCard(label, url) {
    return `
      <article class="card" style="text-align:center;">
        <h3 class="card-title">${escapeHtml(label)}</h3>
        <div style="margin-top:12px; display:flex; align-items:center; justify-content:center;">
          ${url ? `<img src="${escapeAttribute(url)}" alt="${escapeHtml(label)}" style="max-width:120px; max-height:120px; border-radius:12px;">` : '<div class="empty-state" style="border:none;background:transparent;padding:12px;">未設定</div>'}
        </div>
        <p style="font-size:12px; color:#64748b; margin-top:10px;">${url ? '設定済みです。' : '早めの設定をおすすめします。'}</p>
      </article>
    `;
  }

  function renderSettingsSummaryTable(settings) {
    if (!settings) return '';
    const rows = [
      ['代表住所', settings.contact_address],
      ['代表電話', settings.contact_phone],
      ['代表メール', settings.contact_email],
      ['お問い合わせ担当者', settings.contact_person_name],
      ['施行日', settings.privacy_effective_date],
    ];
    return `
      <div class="card">
        <table class="data-table">
          <tbody>
            ${rows.map(([label, value]) => `
              <tr>
                <th style="width:30%; font-weight:600;">${escapeHtml(label)}</th>
                <td>${escapeHtml(value || '未設定')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function buildUniqueOptions(list) {
    const set = new Set();
    list.forEach((value) => {
      if (!value) return;
      set.add(String(value));
    });
    return Array.from(set).sort();
  }

  function labelizeUnit(unit) {
    const unitLabels = {
      beaver: 'ビーバー',
      cub: 'カブ',
      boy: 'ボーイ',
      venture: 'ベンチャー',
      rover: 'ローバー',
    };
    return unitLabels[unit] || unit || '—';
  }

  function formatDate(value) {
    if (!value) return '—';
    try {
      const dt = new Date(value);
      if (Number.isNaN(dt.getTime())) return '—';
      return dt.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return '—';
    }
  }
  async function initPalette() {
    const palette = state.palette;
    palette.input = document.getElementById('cmdp-input');
    palette.list = document.getElementById('cmdp-list');
    palette.backdrop = document.getElementById('cmdp-backdrop');

    updatePaletteItems();

    palette.input?.addEventListener('input', () => filterPaletteItems(palette.input.value));

    palette.backdrop?.addEventListener('click', (event) => {
      if (event.target === palette.backdrop) closePalette();
    });

    document.addEventListener('keydown', (event) => {
      if (!palette.open) return;
      const listItems = Array.from(palette.list.querySelectorAll('.cmdp-item'));
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        palette.selectedIndex = Math.min(listItems.length - 1, palette.selectedIndex + 1);
        highlightPaletteItem();
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        palette.selectedIndex = Math.max(0, palette.selectedIndex - 1);
        highlightPaletteItem();
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const item = palette.filtered[palette.selectedIndex];
        executePaletteItem(item);
      }
    });
  }

  function updatePaletteItems() {
    const items = [];
    Object.entries(views).forEach(([key, view]) => {
      items.push({
        type: 'view',
        key,
        label: view.title,
        sub: view.subtitle,
        icon: '➡️',
      });
    });

    const news = state.cache.news || [];
    news.slice(0, 50).forEach((item) => {
      items.push({
        type: 'news',
        key: item.id,
        label: item.title || '(無題のお知らせ)',
        sub: 'お知らせを編集',
        icon: '📰',
      });
    });

    const activities = state.cache.activities || [];
    activities.slice(0, 50).forEach((item) => {
      items.push({
        type: 'activity',
        key: item.id,
        label: item.title || '(無題の活動)',
        sub: '活動を編集',
        icon: '🎒',
      });
    });

    state.palette.items = items;
    filterPaletteItems(state.palette.input?.value || '');
  }

  function filterPaletteItems(query) {
    const palette = state.palette;
    const q = query.trim().toLowerCase();
    palette.filtered = palette.items.filter((item) => {
      if (!q) return true;
      const text = `${item.label} ${item.sub || ''}`.toLowerCase();
      return text.includes(q);
    });
    palette.list.innerHTML = palette.filtered.length
      ? palette.filtered.map((item, index) => paletteItemToHTML(item, index)).join('')
      : '<div class="cmdp-item">該当する項目はありません。</div>';
    palette.selectedIndex = palette.filtered.length ? 0 : -1;
    highlightPaletteItem();

    palette.list.querySelectorAll('.cmdp-item').forEach((el) => {
      el.addEventListener('click', () => {
        const index = Number(el.dataset.index);
        const item = palette.filtered[index];
        executePaletteItem(item);
      });
    });
  }

  function paletteItemToHTML(item, index) {
    return `
      <div class="cmdp-item" data-index="${index}">
        <div>${item.icon || ''}</div>
        <div>
          <div>${escapeHtml(item.label)}</div>
          <div class="sub">${escapeHtml(item.sub || '')}</div>
        </div>
      </div>
    `;
  }

  function highlightPaletteItem() {
    const palette = state.palette;
    const nodes = Array.from(palette.list.querySelectorAll('.cmdp-item'));
    nodes.forEach((node, index) => node.classList.toggle('active', index === palette.selectedIndex));
  }

  function executePaletteItem(item) {
    if (!item) return;
    closePalette();
    if (item.type === 'view') {
      setActiveView(item.key, { force: true });
      return;
    }
    if (item.type === 'news') {
      window.open(`/admin/edit.html?id=${item.key}`, '_blank', 'noopener');
      return;
    }
    if (item.type === 'activity') {
      window.open(`/admin/activity-edit.html?id=${item.key}`, '_blank', 'noopener');
    }
  }

  function openPalette(query) {
    const palette = state.palette;
    palette.backdrop?.classList.add('open');
    palette.open = true;
    if (palette.input) {
      palette.input.value = query;
      palette.input.focus();
      filterPaletteItems(query);
    }
  }

  function closePalette() {
    const palette = state.palette;
    palette.backdrop?.classList.remove('open');
    palette.open = false;
    palette.selectedIndex = -1;
  }

  function showToast(message, variant = 'success') {
    const stack = document.getElementById('toast-stack');
    if (!stack) return;
    const toast = document.createElement('div');
    toast.className = `toast ${variant}`;
    toast.textContent = message;
    stack.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('hide');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
      toast.style.opacity = '0';
    }, 2800);
  }

  function confirmDestructive(message) {
    return new Promise((resolve) => {
      AdminUI.showResult({
        ok: false,
        message,
        actions: [
          { label: 'キャンセル', keepOpen: false, onClick: () => resolve(false) },
          { label: '削除する', variant: 'danger', keepOpen: false, onClick: () => resolve(true) },
        ],
      });
    });
  }

  const api = {
    async summary() {
      const res = await fetch('/api/admin/summary', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('サマリーの取得に失敗しました');
      return res.json();
    },
    async news() {
      const res = await fetch('/api/news?limit=100', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('お知らせの取得に失敗しました');
      return res.json();
    },
    async activities() {
      const res = await fetch('/api/activities?limit=100', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('活動の取得に失敗しました');
      return res.json();
    },
    async deleteNews(id) {
      const res = await fetch(`/api/news/${id}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!res.ok && res.status !== 204) throw new Error('削除に失敗しました');
    },
    async deleteActivity(id) {
      const res = await fetch(`/api/activities/${id}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!res.ok && res.status !== 204) throw new Error('削除に失敗しました');
    },
    async settings() {
      const res = await fetch('/api/settings/all', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('設定の取得に失敗しました');
      return res.json();
    },
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (chr) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[chr] || chr));
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function debounce(fn, wait = 200) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  function openEditor(type) {
    if (type === 'activity') {
      window.open('/admin/activity-edit.html', '_blank', 'noopener');
    } else {
      window.open('/admin/edit.html', '_blank', 'noopener');
    }
  }

  function openSettingsPage() {
    window.open('/admin/settings.html', '_blank', 'noopener');
  }

  function openBrandingPage() {
    window.open('/admin/branding.html', '_blank', 'noopener');
  }
})();
