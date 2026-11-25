// admin-views.js
(function () {
  const Admin = (window.Admin = window.Admin || {});
  const { state, utils, api, actions } = Admin;

  // --- Views Management ---
  const views = Admin.views = {};

  views.setActiveView = async function (viewId, params = {}) {
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
    const titleEl = document.querySelector('.topbar-title') || document.querySelector('.top-bar h1');
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

  // --- Settings View Logic ---
  async function renderSettingsView(root, initialTab) {
    root.innerHTML = '<div class="loading-spinner mx-auto"></div>';

    // Load Data
    let structuredData = {};
    let groupsDef = {};
    let flatData = {};

    try {
      const res = await api.settings(); // expects { groups, settings, flat }
      if (res.groups && res.settings) {
        structuredData = res.settings;
        groupsDef = res.groups;
        flatData = res.flat;
      } else {
        // Fallback or error
        throw new Error('Invalid API response format');
      }
    } catch (e) {
      root.innerHTML = `<div class="error-message">設定の読み込みに失敗しました: ${utils.escapeHtml(e.message)}</div>`;
      return;
    }

    // グループ定義（順番制御用）- サーバー定義のキー順序が保障されないため、ここで順序を定義するか、サーバーから配列でもらうのが良いが、
    // JavaScriptのObject.keys順序（挿入順）にある程度依存してしまう。
    // ここでは主要なグループ順序を定義し、残りはその後に続ける。
    const orderedGroupKeys = [
      'COMMON', 'INDEX', 'ABOUT', 'JOIN', 'CONTACT', 'SNS', 'PRIVACY',
      'BEAVER', 'CUB', 'BOY', 'VENTURE', 'ROVER'
    ];
    // 未定義のグループがあれば末尾に追加
    Object.keys(groupsDef).forEach(k => {
      if (!orderedGroupKeys.includes(k)) orderedGroupKeys.push(k);
    });

    let currentTab = initialTab || orderedGroupKeys[0];
    if (!structuredData[currentTab]) currentTab = orderedGroupKeys.find(k => structuredData[k]) || 'COMMON';

    const render = () => {
      root.innerHTML = '';

      // 1. Tabs
      const tabsNav = document.createElement('div');
      tabsNav.className = 'tabs';
      // コンテナ幅を超える場合のスクロール対応
      tabsNav.style.overflowX = 'auto';
      tabsNav.style.flexWrap = 'nowrap';

      orderedGroupKeys.forEach(groupId => {
        if (!structuredData[groupId]) return; // データがないグループは表示しない

        const btn = document.createElement('button');
        btn.className = `tab-btn ${groupId === currentTab ? 'active' : ''}`;
        btn.textContent = groupsDef[groupId] || groupId;
        btn.onclick = () => { currentTab = groupId; render(); };
        btn.style.whiteSpace = 'nowrap';
        tabsNav.appendChild(btn);
      });
      root.appendChild(tabsNav);

      // 2. Content
      const fields = structuredData[currentTab] || [];

      const desc = document.createElement('p');
      desc.className = 'settings-description';
      desc.textContent = `${groupsDef[currentTab] || currentTab} の設定項目です。画像はアップロードするとURLが自動入力されます。`;
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
        fields.forEach(field => {
          const input = form.querySelector(`[name="${field.key}"]`);
          if (input) {
            let val = input.value;
            // Google Drive変換 (Imageタイプのみ) - 念のため
            if (field.type === 'image') {
              val = utils.convertGoogleDriveUrl(val);
            }
            payload[field.key] = val;
          }
        });

        try {
          const res = await utils.fetchWithAuth('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'same-origin'
          });
          if (!res.ok) throw new Error('Save failed');
          utils.showToast('設定を保存しました');
          // Update local data for preview
          fields.forEach(field => {
            if (payload[field.key]) field.value = payload[field.key];
          });
          render();
        } catch (err) {
          utils.showToast(err.message, 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      };

      fields.forEach(field => {
        const div = document.createElement('div');
        div.className = 'form-group full-width';

        const label = document.createElement('label');
        label.textContent = field.label || field.key;
        div.appendChild(label);

        // Input Wrapper
        const inputWrapper = document.createElement('div');
        inputWrapper.style.display = 'flex';
        inputWrapper.style.gap = '8px';

        const input = document.createElement('input');
        input.type = 'text';
        input.name = field.key;
        input.className = 'input';
        // サーバーから来る値 (field.value) を使用
        input.value = field.value || '';

        if (field.type === 'image') {
          input.placeholder = 'https://... または画像をアップロード';
          input.style.flex = '1';

          input.addEventListener('input', utils.debounce((e) => {
            const preview = div.querySelector('.image-preview-thumb');
            if (preview) preview.src = utils.convertGoogleDriveUrl(e.target.value);
          }, 500));

          // Upload Button
          const uploadBtn = document.createElement('button');
          uploadBtn.type = 'button';
          uploadBtn.className = 'btn-secondary';
          uploadBtn.textContent = '画像を選択';
          uploadBtn.style.whiteSpace = 'nowrap';

          // Hidden File Input
          const fileInput = document.createElement('file-input'); // dummy tag mechanism or create element
          const hiddenInput = document.createElement('input');
          hiddenInput.type = 'file';
          hiddenInput.accept = 'image/*';
          hiddenInput.style.display = 'none';

          uploadBtn.onclick = () => hiddenInput.click();

          hiddenInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            uploadBtn.textContent = '...';
            uploadBtn.disabled = true;

            const formData = new FormData();
            formData.append('image', file);
            formData.append('key', field.key); // キーも送るとバックエンドで設定更新もしてくれる

            try {
              const res = await utils.fetchWithAuth('/api/settings/upload', {
                method: 'POST',
                body: formData,
                credentials: 'same-origin'
              });
              if (!res.ok) throw new Error('Upload failed');
              const data = await res.json();

              // 成功したらURLを入力欄にセット
              input.value = data.url;
              field.value = data.url; // Update local state

              const preview = div.querySelector('.image-preview-thumb');
              if (preview) {
                preview.src = data.url;
                preview.parentElement.style.display = 'block';
              }
              utils.showToast('アップロード完了');
            } catch (err) {
              utils.showToast('アップロード失敗: ' + err.message, 'error');
            } finally {
              uploadBtn.textContent = '画像を選択';
              uploadBtn.disabled = false;
              hiddenInput.value = ''; // Reset
            }
          };

          inputWrapper.appendChild(input);
          inputWrapper.appendChild(uploadBtn);
          inputWrapper.appendChild(hiddenInput); // DOMに追加しておかないと動作しないブラウザもあるかも
        } else {
          // テキストエリア対応 (長文の場合)
          if (field.key.includes('message') || field.key.includes('html')) {
            const textarea = document.createElement('textarea');
            textarea.name = field.key;
            textarea.className = 'textarea';
            textarea.value = field.value || '';
            textarea.rows = 4;
            div.appendChild(textarea);
            inputWrapper.style.display = 'none'; // inputWrapperを使わない
          } else {
            inputWrapper.appendChild(input);
          }
        }

        if (inputWrapper.style.display !== 'none') {
          div.appendChild(inputWrapper);
        }

        // Preview Area (Image only)
        if (field.type === 'image') {
          const previewWrapper = document.createElement('div');
          previewWrapper.className = 'image-preview-item';
          previewWrapper.style.marginTop = '10px';
          previewWrapper.style.maxWidth = '200px';

          const img = document.createElement('img');
          img.className = 'image-preview-thumb';
          img.style.width = '100%';
          img.style.borderRadius = '8px';
          img.style.border = '1px solid #ddd';

          const val = field.value || '';
          img.src = utils.convertGoogleDriveUrl(val);

          img.onerror = () => { previewWrapper.style.display = 'none'; };
          img.onload = () => { previewWrapper.style.display = 'block'; };

          if (!val) previewWrapper.style.display = 'none';

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
                 <button id="go-to-settings-btn" class="btn-secondary mt-3 text-sm">設定画面へ</button>
               </div>`
          : '<div class="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">✅ 重要な設定は完了しています</div>'}
        </div>

        <div class="view-section">
          <h2 class="section-heading">システム管理</h2>
          <div class="card p-4">
            <h3 class="font-bold mb-2">データバックアップ</h3>
            <p class="text-sm text-gray-600 mb-4">画像ファイルとデータベースの完全バックアップ（ZIP）をダウンロードします。</p>
            <button id="backup-btn" class="btn-primary">📦 今すぐバックアップをダウンロード</button>
          </div>
        </div>
      `;

      // イベントリスナーをDOMに追加（CSP対応）
      const backupBtn = document.getElementById('backup-btn');
      if (backupBtn) {
        backupBtn.onclick = () => {
          // パスワード入力ダイアログを表示
          showBackupDialog();
        };
      }

      function showBackupDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'modal-backdrop';
        dialog.style.display = 'flex'; // CSSのdisplay:noneを上書き
        dialog.innerHTML = `
          <div class="modal" style="max-width:400px;">
            <div class="modal-header">
              <h2>バックアップダウンロード</h2>
              <button class="modal-close">✕</button>
            </div>
            <form class="modal-body" id="backup-form">
              <p style="margin-bottom:1rem;color:#666;">セキュリティのため、パスワードを再入力してください。</p>
              <div class="form-group">
                <label>パスワード</label>
                <input type="password" name="password" required autocomplete="current-password">
              </div>
              <div class="form-actions">
                <button type="button" class="btn-ghost modal-cancel">キャンセル</button>
                <button type="submit" class="btn-primary">ダウンロード</button>
              </div>
            </form>
          </div>
        `;

        document.body.appendChild(dialog);

        const closeDialog = () => dialog.remove();
        dialog.querySelector('.modal-close')?.addEventListener('click', closeDialog);
        dialog.querySelector('.modal-cancel')?.addEventListener('click', closeDialog);
        dialog.addEventListener('click', (e) => { if (e.target === dialog) closeDialog(); });

        dialog.querySelector('#backup-form')?.addEventListener('submit', async (e) => {
          e.preventDefault();
          const form = e.target;
          const password = form.querySelector('[name="password"]').value;
          const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
          const submitBtn = form.querySelector('[type="submit"]');

          submitBtn.disabled = true;
          submitBtn.textContent = 'ダウンロード中...';

          try {
            const res = await fetch('/api/admin/backup', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrf
              },
              credentials: 'same-origin',
              body: JSON.stringify({ password })
            });

            if (!res.ok) {
              const err = await res.json();
              throw new Error(err.message || err.error || 'ダウンロードに失敗しました');
            }

            // ファイルダウンロードを処理
            const blob = await res.blob();
            const contentDisposition = res.headers.get('content-disposition');
            let filename = 'backup.zip';
            if (contentDisposition) {
              const match = contentDisposition.match(/filename="?([^"]+)"?/);
              if (match) filename = match[1];
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            utils.showToast('バックアップをダウンロードしました', 'success');
            closeDialog();
          } catch (err) {
            utils.showToast(`エラー: ${err.message}`, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'ダウンロード';
          }
        });
      }

      // イベントリスナーをDOMに追加（CSP対応）
      const goToSettingsBtn = document.getElementById('go-to-settings-btn');
      if (goToSettingsBtn) {
        goToSettingsBtn.addEventListener('click', () => Admin.views.setActiveView('settings'));
      }
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
    'dashboard': { title: 'ダッシュボード', subtitle: 'サイトの概況', render: renderDashboardView },
    'news': { title: 'お知らせ', subtitle: 'ニュースの管理', render: createListView(newsViewConfig) },
    'activities': { title: '活動記録', subtitle: '活動レポートの管理', render: createListView(activitiesViewConfig) },
    'settings': { title: 'サイト設定', subtitle: 'サイト全体・ブランドの設定', render: renderSettingsView, adminOnly: true },
    'users': { title: 'ユーザー管理', subtitle: '管理者・編集者の管理', render: renderUsersView, adminOnly: true },
    'audit-logs': { title: 'セキュリティログ', subtitle: '操作履歴の確認', render: renderAuditLogsView, adminOnly: true },

    'news-editor': { title: '...', subtitle: '', render: (root, id) => renderNewsEditorView(root, id) },
    'activities-editor': { title: '...', subtitle: '', render: (root, id) => renderActivityEditorView(root, id) },
  };

  // ---- Users Management View ----
  async function renderUsersView(root) {
    root.innerHTML = '<div class="loading-spinner mx-auto"></div>';

    try {
      const res = await fetch('/api/users', { credentials: 'same-origin' });
      if (!res.ok) {
        if (res.status === 403) {
          root.innerHTML = '<div class="error-message">この機能は管理者のみ利用できます。</div>';
          return;
        }
        throw new Error('Failed to fetch users');
      }
      const { users, currentUserId } = await res.json();

      root.innerHTML = `
        <div class="view-section">
          <div class="card">
            <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
              <h2>ユーザー一覧</h2>
              <button class="btn-primary" id="add-user-btn">＋ ユーザー追加</button>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>ユーザー名</th>
                  <th>権限</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody id="users-tbody">
                ${users.map(user => {
        const isSelf = user.id === currentUserId;
        return `
                  <tr data-user-id="${user.id}">
                    <td>${user.id}${isSelf ? ' <span class="badge gray">あなた</span>' : ''}</td>
                    <td>${utils.escapeHtml(user.username)}</td>
                    <td><span class="badge ${user.role === 'admin' ? 'green' : 'blue'}">${user.role === 'admin' ? '管理者' : '編集者'}</span></td>
                    <td>
                      <button class="btn-ghost edit-user-btn" data-id="${user.id}" data-is-self="${isSelf}">編集</button>
                      ${!isSelf ? `<button class="btn-ghost delete-user-btn" data-id="${user.id}" data-username="${utils.escapeHtml(user.username)}">削除</button>` : ''}
                    </td>
                  </tr>
                `}).join('')}
              </tbody>
            </table>
          </div>
          <div class="card" style="margin-top:1rem;">
            <h3>権限について</h3>
            <ul style="margin-left:1rem;line-height:1.8;">
              <li><strong>管理者 (admin)</strong>：すべての機能にアクセス可能（設定変更、バックアップ、ユーザー管理を含む）</li>
              <li><strong>編集者 (editor)</strong>：お知らせ・活動記録の作成・編集のみ可能</li>
            </ul>
          </div>
        </div>
      `;

      // Add user button
      document.getElementById('add-user-btn')?.addEventListener('click', () => showUserDialog());

      // Edit buttons
      root.querySelectorAll('.edit-user-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const userId = btn.dataset.id;
          const isSelf = btn.dataset.isSelf === 'true';
          const row = btn.closest('tr');
          const username = row?.querySelector('td:nth-child(2)')?.textContent || '';
          const role = row?.querySelector('.badge.green') ? 'admin' : 'editor'; // badge class check is safer
          showUserDialog({ id: userId, username, role, isSelf });
        });
      });

      // Delete buttons
      root.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const userId = btn.dataset.id;
          const username = btn.dataset.username;
          showDeleteUserDialog(userId, username, root);
        });
      });

    } catch (e) {
      root.innerHTML = `<div class="error-message">ユーザー情報の取得に失敗しました: ${utils.escapeHtml(e.message)}</div>`;
    }
  }

  function showDeleteUserDialog(userId, username, root) {
    const dialog = document.createElement('div');
    dialog.className = 'modal-backdrop';
    dialog.style.display = 'flex'; // Ensure visibility
    dialog.innerHTML = `
      <div class="modal" style="max-width:400px;">
        <div class="modal-header">
          <h2 style="color:#e02424;">ユーザー削除の確認</h2>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <p>ユーザー <strong>${utils.escapeHtml(username)}</strong> を削除してもよろしいですか？</p>
          <p style="margin-top:0.5rem;color:#666;font-size:0.9em;">この操作は取り消すことができません。</p>
        </div>
        <div class="form-actions">
          <button type="button" class="btn-ghost modal-cancel">キャンセル</button>
          <button type="button" class="btn-primary" style="background-color:#e02424;border-color:#e02424;" id="confirm-delete-btn">削除する</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    const closeDialog = () => dialog.remove();
    dialog.querySelector('.modal-close')?.addEventListener('click', closeDialog);
    dialog.querySelector('.modal-cancel')?.addEventListener('click', closeDialog);
    dialog.addEventListener('click', (e) => { if (e.target === dialog) closeDialog(); });

    dialog.querySelector('#confirm-delete-btn')?.addEventListener('click', async () => {
      const btn = dialog.querySelector('#confirm-delete-btn');
      btn.disabled = true;
      btn.textContent = '削除中...';

      try {
        const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
        const res = await fetch(`/api/users/${userId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
          credentials: 'same-origin'
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Delete failed');
        }

        utils.showToast('ユーザーを削除しました', 'success');
        closeDialog();
        renderUsersView(root); // Refresh
      } catch (e) {
        utils.showToast(`削除に失敗しました: ${e.message}`, 'error');
        btn.disabled = false;
        btn.textContent = '削除する';
      }
    });
  }

  function showUserDialog(existingUser = null) {
    const isEdit = !!existingUser?.id;
    const title = isEdit ? 'ユーザー編集' : '新規ユーザー作成';

    const dialog = document.createElement('div');
    dialog.className = 'modal-backdrop';
    dialog.style.display = 'flex'; // CSSのdisplay:noneを上書き
    dialog.innerHTML = `
      <div class="modal" style="max-width:400px;">
      <div class="modal-header">
        <h2>${title}</h2>
        <button class="modal-close">✕</button>
      </div>
      <form class="modal-body" id="user-form">
        <div class="form-group">
          <label>ユーザー名</label>
          <input type="text" name="username" required value="${existingUser?.username || ''}" ${isEdit ? 'readonly' : ''} autocomplete="username">
        </div>
        <div class="form-group">
          <label>パスワード${isEdit ? '（変更する場合のみ入力）' : ''}</label>
          <input type="password" name="password" ${isEdit ? '' : 'required'} autocomplete="new-password">
        </div>
        <div class="form-group">
          <label>権限${existingUser?.isSelf ? ' <span class="text-xs text-gray-500">※自分自身の権限は変更できません</span>' : ''}</label>
          <select name="role" ${existingUser?.isSelf ? 'disabled' : ''}>
            <option value="editor" ${existingUser?.role !== 'admin' ? 'selected' : ''}>編集者（コンテンツのみ）</option>
            <option value="admin" ${existingUser?.role === 'admin' ? 'selected' : ''}>管理者（全機能）</option>
          </select>
        </div>
        <div class="form-actions">
          <button type="button" class="btn-ghost modal-cancel">キャンセル</button>
          <button type="submit" class="btn-primary">${isEdit ? '更新' : '作成'}</button>
        </div>
      </form>
    </div>
    `;

    document.body.appendChild(dialog);

    const closeDialog = () => dialog.remove();
    dialog.querySelector('.modal-close')?.addEventListener('click', closeDialog);
    dialog.querySelector('.modal-cancel')?.addEventListener('click', closeDialog);
    dialog.addEventListener('click', (e) => { if (e.target === dialog) closeDialog(); });

    dialog.querySelector('#user-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = Object.fromEntries(new FormData(form).entries());
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content;

      try {
        const url = isEdit ? `/api/users/${existingUser.id}` : '/api/users';
        const method = isEdit ? 'PUT' : 'POST';

        // Remove password if empty on edit
        if (isEdit && !data.password) delete data.password;
        // Remove username on edit (readonly)
        if (isEdit) delete data.username;

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
          credentials: 'same-origin',
          body: JSON.stringify(data)
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Request failed');
        }

        utils.showToast(isEdit ? 'ユーザーを更新しました' : 'ユーザーを作成しました', 'success');
        closeDialog();
        // Refresh view
        const root = document.getElementById('view-root');
        if (root) renderUsersView(root);
      } catch (e) {
        utils.showToast(`エラー: ${e.message} `, 'error');
      }
    });
  }

  // ---- Audit Logs View ----
  async function renderAuditLogsView(root) {
    root.innerHTML = '<div class="loading-spinner mx-auto"></div>';

    try {
      const res = await fetch('/api/admin/audit-logs?limit=100', { credentials: 'same-origin' });
      if (!res.ok) {
        if (res.status === 403) {
          root.innerHTML = '<div class="error-message">この機能は管理者のみ利用できます。</div>';
          return;
        }
        throw new Error('Failed to fetch audit logs');
      }
      const { logs } = await res.json();
      const actionLabels = {
        activity_created: '活動記録を追加',
        activity_deleted: '活動記録を削除',
        news_created: 'お知らせを追加',
        news_deleted: 'お知らせを削除',
      };
      const formatDetails = (details) => {
        if (!details) return '-';
        try {
          const data = JSON.parse(details);
          const resource = data.resource === 'activity' ? '活動記録' : data.resource === 'news' ? 'お知らせ' : data.resource;
          const target = [resource, data.id ? `#${data.id}` : '', data.title || ''].filter(Boolean).join(' ');
          return utils.escapeHtml(target || details);
        } catch {
          return utils.escapeHtml(details);
        }
      };

      root.innerHTML = `
      <div class="view-section">
        <div class="card">
          <div class="card-header">
            <h2>操作ログ（直近100件）</h2>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>日時</th>
                <th>操作</th>
                <th>ユーザー</th>
                <th>IPアドレス</th>
                <th>ステータス</th>
                <th>詳細</th>
              </tr>
            </thead>
            <tbody>
              ${logs.length === 0 ? '<tr><td colspan="6" style="text-align:center;">ログがありません</td></tr>' : logs.map(log => `
                  <tr>
                    <td>${utils.escapeHtml(utils.formatDate(log.created_at))}</td>
                    <td><code>${utils.escapeHtml(actionLabels[log.action] || log.action)}</code></td>
                    <td>${utils.escapeHtml(log.username || '-')}</td>
                    <td><code>${utils.escapeHtml(log.ip_address || '-')}</code></td>
                    <td><span class="badge ${log.status === 'success' ? 'green' : 'red'}">${utils.escapeHtml(log.status || '-')}</span></td>
                    <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${utils.escapeHtml(log.details || '')}">${formatDetails(log.details)}</td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
        </div>
        </div>
      </div>
      `;
    } catch (e) {
      root.innerHTML = `<div class="error-message">ログの取得に失敗しました: ${utils.escapeHtml(e.message)}</div>`;
    }
  }

  // ---- Main Logic ----
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    try {
      const user = await ensureSession();
      initZoom();
      await window.AdminPalette?.init();

      // ロールベースのUI制御
      if (user.role !== 'admin') {
        document.querySelectorAll('[data-require-admin]').forEach(el => el.remove());
      }

      const params = new URLSearchParams(location.search);
      let initialView = params.get('view') || localStorage.getItem('admin.active') || 'dashboard';

      // 管理者専用ビューへのアクセスをブロック
      if (user.role !== 'admin') {
        const restrictedViews = ['settings', 'users', 'audit-logs', 'branding'];
        if (restrictedViews.includes(initialView.split('/')[0])) {
          initialView = 'dashboard';
        }
      }

      const parts = initialView.split('/');
      const viewId = parts[0];
      const id = parts[1];

      views.setActiveView(viewId, { id });
    } catch (err) {
      console.error('admin init failed', err);
      utils.showToast('セッションが無効です。再ログインしてください。', 'error');
      setTimeout(() => location.replace('/admin/login'), 1000);
    }
  }

  async function ensureSession() {
    const res = await fetch('/api/session', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Network error');
    const data = await res.json();
    if (!data.loggedIn) throw new Error('unauthenticated');
    return data.user;
  }

  function initZoom() {
    const root = document.documentElement;
    const clamp = (v) => Math.min(1.25, Math.max(0.85, Number(v) || 1));
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

  function renderSkeleton() {
    const root = document.getElementById('view-root');
    if (!root) return;
    root.innerHTML = `
      < div class= "view-section" >
        <div class="skeleton-card" style="height: 200px; margin-bottom: 20px;"></div>
        <div class="skeleton-card" style="height: 400px;"></div>
      </div > `;
  }

  function renderError(err) {
    const root = document.getElementById('view-root');
    if (root) root.innerHTML = `< div class= "error-message p-8 text-center" > エラーが発生しました: ${utils.escapeHtml(err.message)}</div > `;
  }

})();
