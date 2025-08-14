/* ===== Theme toggle ===== */
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

/* ===== Manual refresh ===== */
(function(){
  const b = document.getElementById('refreshBtn');
  if (b) b.addEventListener('click', () => window.location.reload());
})();

/* ===== Auto-refresh when date changes ===== */
(function(){
  const renderedIso = document.body.dataset.today;
  function todayIso(){
    const d=new Date(), y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }
  function maybeReload(){ if (renderedIso && renderedIso !== todayIso()) window.location.reload(); }
  window.addEventListener('focus', maybeReload);
  document.addEventListener('visibilitychange', ()=>{ if (!document.hidden) maybeReload(); });
  setInterval(maybeReload, 5*60*1000);
})();

/* ===== Drag & Drop (Today only) ===== */
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

/* ===== Deterministic tag colors (same tag -> same color) ===== */
(function(){
  const PALETTE = ['tcolor-0','tcolor-1','tcolor-2','tcolor-3','tcolor-4','tcolor-5'];
  const hash = (s) => { let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; };
  document.querySelectorAll('.tag-pill').forEach(pill => {
    const tag = (pill.dataset.tag || pill.textContent || '').trim().toLowerCase();
    const idx = tag ? hash(tag) % PALETTE.length : 0;
    pill.classList.remove(...PALETTE);
    pill.classList.add(PALETTE[idx]);
  });
})();

/* ===== Tags: + Tag modal ===== */
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

  // open modal
  document.addEventListener('click', e => {
    const addBtn = e.target.closest('.tag-add-btn');
    if (addBtn) {
      e.preventDefault();
      const editor = addBtn.closest('.tags-editor');
      if (editor) openModal(editor);
    }
  });

  // remove tag
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

