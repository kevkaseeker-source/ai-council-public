'use strict';

const vscode = acquireVsCodeApi();
const h = {
  css: name => getComputedStyle(document.body).getPropertyValue(name).trim() || '#888',
  safe: value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]),
  post: message => vscode.postMessage(message)
};
const esc = h.safe;
const app = document.getElementById('app');
const $ = selector => app.querySelector(selector);
const saved = vscode.getState() || {};
const tabNames = ['activity', 'learnings', 'network'];
let ui = {
  selected: saved.selected || '*',
  tab: tabNames.includes(saved.tab) ? saved.tab : 'activity',
  view3d: saved.view3d !== false,
  drawerId: saved.drawerId || null,
  menuOpen: !!saved.menuOpen,
  expandedLog: null,
  newOnly: false,
  learningSearchUsed: false
};
let data = {};
let tischDetail = null, tischOpen = false, tischHtml = '';
let chartSig = '';
let userScrolledUp = false;
let previousLogCount = 0;

app.innerHTML = `
  <main class="council">
    <header class="head">
      <b class="brand">Council</b><span id="area" class="badge"></span>
      <select id="sessions" aria-label="Sitzung"></select>
      <button id="goto" class="button goto" type="button">→ zum Tab</button>
      <span class="spacer"></span><button id="new" class="star" type="button"></button>
      <button id="gear" class="icon-button" type="button" aria-label="Einstellungen"
        aria-expanded="false">⚙</button>
    </header>
    <section class="work">
      <div id="chart" class="chart"><svg id="lines" class="lines" aria-hidden="true"></svg>
        <div id="org"></div>
      </div>
      <aside id="drawer" class="drawer" hidden></aside>
    </section>
    <section class="bottom">
      <nav class="tabs" role="tablist" aria-label="Ansicht">
        <button class="tab" data-tab="activity" role="tab">Aktivität</button>
        <button class="tab" data-tab="learnings" role="tab">Erkenntnisse</button>
        <button class="tab" data-tab="network" role="tab">Universum</button>
      </nav>
      <div id="activity" class="pane activity-pane"></div>
      <div id="learnings" class="pane learnings-pane" hidden></div>
      <div id="network" class="pane network-pane" hidden>
        <div class="graph-tools"><button type="button" data-view3d aria-pressed="true">3D</button><button type="button" data-reset-layout>Anordnung zurücksetzen</button><button type="button" data-zoom="1.25" aria-label="Vergrößern">＋</button><button type="button" data-zoom="0.8" aria-label="Verkleinern">−</button><button type="button" data-zoom="0">Alles zeigen</button><span class="graph-hint">Ziehen dreht · Mausrad zoomt · Klick zeigt Details</span></div>
        <div id="universe"></div><canvas id="graph"></canvas><aside id="detail" class="graph-detail"></aside>
      </div>
    </section>
    <div id="menu" class="menu" hidden></div>
  </main>`;

function persist() {
  vscode.setState({
    selected: ui.selected, tab: ui.tab, drawerId: ui.drawerId, menuOpen: ui.menuOpen, view3d: ui.view3d
  });
}

function relativeTime(timestamp) {
  const elapsed = Date.now() - new Date(timestamp || 0).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return '';
  if (elapsed < 60000) return 'jetzt';
  if (elapsed < 3600000) return `vor ${Math.floor(elapsed / 60000)} min`;
  return `vor ${Math.floor(elapsed / 3600000)} h`;
}

