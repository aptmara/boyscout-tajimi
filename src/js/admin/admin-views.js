// admin-views.js
(function(){
  const Admin = (window.Admin = window.Admin || {});
  const { state, utils, api, actions } = Admin;

  // --- Views Management ---
  const views = Admin.views = {};

  views.setActiveView = async function(viewId, params = {}) {
    const { id, force } = params;
    if (!force && state.activeView === viewId && !id) return;

    const reg = views.registry ? views.registry[viewId] : null;
    if (!reg) {
      console.warn(`View ${viewId} not found`);
      return;
    }

    // Update State
    state.activeView = viewId;
    localStorage.setItem('admin.active', viewId);

    // Update UI (Sidebar)
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.view === viewId);
    });

    // Update URL
    const url = new URL(window.location);
    url.searchParams.set('view', id ? `${viewId}/${id}` : viewId);
    window.history.replaceState({}, '', url);

    // Render
    const root = document.getElementById('view-root');
    if (!root) return;

    // Set Title
    const titleEl = document.querySelector('.top-bar h1');
    if (titleEl) titleEl.textContent = reg.title;

    // Render Content
    if (typeof reg.render === 'function') {
      await reg.render(root, id);
    }
  };

  // --- Utility Components ---
  const Components = {
    pagination(current, totalPages, onPageChange) {
      const nav = document.createElement('nav');
      nav.className = 'pagination-nav';
      if (totalPages <= 1) return nav;

      const prev = document.createElement('button');
      prev.textContent = '←';
      prev.className = 'btn-ghost';
      prev.disabled = current === 1;
      prev.onclick = () => onPageChange(current - 1);

      const next = document.createElement('button');
      next.textContent = '→';
      next.className = 'btn-ghost';
      next.disabled = current === totalPages;
      next.onclick = () => onPageChange(current + 1);

      const info = document.createElement('span');
      info.className = 'pagination-info';
      info.textContent = `${current} / ${totalPages}`;

      nav.appendChild(prev);
      nav.appendChild(info);
      nav.appendChild(next);
      return nav;
    },
    searchBar(onSearch, placeholder = '検索...') {
      const wrapper = document.createElement('div');
      wrapper.className = 'view-search-bar';
      const input = document.createElement('input');
      input.type = 'search';
      input.placeholder = placeholder;
      input.className = 'input';
      input.addEventListener('input', utils.debounce((e) => onSearch(e.target.value), 300));
      wrapper.appendChild(input);
      return wrapper;
    },
    emptyState(message, actionText, onAction) {
      const div = document.createElement('div');
      div.className = 'empty-state';
      div.innerHTML = `<p>${utils.escapeHtml(message)}</p>`;
      if (actionText && onAction) {
        const btn = document.createElement('button');
        btn.className = 'btn-primary mt-4';
        btn.textContent = actionText;
        btn.onclick = onAction;
        div.appendChild(btn);
      }
      return div;
    }
  };

  // --- List View Factory ---
  function createListView(config) {
    return async (root) => {
      root.innerHTML = '<div class="loading-spinner mx-auto"></div>';
      
      let items = [];
      try {
        const data = await config.api();
        items = Array.isArray(data) ? data : (data.items || []);
      } catch (e) {
        root.innerHTML = `<div class="error-message">読み込みに失敗しました: ${utils.escapeHtml(e.message)}</div>`;
        return;
      }

      // State for this view
      let viewState = {
        query: '',
        page: 1,
        itemsPerPage: 10,
        filterCategory: '',
        filterUnit: ''
      };

      const render = () => {
        root.innerHTML = '';
        
        // 1. Toolbar (Search & Filter)
        const toolbar = document.createElement('div');
        toolbar.className = 'view-toolbar filter-bar';
        
        // Search
        const searchWrapper = Components.searchBar((q) => {
          viewState.query = q;
          viewState.page = 1;
          renderBody();
        }, 'キーワードで検索...');
        toolbar.appendChild(searchWrapper);

        // Category Filter (if exists in items)
        const categories = utils.buildUniqueOptions(items.map(i => i.category));
        if (categories.length > 0) {
          const catSelect = document.createElement('select');
          catSelect.className = 'select';
          catSelect.innerHTML = '<option value="">すべてのカテゴリ</option>' + categories.map(c => `<option value="${utils.escapeHtml(c)}">${utils.escapeHtml(c)}</option>`).join('');
          catSelect.value = viewState.filterCategory;
          catSelect.onchange = (e) => { viewState.filterCategory = e.target.value; viewState.page = 1; renderBody(); };
          toolbar.appendChild(catSelect);
        }

        // Unit Filter (if exists in items)
        const units = utils.buildUniqueOptions(items.map(i => i.unit));
        if (units.length > 0) {
          const unitSelect = document.createElement('select');
          unitSelect.className = 'select';
          unitSelect.innerHTML = '<option value="">すべての隊</option>' + units.map(u => `<option value="${utils.escapeHtml(u)}">${utils.escapeHtml(utils.labelizeUnit(u))}</option>`).join('');
          unitSelect.value = viewState.filterUnit;
          unitSelect.onchange = (e) => { viewState.filterUnit = e.target.value; viewState.page = 1; renderBody(); };
          toolbar.appendChild(unitSelect);
        }

        root.appendChild(toolbar);

        // 2. List Container
        const listContainer = document.createElement('div');
        listContainer.id = 'view-list-container';
        root.appendChild(listContainer);

        // 3. Render Body Function
        const renderBody = () => {
          listContainer.innerHTML = '';
          
          // Filter
          let filtered = items.filter(item => {
            const text = config.getSearchableText(item).toLowerCase();
            const q = viewState.query.toLowerCase();
            if (q && !text.includes(q)) return false;
            if (viewState.filterCategory && item.category !== viewState.filterCategory) return false;
            if (viewState.filterUnit && item.unit !== viewState.filterUnit) return false;
            return true;
          });

          if (filtered.length === 0) {
            listContainer.appendChild(Components.emptyState('条件に一致する項目はありません', null, null));
            return;
          }

          // Pagination
          const totalPages = Math.ceil(filtered.length / viewState.itemsPerPage);
          const start = (viewState.page - 1) * viewState.itemsPerPage;
          const pagedItems = filtered.slice(start, start + viewState.itemsPerPage);

          // Table / Card List
          const table = document.createElement('table');
          table.className = 'data-table';
          
          const thead = document.createElement('thead');
          thead.innerHTML = `<tr>${config.columns.map(c => `<th>${utils.escapeHtml(c.label)}</th>`).join('')}<th>操作</th></tr>`;
          table.appendChild(thead);

          const tbody = document.createElement('tbody');
          pagedItems.forEach(item => {
            const tr = document.createElement('tr');
            config.columns.forEach(col => {
              const td = document.createElement('td');
              td.innerHTML = col.render(item);
              tr.appendChild(td);
            });
            
            // Actions
            const actionTd = document.createElement('td');
            actionTd.className = 'table-actions';
            
            const editBtn = document.createElement('button');
            editBtn.textContent = '編集';
            editBtn.onclick = () => config.openEditor(item.id);
            
            const delBtn = document.createElement('button');
            delBtn.textContent = '削除';
            delBtn.className = 'text-red-600 hover:bg-red-50';
            delBtn.onclick = async () => {
              if (await utils.confirmDestructive('本当に削除しますか？この操作は取り消せません。')) {
                try {
                  await config.deleteApi(item.id);
                  utils.showToast('削除しました');
                  // Refresh data
                  const newData = await config.api();
                  items = Array.isArray(newData) ? newData : (newData.items || []);
                  renderBody(); // re-render current page
                } catch (e) {
                  utils.showToast(e.message, 'error');
                }
              }
            };

            actionTd.appendChild(editBtn);
            actionTd.appendChild(delBtn);
            tr.appendChild(actionTd);
            tbody.appendChild(tr);
          });
          table.appendChild(tbody);
          listContainer.appendChild(table);

          // Pagination Controls
          if (totalPages > 1) {
            listContainer.appendChild(Components.pagination(viewState.page, totalPages, (p) => {
              viewState.page = p;
              renderBody();
            }));
          }
        };

        renderBody();
      };

      render();
    };
  }

  // --- Settings View Configuration ---
  const settingsGroups = [
    {
      id: 'basic', label: '基本情報',
      description: 'サイト全体に表示される連絡先などの基本情報です。',
      fields: [
        { key: 'contact_address', label: '住所' },
        { key: 'contact_phone', label: '電話番号' },
        { key: 'contact_email', label: 'メールアドレス' },
        { key: 'contact_person_name', label: '問い合わせ担当者名' },
      ]
    },
    {
      id: 'privacy', label: 'プライバシー',
      description: 'プライバシーポリシーページに表示される情報です。',
      fields: [
        { key: 'privacy_effective_date', label: '制定日' },
        { key: 'privacy_last_updated_date', label: '最終改定日' },
        { key: 'privacy_contact_person', label: '個人情報担当者' },
        { key: 'privacy_contact_phone', label: '問い合わせ電話番号' },
        { key: 'privacy_contact_email', label: '問い合わせメール' },
      ]
    },
    {
      id: 'images', label: 'トップ画像',
      description: 'トップページのメインビジュアルなどを設定します。',
      fields: [
        { key: 'index_hero_image_url', label: 'ヒーロー画像', type: 'image' },
        { key: 'group_crest_url', label: '団章画像', type: 'image' },
        { key: 'site_favicon_url', label: 'ファビコン', type: 'image' },
      ]
    },
    {
      id: 'units', label: '各隊設定',
      description: '各隊のリーダー名や画像を設定します。',
      fields: [
        { key: 'leader_beaver', label: 'ビーバー隊リーダー' },
        { key: 'unit_beaver_logo_url', label: 'ビーバー隊章', type: 'image' },
        { key: 'leader_cub', label: 'カブ隊リーダー' },
        { key: 'unit_cub_logo_url', label: 'カブ隊章', type: 'image' },
        { key: 'leader_boy', label: 'ボーイ隊リーダー' },
        { key: 'unit_boy_logo_url', label: 'ボーイ隊章', type: 'image' },
        { key: 'leader_venture', label: 'ベンチャー隊リーダー' },
        { key: 'unit_venture_logo_url', label: 'ベンチャー隊章', type: 'image' },
        { key: 'leader_rover', label: 'ローバー隊リーダー' },
        { key: 'unit_rover_logo_url', label: 'ローバー隊章', type: 'image' },
      ]
    }
  ];

  // --- Settings View Logic ---
  async function renderSettingsView(root, initialTab) {
    root.innerHTML = '<div class="loading-spinner mx-auto"></div>';
    
    // Load Data
    let settingsData = {};
    try {
      const res = await api.settings(); // /api/settings/all returns array of {key, value}
      if (Array.isArray(res)) {
        settingsData = res.reduce((acc, cur) => { acc[cur.key] = cur.value; return acc; }, {});
      } else {
        settingsData = res; // Fallback
      }
    } catch (e) {
      root.innerHTML = `<div class="error-message">設定の読み込みに失敗しました: ${utils.escapeHtml(e.message)}</div>`;
      return;
    }

    let currentTab = initialTab || settingsGroups[0].id;
    if (currentTab === 'branding') currentTab = 'images'; // Alias handling

    const render = () => {
      root.innerHTML = '';

      // 1. Tabs
      const tabsNav = document.createElement('div');
      tabsNav.className = 'tabs';
      settingsGroups.forEach(group => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${group.id === currentTab ? 'active' : ''}`;
        btn.textContent = group.label;
        btn.onclick = () => { currentTab = group.id; render(); };
        tabsNav.appendChild(btn);
      });
      root.appendChild(tabsNav);

      // 2. Content
      const group = settingsGroups.find(g => g.id === currentTab) || settingsGroups[0];
      
      const desc = document.createElement('p');
      desc.className = 'settings-description';
      desc.textContent = group.description;
      root.appendChild(desc);

      const form = document.createElement('form');
      form.className = 'form-grid';
      form.onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = '保存中...';

        const payload = {};
        group.fields.forEach(field => {
          const input = form.querySelector(`[name="${field.key}"]`);
          if (input) {
            // Google Drive変換 (Imageタイプのみ)
            let val = input.value;
            if (field.type === 'image') {
              val = utils.convertGoogleDriveUrl(val);
            }
            payload[field.key] = val;
          }
        });

        try {
          const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'same-origin'
          });
          if (!res.ok) throw new Error('Save failed');
          utils.showToast('設定を保存しました');
          // 更新後の値を再反映 (プレビュー更新のため)
          group.fields.forEach(field => {
            if (payload[field.key]) settingsData[field.key] = payload[field.key];
          });
          render(); // Re-render to update previews
        } catch (err) {
          utils.showToast(err.message, 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      };

      group.fields.forEach(field => {
        const div = document.createElement('div');
        div.className = 'form-group full-width';
        
        const label = document.createElement('label');
        label.textContent = field.label;
        div.appendChild(label);

        const input = document.createElement('input');
        input.type = 'text';
        input.name = field.key;
        input.className = 'input';
        input.value = settingsData[field.key] || '';
        if (field.type === 'image') {
          input.placeholder = 'https://... (Google Drive URL対応)';
          input.addEventListener('input', utils.debounce((e) => {
            const preview = div.querySelector('.image-preview-thumb');
            if (preview) preview.src = utils.convertGoogleDriveUrl(e.target.value);
          }, 500));
        }
        div.appendChild(input);

        if (field.type === 'image') {
          const previewWrapper = document.createElement('div');
          previewWrapper.className = 'image-preview-item';
          const img = document.createElement('img');
          img.className = 'image-preview-thumb';
          img.src = utils.convertGoogleDriveUrl(settingsData[field.key] || '');
          img.onerror = () => { previewWrapper.style.display = 'none'; };
          img.onload = () => { previewWrapper.style.display = 'block'; };
          if (!settingsData[field.key]) previewWrapper.style.display = 'none';
          
          previewWrapper.appendChild(img);
          div.appendChild(previewWrapper);
        }

        form.appendChild(div);
      });

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'editor-actions full-width';
      actionsDiv.style.marginTop = '32px';
      
      const saveBtn = document.createElement('button');
      saveBtn.type = 'submit';
      saveBtn.className = 'btn-primary';
      saveBtn.textContent = '変更を保存';
      
      actionsDiv.appendChild(saveBtn);
      form.appendChild(actionsDiv);
      root.appendChild(form);
    };

    render();
  }

  // --- Dashboard View ---
  async function renderDashboardView(root) {
    root.innerHTML = '<div class="loading-spinner mx-auto"></div>';
    try {
      const data = await api.summary();
      
      root.innerHTML = `
        <div class="view-section">
          <h2 class="section-heading">概要</h2>
          <div class="stats-grid">
            <div class="card">
              <div class="card-header"><span class="card-title">お知らせ</span><span class="nav-icon">📰</span></div>
              <div class="card-metric">${data.news.total}</div>
              <div class="metric-trend">${utils.escapeHtml(data.news.trendLabel)}</div>
            </div>
            <div class="card">
              <div class="card-header"><span class="card-title">活動記録</span><span class="nav-icon">🎒</span></div>
              <div class="card-metric">${data.activities.total}</div>
              <div class="metric-trend">${utils.escapeHtml(data.activities.trendLabel)}</div>
            </div>
          </div>
        </div>

        <div class="view-section">
          <h2 class="section-heading">設定ステータス</h2>
          ${data.settings.missingKeys.length > 0 
            ? `<div class="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                 <p class="text-yellow-800 font-bold mb-2">⚠️ 未設定の項目があります</p>
                 <ul class="list-disc list-inside text-sm text-yellow-700">
                   ${data.settings.missingKeys.map(k => `<li>${utils.escapeHtml(k.label)}</li>`).join('')}
                 </ul>
                 <button class="btn-secondary mt-3 text-sm" onclick="Admin.views.setActiveView('settings')">設定画面へ</button>
               </div>` 
            : '<div class="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">✅ 重要な設定は完了しています</div>'}
        </div>
      `;
    } catch (e) {
      root.innerHTML = `<div class="error-message">読み込みエラー: ${utils.escapeHtml(e.message)}</div>`;
    }
  }

  // --- Editors Placeholders ---
  function renderNewsEditorView(root, id) {
    root.innerHTML = ''; // Clear
    Admin.editors.openNews(id);
    views.setActiveView('news'); 
  }

  function renderActivityEditorView(root, id) {
    root.innerHTML = '';
    Admin.editors.openActivity(id);
    views.setActiveView('activities');
  }

  // ---- View Configs ----
  const newsViewConfig = {
    id: 'news',
    title: 'お知らせ',
    api: api.news,
    deleteApi: api.deleteNews,
    openEditor: (id) => Admin.editors.openNews(id),
    getSearchableText: (item) => `${item.title || ''} ${item.content || ''}`,
    columns: [
      { label: 'タイトル', key: 'title', width: '40%', render: (item) => `<span class="font-bold text-gray-700">${utils.escapeHtml(item.title || '(無題)')}</span>` },
      { label: 'カテゴリ', key: 'category', render: (item) => `<span class="badge">${utils.escapeHtml(item.category || '未分類')}</span>` },
      { label: '隊', key: 'unit', render: (item) => item.unit ? `<span class="badge blue">${utils.escapeHtml(utils.labelizeUnit(item.unit))}</span>` : '-' },
      { label: '公開日', key: 'created_at', render: (item) => utils.formatDate(item.created_at) },
    ]
  };

  const activitiesViewConfig = {
    id: 'activities',
    title: '活動記録',
    api: api.activities,
    deleteApi: api.deleteActivity,
    openEditor: (id) => Admin.editors.openActivity(id),
    getSearchableText: (item) => `${item.title || ''} ${item.content || ''}`,
    columns: [
      { label: 'タイトル', key: 'title', width: '40%', render: (item) => `<span class="font-bold text-gray-700">${utils.escapeHtml(item.title || '(無題)')}</span>` },
      { label: 'カテゴリ', key: 'category', render: (item) => `<span class="badge">${utils.escapeHtml(item.category || '未分類')}</span>` },
      { label: '隊', key: 'unit', render: (item) => item.unit ? `<span class="badge blue">${utils.escapeHtml(utils.labelizeUnit(item.unit))}</span>` : '-' },
      { label: '実施日', key: 'activity_date', render: (item) => utils.formatDate(item.activity_date || item.created_at) },
    ]
  };

  // ---- Registry ----
  views.registry = {
    'dashboard': { title:'ダッシュボード', subtitle:'サイトの概況', render: renderDashboardView },
    'news': { title:'お知らせ', subtitle:'ニュースの管理', render: createListView(newsViewConfig) },
    'activities': { title:'活動記録', subtitle:'活動レポートの管理', render: createListView(activitiesViewConfig) },
    'settings': { title:'サイト設定', subtitle:'全体設定の管理', render: renderSettingsView },
    'branding': { title:'ブランド資産', subtitle:'ロゴ・配色の管理', render: (root) => renderSettingsView(root, 'branding') },
    
    'news-editor': { title:'...', subtitle:'', render: (root, id) => renderNewsEditorView(root, id) },
    'activities-editor': { title:'...', subtitle:'', render: (root, id) => renderActivityEditorView(root, id) },
  };

  // ---- Main Logic ----
  document.addEventListener('DOMContentLoaded', init);

  async function init(){
    try {
      await ensureSession();
      initZoom();
      await window.AdminPalette?.init();
      
      const params = new URLSearchParams(location.search);
      const initialView = params.get('view') || localStorage.getItem('admin.active') || 'dashboard';
      
      const parts = initialView.split('/');
      const viewId = parts[0];
      const id = parts[1];

      views.setActiveView(viewId, { id });
    } catch (err) {
      console.error('admin init failed', err);
      utils.showToast('セッションが無効です。再ログインしてください。', 'error');
      setTimeout(() => location.replace('/admin/login.html'), 1000);
    }
  }

  async function ensureSession(){
    const res = await fetch('/api/session', { credentials:'same-origin' });
    if (!res.ok) throw new Error('Network error');
    const data = await res.json();
    if (!data.loggedIn) throw new Error('unauthenticated');
  }

  function initZoom(){
    const root=document.documentElement;
    const clamp=(v)=>Math.min(1.25,Math.max(0.85,Number(v)||1));
    const read=()=>clamp(parseFloat(localStorage.getItem('admin.zoom')||'1'));
    const apply=(value)=>{
      const next=clamp(value);
      root.style.setProperty('--zoom', next.toString());
      localStorage.setItem('admin.zoom', next.toFixed(2));
    };
    apply(read());
    document.getElementById('zoom-inc')?.addEventListener('click', ()=>apply(read()+0.05));
    document.getElementById('zoom-dec')?.addEventListener('click', ()=>apply(read()-0.05));
  }

  function renderSkeleton(){
    const root=document.getElementById('view-root');
    if (!root) return;
    root.innerHTML = `
      <div class="view-section">
        <div class="skeleton-card" style="height: 200px; margin-bottom: 20px;"></div>
        <div class="skeleton-card" style="height: 400px;"></div>
      </div>`;
  }

  function renderError(err) {
    const root=document.getElementById('view-root');
    if(root) root.innerHTML = `<div class="error-message p-8 text-center">エラーが発生しました: ${utils.escapeHtml(err.message)}</div>`;
  }

})();