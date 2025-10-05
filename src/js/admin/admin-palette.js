// admin-palette.js
(function(){
  const Admin = (window.Admin = window.Admin || {});
  const { state } = Admin;

  const Palette = Admin.palette = {
    async init(){
      state.palette = state.palette || { open:false, items:[], filtered:[], selectedIndex:-1 };
      this.input = document.getElementById('cmdp-input');
      this.list = document.getElementById('cmdp-list');
      this.backdrop = document.getElementById('cmdp-backdrop');
      this.updateItems();
      this.input?.addEventListener('input', ()=> this.filter(this.input.value));
      this.backdrop?.addEventListener('click', (event)=>{ if (event.target===this.backdrop) this.close(); });
      document.addEventListener('keydown', (event)=>{
        if (!state.palette.open) return;
        const listItems = Array.from(this.list.querySelectorAll('.cmdp-item'));
        if (event.key === 'ArrowDown'){ event.preventDefault(); state.palette.selectedIndex = Math.min(listItems.length-1, state.palette.selectedIndex+1); this.highlight(); }
        if (event.key === 'ArrowUp'){ event.preventDefault(); state.palette.selectedIndex = Math.max(0, state.palette.selectedIndex-1); this.highlight(); }
        if (event.key === 'Enter'){ event.preventDefault(); const item = state.palette.filtered[state.palette.selectedIndex]; this.execute(item); }
      });
    },
    updateItems(){
      const items = [];
      const views = Admin.views?.registry || {};
      Object.entries(views).forEach(([key, view])=>{ items.push({ type:'view', key, label:view.title, sub:view.subtitle, icon:'??' }); });
      const news = state.cache.news || []; news.slice(0,50).forEach((item)=>{ items.push({ type:'news', key:item.id, label:item.title||'(無題のお知らせ)', sub:'お知らせを編集', icon:'??' }); });
      const activities = state.cache.activities || []; activities.slice(0,50).forEach((item)=>{ items.push({ type:'activity', key:item.id, label:item.title||'(無題の活動)', sub:'活動を編集', icon:'??' }); });
      state.palette.items = items; this.filter(this.input?.value||'');
    },
    filter(query){
      const q = String(query||'').trim().toLowerCase();
      state.palette.filtered = state.palette.items.filter((item)=>{ if (!q) return true; const text = `${item.label} ${item.sub||''}`.toLowerCase(); return text.includes(q); });
      if (!this.list) return; this.list.innerHTML = state.palette.filtered.length ? state.palette.filtered.map(this.toHTML).join('') : '<div class="cmdp-item">該当する項目はありません。</div>';
      state.palette.selectedIndex = state.palette.filtered.length ? 0 : -1; this.highlight();
      this.list.querySelectorAll('.cmdp-item').forEach((el)=>{ el.addEventListener('click', ()=>{ const index = Number(el.dataset.index); const item = state.palette.filtered[index]; this.execute(item); }); });
    },
    toHTML(item, index){ return `<div class="cmdp-item" data-index="${index}"><div>${item.icon||''}</div><div><div>${Admin.utils.escapeHtml(item.label)}</div><div class="sub">${Admin.utils.escapeHtml(item.sub||'')}</div></div></div>`; },
    highlight(){ const nodes = Array.from(this.list?.querySelectorAll('.cmdp-item')||[]); nodes.forEach((node, i)=> node.classList.toggle('active', i===state.palette.selectedIndex)); },
    execute(item){ if (!item) return; this.close(); if (item.type==='view'){ Admin.views?.setActiveView(item.key, { force:true }); return; } if (item.type==='news'){ window.open(`/admin/edit.html?id=${item.key}`, '_blank', 'noopener'); return; } if (item.type==='activity'){ window.open(`/admin/activity-edit.html?id=${item.key}`, '_blank', 'noopener'); } },
    open(query){ this.backdrop?.classList.add('open'); state.palette.open=true; if (this.input){ this.input.value = query||''; this.input.focus(); this.filter(this.input.value); } },
    close(){ this.backdrop?.classList.remove('open'); state.palette.open=false; state.palette.selectedIndex=-1; }
  };

  // alias for layout module
  window.AdminPalette = Palette;
})();