function duration(milliseconds, status) {
  if (status === 'wartet' || status === 'unbekannt') return 'bereit';
  const seconds = Math.max(0, Math.floor((milliseconds || 0) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:` +
    String(seconds % 60).padStart(2, '0');
}

function statusClass(status) {
  return ({ arbeitet: 'run', fertig: 'done', fehler: 'err', wartet: 'wait',
    unbekannt: 'wait' })[status] || 'wait';
}

function tokenFormat(amount) {
  if (!amount) return '0';
  if (amount >= 1e6) return (amount / 1e6).toLocaleString('de-DE', {
    maximumFractionDigits: 1
  }) + ' M';
  if (amount >= 1e3) return (amount / 1e3).toLocaleString('de-DE', {
    maximumFractionDigits: 0
  }) + ' k';
  return String(amount);
}

function renderMenu() {
  const folders = data.folders || {};
  const current = folders.current;
  const area = data.areaFilter || 'alle';
  const folderRows = [...(folders.favorites || []), ...(folders.recent || [])]
    .map(folder => `<div class="folder-row"><span>${esc(folder.area?.icon || '📁')} ` +
      `${esc(folder.path.split(/[\\/]/).filter(Boolean).pop() || folder.path)}</span>` +
      `<button data-fav="${esc(folder.path)}">${folder.favorite ? '★' : '☆'}</button>` +
      `<button data-open="${esc(folder.path)}">Öffnen</button></div>`).join('');
  const staex = current?.area?.id === 'staex';
  const today = data.today || {};
  $('#menu').innerHTML = `<h4>Ordner</h4><div class="current-folder">` +
    `${current ? esc(current.area?.icon || '📁') + ' ' +
      esc(current.path.split(/[\\/]/).filter(Boolean).pop() || current.path) : 'Kein Ordner'}</div>` +
    `${folderRows}<button class="button" data-pick>Anderen Ordner…</button>` +
    '<small class="muted">öffnet in neuem Fenster</small><h4>Bereich</h4>' +
    `${[['alle', 'Alle'], ['staex', 'nur Staex'], ['privat', 'nur Privat']].map(([value, label]) =>
      `<label><input type="radio" name="area" value="${value}" ` +
      `${area === value ? 'checked' : ''}> ${label}</label>`).join('')}` +
    `${staex ? `<h4>Datenschutz</h4><label><input type="checkbox" id="private" ` +
      `${folders.revealed ? 'checked' : ''}> Private Sitzungen anzeigen</label>` : ''}` +
    `<h4>Heute</h4><div class="muted today">Codex ${tokenFormat(today.openai)} · ` +
    `Grok ${tokenFormat(today.xai)} · Claude-Helfer ${tokenFormat(today.anthropic)} Tokens</div>`;
  $('#menu').hidden = !ui.menuOpen;
}

function avatar(id, member, label, big) {
  const status = member.status || 'unbekannt';
  const agent = String(member.agent || id || '');
  const glyph = agent.includes('browser') ? '◉' : id === 'codex' ? '</>' :
    id.startsWith('grok') ? '✱' : (member.model || agent).match(/[A-Za-z]/)?.[0]?.toUpperCase() || '?';
  return `<button class="av ${big ? 'big ' : ''}${statusClass(status)}" ` +
    `data-id="${esc(id)}" aria-pressed="${ui.drawerId === id}">` +
    `<span class="ring">${esc(glyph)}</span><span class="nm">${esc(label || member.label ||
      member.agent || id)}</span>${id === 'opus' ? '' : `<span class="st">${esc(duration(member.durationMs, status))}</span>`}` +
    '</button>';
}

function renderChart(force = false) {
  const tree = data.trees?.[ui.selected] || data.trees?.['*'];
  const signature = JSON.stringify(tree || null);
  if (!force && signature === chartSig) {
    renderDrawer();
    return;
  }
  chartSig = signature;
  const root = $('#org');
  if (!tree) {
    root.innerHTML = '<div class="empty">Keine Sitzungsdaten</div>';
    $('#lines').innerHTML = '';
    renderDrawer();
    return;
  }
  const externalMembers = [...(tree.external || [])];
  const externalNames = ['Codex', 'Grok 4.7', 'Grok build-fast'];
  const externalIds = ['codex', 'grok', 'grokbf'];
  const externalNeedles = ['codex', 'grok-4.7-build-fast', 'grok-4.7'];
  const external = externalNames.map((name, index) => {
    const member = externalMembers.find(item =>
      String(item.agent || '').toLowerCase().includes(externalNeedles[index])) ||
      externalMembers[index] || { agent: externalNeedles[index], status: 'wartet' };
    return avatar(externalIds[index], member, name, false);
  }).join('');
  const groups = (tree.groups || []).map(group => `<div class="cluster" data-parent="opus">` +
    `<h3>${esc(group.name)}</h3><div class="row">${(group.members || []).map(member =>
      avatar(member.run || member.agent, member, member.label || member.agent, false)).join('')}</div>` +
    `${group.hidden ? `<small class="muted">+${group.hidden} ältere</small>` : ''}</div>`).join('');
  root.innerHTML = `<div class="level boss"><div class="opus-wrap">` +
    `${avatar('opus', tree.opus || { status: 'unbekannt' }, 'Opus 5.5', true)}` +
    `<small class="opus-activity">${esc([tree.opus?.status || 'unbekannt', tree.opus?.activity]
      .filter((v, i, a) => v && a.indexOf(v) === i).join(' · '))}</small>` +
    `${tree.opus?.browserSteps ? `<small class="opus-warn">⚠ Opus hat ${tree.opus.browserSteps} Browser-Schritte selbst gemacht – gehört an Haiku</small>` : ''}</div></div>` +
    `<div class="level clusters"><div class="cluster" data-parent="opus"><h3>Extern</h3>` +
    `<div class="row">${external}</div></div>${groups || `<div class="cluster hint" ` +
      `data-parent="opus"><div>Claude-Helfer erscheinen, sobald Opus Arbeit abgibt</div></div>`}` +
    '</div>';
  renderDrawer();
  requestAnimationFrame(drawLines);
}

function lookupMember(id) {
  const tree = data.trees?.[ui.selected] || data.trees?.['*'];
  if (id === 'opus') return tree?.opus;
  const members = [...(tree?.external || []), ...(tree?.groups || []).flatMap(group =>
    group.members || [])];
  return members.find(member => String(member.run || member.agent) === id ||
    String(member.agent) === id) || null;
}

function renderDrawer() {
  const drawer = $('#drawer');
  const member = ui.drawerId && lookupMember(ui.drawerId);
  if (!member) {
    drawer.hidden = true;
    return;
  }
  drawer.hidden = false;
  const status = member.status || 'unbekannt';
  drawer.innerHTML = `<button class="icon-button close" aria-label="Schließen">✕</button>` +
    `<h2>${esc(member.label || member.agent || 'Opus 5.5')}</h2><div class="kv">` +
    `<span>Status</span><b>${esc(status)}</b><span>Tätigkeit</span><b>${esc(member.activity || '')}</b>` +
    `<span>Dauer</span><b>${duration(member.durationMs, status)}</b>` +
    `${member.tokens ? `<span>Tokens</span><b>${tokenFormat(member.tokens.in)} in / ` +
      `${tokenFormat(member.tokens.out)} out (${esc(member.tokens.provider || '')})</b>` : ''}` +
    `${member.model ? `<span>Modell</span><b>${esc(member.model)}</b>` : ''}</div>` +
    `${(member.thoughts || []).length ? `<h3>Gedanken</h3>` +
      member.thoughts.map(thought => `<div class="th">${esc(thought)}</div>`).join('') : ''}`;
  drawer.querySelector('.close').onclick = closeDrawer;
}

function closeDrawer() {
  ui.drawerId = null;
  persist();
  renderChart(false);
}

// Family-tree lines with right angles: trunk below Opus' label, one bus per row of clusters,
// short drops to each cluster; extra rows are reached via a gutter on the left so no line crosses a box.
function drawLines() {
  const chart = $('#chart');
  const svg = $('#lines');
  const bossWrap = chart.querySelector('.opus-wrap');
  if (!bossWrap) return;
  const c = chart.getBoundingClientRect();
  const b = bossWrap.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${c.width} ${c.height}`);
  svg.innerHTML = '';
  const add = (d, on) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    if (on) path.setAttribute('class', 'on');
    svg.appendChild(path);
  };
  const clusters = [...chart.querySelectorAll('.cluster')].map(el => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - c.left, top: r.top - c.top, on: !!el.querySelector('.run') };
  });
  if (!clusters.length) return;
  const rows = [];
  clusters.sort((p, q) => p.top - q.top).forEach(cl => {
    const row = rows.find(r => Math.abs(r.top - cl.top) < 8);
    if (row) row.items.push(cl); else rows.push({ top: cl.top, items: [cl] });
  });
  const trunkX = b.left + b.width / 2 - c.left;
  const startY = b.bottom - c.top + 2;
  const gutterX = 6;
  const anyOn = clusters.some(cl => cl.on);
  rows.forEach((row, i) => {
    const busY = row.top - 12;
    const xs = row.items.map(it => it.x);
    const rowOn = row.items.some(it => it.on);
    const left = i === 0 ? Math.min(trunkX, ...xs) : gutterX;
    const right = i === 0 ? Math.max(trunkX, ...xs) : Math.max(...xs);
    add(`M${left} ${busY} H${right}`, rowOn);
    row.items.forEach(it => add(`M${it.x} ${busY} V${row.top}`, it.on));
    if (i === 0) add(`M${trunkX} ${startY} V${busY}`, anyOn);
  });
  if (rows.length > 1) {
    // gutter from the first bus down to the last row's bus
    const firstBus = rows[0].top - 12;
    const lastBus = rows[rows.length - 1].top - 12;
    const laterOn = rows.slice(1).some(r => r.items.some(it => it.on));
    add(`M${Math.min(trunkX, ...rows[0].items.map(it => it.x))} ${firstBus} H${gutterX} V${lastBus}`, laterOn);
  }
}

