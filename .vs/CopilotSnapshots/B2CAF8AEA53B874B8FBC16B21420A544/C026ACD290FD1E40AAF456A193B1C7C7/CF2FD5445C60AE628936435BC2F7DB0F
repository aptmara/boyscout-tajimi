// admin-views.js
(function(){
  const Admin = (window.Admin = window.Admin || {});
  const { state, utils, api, actions, constants } = Admin;

  const views = Admin.views = {
    registry: {
      dashboard: { title:'ダッシュボード', subtitle:'活動とお知らせの指標をひと目で把握', render: renderDashboardView },
      news: { title:'お知らせ', subtitle:'最新のお知らせを作成・編集・公開管理', render: renderNewsView },
      activities: { title:'活動記録', subtitle:'隊の活動ログを整理しアーカイブを構築', render: renderActivitiesView },
      settings: { title:'サイト設定', subtitle:'連絡先や画像などサイト全体の設定を管理', render: renderSettingsSummaryView },
      branding: { title:'ブランド資産', subtitle:'ロゴ・写真・色などのビジュアル要素を確認', render: renderBrandingView },
    },
    async setActiveView(viewId, { force=false } = {}){
      if (!views.registry[viewId]) viewId = 'dashboard';
      if (!force && state.activeView === viewId) return;
      state.activeView = viewId; localStorage.setItem('admin.active', viewId);
      document.querySelectorAll('.nav-btn').forEach((btn)=>{ btn.classList.toggle('active', btn.dataset.view === viewId); });
      const view = views.registry[viewId];
      document.getElementById('view-title').textContent = view.title;
      document.getElementById('view-subtitle').textContent = view.subtitle;
      renderSkeleton();
      try { await view.render(document.getElementById('view-root')); window.Admin?.palette?.updateItems(); } catch (err) { console.error('view render failed', err); renderError(err); utils.showToast('データの取得に失敗しました。時間をおいて再度お試しください。', 'error'); }
    }
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init(){
    try {
      await ensureSession();
      initZoom();
      await AdminPalette.init();
      const initial = new URLSearchParams(location.search).get('view') || localStorage.getItem('admin.active') || 'dashboard';
      views.setActiveView(views.registry[initial] ? initial : 'dashboard');
    } catch (err) {
      console.error('admin init failed', err);
      utils.showToast('読み込みに失敗しました。再度ログインしてください。', 'error');
      location.replace('/admin/login.html');
    }
  }

  async function ensureSession(){ const res = await fetch('/api/session', { credentials:'same-origin' }); if (!res.ok) throw new Error('session check failed'); const data = await res.json(); if (!data.loggedIn) throw new Error('unauthenticated'); }

  function initZoom(){ const root=document.documentElement; const clamp=(v)=>Math.min(1.25,Math.max(0.85,Number(v)||1)); const read=()=>clamp(parseFloat(localStorage.getItem('admin.zoom')||'1')); const apply=(value)=>{ const next=clamp(value); root.style.setProperty('--zoom', next.toString()); localStorage.setItem('admin.zoom', next.toFixed(2)); }; apply(read()); document.getElementById('zoom-inc')?.addEventListener('click', ()=>apply(read()+0.05)); document.getElementById('zoom-dec')?.addEventListener('click', ()=>apply(read()-0.05)); }

  function renderSkeleton(){ const root=document.getElementById('view-root'); if (!root) return; root.innerHTML = `<section class="view-skeleton"><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div></section>`; }

  function renderError(error){ const root=document.getElementById('view-root'); if (!root) return; const message = error && error.message ? utils.escapeHtml(error.message) : '不明なエラーが発生しました。'; root.innerHTML = `<section class="view-section"><div class="card empty-state"><h2>読み込みエラー</h2><p>${message}</p><button class="btn-primary" type="button" id="retry-view">再読み込み</button></div></section>`; document.getElementById('retry-view')?.addEventListener('click', ()=> views.setActiveView(state.activeView, { force:true })); }

  // ---- Dashboard ----
  async function renderDashboardView(root){ const summary = await api.summary(); state.cache.summary = summary; const { news, activities, settings } = summary; root.innerHTML = `
    <section class="view-section"><div class="section-heading"><h2>主要指標</h2><p>最新の投稿状況と設定ステータス</p></div><div class="stats-grid">${renderMetricCard('お知らせ件数', news.total, news.trendLabel, '📰')}${renderMetricCard('活動記録', activities.total, activities.trendLabel, '🎒')}${renderSettingsMetric(settings)}</div></section>
    <section class="view-section"><div class="section-heading"><h2>最近のお知らせ</h2><p>直近5件を表示します</p><button class="btn-ghost" type="button" id="jump-to-news">一覧を開く</button></div>${renderNewsTable(news.recent)}</section>
    <section class="view-section"><div class="section-heading"><h2>最新の活動</h2><p>直近の活動記録を確認</p><button class="btn-ghost" type="button" id="jump-to-activities">一覧を開く</button></div>${renderActivityTable(activities.recent)}</section>`; document.getElementById('jump-to-news')?.addEventListener('click', ()=> views.setActiveView('news', { force:true })); document.getElementById('jump-to-activities')?.addEventListener('click', ()=> views.setActiveView('activities', { force:true })); }

  function renderMetricCard(label, value, trendLabel, icon){ return `<article class="card"><div class="card-header"><h3 class="card-title">${utils.escapeHtml(label)}</h3><span>${icon||''}</span></div><p class="card-metric">${Number(value||0).toLocaleString('ja-JP')}</p>${trendLabel?`<p class="metric-trend">${utils.escapeHtml(trendLabel)}</p>`:''}</article>`; }

  function renderSettingsMetric(settings){ const complete = settings && settings.missingKeys && settings.missingKeys.length===0; const caption = complete ? '主要項目はすべて設定済みです。' : `${settings.missingKeys.length} 件の項目が未設定です。`; const statusBadge = complete ? '<span class="badge green">設定済み</span>' : '<span class="badge rose">要対応</span>'; const jumpUrl = complete ? '' : buildSettingsUrl({ tab: inferPrimaryMissingTab(settings.missingKeys) }); return `<article class="card"><div class="card-header"><h3 class="card-title">サイト設定</h3>${statusBadge}</div><p class="card-metric">${complete?'良好':'要確認'}</p><p class="metric-trend">${utils.escapeHtml(caption)}</p>${complete?'':`<div class="card-actions"><a href="${jumpUrl}" target="_blank" rel="noopener" class="btn-link">未設定を確認</a></div>`}</article>`; }
  function buildSettingsUrl({ tab, field }={}){ const p=new URLSearchParams(); if (tab) p.set('tab', tab); if (field) p.set('field', field); const q=p.toString(); return `/admin/settings.html${q?`?${q}`:''}`; }
  function inferPrimaryMissingTab(missingKeys=[]){ for (const item of missingKeys){ const meta = constants.SETTINGS_FIELD_LINKS[item.key]; if (meta?.tab) return meta.tab; } return 'site_meta'; }

  function renderNewsTable(list, { showEmpty=false, showActions=false } = {}){ if (!list || list.length===0){ return showEmpty?'<div class="empty-state">まだ記事がありません。<div style="margin-top:16px"><button class="btn-secondary" type="button" id="empty-create-news">お知らせを作成</button></div></div>':'<p class="empty-state">データがありません。</p>'; } return `<div class="card"><table class="data-table"><thead><tr><th style="width: 40%">タイトル</th><th>カテゴリ</th><th>隊</th><th>作成日</th>${showActions?'<th>操作</th>':''}</tr></thead><tbody>${list.map((item)=>`<tr data-id="${item.id}"><td>${utils.escapeHtml(item.title||'(無題)')}</td><td>${utils.escapeHtml(item.category||'未分類')}</td><td>${utils.escapeHtml(utils.labelizeUnit(item.unit))}</td><td>${utils.formatDate(item.created_at)}</td>${showActions?renderNewsActionsCell(item.id):''}</tr>`).join('')}</tbody></table></div>`; }
  function renderNewsActionsCell(id){ return `<td><div class="table-actions"><a href="/news-detail-placeholder.html?id=${id}" target="_blank" rel="noopener">公開</a><button type="button" data-action="edit" data-id="${id}">編集</button><button type="button" data-action="delete" data-id="${id}" class="btn-danger">削除</button></div></td>`; }
  function bindNewsTableActions(){ document.querySelectorAll('#news-table-wrap .table-actions button[data-action]').forEach((btn)=>{ btn.addEventListener('click', async ()=>{ const action=btn.dataset.action; const id=btn.dataset.id; if (!id) return; if (action==='edit'){ window.open(`/admin/edit.html?id=${id}`, '_blank', 'noopener'); } if (action==='delete'){ const confirmed = await utils.confirmDestructive('お知らせを削除しますか？この操作は元に戻せません。'); if (!confirmed) return; try { await api.deleteNews(id); utils.showToast('お知らせを削除しました。', 'success'); views.setActiveView('news', { force:true }); state.cache.summary = null; } catch (err) { console.error(err); utils.showToast('削除に失敗しました。', 'error'); } } }); }); document.getElementById('empty-create-news')?.addEventListener('click', ()=> actions.openEditor('news')); }

  function renderActivityTable(list, { showEmpty=false, showActions=false } = {}){ if (!list || list.length===0){ return showEmpty?'<div class="empty-state">活動記録がまだありません。<div style="margin-top:16px"><button class="btn-secondary" type="button" id="empty-create-activity">活動を作成</button></div></div>':'<p class="empty-state">データがありません。</p>'; } return `<div class="card"><table class="data-table"><thead><tr><th style="width: 40%">タイトル</th><th>カテゴリ</th><th>隊</th><th>実施日</th>${showActions?'<th>操作</th>':''}</tr></thead><tbody>${list.map((item)=>`<tr data-id="${item.id}"><td>${utils.escapeHtml(item.title||'(無題)')}</td><td>${utils.escapeHtml(item.category||'未分類')}</td><td>${utils.escapeHtml(utils.labelizeUnit(item.unit))}</td><td>${utils.formatDate(item.activity_date||item.created_at)}</td>${showActions?renderActivityActionsCell(item.id):''}</tr>`).join('')}</tbody></table></div>`; }
  function renderActivityActionsCell(id){ return `<td><div class="table-actions"><a href="/activity-detail-placeholder.html?id=${id}" target="_blank" rel="noopener">公開</a><button type="button" data-action="edit" data-id="${id}">編集</button><button type="button" data-action="delete" data-id="${id}" class="btn-danger">削除</button></div></td>`; }
  function bindActivityTableActions(){ document.querySelectorAll('#activities-table-wrap .table-actions button[data-action]').forEach((btn)=>{ btn.addEventListener('click', async ()=>{ const action=btn.dataset.action; const id=btn.dataset.id; if (!id) return; if (action==='edit'){ window.open(`/admin/activity-edit.html?id=${id}`, '_blank', 'noopener'); } if (action==='delete'){ const confirmed = await utils.confirmDestructive('活動記録を削除しますか？'); if (!confirmed) return; try { await api.deleteActivity(id); utils.showToast('活動記録を削除しました。', 'success'); views.setActiveView('activities', { force:true }); state.cache.summary = null; } catch (err) { console.error(err); utils.showToast('削除に失敗しました。', 'error'); } } }); }); document.getElementById('empty-create-activity')?.addEventListener('click', ()=> actions.openEditor('activity')); }

  // ---- Views ----
  async function renderNewsView(root){ const data = await api.news(); state.cache.news = data; const uniqueUnits = utils.buildUniqueOptions(data.map((i)=>i.unit)); const uniqueCategories = utils.buildUniqueOptions(data.map((i)=>i.category)); root.innerHTML = `
    <section class="view-section"><div class="section-heading"><h2>お知らせ一覧</h2><button class="btn-primary" type="button" id="create-news">＋ 新規追加</button></div>
    <div class="filter-bar"><input type="search" id="news-search" placeholder="キーワードで検索" aria-label="お知らせ検索"><select id="news-unit-filter" aria-label="隊で絞り込み"><option value="">すべての隊</option>${uniqueUnits.map((v)=>`<option value="${utils.escapeHtml(v)}">${utils.escapeHtml(utils.labelizeUnit(v))}</option>`).join('')}</select><select id="news-category-filter" aria-label="カテゴリで絞り込み"><option value="">すべてのカテゴリ</option>${uniqueCategories.map((v)=>`<option value="${utils.escapeHtml(v)}">${utils.escapeHtml(v||'未分類')}</option>`).join('')}</select></div><div id="news-table-wrap"></div></section>`;
    document.getElementById('create-news')?.addEventListener('click', ()=> actions.openEditor('news'));
    const searchInput=document.getElementById('news-search'); const unitSelect=document.getElementById('news-unit-filter'); const categorySelect=document.getElementById('news-category-filter'); const tableWrap=document.getElementById('news-table-wrap');
    const update = ()=>{ const query=(searchInput?.value||'').toLowerCase(); const unit=unitSelect?.value||''; const category=categorySelect?.value||''; const filtered=data.filter((item)=>{ const matchesQuery=!query||(item.title||'').toLowerCase().includes(query)||(item.content||'').toLowerCase().includes(query); const matchesUnit=!unit||(item.unit||'')===unit; const matchesCategory=!category||(item.category||'')===category; return matchesQuery&&matchesUnit&&matchesCategory; }); tableWrap.innerHTML=renderNewsTable(filtered, { showEmpty:true, showActions:true }); bindNewsTableActions(); };
    searchInput?.addEventListener('input', utils.debounce(update, 200)); unitSelect?.addEventListener('change', update); categorySelect?.addEventListener('change', update); update(); }

  async function renderActivitiesView(root){ const data = await api.activities(); state.cache.activities=data; const uniqueUnits=utils.buildUniqueOptions(data.map(i=>i.unit)); const uniqueCategories=utils.buildUniqueOptions(data.map(i=>i.category)); root.innerHTML = `
    <section class="view-section"><div class="section-heading"><h2>活動記録</h2><button class="btn-primary" type="button" id="create-activity">＋ 新規追加</button></div><div class="filter-bar"><input type="search" id="activities-search" placeholder="キーワードで検索" aria-label="活動検索"><select id="activities-unit-filter" aria-label="隊で絞り込み"><option value="">すべての隊</option>${uniqueUnits.map((v)=>`<option value="${utils.escapeHtml(v)}">${utils.escapeHtml(utils.labelizeUnit(v))}</option>`).join('')}</select><select id="activities-category-filter" aria-label="カテゴリで絞り込み"><option value="">すべてのカテゴリ</option>${uniqueCategories.map((v)=>`<option value="${utils.escapeHtml(v)}">${utils.escapeHtml(v||'未分類')}</option>`).join('')}</select></div><div id="activities-table-wrap"></div></section>`;
    document.getElementById('create-activity')?.addEventListener('click', ()=> actions.openEditor('activity'));
    const searchInput=document.getElementById('activities-search'); const unitSelect=document.getElementById('activities-unit-filter'); const categorySelect=document.getElementById('activities-category-filter'); const tableWrap=document.getElementById('activities-table-wrap');
    const update = ()=>{ const query=(searchInput?.value||'').toLowerCase(); const unit=unitSelect?.value||''; const category=categorySelect?.value||''; const filtered=data.filter((item)=>{ const matchesQuery=!query||(item.title||'').toLowerCase().includes(query)||(item.content||'').toLowerCase().includes(query); const matchesUnit=!unit||(item.unit||'')===unit; const matchesCategory=!category||(item.category||'')===category; return matchesQuery&&matchesUnit&&matchesCategory; }); tableWrap.innerHTML=renderActivityTable(filtered, { showEmpty:true, showActions:true }); bindActivityTableActions(); };
    searchInput?.addEventListener('input', utils.debounce(update, 200)); unitSelect?.addEventListener('change', update); categorySelect?.addEventListener('change', update); update(); }

  async function renderSettingsSummaryView(root){ const summary = state.cache.summary || await api.summary(); const settingsSummary = summary.settings; const allSettings = await api.settings(); state.cache.settings = allSettings; const missing = settingsSummary.missingKeys || []; root.innerHTML = `
    <section class="view-section"><div class="section-heading"><h2>設定の状態</h2><a class="btn-primary" id="open-settings" href="${buildSettingsUrl()}" target="_blank" rel="noopener">設定を開く</a></div><div class="stats-grid">${renderSettingsMetric(settingsSummary)}${renderBrandPreview(allSettings)}</div></section>
    <section class="view-section"><div class="section-heading"><h2>未設定項目</h2><p>優先度の高いフィールドを確認</p></div>${missing.length?`<ul class="card settings-missing-list">${missing.map((item)=>renderMissingSetting(item)).join('')}</ul>`:`<div class="card"><strong>すべて設定済みです。</strong><p>ファビコンや画像が揃っており、公開準備が整っています。</p></div>`}</section>
    <section class="view-section"><div class="section-heading"><h2>主要設定サマリー</h2></div>${renderSettingsSummaryTable(allSettings)}</section>`;
    document.getElementById('open-settings')?.addEventListener('click', (event)=>{ if (event.metaKey || event.ctrlKey) return; event.preventDefault(); actions.openSettingsPage(); }); }

  function renderBrandPreview(settings){ const crest=settings.group_crest_url; const favicon=settings.site_favicon_url; return `<article class="card"><div class="card-header"><h3 class="card-title">ブランド概要</h3>${crest?'<span class="badge blue">画像あり</span>':'<span class="badge rose">未設定</span>'}</div><div style="display:flex; gap:16px; align-items:center;"><div style="width:72px; height:72px; border-radius:16px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; overflow:hidden;">${crest?`<img src="${utils.escapeAttribute(crest)}" alt="団章プレビュー" style="max-width:72px; max-height:72px;">`:'---'}</div><div><p style="margin:0 0 6px; font-weight:600;">団章</p><p style="margin:0; font-size:13px; color:#64748b;">${crest?'公開用の団章画像が設定されています。':'団章画像が未設定です。'}</p><p style="margin:10px 0 0; font-size:13px; color:#64748b;">ファビコン: ${favicon?'設定済み ✅':'未設定 ⚠️'}</p></div></div></article>`; }
  function renderMissingSetting(item){ const meta = constants.SETTINGS_FIELD_LINKS[item.key] || null; const label = utils.escapeHtml(item.label || item.key); const href = meta ? buildSettingsUrl(meta) : buildSettingsUrl(); const keyTag = meta?.field ? `<code>${utils.escapeHtml(meta.field)}</code>` : ''; return `<li class="settings-missing"><div class="settings-missing-label">⚠️ ${label}${keyTag?`<span class="settings-missing-key">${keyTag}</span>`:''}</div><a class="btn-ghost" href="${href}" target="_blank" rel="noopener">設定する</a></li>`; }
  function renderSettingsSummaryTable(settings){ if (!settings) return ''; const rows = [['代表住所', settings.contact_address], ['代表電話', settings.contact_phone], ['代表メール', settings.contact_email], ['お問い合わせ担当者', settings.contact_person_name], ['施行日', settings.privacy_effective_date]]; return `<div class="card"><table class="data-table"><tbody>${rows.map(([label, value])=>`<tr><th style="width:30%; font-weight:600;">${utils.escapeHtml(label)}</th><td>${utils.escapeHtml(value||'未設定')}</td></tr>`).join('')}</tbody></table></div>`; }

})();
