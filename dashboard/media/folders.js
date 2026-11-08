(function () {
  const state = new WeakMap();
  const esc = (h, value) => h.safe(String(value == null ? '' : value));
  const segment = path => String(path || '').replace(/[\\/]+$/, '').split(/[\\/]/).pop() || String(path || '');

  function render(container, folders, filter, h) {
    const snapshot = JSON.stringify([folders, filter]);
    let view = state.get(container);
    if (view && view.snapshot === snapshot) return;
    const open = view ? view.open : false;
    const current = folders.current;
    const palette = name => h.css(name);
    const buttonStyle = `color:${palette('--vscode-button-foreground')};background:${palette('--vscode-button-background')};border:1px solid ${palette('--vscode-panel-border')};`;
    const textStyle = `color:${palette('--vscode-foreground')};background:${palette('--vscode-editor-background')};`;
    const selectedStyle = `color:${palette('--vscode-button-foreground')};background:${palette('--vscode-button-background')};`;
    const pathTitle = current ? ` title="${esc(h, current.path)}"` : '';
    const connected = current ? `${current.area.icon} ${current.area.label} · ${segment(current.path)}` : '—';
    let html = `<div class="cf-root" style="${textStyle}position:relative;font:inherit;">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span${pathTitle}>📁 Verbunden: ${esc(h, connected)}</span>
        <button type="button" data-action="toggle" style="${buttonStyle}">Ordner wechseln…</button>
        ${[['alle','Alle'],['staex','🏢 Staex'],['privat','🔒 Privat']].map(([value,label]) => `<button type="button" data-filter="${value}" style="${filter === value ? selectedStyle : ''}">${esc(h,label)}</button>`).join('')}
        ${folders.privateHidden ? `<button type="button" data-reveal="true" style="${buttonStyle}">🔒 privat anzeigen</button>` : current && current.area.id === 'staex' && folders.revealed ? `<button type="button" data-reveal="false" style="${buttonStyle}">privat ausblenden</button>` : ''}
      </div>`;
    if (open) {
      const row = item => `<div style="display:flex;align-items:center;gap:6px;padding:4px 2px">
        <span>${esc(h,item.area.icon)}</span><span title="${esc(h,item.path)}" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h,segment(item.path))}<small style="display:block;opacity:.75">${esc(h,item.area.label)}${item.area.note ? ` · ${esc(h,item.area.note)}` : ''}</small></span>
        <button type="button" data-favorite="${esc(h,item.path)}" aria-label="Favorit">${item.favorite ? '★' : '☆'}</button>
        <button type="button" data-open="${esc(h,item.path)}" style="${buttonStyle}">Öffnen</button></div>`;
      html += `<div class="cf-dropdown" style="position:absolute;z-index:10;top:100%;left:0;max-height:60vh;overflow:auto;min-width:min(440px,95vw);padding:8px;border:1px solid ${palette('--vscode-panel-border')};background:${palette('--vscode-dropdown-background')};color:${palette('--vscode-dropdown-foreground')};box-shadow:0 4px 12px ${palette('--vscode-widget-shadow')}">`;
      for (const [label, items] of [['Favoriten',folders.favorites || []],['Zuletzt benutzt',folders.recent || []]]) {
        if (!items.length) continue;
        html += `<section><strong>${esc(h,label)}</strong>${items.map(row).join('')}</section>`;
      }
      html += `<button type="button" data-pick style="${buttonStyle};width:100%;margin-top:6px">Anderen Ordner suchen…</button><div style="font-size:.85em;opacity:.75;padding-top:6px">öffnet in einem neuen VS-Code-Fenster</div></div>`;
    }
    html += '</div>';
    container.innerHTML = html;
    view = { snapshot, open };
    state.set(container, view);
    container.onclick = event => {
      const target = event.target.closest('button');
      if (!target) {
        if (view.open && !event.target.closest('.cf-dropdown')) { view.open = false; state.delete(container); render(container, folders, filter, h); }
        return;
      }
      if (target.dataset.action === 'toggle') { view.open = !view.open; state.delete(container); render(container, folders, filter, h); }
      else if (target.dataset.filter) h.post({ type: 'areaFilter', value: target.dataset.filter });
      else if (target.dataset.reveal != null) h.post({ type: 'revealPrivate', on: target.dataset.reveal === 'true' });
      else if (target.dataset.favorite != null) h.post({ type: 'toggleFavorite', path: target.dataset.favorite });
      else if (target.dataset.open != null) h.post({ type: 'openFolder', path: target.dataset.open });
      else if (target.hasAttribute('data-pick')) h.post({ type: 'pickFolder' });
    };
    if (open) {
      container.onkeydown = event => { if (event.key === 'Escape') { view.open = false; state.delete(container); render(container, folders, filter, h); } };
      if (typeof document !== 'undefined') {
        if (view.outsideHandler) document.removeEventListener('click', view.outsideHandler, true);
        view.outsideHandler = event => {
          if (!container.contains(event.target)) {
            view.open = false;
            state.delete(container);
            render(container, folders, filter, h);
          }
        };
        document.addEventListener('click', view.outsideHandler, true);
      }
    }
  }

  window.CouncilFolders = { render };
})();