function logTime(timestamp) {
  const date = new Date(timestamp || 0);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function shortEventText(event) {
  const text = String(event.text || '');
  if (text.startsWith('fertig: führt aus: ')) return 'Befehl fertig';
  if (text.startsWith('führt aus: ')) return 'führt einen Befehl aus';
  const completedPath = text.match(/^fertig: (liest|schreibt) (.+)$/);
  if (completedPath) return `${shortPathEvent(completedPath[1], completedPath[2])} ✓`;
  const pathEvent = text.match(/^(liest|schreibt) (.+)$/);
  if (pathEvent) return shortPathEvent(pathEvent[1], pathEvent[2]);
  const search = text.match(/^sucht (.+)$/);
  if (search) return `sucht „${truncate(search[1], 30)}“`;
  const delegation = text.match(/^delegiert an ([^:]+):\s*(.*)$/);
  if (delegation) return `gibt Arbeit an ${delegation[1]}: ${delegation[2]}`;
  return event.type === 'thinking' ? `💭 ${text}` : text;
}

function shortPathEvent(verb, path) {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return `${verb} ${parts[parts.length - 1] || path}`;
}

function truncate(text, limit) {
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function eventIdentity(event) {
  return String(event.agent || '');
}

function mergedEvents(events) {
  const merged = [];
  for (const event of events) {
    const label = shortEventText(event);
    const prior = merged[merged.length - 1];
    const elapsed = new Date(event.ts || 0).getTime() - new Date(prior?.lastTs || 0).getTime();
    if (prior && prior.label === label && prior.agent === eventIdentity(event) &&
        elapsed >= 0 && elapsed <= 10000) {
      prior.count += 1;
      prior.lastTs = event.ts;
      continue;
    }
    merged.push({ event, label, agent: eventIdentity(event), lastTs: event.ts, count: 1 });
  }
  return merged;
}

function agentGlyph(agent) {
  const name = String(agent || '');
  if (name.toLowerCase().includes('browser')) return '◉';
  if (name.toLowerCase() === 'codex') return '</>';
  if (name.toLowerCase().startsWith('grok')) return '✱';
  return name.match(/[A-Za-z]/)?.[0]?.toUpperCase() || '?';
}

function renderActivity() {
  const pane = $('#activity');
  const wasAtBottom = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 24;
  const entries = (data.log || []).filter(event =>
    ui.selected === '*' || event.session === ui.selected).slice().sort((a, b) =>
    new Date(a.ts || 0) - new Date(b.ts || 0));
  const rows = mergedEvents(entries).reverse(); // newest activity on top
  pane.innerHTML = rows.map(row => {
    const key = `${row.event.ts}|${row.agent}`; // stable even when new rows arrive above
    const expanded = ui.expandedLog === key;
    const thinking = row.event.type === 'thinking';
    return `<button class="log-row ${thinking ? 'think' : ''} ${expanded ? 'expanded' : ''}" ` +
      `type="button" data-log-index="${esc(key)}" aria-expanded="${expanded}">` +
      `<time>${esc(logTime(row.event.ts))}</time><span class="log-agent" aria-label="` +
      `${esc(row.agent)}">${esc(agentGlyph(row.agent))}</span>` +
      `<span class="log-summary">${esc(row.label)}</span>` +
      `${row.count > 1 ? `<span class="log-count">×${row.count}</span>` : ''}` +
      `${expanded ? `<span class="log-full">${esc(row.event.text || '')}</span>` : ''}</button>`;
  }).join('') || '<div class="empty">Noch keine Aktivität</div>';
  // newest rows are at the top; keep the user's scroll position, no auto-scroll to the bottom
  previousLogCount = entries.length;
}

function renderLearnings() {
  const pane = $('#learnings');
  const query = pane.querySelector('.learning-search')?.value.trim().toLowerCase() || '';
  const allItems = data.learningsList || [];
  const items = allItems.filter(item => ((!ui.newOnly || query || ui.learningSearchUsed) ||
    item.isNew) && (!query || [item.key, item.summary, item.worker]
    .some(value => String(value || '').toLowerCase().includes(query))));
  const groups = new Map();
  items.forEach(item => {
    const field = item.arbeitsfeld || 'Ohne Arbeitsfeld';
    if (!groups.has(field)) groups.set(field, []);
    groups.get(field).push(item);
  });
  const sortedGroups = [...groups.entries()].map(([field, entries]) => {
    entries.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    return { field, entries, newest: new Date(entries[0]?.date || 0).getTime() };
  }).sort((a, b) => b.newest - a.newest);
  const groupMarkup = sortedGroups.map(({ field, entries }) => {
    return `<section class="learning-group"><h3>${esc(field)}</h3>` +
      entries.map(item => `<button class="learning-entry" type="button" ` +
        `data-learning-key="${esc(item.key)}"><span class="learning-title">` +
        `${item.isNew ? '<span class="learning-star">★ </span>' : ''}` +
        `<b>${esc(String(item.key || '').replace(/-/g, ' '))}</b>` +
        `<span class="chip">${esc(item.type || '')}</span>` +
        `<span class="chip">${esc(item.worker || '')}</span>` +
        `<time>${esc(item.date || '')}</time></span>` +
        `<span class="learning-summary" title="${esc(item.summary || '')}">` +
        `${esc(item.summary || '')}</span></button>`).join('') + '</section>';
  }).join('');
  pane.innerHTML = `<div class="learning-tools"><input class="learning-search" type="search" ` +
    `placeholder="Suchen…" aria-label="Erkenntnisse durchsuchen" value="${esc(query)}">` +
    `${ui.newOnly ? '<button class="show-all" type="button">Alle anzeigen</button>' : ''}</div>` +
    `${groupMarkup || '<div class="empty">Keine passenden Erkenntnisse</div>'}`;
  pane.querySelector('.learning-search').addEventListener('input', event => {
    ui.learningSearchUsed = true;
    const caret = event.target.selectionStart;
    renderLearnings();
    const input = pane.querySelector('.learning-search');
    input.focus();
    input.setSelectionRange(caret, caret);
  });
  pane.querySelector('.show-all')?.addEventListener('click', () => {
    ui.newOnly = false;
    renderLearnings();
  });
}

function renderNetwork() {
  if (ui.tab !== 'network') return;
  const pane = $('#network');
  if (pane.clientWidth < 1 || pane.clientHeight < 1) return;
  const use3d = ui.view3d && window.CouncilUniverse;
  $('[data-view3d]').setAttribute('aria-pressed', String(!!use3d));
  $('#universe').hidden = !use3d;
  $('#graph').hidden = !!use3d;
  pane.querySelectorAll('[data-zoom]').forEach(button => { button.hidden = !!use3d; });
  $('.graph-hint').textContent = use3d ? 'Ziehen dreht · Mausrad zoomt · Klick zeigt Bestand · Shift + Kugel ziehen verschiebt Blasen' : 'Strg + Mausrad zoomt · Ziehen verschiebt · Klick zeigt Details';
  if (use3d) window.CouncilUniverse.render($('#universe'), $('#detail'), data.universe, h);
  else {
    window.CouncilUniverse?.dispose();
    if (window.CouncilGraph) window.CouncilGraph.render($('#graph'), $('#detail'), data, h);
  }
}

function activateTab(tab) {
  ui.tab = tabNames.includes(tab) ? tab : 'activity';
  persist();
  renderTabs();
  if (ui.tab === 'network') requestAnimationFrame(renderNetwork);
}
h.openTisch = id => { tischOpen = true; tischDetail = null; tischHtml = ''; h.post({ type: 'tisch', id: id || '' }); renderTische(); };
h.closeTisch = () => { if (!tischOpen) return; tischOpen = false; tischDetail = null; tischHtml = ''; $('#detail').classList.remove('tisch-panel'); h.post({ type: 'tisch', id: '' }); };

function renderTabs() {
  $('.tab[aria-selected="true"]')?.removeAttribute('aria-selected');
  $(`.tab[data-tab="${ui.tab}"]`).setAttribute('aria-selected', 'true');
  tabNames.forEach(name => { $(`#${name}`).hidden = name !== ui.tab; });
  if (ui.tab !== 'network') window.CouncilUniverse?.pause();
  if (ui.tab === 'network') requestAnimationFrame(renderNetwork);
  renderTische();
}

// Runder Tisch: Liste/Protokoll im Seitenpanel des Universums (nur neu zeichnen, wenn sich etwas geändert hat)
function renderTische() {
  if (!tischOpen || !window.CouncilTische) return;
  const html = tischDetail ? window.CouncilTische.detailHtml(tischDetail, esc) : window.CouncilTische.listHtml(data.tische || [], esc);
  if (html === tischHtml) return;
  const aside = $('#detail'), open = [...aside.querySelectorAll('details')].map(d => d.open), top = aside.scrollTop;
  tischHtml = html; aside.classList.add('universe-aside', 'tisch-panel'); aside.style.display = '';
  aside.innerHTML = '<button type="button" class="aside-close" data-close-aside aria-label="Schließen">✕</button>' + html;
  if (tischDetail) aside.querySelectorAll('details').forEach((d, i) => { if (i < open.length) d.open = open[i]; });
  aside.scrollTop = top;
}

function render() {
  const sessions = data.sessions || [];
  const chosen = sessions.find(session => session.sessionId === ui.selected);
  $('#area').textContent = chosen?.area?.label || '';
  $('#area').hidden = !chosen?.area?.label;
  $('#sessions').innerHTML = '<option value="*">Alle</option>' +
    sessions.filter(session => !session.hidden).map(session =>
      `<option value="${esc(session.sessionId)}">${session.active ? '● ' : ''}` +
      `${esc(session.title || 'Sitzung')} · ${esc(relativeTime(session.lastTs))}</option>`).join('');
  $('#sessions').value = ui.selected;
  $('#goto').hidden = ui.selected === '*';
  const newCount = (data.newKeys || []).length;
  $('#new').textContent = newCount ? `★ ${newCount} neu` : '';
  $('#new').hidden = !newCount;
  renderMenu();
  renderChart(false);
  renderActivity();
  renderLearnings();
  renderTabs();
  renderTische();
}

function onMessage(message) {
  if (!message.data || message.data.type !== 'state') return;
  data = message.data;
  render();
}

$('#sessions').addEventListener('change', event => {
  ui.selected = event.target.value;
  ui.drawerId = null;
  userScrolledUp = false;
  persist();
  h.post({ type: 'select', sessionId: ui.selected });
  chartSig = '';
  render();
});

$('#goto').addEventListener('click', () => {
  const session = (data.sessions || []).find(item => item.sessionId === ui.selected);
  if (session) h.post({ type: 'gotoTab', title: session.title });
});

$('#new').addEventListener('click', () => {
  ui.newOnly = true;
  ui.learningSearchUsed = false;
  activateTab('learnings');
  renderLearnings();
});

$('#gear').addEventListener('click', () => {
  ui.menuOpen = !ui.menuOpen;
  persist();
  renderMenu();
  $('#gear').setAttribute('aria-expanded', String(ui.menuOpen));
});

$('#menu').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.pick !== undefined) h.post({ type: 'pickFolder' });
  if (button.dataset.fav) h.post({ type: 'toggleFavorite', path: button.dataset.fav });
  if (button.dataset.open) h.post({ type: 'openFolder', path: button.dataset.open });
});

