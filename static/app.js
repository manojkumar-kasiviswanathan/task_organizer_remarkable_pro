/* ========= Theme toggle ========= */
(function(){
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const root = document.documentElement;
  const load = () => localStorage.getItem('theme') || 'light';
  const save = t => localStorage.setItem('theme', t);
  const set = t => root.setAttribute('data-theme', t);
  set(load());
  btn.addEventListener('click', () => {
    const next = (root.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
    set(next); save(next);
  });
})();

/* ========= Manual refresh ========= */
(function(){
  const b = document.getElementById('refreshBtn');
  if (b) b.addEventListener('click', () => window.location.reload());
})();

/* ========= Auto-refresh when date changes ========= */
(function(){
  const renderedIso = document.body.dataset.today; // YYYY-MM-DD from server
  function todayIso(){
    const d=new Date(), y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }
  function maybeReload(){ if (renderedIso && renderedIso !== todayIso()) window.location.reload(); }
  window.addEventListener('focus', maybeReload);
  document.addEventListener('visibilitychange', ()=>{ if (!document.hidden) maybeReload(); });
  setInterval(maybeReload, 5*60*1000);
})();

/* ========= Drag & Drop (TODAY only) ========= */
(function(){
  const containers = document.querySelectorAll('.draggable');
  if (!containers.length) return;
  containers.forEach(container => {
    const dateKey = container.dataset.date;
    const isToday = document.body.dataset.today === dateKey;
    if (!isToday) return;

    let draggingEl = null;
    container.addEventListener('dragstart', e => {
      const row = e.target.closest('.item'); if (!row) return;
      draggingEl = row; row.classList.add('dragging'); e.dataTransfer.effectAllowed='move';
    });
    container.addEventListener('dragend', e => {
      const row = e.target.closest('.item'); if (row) row.classList.remove('dragging');
      draggingEl = null; persistOrder(container, dateKey);
    });
    container.addEventListener('dragover', e => {
      e.preventDefault();
      const afterEl = getDragAfterElement(container, e.clientY);
      if (!draggingEl) return;
      if (afterEl == null) container.appendChild(draggingEl);
      else container.insertBefore(draggingEl, afterEl);
    });
  });

  function getDragAfterElement(container, y){
    const els=[...container.querySelectorAll('.item:not(.dragging)')];
    return els.reduce((closest, child) => {
      const box=child.getBoundingClientRect();
      const offset=y - box.top - box.height/2;
      if (offset < 0 && offset > closest.offset) return {offset, element:child};
      return closest;
    }, {offset:Number.NEGATIVE_INFINITY}).element;
  }
  function persistOrder(container, dateKey){
    const items=container.querySelectorAll('.item');
    const order=Array.from(items).map(el=>parseInt(el.dataset.index,10)).filter(n=>!isNaN(n));
    fetch(`/reorder/${encodeURIComponent(dateKey)}`,{
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({order})
    }).catch(()=>{});
  }
})();

/* ========= Deterministic tag colors (same tag => same color) ========= */
(function(){
  const PALETTE = ['tcolor-0','tcolor-1','tcolor-2','tcolor-3','tcolor-4','tcolor-5'];
  const hash = (s) => {
    let h = 2166136261 >>> 0;
    for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  document.querySelectorAll('.tag-pill').forEach(pill => {
    const tag = (pill.dataset.tag || pill.textContent || '').trim().toLowerCase();
    const idx = tag ? hash(tag) % PALETTE.length : 0;
    // remove any previous tcolor-* then add the deterministic one
    pill.classList.remove(...PALETTE);
    pill.classList.add(PALETTE[idx]);
  });
})();

/* ========= Tags: + Tag modal, add/remove chips ========= */
(function(){
  const modal = document.getElementById('tagModal');
  if (!modal) return;
  const backdrop = modal.querySelector('.modal-backdrop');
  const input = document.getElementById('tagInput');
  const btnCancel = document.getElementById('tagCancel');
  const btnSave = document.getElementById('tagSave');
  let currentEditor = null, currentHidden = null, currentForm = null;

  const getTags = () => (currentHidden.value || '').split(',').map(s => s.trim()).filter(Boolean);
  const setTags = (arr) => { currentHidden.value = arr.join(', '); };

  function openModal(editor){
    currentEditor = editor;
    currentHidden = editor.querySelector('input[name="tags"]');
    currentForm = editor.querySelector('.tags-form');
    input.value = '';
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(()=>input.focus(), 10);
  }
  function closeModal(){
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    currentEditor = currentHidden = currentForm = null;
  }
  function saveTag(){
    const t = (input.value || '').trim();
    if (!t || !currentHidden || !currentForm) return;
    const tags = getTags();
    if (!tags.includes(t)) { tags.push(t); setTags(tags); currentForm.submit(); }
    closeModal();
  }

  // Open via "+ Tag" (delegation)
  document.addEventListener('click', e => {
    const addBtn = e.target.closest('.tag-add-btn');
    if (addBtn) {
      e.preventDefault();
      const editor = addBtn.closest('.tags-editor');
      if (editor) openModal(editor);
    }
  });

  // Remove tag via × on a pill (delegation)
  document.addEventListener('click', e => {
    const pill = e.target.closest('.tag-pill');
    if (!pill || !pill.querySelector('.tag-x')) return;
    const editor = pill.closest('.tags-editor'); if (!editor) return;
    const hidden = editor.querySelector('input[name="tags"]');
    const form = editor.querySelector('.tags-form');
    const current = (hidden.value || '').split(',').map(s=>s.trim()).filter(Boolean);
    const next = current.filter(t => t !== pill.dataset.tag);
    hidden.value = next.join(', ');
    form.submit();
  });

  backdrop.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', e => { e.preventDefault(); closeModal(); });
  btnSave.addEventListener('click', e => { e.preventDefault(); saveTag(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); saveTag(); }
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
  });
})();

/* ========= Tiny Markdown renderer (read-only .md blocks) ========= */
(function(){
  function esc(s){ return String(s||'').replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function inline(s){
    s = esc(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
              .replace(/(^|[^*])\*(.+?)\*/g,'$1<em>$2</em>');
    return s;
  }
  function render(src){
    const lines = String(src||'').split(/\r?\n/); let html='', i=0;
    while(i<lines.length){
      if (/^\s*\d+\.\s+/.test(lines[i])){ html+='<ol>'; 
        while(i<lines.length && /^\s*\d+\.\s+/.test(lines[i])) html+=`<li>${inline(lines[i++].replace(/^\s*\d+\.\s+/,''))}</li>`; html+='</ol>'; continue; }
      if (/^\s*[-*]\s+/.test(lines[i])){ html+='<ul>'; 
        while(i<lines.length && /^\s*[-*]\s+/.test(lines[i])) html+=`<li>${inline(lines[i++].replace(/^\s*[-*]\s+/,''))}</li>`; html+='</ul>'; continue; }
      const l = lines[i++]; html += (l.trim()==='') ? '<p></p>' : `<p>${inline(l)}</p>`;
    }
    return html;
  }
  document.querySelectorAll('.md').forEach(el => { el.innerHTML = render(el.textContent); });
})();
