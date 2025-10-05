// 画像ライトボックス（#news-article-container / #activity-article-container の画像に対応）
(function(){
  const SEL_CONTAINERS = ['#news-article-container', '#activity-article-container'];
  let state = { list: [], index: 0 };

  function ensureHost(){
    if (document.getElementById('lb-backdrop')) return;
    const bd = document.createElement('div');
    bd.id = 'lb-backdrop';
    bd.className = 'lb-backdrop';
    bd.innerHTML = `
      <div class="lb-frame">
        <img id="lb-img" class="lb-img" alt="preview">
        <button id="lb-prev" class="lb-prev" aria-label="前へ">◀</button>
        <button id="lb-next" class="lb-next" aria-label="次へ">▶</button>
        <button id="lb-close" class="lb-close" aria-label="閉じる">✕</button>
        <div id="lb-caption" class="lb-caption"></div>
      </div>`;
    document.body.appendChild(bd);
    bd.addEventListener('click', (e)=>{ if (e.target === bd) close(); });
    document.getElementById('lb-close').addEventListener('click', close);
    document.getElementById('lb-prev').addEventListener('click', prev);
    document.getElementById('lb-next').addEventListener('click', next);
    document.addEventListener('keydown', (e)=>{
      if (!bd.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    });
  }

  function open(index){ ensureHost(); state.index = index; render(); document.getElementById('lb-backdrop').classList.add('open'); }
  function close(){ const bd = document.getElementById('lb-backdrop'); if (bd) bd.classList.remove('open'); }
  function prev(){ state.index = (state.index - 1 + state.list.length) % state.list.length; render(); }
  function next(){ state.index = (state.index + 1) % state.list.length; render(); }
  function render(){
    const it = state.list[state.index];
    const img = document.getElementById('lb-img');
    const cap = document.getElementById('lb-caption');
    if (!it) return;
    img.src = it.src;
    img.alt = it.alt || '';
    cap.textContent = it.alt || '';
  }

  function collect(container){
    const imgs = Array.from(container.querySelectorAll('img'));
    state.list = imgs.map(img => ({ src: img.currentSrc || img.src, alt: img.alt || img.getAttribute('alt') || '' }));
    imgs.forEach((img, i) => {
      if (img.dataset.lbBound) return;
      img.dataset.lbBound = '1';
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', (e)=>{ e.preventDefault(); open(i); });
    });
  }

  function watch(container){
    const obs = new MutationObserver(() => collect(container));
    obs.observe(container, { childList: true, subtree: true });
    collect(container);
  }

  document.addEventListener('DOMContentLoaded', () => {
    SEL_CONTAINERS.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) watch(el);
    });
  });
})();