/* ===== Markdown renderer (read-only .md blocks) ===== */
(function(){
  function esc(s){ return String(s||'').replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function inline(s){ s = esc(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/(^|[^*])\*(.+?)\*/g,'$1<em>$2</em>'); return s; }
  function render(src){
    const lines = String(src||'').split(/\r?\n/); let html='', i=0;
    while(i<lines.length){
      if (/^\s*\d+\.\s+/.test(lines[i])){ html+='<ol>'; while(i<lines.length && /^\s*\d+\.\s+/.test(lines[i])) html+=`<li>${inline(lines[i++].replace(/^\s*\d+\.\s+/,''))}</li>`; html+='</ol>'; continue; }
      if (/^\s*[-*]\s+/.test(lines[i])){ html+='<ul>'; while(i<lines.length && /^\s*[-*]\s+/.test(lines[i])) html+=`<li>${inline(lines[i++].replace(/^\s*[-*]\s+/,''))}</li>`; html+='</ul>'; continue; }
      const l = lines[i++]; html += (l.trim()==='') ? '<p></p>' : `<p>${inline(l)}</p>`;
    }
    return html;
  }
  document.querySelectorAll('.md').forEach(el => { el.innerHTML = render(el.textContent); });
})();

/* ===== Robust dd/mm/yyyy picker overlay for Today ===== */
(function(){
  function formatDMY(iso){ if(!iso) return ''; const [Y,M,D]=iso.split('-'); return `${D}/${M}/${Y}`; }

  function createOverlayPicker(anchorInput, currentISO){
    const r = anchorInput.getBoundingClientRect();

    const picker = document.createElement('input');
    picker.type = 'date';
    picker.value = currentISO || '';
    picker.setAttribute('aria-hidden','true');

    // position exactly over the visible field
    Object.assign(picker.style, {
      position: 'fixed',
      top: `${r.top}px`,
      left: `${r.left}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
      opacity: '0',               // fully transparent but clickable/focusable
      zIndex: '9999',
      border: 'none',
      background: 'transparent'
    });

    // when a date is picked -> write back & submit
    picker.addEventListener('change', () => {
      const hiddenIso = anchorInput.parentElement.querySelector('input[type="hidden"][name="due"]');
      if (picker.value && hiddenIso) {
        anchorInput.value = formatDMY(picker.value);
        hiddenIso.value = picker.value;
        if (anchorInput.form) anchorInput.form.submit();
      }
      cleanup();
    });

    // if user taps away, just remove it
    picker.addEventListener('blur', cleanup);

    function cleanup(){
      if (picker && picker.parentNode) picker.parentNode.removeChild(picker);
    }

    document.body.appendChild(picker);
    // focus and try to open the native UI
    picker.focus({ preventScroll: true });
    if (picker.showPicker) {
      try { picker.showPicker(); } catch {}
    }
  }

  // Delegate clicks to any .date-display (works after DOM changes)
  document.addEventListener('click', (e) => {
    const display = e.target.closest('.date-display');
    if (!display) return;

    // find current ISO hidden field next to it
    const hiddenIso = display.parentElement.querySelector('input[type="hidden"][name="due"]');
    const iso = hiddenIso ? hiddenIso.value : '';
    createOverlayPicker(display, iso);
  });
})();
/* ===== Allow clearing the deadline (click × or Backspace/Delete) ===== */
(function(){
  // Click the "×" button
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.due-clear');
    if (!btn) return;
    const chip = btn.closest('.due-chip');
    if (!chip) return;
    const display = chip.querySelector('.date-display');
    const hiddenIso = chip.querySelector('input[type="hidden"][name="due"]');
    if (hiddenIso) hiddenIso.value = '';
    if (display) display.value = '';
    // submit parent form
    const form = chip.closest('form');
    if (form) form.submit();
  });

  // Keyboard: Backspace/Delete on the display field clears
  document.addEventListener('keydown', (e) => {
    const display = e.target.closest('.date-display');
    if (!display) return;
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      const chip = display.closest('.due-chip');
      const hiddenIso = chip && chip.querySelector('input[type="hidden"][name="due"]');
      if (hiddenIso) hiddenIso.value = '';
      display.value = '';
      const form = chip && chip.closest('form');
      if (form) form.submit();
    }
  });
})();

/* ===== Robust dd/mm/yyyy picker overlay (keep this; replaces openDatePicker) ===== */
(function(){
  function formatDMY(iso){ if(!iso) return ''; const [Y,M,D]=iso.split('-'); return `${D}/${M}/${Y}`; }

  function createOverlayPicker(anchorInput, currentISO){
    const r = anchorInput.getBoundingClientRect();
    const picker = document.createElement('input');
    picker.type = 'date';
    picker.value = currentISO || '';
    picker.setAttribute('aria-hidden','true');
    Object.assign(picker.style, {
      position: 'fixed', top: `${r.top}px`, left: `${r.left}px`,
      width: `${r.width}px`, height: `${r.height}px`,
      opacity: '0', zIndex: '9999', border: 'none', background: 'transparent'
    });

    picker.addEventListener('change', () => {
      const chip = anchorInput.closest('.due-chip');
      const hiddenIso = chip && chip.querySelector('input[type="hidden"][name="due"]');
      if (picker.value && hiddenIso) {
        anchorInput.value = formatDMY(picker.value);
        hiddenIso.value = picker.value;
        const form = chip.closest('form');
        if (form) form.submit();
      }
      cleanup();
    });
    picker.addEventListener('blur', cleanup);

    function cleanup(){ if (picker && picker.parentNode) picker.parentNode.removeChild(picker); }

    document.body.appendChild(picker);
    picker.focus({ preventScroll: true });
    if (picker.showPicker) { try { picker.showPicker(); } catch{} }
  }

  // Delegate clicks to .date-display
  document.addEventListener('click', (e) => {
    const display = e.target.closest('.date-display');
    if (!display) return;
    const chip = display.closest('.due-chip');
    const hiddenIso = chip && chip.querySelector('input[type="hidden"][name="due"]');
    const iso = hiddenIso ? hiddenIso.value : '';
    createOverlayPicker(display, iso);
  });
})();

/* ===== Auto-expand Today comment textareas ===== */
(function(){
  function autoSize(el){
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight + 2) + 'px';
  }
  function bind(el){
    autoSize(el);
    el.addEventListener('input', () => autoSize(el));
    el.addEventListener('focus', () => autoSize(el));
  }
  document.querySelectorAll('textarea.comment-ta').forEach(bind);

  // If your page updates via navigation/partial reloads, you can re-bind as needed.
})();

/* === Swap theme icon to match current theme & add shortcuts === */
(function(){
  const root = document.documentElement;
  const btn  = document.getElementById('themeToggle');
  const refresh = document.getElementById('refreshBtn');
  if (!btn) return;

  const darkIcon  = btn.dataset.iconDark  || '☀️';
  const lightIcon = btn.dataset.iconLight || '🌙';

  function applyIcon(){
    const isDark = root.getAttribute('data-theme') === 'dark';
    btn.textContent = isDark ? darkIcon : lightIcon;
  }
  // run once after your existing theme code sets data-theme
  applyIcon();
  // also whenever the button toggles
  btn.addEventListener('click', () => setTimeout(applyIcon, 0));

  // keyboard: r = refresh, t = toggle theme
  document.addEventListener('keydown', (e) => {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    if (e.key.toLowerCase() === 'r' && refresh){ e.preventDefault(); refresh.click(); }
    if (e.key.toLowerCase() === 't'){ e.preventDefault(); btn.click(); }
  });
})();

