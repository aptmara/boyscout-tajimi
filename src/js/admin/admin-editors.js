// admin-editors.js
(function () {
  const Admin = (window.Admin = window.Admin || {});
  const { utils, api, state } = Admin;

  Admin.editors = {
    openNews(id) { openNewsEditor(id); },
    openActivity(id) { openActivityEditor(id); }
  };

  function onSheetReady(fn) { if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fn); else setTimeout(fn, 0); }

  // 画像URLのプレビューを更新する関数
  function updateImagePreview(textareaId, containerId) {
    const textarea = document.getElementById(textareaId);
    const container = document.getElementById(containerId);
    if (!textarea || !container) return;

    const urls = textarea.value.split(/\n+/).map(u => u.trim()).filter(u => u);
    container.innerHTML = ''; // Clear current previews

    if (urls.length === 0) {
      container.innerHTML = '<div class="preview-placeholder">画像URLを入力するとプレビューが表示されます</div>';
      return;
    }

    urls.forEach(rawUrl => {
      const url = utils.convertGoogleDriveUrl(rawUrl);
      const wrapper = document.createElement('div');
      wrapper.className = 'image-preview-item';

      const img = document.createElement('img');
      img.src = url;
      img.className = 'image-preview-thumb';
      img.onerror = () => { wrapper.classList.add('error'); };

      wrapper.appendChild(img);
      container.appendChild(wrapper);
    });
  }

  // URL入力欄の変更監視を設定する関数
  function setupImagePreview(textareaId, containerId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;
    textarea.addEventListener('input', utils.debounce(() => updateImagePreview(textareaId, containerId), 500));
  }

  // ---- News Editor ----
  async function openNewsEditor(id) {
    const isEdit = Boolean(id);
    const title = isEdit ? 'お知らせ編集' : 'お知らせ作成';
    const formId = 'news-editor-form';
    const html = `
      <form id="${formId}" class="editor-form form-grid">
        <div class="form-group full-width"><label>タイトル</label><input type="text" id="news-title" required class="input"></div>
        <div class="form-group full-width"><label>本文</label><textarea id="news-content" required class="textarea" rows="8"></textarea></div>
        
        <div class="form-group full-width">
          <label>画像URL (1行に1つ・Google Drive対応)</label>
          <textarea id="news-images" class="textarea" rows="3" placeholder="https://..."></textarea>
          <div id="news-images-preview" class="image-preview-container mt-2"></div>
        </div>

        <div class="form-group"><label>カテゴリー</label><input type="text" id="news-category" class="input" placeholder="未分類"></div>
        <div class="form-group"><label>隊</label><select id="news-unit" class="select"><option value="">(指定なし)</option></select></div>
        <div class="form-group full-width"><label>タグ（複数選択可）</label><select id="news-tags" class="select" multiple size="5"></select></div>
        
        <div class="editor-actions full-width">
          <button type="button" id="news-cancel" class="btn-ghost">キャンセル</button>
          <button type="submit" class="btn-primary">${isEdit ? '更新する' : '作成する'}</button>
        </div>
        <p id="news-error" class="error-message full-width"></p>
      </form>`;
    AdminUI.open({ title, html, actions: [] });

    let settings = {};
    try {
      const res = await fetch('/api/settings/all', { credentials: 'same-origin' });
      if (res.ok) { const rows = await res.json(); settings = rows.reduce((acc, r) => (acc[r.key] = r.value, acc), {}); }
    } catch { }

    onSheetReady(async () => {
      const form = document.getElementById(formId);
      const titleInput = document.getElementById('news-title');
      const contentInput = document.getElementById('news-content');
      const imagesInput = document.getElementById('news-images'); // Added
      const categoryInput = document.getElementById('news-category');
      const unitSelect = document.getElementById('news-unit');
      const tagsSelect = document.getElementById('news-tags');
      const err = document.getElementById('news-error');
      document.getElementById('news-cancel')?.addEventListener('click', AdminUI.close);

      setupImagePreview('news-images', 'news-images-preview');

      try {
        const units = JSON.parse(settings.units_json || '[]');
        unitSelect.innerHTML = '<option value="">(指定なし)</option>' + (Array.isArray(units) ? units.map(u => `<option value="${utils.escapeHtml(u.slug)}">${utils.escapeHtml(u.label || u.slug)}</option>`).join('') : '');
        const tags = JSON.parse(settings.news_tags_json || '[]');
        tagsSelect.innerHTML = (Array.isArray(tags) ? tags.map(t => `<option value="${utils.escapeHtml(t.slug)}">${utils.escapeHtml(t.label || t.slug)}</option>`).join('') : '');
      } catch { }

      if (isEdit) {
        try {
          const r = await fetch(`/api/news/${encodeURIComponent(id)}`, { credentials: 'same-origin' });
          if (r.ok) {
            const a = await r.json();
            titleInput.value = a.title || '';
            contentInput.value = a.content || '';
            // 画像URL配列を改行区切り文字列に表示
            imagesInput.value = Array.isArray(a.image_urls) ? a.image_urls.join('\n') : '';
            updateImagePreview('news-images', 'news-images-preview');

            categoryInput.value = a.category || '';
            unitSelect.value = a.unit || '';
            const set = new Set(Array.isArray(a.tags) ? a.tags : []);
            Array.from(tagsSelect.options).forEach(o => o.selected = set.has(o.value));
          } else {
            err.textContent = '記事の読み込みに失敗しました。';
          }
        } catch { err.textContent = '記事の読み込みに失敗しました。'; }
      }

      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        err.textContent = '';

        // Google Drive URLの変換処理
        const rawImages = imagesInput.value.split(/\n+/).map(s => s.trim()).filter(s => s);
        const convertedImages = rawImages.map(url => utils.convertGoogleDriveUrl(url));

        const payload = {
          title: String(titleInput.value || '').trim(),
          content: String(contentInput.value || '').trim(),
          images: convertedImages,
          category: String(categoryInput.value || '').trim() || '未分類',
          unit: String(unitSelect.value || '').trim() || null,
          tags: Array.from(tagsSelect.options).filter(o => o.selected).map(o => o.value)
        };
        if (!payload.title || !payload.content) { err.textContent = 'タイトルと本文は必須です。'; return; }

        const url = isEdit ? `/api/news/${encodeURIComponent(id)}` : '/api/news';
        const method = isEdit ? 'PUT' : 'POST';
        try {
          const res = await utils.fetchWithAuth(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (res.ok) {
            AdminUI.close();
            utils.showToast('保存しました', 'success');
            state.cache.summary = null;
            window.Admin?.views?.setActiveView('news', { force: true });
          } else {
            const data = await res.json().catch(() => ({}));
            err.textContent = data.error || '保存に失敗しました。';
          }
        } catch { err.textContent = '通信に失敗しました。'; }
      });
    });
  }

  // ---- Activity Editor ----
  async function openActivityEditor(id) {
    const isEdit = Boolean(id);
    const title = isEdit ? '活動記録編集' : '活動記録作成';
    const formId = 'activity-editor-form';
    const html = `
      <form id="${formId}" class="editor-form form-grid">
        <div class="form-group full-width"><label>タイトル</label><input type="text" id="act-title" required class="input"></div>
        <div class="form-group full-width"><label>本文</label><textarea id="act-content" required class="textarea" rows="8"></textarea></div>
        
        <div class="form-group full-width">
          <label>画像URL (1行に1つ・Google Drive対応)</label>
          <textarea id="act-images" class="textarea" rows="3" placeholder="https://..."></textarea>
          <div id="act-images-preview" class="image-preview-container mt-2"></div>
        </div>

        <div class="form-group"><label>カテゴリー</label><input type="text" id="act-category" class="input" placeholder="未分類"></div>
        <div class="form-group"><label>隊</label><select id="act-unit" class="select"><option value="">(指定なし)</option></select></div>
        <div class="form-group"><label>タグ（複数選択可）</label><select id="act-tags" class="select" multiple size="5"></select></div>
        <div class="form-group"><label>活動日</label><input type="date" id="act-date" class="input"></div>
        
        <div class="editor-actions full-width">
          <button type="button" id="act-cancel" class="btn-ghost">キャンセル</button>
          <button type="submit" class="btn-primary">${isEdit ? '更新する' : '作成する'}</button>
        </div>
        <p id="act-error" class="error-message full-width"></p>
      </form>`;
    AdminUI.open({ title, html, actions: [] });

    let settings = {};
    try { const r = await fetch('/api/settings/all', { credentials: 'same-origin' }); if (r.ok) { const rows = await r.json(); settings = rows.reduce((a, x) => (a[x.key] = x.value, a), {}); } } catch { }

    onSheetReady(async () => {
      const form = document.getElementById(formId);
      const titleInput = document.getElementById('act-title');
      const contentInput = document.getElementById('act-content');
      const imagesInput = document.getElementById('act-images'); // Added
      const categoryInput = document.getElementById('act-category');
      const unitSelect = document.getElementById('act-unit');
      const tagsSelect = document.getElementById('act-tags');
      const dateInput = document.getElementById('act-date');
      const err = document.getElementById('act-error');
      document.getElementById('act-cancel')?.addEventListener('click', AdminUI.close);

      setupImagePreview('act-images', 'act-images-preview');

      try {
        const units = JSON.parse(settings.units_json || '[]');
        unitSelect.innerHTML = '<option value="">(指定なし)</option>' + (Array.isArray(units) ? units.map(u => `<option value="${utils.escapeHtml(u.slug)}">${utils.escapeHtml(u.label || u.slug)}</option>`).join('') : '');
        const tags = JSON.parse(settings.activity_tags_json || '[]');
        tagsSelect.innerHTML = (Array.isArray(tags) ? tags.map(t => `<option value="${utils.escapeHtml(t.slug)}">${utils.escapeHtml(t.label || t.slug)}</option>`).join('') : '');
      } catch { }

      if (isEdit) {
        try {
          const r = await fetch(`/api/activities/${encodeURIComponent(id)}`, { credentials: 'same-origin' });
          if (r.ok) {
            const a = await r.json();
            titleInput.value = a.title || '';
            contentInput.value = a.content || '';
            // 画像URL配列を改行区切り文字列に変換して表示
            imagesInput.value = Array.isArray(a.image_urls) ? a.image_urls.join('\n') : '';
            updateImagePreview('act-images', 'act-images-preview');

            categoryInput.value = a.category || '';
            unitSelect.value = a.unit || '';
            const set = new Set(Array.isArray(a.tags) ? a.tags : []);
            Array.from(tagsSelect.options).forEach(o => o.selected = set.has(o.value));
            if (a.activity_date) { const d = new Date(a.activity_date); if (!isNaN(d)) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); dateInput.value = `${y}-${m}-${day}`; } }
          } else { err.textContent = '活動記録の読み込みに失敗しました。'; }
        } catch { err.textContent = '活動記録の読み込みに失敗しました。'; }
      }

      form?.addEventListener('submit', async (e) => {
        e.preventDefault(); err.textContent = '';

        // Google Drive URLの変換処理
        const rawImages = imagesInput.value.split(/\n+/).map(s => s.trim()).filter(s => s);
        const convertedImages = rawImages.map(url => utils.convertGoogleDriveUrl(url));

        const payload = {
          title: String(titleInput.value || '').trim(),
          content: String(contentInput.value || '').trim(),
          images: convertedImages,
          category: String(categoryInput.value || '').trim() || '未分類',
          unit: String(unitSelect.value || '').trim() || null,
          tags: Array.from(tagsSelect.options).filter(o => o.selected).map(o => o.value),
          activity_date: String(dateInput.value || '').trim() || null
        };
        if (!payload.title || !payload.content) { err.textContent = 'タイトルと本文は必須です。'; return; }

        const url = isEdit ? `/api/activities/${encodeURIComponent(id)}` : '/api/activities';
        const method = isEdit ? 'PUT' : 'POST';
        try {
          const res = await utils.fetchWithAuth(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (res.ok) { AdminUI.close(); utils.showToast('保存しました', 'success'); state.cache.summary = null; window.Admin?.views?.setActiveView('activities', { force: true }); }
          else { const data = await res.json().catch(() => ({})); err.textContent = data.error || '保存に失敗しました。'; }
        } catch { err.textContent = '通信に失敗しました。'; }
      });
    });
  }
})();