$('#menu').addEventListener('change', event => {
  if (event.target.name === 'area') h.post({ type: 'areaFilter', value: event.target.value });
  if (event.target.id === 'private') h.post({ type: 'revealPrivate', on: event.target.checked });
});

$('#org').addEventListener('click', event => {
  const button = event.target.closest('[data-id]');
  if (!button) return;
  ui.drawerId = button.dataset.id;
  persist();
  renderChart(false);
});

app.addEventListener('click', event => {
  const item = event.target.closest('[data-tisch]'); if (item) { h.post({ type: 'tisch', id: item.dataset.tisch }); return; }
  if (event.target.closest('[data-tisch-zurueck]')) { tischDetail = null; tischHtml = ''; h.post({ type: 'tisch', id: '' }); renderTische(); return; }
  const tab = event.target.closest('[data-tab]');
  if (tab) activateTab(tab.dataset.tab);
  const logRow = event.target.closest('[data-log-index]');
  if (logRow) {
    const index = logRow.dataset.logIndex;
    ui.expandedLog = ui.expandedLog === index ? null : index;
    renderActivity();
  }
  const learning = event.target.closest('[data-learning-key]');
  if (learning) h.post({ type: 'openLearning', key: learning.dataset.learningKey });
});

$('#activity').addEventListener('scroll', () => {
  userScrolledUp = $('#activity').scrollHeight - $('#activity').scrollTop -
    $('#activity').clientHeight > 24;
});

