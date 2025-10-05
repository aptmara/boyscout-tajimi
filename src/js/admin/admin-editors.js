// admin-editors.js
(function(){
  const Admin = (window.Admin = window.Admin || {});
  const { utils, api, state } = Admin;

  Admin.editors = {
    openNews(id){ openNewsEditor(id); },
    openActivity(id){ openActivityEditor(id); }
  };

  function onSheetReady(fn){ if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fn); else setTimeout(fn, 0); }

  // ---- News Editor ----
  async function openNewsEditor(id){
    const isEdit = Boolean(id);
    const title = isEdit ? '���m�点��ҏW' : '���m�点���쐬';
    const formId = 'news-editor-form';
    const html = `
      <form id="${formId}" class="editor-form">
        <div class="form-row"><label>�^�C�g��</label><input type="text" id="news-title" required class="input"></div>
        <div class="form-row"><label>�{��</label><textarea id="news-content" required class="textarea" rows="8"></textarea></div>
        <div class="form-row"><label>�J�e�S��</label><input type="text" id="news-category" class="input" placeholder="������"></div>
        <div class="form-row"><label>��</label><select id="news-unit" class="input"><option value="">�i���w��j</option></select></div>
        <div class="form-row"><label>�^�O�i�����I���j</label><select id="news-tags" class="input" multiple size="5"></select></div>
        <div class="editor-actions"><button type="submit" class="btn">${isEdit?'�X�V����':'�쐬����'}</button><button type="button" id="news-cancel" class="btn-ghost">�L�����Z��</button></div>
        <p id="news-error" class="error-message"></p>
      </form>`;
    AdminUI.open({ title, html, actions: [] });

    // Populate settings (units/tags)
    let settings = {};
    try {
      const res = await fetch('/api/settings/all', { credentials:'same-origin' });
      if (res.ok){ const rows = await res.json(); settings = rows.reduce((acc, r)=> (acc[r.key]=r.value, acc), {}); }
    } catch {}

    onSheetReady(async ()=>{
      const form = document.getElementById(formId);
      const titleInput = document.getElementById('news-title');
      const contentInput = document.getElementById('news-content');
      const categoryInput = document.getElementById('news-category');
      const unitSelect = document.getElementById('news-unit');
      const tagsSelect = document.getElementById('news-tags');
      const err = document.getElementById('news-error');
      document.getElementById('news-cancel')?.addEventListener('click', AdminUI.close);

      // options
      try{
        const units = JSON.parse(settings.units_json || '[]');
        unitSelect.innerHTML = '<option value="">�i���w��j</option>' + (Array.isArray(units)?units.map(u=>`<option value="${utils.escapeHtml(u.slug)}">${utils.escapeHtml(u.label||u.slug)}</option>`).join(''): '');
        const tags = JSON.parse(settings.news_tags_json || '[]');
        tagsSelect.innerHTML = (Array.isArray(tags)?tags.map(t=>`<option value="${utils.escapeHtml(t.slug)}">${utils.escapeHtml(t.label||t.slug)}</option>`).join(''): '');
      } catch {}

      if (isEdit){
        try {
          const r = await fetch(`/api/news/${encodeURIComponent(id)}`, { credentials:'same-origin' });
          if (r.ok){
            const a = await r.json();
            titleInput.value = a.title || '';
            contentInput.value = a.content || '';
            categoryInput.value = a.category || '';
            unitSelect.value = a.unit || '';
            const set = new Set(Array.isArray(a.tags)?a.tags:[]);
            Array.from(tagsSelect.options).forEach(o=> o.selected = set.has(o.value));
          } else {
            err.textContent = '�L���̓ǂݍ��݂Ɏ��s���܂����B';
          }
        } catch { err.textContent = '�L���̓ǂݍ��݂Ɏ��s���܂����B'; }
      }

      form?.addEventListener('submit', async (e)=>{
        e.preventDefault();
        err.textContent = '';
        const payload = {
          title: String(titleInput.value||'').trim(),
          content: String(contentInput.value||'').trim(),
          category: String(categoryInput.value||'').trim() || '������',
          unit: String(unitSelect.value||'').trim() || null,
          tags: Array.from(tagsSelect.options).filter(o=>o.selected).map(o=>o.value)
        };
        if (!payload.title || !payload.content){ err.textContent = '�^�C�g���Ɩ{���͕K�{�ł��B'; return; }
        const url = isEdit ? `/api/news/${encodeURIComponent(id)}` : '/api/news';
        const method = isEdit ? 'PUT' : 'POST';
        try {
          const res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, credentials:'same-origin', body: JSON.stringify(payload) });
          if (res.ok){
            AdminUI.close();
            utils.showToast('�ۑ����܂���', 'success');
            state.cache.summary = null; // refresh dashboard next time
            window.Admin?.views?.setActiveView('news', { force:true });
          } else {
            const data = await res.json().catch(()=>({}));
            err.textContent = data.error || '�ۑ��Ɏ��s���܂����B';
          }
        } catch { err.textContent = '�ʐM�Ɏ��s���܂����B'; }
      });
    });
  }

  // ---- Activity Editor ----
  async function openActivityEditor(id){
    const isEdit = Boolean(id);
    const title = isEdit ? '������ҏW' : '�������쐬';
    const formId = 'activity-editor-form';
    const html = `
      <form id="${formId}" class="editor-form">
        <div class="form-row"><label>�^�C�g��</label><input type="text" id="act-title" required class="input"></div>
        <div class="form-row"><label>�{��</label><textarea id="act-content" required class="textarea" rows="8"></textarea></div>
        <div class="form-row"><label>�J�e�S��</label><input type="text" id="act-category" class="input" placeholder="������"></div>
        <div class="form-row"><label>��</label><select id="act-unit" class="input"><option value="">�i���w��j</option></select></div>
        <div class="form-row"><label>�^�O�i�����I���j</label><select id="act-tags" class="input" multiple size="5"></select></div>
        <div class="form-row"><label>���{��</label><input type="date" id="act-date" class="input"></div>
        <div class="editor-actions"><button type="submit" class="btn">${isEdit?'�X�V����':'�쐬����'}</button><button type="button" id="act-cancel" class="btn-ghost">�L�����Z��</button></div>
        <p id="act-error" class="error-message"></p>
      </form>`;
    AdminUI.open({ title, html, actions: [] });

    // settings
    let settings = {};
    try { const r=await fetch('/api/settings/all', { credentials:'same-origin' }); if (r.ok){ const rows=await r.json(); settings = rows.reduce((a,x)=>(a[x.key]=x.value,a),{}); } } catch {}

    onSheetReady(async ()=>{
      const form = document.getElementById(formId);
      const titleInput = document.getElementById('act-title');
      const contentInput = document.getElementById('act-content');
      const categoryInput = document.getElementById('act-category');
      const unitSelect = document.getElementById('act-unit');
      const tagsSelect = document.getElementById('act-tags');
      const dateInput = document.getElementById('act-date');
      const err = document.getElementById('act-error');
      document.getElementById('act-cancel')?.addEventListener('click', AdminUI.close);

      try{
        const units = JSON.parse(settings.units_json || '[]');
        unitSelect.innerHTML = '<option value="">�i���w��j</option>' + (Array.isArray(units)?units.map(u=>`<option value="${utils.escapeHtml(u.slug)}">${utils.escapeHtml(u.label||u.slug)}</option>`).join(''): '');
        const tags = JSON.parse(settings.activity_tags_json || '[]');
        tagsSelect.innerHTML = (Array.isArray(tags)?tags.map(t=>`<option value="${utils.escapeHtml(t.slug)}">${utils.escapeHtml(t.label||t.slug)}</option>`).join(''): '');
      } catch {}

      if (isEdit){
        try {
          const r = await fetch(`/api/activities/${encodeURIComponent(id)}`, { credentials:'same-origin' });
          if (r.ok){
            const a = await r.json();
            titleInput.value = a.title || '';
            contentInput.value = a.content || '';
            categoryInput.value = a.category || '';
            unitSelect.value = a.unit || '';
            const set = new Set(Array.isArray(a.tags)?a.tags:[]);
            Array.from(tagsSelect.options).forEach(o=> o.selected = set.has(o.value));
            if (a.activity_date){ const d=new Date(a.activity_date); if (!isNaN(d)){ const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); dateInput.value = `${y}-${m}-${day}`; } }
          } else { err.textContent = '�����̓ǂݍ��݂Ɏ��s���܂����B'; }
        } catch { err.textContent = '�����̓ǂݍ��݂Ɏ��s���܂����B'; }
      }

      form?.addEventListener('submit', async (e)=>{
        e.preventDefault(); err.textContent = '';
        const payload = {
          title: String(titleInput.value||'').trim(),
          content: String(contentInput.value||'').trim(),
          category: String(categoryInput.value||'').trim() || '������',
          unit: String(unitSelect.value||'').trim() || null,
          tags: Array.from(tagsSelect.options).filter(o=>o.selected).map(o=>o.value),
          activity_date: String(dateInput.value||'').trim() || null
        };
        if (!payload.title || !payload.content){ err.textContent = '�^�C�g���Ɩ{���͕K�{�ł��B'; return; }
        const url = isEdit ? `/api/activities/${encodeURIComponent(id)}` : '/api/activities';
        const method = isEdit ? 'PUT' : 'POST';
        try {
          const res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, credentials:'same-origin', body: JSON.stringify(payload) });
          if (res.ok){ AdminUI.close(); utils.showToast('�ۑ����܂���', 'success'); state.cache.summary = null; window.Admin?.views?.setActiveView('activities', { force:true }); }
          else { const data = await res.json().catch(()=>({})); err.textContent = data.error || '�ۑ��Ɏ��s���܂����B'; }
        } catch { err.textContent = '�ʐM�Ɏ��s���܂����B'; }
      });
    });
  }
})();
