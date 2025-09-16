// 管理アプリ（app.html）用のUI制御
(function(){
  const routes = {
    news: { title: 'ニュース管理', src: '/admin/dashboard.html' },
    activities: { title: '活動管理', src: '/admin/settings.html?tab=activity' },
    settings: { title: 'サイト設定', src: '/admin/settings.html' },
    branding: { title: 'ブランディング', src: '/admin/branding.html' },
    news_new: { title: 'ニュース新規作成', src: '/admin/edit.html' },
    activity_new: { title: '活動新規作成', src: '/admin/activity-edit.html' },
  };

  async function ensureSession(){
    try {
      const r = await fetch('/api/session', { credentials: 'same-origin' });
      const d = await r.json();
      if (!d.loggedIn) location.replace('/admin/login.html');
    } catch {
      location.replace('/admin/login.html');
    }
  }

  function setActive(key){
    const iframe = document.getElementById('main-frame');
    const titleEl = document.getElementById('view-title');
    const btns = document.querySelectorAll('[data-nav]');
    btns.forEach(b => b.classList.toggle('active', b.dataset.nav === key));
    const route = routes[key] || routes.news;
    titleEl.textContent = route.title;
    iframe.src = route.src;
    localStorage.setItem('admin.active', key);
    document.querySelector('.app-nav')?.classList.remove('open');
  }

  function initZoom(){
    const root = document.documentElement;
    const get = ()=> Number(localStorage.getItem('admin.zoom') || '1');
    const set = (v)=> { v = Math.min(1.25, Math.max(0.9, Number(v)||1)); localStorage.setItem('admin.zoom', String(v)); root.style.setProperty('--zoom', v); };
    set(get());
    document.getElementById('zoom-inc')?.addEventListener('click', ()=> set(get() + 0.05));
    document.getElementById('zoom-dec')?.addEventListener('click', ()=> set(get() - 0.05));
  }

  function initNav(){
    document.querySelector('.links')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-nav]');
      if (!btn) return;
      setActive(btn.dataset.nav);
    });
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
      try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); location.replace('/admin/login.html'); }
      catch { alert('ログアウトに失敗しました'); }
    });
    document.getElementById('menu-toggle')?.addEventListener('click', ()=>{
      document.querySelector('.app-nav')?.classList.toggle('open');
    });
    document.getElementById('quick-new-news')?.addEventListener('click', ()=> setActive('news_new'));
    document.getElementById('quick-new-activity')?.addEventListener('click', ()=> setActive('activity_new'));
  }

  // コマンドパレット（Ctrl/Cmd + K）
  const palette = {
    backdrop: null, input: null, list: null, open: false, items: [], sel: -1,
  };

  function showPalette(q=''){
    palette.backdrop.classList.add('open');
    palette.open = true; palette.input.value = q; palette.input.focus();
    renderPalette();
  }
  function hidePalette(){ palette.backdrop.classList.remove('open'); palette.open = false; palette.sel = -1; }

  function paletteItemEl(item, i){
    const el = document.createElement('div');
    el.className = 'cmdp-item' + (i===palette.sel?' active':'');
    el.role = 'option'; el.dataset.index = String(i);
    el.innerHTML = `<div>${item.icon||''}</div><div><div>${item.label}</div><div class="sub">${item.sub||''}</div></div>`;
    el.addEventListener('click', ()=> execItem(item));
    return el;
  }

  function renderPalette(){
    const q = (palette.input.value || '').toLowerCase();
    const filtered = palette.items.filter(it => (it.label+ ' ' + (it.sub||'')).toLowerCase().includes(q));
    const list = palette.list; list.innerHTML = '';
    filtered.forEach((it, i)=> list.appendChild(paletteItemEl(it, i)));
    palette.sel = filtered.length ? 0 : -1;
  }

  function execItem(item){
    if (!item) return;
    hidePalette();
    if (item.type === 'route'){ setActive(item.key); return; }
    if (item.type === 'open'){ const iframe = document.getElementById('main-frame'); const titleEl = document.getElementById('view-title'); titleEl.textContent = item.title || item.label; iframe.src = item.href; return; }
  }

  async function loadIndexData(){
    try {
      const [newsRes, actRes] = await Promise.all([
        fetch('/api/news', { credentials: 'same-origin' }),
        fetch('/api/activities', { credentials: 'same-origin' })
      ]);
      const [news, acts] = await Promise.all([newsRes.json(), actRes.json()]);
      const newsItems = (Array.isArray(news)?news:[]).slice(0,200).map(n=>({
        type: 'open', icon: '📰', label: n.title||'(無題)', sub: 'ニュース', href: `/admin/edit.html?id=${n.id}`, title: 'ニュース編集'
      }));
      const actItems = (Array.isArray(acts)?acts:[]).slice(0,200).map(a=>({
        type: 'open', icon: '🏕', label: a.title||'(無題)', sub: '活動', href: `/admin/activity-edit.html?id=${a.id}`, title: '活動編集'
      }));
      return { newsItems, actItems };
    } catch {
      return { newsItems: [], actItems: [] };
    }
  }

  async function initPalette(){
    palette.backdrop = document.getElementById('cmdp-backdrop');
    palette.input = document.getElementById('cmdp-input');
    palette.list = document.getElementById('cmdp-list');

    // ベースのコマンド
    const base = [
      { type:'route', key:'news', icon:'📰', label:'ニュース一覧を開く' },
      { type:'route', key:'activities', icon:'🏕', label:'活動一覧を開く' },
      { type:'route', key:'settings', icon:'⚙️', label:'サイト設定を開く' },
      { type:'route', key:'branding', icon:'🎨', label:'ブランディングを開く' },
      { type:'route', key:'news_new', icon:'➕', label:'ニュースを新規作成' },
      { type:'route', key:'activity_new', icon:'➕', label:'活動を新規作成' },
    ];

    const { newsItems, actItems } = await loadIndexData();
    palette.items = [...base, ...newsItems, ...actItems];

    // 入力イベント
    palette.input.addEventListener('input', renderPalette);
    palette.backdrop.addEventListener('click', (e)=>{ if (e.target === palette.backdrop) hidePalette(); });
    document.addEventListener('keydown', (e)=>{
      const mod = (e.ctrlKey || e.metaKey);
      if (mod && e.key.toLowerCase() === 'k'){ e.preventDefault(); showPalette(''); return; }
      if (!palette.open) return;
      if (e.key === 'Escape'){ hidePalette(); return; }
      const listItems = Array.from(palette.list.querySelectorAll('.cmdp-item'));
      if (['ArrowDown','ArrowUp','Enter'].includes(e.key)) e.preventDefault();
      if (e.key === 'ArrowDown'){ palette.sel = Math.min(listItems.length-1, (palette.sel<0?0:palette.sel+1)); highlight(listItems); }
      if (e.key === 'ArrowUp'){ palette.sel = Math.max(0, (palette.sel-1)); highlight(listItems); }
      if (e.key === 'Enter'){ const el = listItems[palette.sel]; const idx = el? Number(el.dataset.index): -1; const item = (palette.items.filter(it => (it.label+' '+(it.sub||'')).toLowerCase().includes((palette.input.value||'').toLowerCase())))[idx]; execItem(item); }
    });

    function highlight(nodes){ nodes.forEach((n,i)=> n.classList.toggle('active', i===palette.sel)); }

    // ツールバーの検索から起動
    const gs = document.getElementById('global-search');
    gs?.addEventListener('focus', ()=> showPalette(gs.value||''));
    gs?.addEventListener('keydown', (e)=>{
      if (e.key.length === 1 || e.key === 'Enter'){ showPalette(gs.value||''); e.preventDefault(); }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await ensureSession();
    initNav();
    initZoom();
    await initPalette();
    const initial = new URLSearchParams(location.search).get('view') || localStorage.getItem('admin.active') || 'news';
    setActive(initial in routes ? initial : 'news');
  });
})();
