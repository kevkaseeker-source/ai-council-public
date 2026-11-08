'use strict';
const vscode = acquireVsCodeApi();
let saved = vscode.getState() || {}, data = { agents: {}, log: [], graph: { nodes: [], edges: [] }, notes: [], newKeys: [], skipped: 0, sessions: [], trees: {} }, active = saved.active || 'agents', selected = saved.selected || '*', expanded = new Set(saved.expanded || []), hovered = false, filters = new Set(), picked = null;
const safe = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function icon(agent) { const key = ['opus','haiku','sonnet','browser','codex'].includes(agent) ? agent : String(agent).startsWith('grok') ? 'grok' : 'other'; return `<img class="icon" src="${document.body.dataset.media}/icons/${key}.svg" alt="">`; }
const css = name => getComputedStyle(document.body).getPropertyValue(name).trim() || '#888';
function persist() { vscode.setState({ active, selected, expanded: [...expanded] }); }
function render() {
  const newest = data.newKeys[0]; document.querySelector('#banner').innerHTML = newest ? `★ Neue Erkenntnis: <button data-key="${safe(newest)}">${safe(newest)}</button>` : '';
  // Same title in several sessions (e.g. a resumed chat): append local time of last activity so chips stay distinguishable.
  const titleCount = {}; for (const s of data.sessions || []) titleCount[s.title] = (titleCount[s.title] || 0) + 1;
  const named = (data.sessions || []).map(s => titleCount[s.title] > 1 ? { ...s, title: `${s.title} · ${new Date(s.lastTs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` } : s);
  const sessions = [{ sessionId: '*', title: 'Alle', active: false }, ...named], chosen = sessions.find(s => s.sessionId === selected) || sessions[0]; selected = chosen.sessionId;
  document.querySelector('#sessions').innerHTML = `<div class="sessionbar">${sessions.map(s => `<button class="chip ${s.sessionId === selected ? 'selected' : ''}" data-session="${safe(s.sessionId)}" title="${safe(s.title + (s.cwd ? ' — ' + s.cwd : ''))}">${s.active ? '● ' : ''}${safe(/^[0-9a-f]{8}$/.test(s.title) ? 'Neue Sitzung' : s.title.length > 38 ? `${s.title.slice(0,24)}…${s.title.slice(-10)}` : s.title)}</button>`).join('')}<button id="goto" ${selected === '*' ? 'hidden' : ''}>→ zum Tab</button></div>`;
  document.querySelectorAll('[data-session]').forEach(b => b.onclick = () => { selected = b.dataset.session; persist(); vscode.postMessage({ type: 'select', sessionId: selected }); render(); });
  document.querySelector('#goto').onclick = () => vscode.postMessage({ type: 'gotoTab', title: chosen.title });
  document.querySelectorAll('[role=tab]').forEach(b => { b.setAttribute('aria-selected', String(b.dataset.tab === active)); b.onclick = () => { active = b.dataset.tab; persist(); document.querySelectorAll('.pane').forEach(p => p.classList.toggle('hidden', p.id !== active)); render(); }; });
  document.querySelectorAll('.pane').forEach(p => p.classList.toggle('hidden', p.id !== active));
  const tree = data.trees?.[selected] || data.trees?.['*']; document.querySelector('#agents').innerHTML = tree ? treeMarkup(tree) : '';
  const sessionIds = new Set((data.sessions || []).map(s => s.sessionId)), log = (data.log || []).filter(e => selected === '*' ? true : e.session === selected || (['codex','grok-4.7','grok-4.7-build-fast'].includes(e.agent) && !e.session));
  const agents = [...new Set(log.map(e => e.agent))]; document.querySelector('#log').innerHTML = `<div class="filters">${agents.map(a => `<button data-filter="${safe(a)}" class="${!filters.size || filters.has(a) ? 'selected' : ''}">${safe(a)}</button>`).join('')}</div><div id="rows">${log.slice(-300).filter(e => !filters.size || filters.has(e.agent)).map(e => `<div class="row ${e.type === 'thinking' ? 'thought' : ''}"><time>${safe((e.ts || '').slice(11,19))}</time><b>${safe(e.agent)}</b><span>${safe(e.text || '')}</span></div>`).join('')}</div><footer>Übersprungene Zeilen: ${data.skipped}</footer>`;
  document.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => { const n = b.dataset.filter; filters.has(n) ? filters.delete(n) : filters.add(n); render(); });
  const rows = document.querySelector('#rows'); if (rows && !hovered) rows.scrollTop = rows.scrollHeight;
  rows?.addEventListener('mouseenter', () => hovered = true); rows?.addEventListener('mouseleave', () => hovered = false);
  document.querySelectorAll('[data-expand]').forEach(b => b.onclick = () => { expanded.has(b.dataset.expand) ? expanded.delete(b.dataset.expand) : expanded.add(b.dataset.expand); persist(); render(); });
  if (window.CouncilFolders) window.CouncilFolders.render(document.querySelector('#folders'), data.folders || { current: null, favorites: [], recent: [] }, data.areaFilter || 'alle', { css, safe, post: m => vscode.postMessage(m) });
  if (window.CouncilHistory) window.CouncilHistory.render(document.querySelector('#history'), data.history || [], data.historyInfo || null, { css, safe, post: m => vscode.postMessage(m) });
  draw(); document.querySelectorAll('[data-key]').forEach(b => b.onclick = () => vscode.postMessage({ type: 'openLearning', key: b.dataset.key }));
}
function treeMarkup(t) {
  const box = (a, label) => `<article class="treebox">${icon(a.agent || a.model || label)}<div class="boxhead"><b>${safe(label || a.label || a.agent)}</b><span class="pill ${safe(a.status || 'wartet')}">${safe(a.status || 'wartet')}</span></div><div class="activity" title="${safe(a.activity || '')}">${safe(a.activity || '—')}</div><small>${duration(a.durationMs)} · ${tokens(a.tokens)}</small>${(a.thoughts || []).slice(0,2).map(x => `<div class="thought">${safe(x)}</div>`).join('')}</article>`;
  const groups = (t.groups || []).map((g, i) => `<div class="group"><h3>${safe(g.name)}</h3><div class="members">${g.members.map(m => box(m)).join('')}</div>${g.hidden ? `<button data-expand="${safe(g.name)}">${expanded.has(g.name) ? 'Einklappen' : `+ ${g.hidden} weitere`}</button>${expanded.has(g.name) ? `<div class="older">${g.hidden} ältere Läufe</div>` : ''}` : ''}</div>`).join('');
  return `<div class="tree"><div class="opus">${box({ ...t.opus, agent: 'opus' }, `Opus 5.5 · ${t.opus.title || 'Alle'}${t.opus.title === 'Alle' && t.opus.sessions ? ` (${t.opus.sessions} aktiv)` : ''}`)}</div><div class="branches"><section class="branch"><h2>Extern</h2><div class="extern">${(t.external || []).map(a => box(a)).join('')}</div></section><section class="branch"><h2>Claude-Unteragenten</h2><div class="groups">${groups || '<span>Keine Unteragenten</span>'}</div></section></div></div>`;
}
function duration(ms) { if (ms == null) return '00:00'; const s = Math.floor(ms / 1000); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
function tokens(t) { return t ? `${(t.in || 0) + (t.out || 0)} Tokens` : '— Tokens'; }
function draw() { if (window.CouncilGraph) window.CouncilGraph.render(document.querySelector('#graph'), document.querySelector('#detail'), data, { css, safe, post: m => vscode.postMessage(m) }); }
function detail(n) { document.querySelector('#detail').innerHTML=`<h3>${safe(n.label)}</h3><p>${safe((data.notes||[]).filter(x=>x.target===n.label).map(x=>x.text).join('\n')||'Keine Notizen')}</p><textarea id="note" placeholder="Notiz"></textarea><button id="save">Notiz speichern</button>`;document.querySelector('#save').onclick=()=>{const text=document.querySelector('#note').value;if(text.trim())vscode.postMessage({type:'addNote',target:n.label,text});}; }
window.addEventListener('message',e=>{if(e.data.type==='state'){data=e.data;render();}}); window.addEventListener('keydown',e=>{if(e.key==='Tab')document.body.classList.add('keyboard');}); render();

vscode.postMessage({ type: 'select', sessionId: selected });