document.addEventListener('click', event => {
  if (!ui.menuOpen || event.target.closest('#menu, #gear')) return;
  ui.menuOpen = false;
  persist();
  renderMenu();
  $('#gear').setAttribute('aria-expanded', 'false');
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (ui.menuOpen) {
    ui.menuOpen = false;
    persist();
    renderMenu();
  }
  if (ui.drawerId) closeDrawer();
});

if (window.ResizeObserver) new ResizeObserver(drawLines).observe($('#chart'));
else window.addEventListener('resize', drawLines);
window.addEventListener('message', onMessage);
vscode.postMessage({ type: 'select', sessionId: ui.selected });
renderTabs();

// Zoom buttons of the Netz tab
document.addEventListener('click', event => {
  const viewButton = event.target.closest('[data-view3d]');
  if (viewButton) {
    ui.view3d = !ui.view3d;
    viewButton.setAttribute('aria-pressed', String(ui.view3d));
    persist();
    renderNetwork();
    return;
  }
  const button = event.target.closest('[data-zoom]');
  if (button && window.CouncilGraph?.zoomBy) window.CouncilGraph.zoomBy(Number(button.dataset.zoom));
});

// 3D-Bibliotheken laden als Modul nach app.js: danach neu zeichnen
window.addEventListener('council-universe-ready', () => renderNetwork());
document.addEventListener('click', ev => { if (ev.target.closest('[data-reset-layout]')) vscode.postMessage({ type: 'resetLayout' }); });
// Bestandsliste einer Blase kommt als eigene Nachricht
window.addEventListener('message', ev => { if (ev.data && ev.data.type === 'inventory' && window.CouncilUniverse) window.CouncilUniverse.showInventory(ev.data); if (ev.data && /^chat(Chunk|Done)$/.test(ev.data.type) && window.CouncilUniverse) window.CouncilUniverse.chatMessage(ev.data); if (ev.data && ev.data.type === 'tischDetail' && tischOpen) { tischDetail = ev.data.tisch; renderTische(); } });
