// 絞り込みUIの項目を、データから動的生成（サーバー保存は使わない）
(function(){
  function uniqSorted(arr){ return Array.from(new Set(arr.filter(Boolean))).sort((a,b)=> String(a).localeCompare(String(b),'ja')); }
  function parseMonthIso(d){ try { const dt = new Date(d); if (isNaN(dt)) return null; return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`; } catch { return null; } }
  function setSelectOptions(sel, values, { withAllLabel } = {}){
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '';
    if (withAllLabel) {
      const o = document.createElement('option'); o.value = 'all'; o.textContent = withAllLabel; sel.appendChild(o);
    }
    values.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o); });
    // keep selection if possible
    if (cur) sel.value = cur;
  }
  function setMultiOptions(sel, values){
    if (!sel) return;
    const selected = new Set(Array.from(sel.selectedOptions || []).map(o=>o.value));
    sel.innerHTML = '';
    values.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; if (selected.has(v)) o.selected = true; sel.appendChild(o); });
  }
  function applyQueryToFilters(prefix){
    const qs = new URLSearchParams(location.search);
    const cat = qs.get('category') || qs.get(`${prefix}-category`) || '';
    const unit = qs.get('unit') || qs.get(`${prefix}-unit`) || '';
    const tags = (qs.get('tags_any') || qs.get(`${prefix}-tags`) || '').split(/[\s,]+/).filter(Boolean);
    const ym = qs.get('ym') || '';
    const catSel = document.getElementById(`${prefix}-category-filter`);
    const unitSel = document.getElementById(`${prefix}-unit-filter`);
    const tagSel = document.getElementById(`${prefix}-tags-filter`);
    const monthInp = document.getElementById(`${prefix}-date-filter`);
    if (catSel && cat) catSel.value = cat;
    if (unitSel && unit) unitSel.value = unit;
    if (tagSel && tags.length) {
      Array.from(tagSel.options).forEach(o => { if (tags.includes(o.value)) o.selected = true; });
    }
    if (monthInp && ym) monthInp.value = ym;
  }

  async function buildNewsFilters(){
    const catSel = document.getElementById('news-category-filter');
    const unitSel = document.getElementById('news-unit-filter');
    const tagSel = document.getElementById('news-tags-filter');
    const monthInp = document.getElementById('news-date-filter');
    if (!catSel && !unitSel && !tagSel && !monthInp) return;
    try {
      const r = await fetch('/api/news');
      if (!r.ok) return;
      const items = await r.json();
      const cats = uniqSorted(items.map(n => n.category).filter(Boolean));
      const units = uniqSorted(items.map(n => n.unit).filter(Boolean));
      const tags = uniqSorted(items.flatMap(n => Array.isArray(n.tags)?n.tags:[]));
      const months = uniqSorted(items.map(n => parseMonthIso(n.created_at)).filter(Boolean)).reverse();
      setSelectOptions(catSel, cats, { withAllLabel: 'すべて' });
      setSelectOptions(unitSel, units, { withAllLabel: 'すべて' });
      setMultiOptions(tagSel, tags);
      // month: datalistを付与
      if (monthInp) {
        const dlId = 'news-month-list';
        let dl = document.getElementById(dlId);
        if (!dl) { dl = document.createElement('datalist'); dl.id = dlId; document.body.appendChild(dl); monthInp.setAttribute('list', dlId); }
        dl.innerHTML = months.map(m => `<option value="${m}"></option>`).join('');
      }
      applyQueryToFilters('news');
    } catch {}
  }

  async function buildActivityFilters(){
    const catSel = document.getElementById('activity-category-filter');
    const unitSel = document.getElementById('activity-unit-filter');
    const tagSel = document.getElementById('activity-tags-filter');
    const monthInp = document.getElementById('activity-date-filter');
    if (!catSel && !unitSel && !tagSel && !monthInp) return;
    try {
      const r = await fetch('/api/activities?limit=500');
      if (!r.ok) return;
      const items = await r.json();
      const cats = uniqSorted(items.map(a => a.category).filter(Boolean));
      const units = uniqSorted(items.map(a => a.unit).filter(Boolean));
      const tags = uniqSorted(items.flatMap(a => Array.isArray(a.tags)?a.tags:[]));
      const months = uniqSorted(items.map(a => parseMonthIso(a.activity_date || a.created_at)).filter(Boolean)).reverse();
      setSelectOptions(catSel, cats, { withAllLabel: 'すべて' });
      setSelectOptions(unitSel, units, { withAllLabel: 'すべて' });
      setMultiOptions(tagSel, tags);
      if (monthInp) {
        const dlId = 'activity-month-list';
        let dl = document.getElementById(dlId);
        if (!dl) { dl = document.createElement('datalist'); dl.id = dlId; document.body.appendChild(dl); monthInp.setAttribute('list', dlId); }
        dl.innerHTML = months.map(m => `<option value="${m}"></option>`).join('');
      }
      applyQueryToFilters('activity');
    } catch {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    buildNewsFilters();
    buildActivityFilters();
  });
})();

