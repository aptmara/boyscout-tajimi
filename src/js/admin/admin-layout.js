// admin-layout.js
(function(){
  const { state } = (window.Admin || {});
  const { showToast } = (window.Admin?.utils || {});
  const { openEditor, openSettingsPage, openBrandingPage } = (window.Admin?.actions || {});

  document.addEventListener('DOMContentLoaded', () => {
    try { setupLayout(); } catch(e){ console.error(e); }
  });

  function setupLayout(){
    const sidebar = document.querySelector('.admin-sidebar');
    const navButtons = Array.from(document.querySelectorAll('.nav-btn'));

    navButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view; if (!view) return;
        window.Admin?.views?.setActiveView(view);
        closeSidebar();
      });
    });

    document.getElementById('sidebar-open')?.addEventListener('click', () => sidebar?.classList.add('open'));
    document.getElementById('sidebar-close')?.addEventListener('click', closeSidebar);
    function closeSidebar(){ sidebar?.classList.remove('open'); }

    document.getElementById('logout-btn')?.addEventListener('click', async () => {
      try { await fetch('/api/logout', { method:'POST', credentials:'same-origin' }); }
      finally { location.replace('/admin/login.html'); }
    });

    document.getElementById('quick-actions-btn')?.addEventListener('click', toggleQuickActions);
    document.getElementById('new-item-btn')?.addEventListener('click', () => openEditor?.('news'));
    document.getElementById('global-search')?.addEventListener('focus', () => window.Admin?.palette?.open(''));

    document.addEventListener('click', (event) => {
      const panel = document.getElementById('quick-actions-panel'); if (!panel) return;
      const btn = document.getElementById('quick-actions-btn');
      if (panel.contains(event.target)) return; if (btn && btn.contains(event.target)) return;
      panel.classList.remove('open'); btn?.setAttribute('aria-expanded', 'false');
    });
    document.getElementById('quick-actions-panel')?.addEventListener('click', (event) => {
      const target = event.target.closest('button[data-action]'); if (!target) return;
      const action = target.dataset.action; handleQuickAction(action);
      const panel = document.getElementById('quick-actions-panel'); panel?.classList.remove('open'); document.getElementById('quick-actions-btn')?.setAttribute('aria-expanded', 'false');
    });

    function toggleQuickActions(){
      const panel = document.getElementById('quick-actions-panel'); const btn = document.getElementById('quick-actions-btn'); if (!panel || !btn) return;
      const willOpen = !panel.classList.contains('open'); panel.classList.toggle('open', willOpen); btn.setAttribute('aria-expanded', String(willOpen));
    }

    document.addEventListener('keydown', (event) => {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === 'k') { event.preventDefault(); window.Admin?.palette?.open(''); }
      if (event.key === 'Escape') {
        document.getElementById('quick-actions-panel')?.classList.remove('open');
        document.getElementById('quick-actions-btn')?.setAttribute('aria-expanded', 'false');
        window.Admin?.palette?.close();
        sidebar?.classList.remove('open');
      }
    });

    window.__adminShell = { refreshView: ()=> window.Admin?.views?.setActiveView(state?.activeView, { force:true }), openEditor };

    function handleQuickAction(action){
      switch(action){
        case 'news:new': openEditor?.('news'); break;
        case 'activities:new': openEditor?.('activity'); break;
        case 'settings': openSettingsPage?.(); break;
        case 'branding': openBrandingPage?.(); break;
      }
    }
  }
})();
