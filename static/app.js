
(function(){
  const saved = localStorage.getItem('theme');
  const btn = document.getElementById('themeToggle');
  const setTheme = (t) => {
    document.documentElement.setAttribute('data-theme', t);
    document.querySelector(':root').setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
    if (btn) btn.textContent = (t === 'dark') ? '☀️' : '🌙';
  };
  setTheme(saved === 'dark' ? 'dark' : 'light');
  btn && btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(next);
  });

  // Drag-and-drop reordering ONLY for Today
  document.querySelectorAll('.draggable').forEach(container => {
    container.addEventListener('dragstart', e => {
      const item = e.target.closest('.item');
      if (!item) return;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    container.addEventListener('dragover', e => {
      e.preventDefault();
      const after = getAfterElement(container, e.clientY);
      const dragging = container.querySelector('.item.dragging');
      if (!dragging) return;
      if (after == null) container.appendChild(dragging);
      else container.insertBefore(dragging, after);
    });

    container.addEventListener('drop', () => {
      const date = container.getAttribute('data-date');
      const groups = document.querySelectorAll(`.draggable[data-date="${date}"]`);
      let items = [];
      groups.forEach(g => items = items.concat(Array.from(g.querySelectorAll('.item'))));
      const newOrder = items.map(el => parseInt(el.getAttribute('data-index'), 10));
      fetch(`/reorder/${encodeURIComponent(date)}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({order: newOrder})
      }).then(() => location.reload());
    });

    container.addEventListener('dragend', e => {
      const item = e.target.closest('.item');
      if (item) item.classList.remove('dragging');
    });
  });

  function getAfterElement(container, y){
    const els = [...container.querySelectorAll('.item:not(.dragging)')];
    return els.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return {offset, element: child};
      else return closest;
    }, {offset: Number.NEGATIVE_INFINITY}).element;
  }
})();
