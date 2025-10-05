// 共通の下部シートUI（アクション結果の表示用）
(function(){
  function ensureHost(){
    if (document.getElementById('sheet-backdrop')) return;
    const bd = document.createElement('div');
    bd.id = 'sheet-backdrop';
    bd.className = 'sheet-backdrop';
    const sheet = document.createElement('div');
    sheet.id = 'sheet';
    sheet.className = 'sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.innerHTML = `
      <div class="sheet-inner">
        <div class="sheet-header">
          <h3 class="sheet-title" id="sheet-title"></h3>
          <button type="button" class="close-x" id="sheet-close">閉じる</button>
        </div>
        <div class="sheet-body" id="sheet-body"></div>
        <div class="sheet-actions" id="sheet-actions"></div>
      </div>`;
    document.body.appendChild(bd);
    document.body.appendChild(sheet);
    bd.addEventListener('click', (e)=> { if (e.target === bd) close(); });
    document.getElementById('sheet-close').addEventListener('click', close);
    document.addEventListener('keydown', (e)=> { if (e.key === 'Escape') close(); });
  }

  function open({ title = '', html = '', actions = [] } = {}){
    ensureHost();
    const bd = document.getElementById('sheet-backdrop');
    const sh = document.getElementById('sheet');
    document.getElementById('sheet-title').textContent = title || '';
    document.getElementById('sheet-body').innerHTML = html || '';
    const act = document.getElementById('sheet-actions');
    act.innerHTML = '';
    for (const a of (actions||[])){
      const btn = document.createElement('button');
      btn.textContent = a.label || 'OK';
      btn.className = a.variant === 'danger' ? 'btn-danger' : (a.variant === 'primary' ? 'btn' : 'btn-ghost');
      btn.addEventListener('click', async () => {
        try { if (typeof a.onClick === 'function') await a.onClick(); } finally { if (!a.keepOpen) close(); }
      });
      act.appendChild(btn);
    }
    bd.classList.add('open');
    sh.classList.add('open');
  }

  function close(){
    const bd = document.getElementById('sheet-backdrop');
    const sh = document.getElementById('sheet');
    if (bd) bd.classList.remove('open');
    if (sh) sh.classList.remove('open');
  }

  function showResult({ ok = true, message = '', detail = '', actions = [] } = {}){
    const icon = ok ? '✅' : '⚠️';
    const html = `<div style="line-height:1.6">${icon} ${escapeHtml(message||'')}${detail?`<div style=\"color:#64748b;margin-top:6px\">${escapeHtml(String(detail))}</div>`:''}</div>`;
    open({ title: ok ? '完了' : 'エラー', html, actions: actions.length?actions:[{ label: '閉じる' }] });
  }

  function escapeHtml(s){
    return String(s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  }

  window.AdminUI = { open, close, showResult };
})();

