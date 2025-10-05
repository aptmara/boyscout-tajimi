// admin-views.js
(function(){
  const Admin = (window.Admin = window.Admin || {});
  const { state, utils, api, actions, constants } = Admin;

  // ---- View Definitions ----
  const newsViewConfig = {
    id: 'news',
    title: 'お知らせ',
    api: api.news,
    deleteApi: api.deleteNews,
    openEditor: (id) => views.setActiveView('news-editor', { id }),
    getSearchableText: (item) => `${item.title || ''} ${item.content || ''}`,
    columns: [
      { label: 'タイトル', key: 'title', width: '40%', render: (item) => utils.escapeHtml(item.title || '(無題)') },
      { label: 'カテゴリ', key: 'category', render: (item) => utils.escapeHtml(item.category || '未分類') },
      { label: '隊', key: 'unit', render: (item) => utils.escapeHtml(utils.labelizeUnit(item.unit)) },
      { label: '作成日', key: 'created_at', render: (item) => utils.formatDate(item.created_at) },
    ]
  };

  const activitiesViewConfig = {
    id: 'activities',
    title: '活動記録',
    api: api.activities,
    deleteApi: api.deleteActivity,
    openEditor: (id) => views.setActiveView('activities-editor', { id }),
    getSearchableText: (item) => `${item.title || ''} ${item.content || ''}`,
    columns: [
      { label: 'タイトル', key: 'title', width: '40%', render: (item) => utils.escapeHtml(item.title || '(無題)') },
      { label: 'カテゴリ', key: 'category', render: (item) => utils.escapeHtml(item.category || '未分類') },
      { label: '隊', key: 'unit', render: (item) => utils.escapeHtml(utils.labelizeUnit(item.unit)) },
      { label: '実施日', key: 'activity_date', render: (item) => utils.formatDate(item.activity_date || item.created_at) },
    ]
  };

  const views = Admin.views = {
    registry: {
      'dashboard': { title:'ダッシュボード', subtitle:'活動とお知らせの指標をひと目で把握', render: renderDashboardView },
      'news': { title:'お知らせ', subtitle:'最新のお知らせを作成・編集・公開管理', render: createListView(newsViewConfig) },
      'news-editor': { title: 'お知らせ作成', subtitle: '新しいお知らせを投稿', render: renderNewsEditorView },
      'activities': { title:'活動記録', subtitle:'隊の活動ログを整理しアーカイブを構築', render: createListView(activitiesViewConfig) },
      'activities-editor': { title: '活動記録を作成', subtitle: '新しい活動記録を投稿', render: renderActivityEditorView },
      'settings': { title:'サイト設定', subtitle:'連絡先や画像などサイト全体の設定を管理', render: renderSettingsView },
      'branding': { title:'ブランド資産', subtitle:'ロゴ・写真・色などのビジュアル要素を確認', render: (root, category) => renderSettingsView(root, 'branding') },
    },
    async setActiveView(viewId, options = {}){
      const { id, force, category } = options;
      const targetView = viewId + (id ? `/${id}` : '') + (category ? `/${category}` : '');
      if (!force && state.activeView === targetView) return;

      const viewDef = views.registry[viewId];
      if (!viewDef) {
        console.error(`View '${viewId}' not found.`);
        return views.setActiveView('dashboard', { force: true });
      }

      state.activeView = targetView;
      localStorage.setItem('admin.active', viewId);
      document.querySelectorAll('.nav-btn').forEach((btn)=>{ btn.classList.toggle('active', btn.dataset.view === viewId); });

      document.getElementById('view-title').textContent = viewDef.title;
      document.getElementById('view-subtitle').textContent = viewDef.subtitle;
      renderSkeleton();

      try {
        await viewDef.render(document.getElementById('view-root'), id || category);
        window.Admin?.palette?.updateItems();
      } catch (err) {
        console.error('view render failed', err);
        renderError(err);
        utils.showToast('データの取得に失敗しました。時間をおいて再度お試しください。', 'error');
      }
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

  function renderSkeleton(){ const root=document.getElementById('view-root'); if (!root) return; root.innerHTML = `<section class=