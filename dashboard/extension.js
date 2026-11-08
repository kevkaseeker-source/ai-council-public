'use strict';
const vscode = require('vscode');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { parseEventLines, reduceEvents } = require('./src/events');
const { readNew } = require('./src/tail');
const { parseLearning, buildGraph, isNew, noteFile, parseNote } = require('./src/graph');
const { transcriptPath, readTranscript } = require('./src/transcripts');
const { readTitle, listSessions, assignExternal } = require('./src/sessions');
const { buildTree } = require('./src/tree');
const { readHistory, readCwd } = require('./src/history');
const { classify, normalize, applyPrivacy, folderList } = require('./src/areas');
const { loadProfiles, loadBereiche } = require('./src/bereiche');
const { buildUniverse } = require('./src/universe');
const { opusInstances } = require('./src/instances');
const { readGitStatus } = require('./src/gitstatus');
const { readStand, appendStand } = require('./src/stand');
const { detectFlows } = require('./src/flows');
const { chatAgentFor, chatOptions, allowedAgent, buildPrompt, textFromJsonl } = require('./src/chat');
const { appendChat, readChat } = require('./src/chatlog');
const { expandFolders } = require('./src/folders');
const { buildInventory, resolveFile } = require('./src/inventory');
const { listTische, readTisch, tischPfad } = require('./src/tische');
const openFolders = new Set(); // im Universum aufgeklappte Bereiche/Ordner (nur diese Sitzung)
let folderDirs = new Map(), expandedCache = null, lastInventoryCtx = null; // Ordner nur nach Klick/Neuladen neu lesen (G: ist langsam)
let revealed = false, areaFilter = 'alle'; // privacy toggle (reset when the Council closes) and area filter
let selectedSession = null; // session chosen in the webview; only its history is sent
let openTisch = null;
let disposables = [], timers = [], provider, debounceTimer;
function activate(context) {
  const root = () => vscode.workspace.getConfiguration('council').get('root');
  const logRoot = () => path.join(root(), 'logs');
  const projectsRoot = () => { const value = vscode.workspace.getConfiguration('council').get('claudeProjects'); return value ? path.resolve(value) : path.join(os.homedir(), '.claude', 'projects'); };
  const mediaPath = path.join(context.extensionPath, 'media');
  let events = [], skipped = 0, notes = [], learnings = [], profiles = [], bereiche = [], graph = { nodes: [], edges: [] }, newKeys = [], offset = 0, buffer = '', activeFile = '', panel, viewWebview;
  const titleCache = new Map(), transcriptCache = new Map(), hosts = new Set(), cwdCache = new Map(), historyCache = new Map(), fileCache = new Map(), chats = new Map();
  let gitStatus = null, gitStatusAt = 0, gitStatusPending = false;
  // Main transcript of a session: <projects>/<any project>/<sessionId>.jsonl (cached once found)
  function sessionFile(id) {
    if (fileCache.has(id)) return fileCache.get(id);
    let found = null;
    try { for (const d of fs.readdirSync(projectsRoot(), { withFileTypes: true })) { if (!d.isDirectory()) continue; const f = path.join(projectsRoot(), d.name, `${id}.jsonl`); if (fs.existsSync(f)) { found = f; break; } } } catch {}
    if (found) fileCache.set(id, found);
    return found;
  }
  function safeFiles(dir, ext) { try { return fs.readdirSync(dir).filter(n => n.endsWith(ext)); } catch { return []; } }
  function refreshAux() {
    profiles = loadProfiles(path.join(root(), 'profile')); bereiche = loadBereiche(path.join(root(), 'bereiche'));
    try { learnings = safeFiles(path.join(root(), 'learnings'), '.md').map(n => parseLearning(fs.readFileSync(path.join(root(), 'learnings', n), 'utf8'), n)); } catch { learnings = []; }
    try { notes = safeFiles(path.join(root(), 'notes'), '.md').map(n => parseNote(fs.readFileSync(path.join(root(), 'notes', n), 'utf8'), n)); } catch { notes = []; }
    graph = buildGraph(learnings); newKeys = learnings.filter(l => isNew(l.date, new Date())).map(l => l.key);
  }
  function titleOf(id) {
    let found = null, files = [];
    try { for (const dir of fs.readdirSync(projectsRoot(), { withFileTypes: true })) if (dir.isDirectory()) { const f = path.join(projectsRoot(), dir.name, `${id}.jsonl`); try { const mt = fs.statSync(f).mtimeMs; files.push([f, mt]); const c = titleCache.get(f); if (c?.mt === mt) { if (c.title) found = c.title; continue; } const title = readTitle(projectsRoot(), id); titleCache.set(f, { mt, title }); if (title) found = title; } catch {} } } catch {}
    return found;
  }
  function enrich(item, sessionId) {
    if (!item?.run || !sessionId) return item;
    const file = transcriptPath(projectsRoot(), sessionId, item.run); if (!file) return item;
    try { const mt = fs.statSync(file).mtimeMs; let d = transcriptCache.get(file); if (!d || d.mt !== mt) { d = { mt, ...readTranscript(file) }; transcriptCache.set(file, d); } return { ...item, model: d.model, thoughts: d.thoughts || [], tokens: d.tokens || item.tokens }; } catch { return item; }
  }
  function favorites() { return context.globalState.get('council.favorites') ?? vscode.workspace.getConfiguration('council').get('favorites') ?? []; }
  function state() {
    const now = new Date(), externalSession = assignExternal(events);
    if (!gitStatusPending && Date.now() - gitStatusAt >= 60000) { gitStatusPending = true; readGitStatus(root()).then(value => { gitStatus = value; gitStatusAt = Date.now(); gitStatusPending = false; post(); }); }
    const raw = listSessions(events, now, titleOf);
    for (const s of raw) { const f = sessionFile(s.sessionId); if (f) { if (!cwdCache.has(f)) cwdCache.set(f, readCwd(f)); s.cwd = cwdCache.get(f); } }
    const windowPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || null, windowArea = classify(windowPath);
    // Privacy: in a Staex window, private sessions show neither title, folder, tree, log nor history (unless revealed).
    const hiddenIds = new Set(applyPrivacy(raw, windowArea, { revealed }).filter(s => s.hidden).map(s => s.sessionId));
    const sessions = applyPrivacy(raw, windowArea, { revealed, areaFilter })
      .map(s => s.hidden || s.area.id === 'unbekannt' ? s : { ...s, title: `${s.area.icon} ${s.title}` });
    const isHiddenEvent = e => hiddenIds.has(e.session) || hiddenIds.has(externalSession.get(e.run));
    const visible = events.filter(e => !isHiddenEvent(e));
    const trees = { '*': buildTree(visible, { session: null, title: 'Alle', now, externalSession }) };
    for (const s of sessions) {
      const t = buildTree(s.hidden ? [] : visible, { session: s.sessionId, title: s.title, now, externalSession });
      t.external = t.external.map(x => enrich(x, s.sessionId));
      t.groups = t.groups.map(g => ({ ...g, members: g.members.map(m => enrich(m, s.sessionId)) }));
      trees[s.sessionId] = t;
    }
    const reduced = reduceEvents(visible, now);
    const log = visible.map(e => ['codex','grok-4.7','grok-4.7-build-fast'].includes(e.agent) && e.session == null ? { ...e, session: externalSession.get(e.run) || null } : e).slice(-300);
    let history = [], historyInfo = null;
    const sel = sessions.find(s => s.sessionId === selectedSession);
    if (sel && sel.hidden) historyInfo = { title: sel.title, cwd: null, sessionId: sel.sessionId };
    else if (sel) {
      historyInfo = { title: sel.title, cwd: sel.cwd || null, sessionId: sel.sessionId };
      const f = sessionFile(sel.sessionId);
      if (f) { try { const mt = fs.statSync(f).mtimeMs; const c = historyCache.get(f); if (c && c.mt === mt) history = c.h; else { history = readHistory(f); historyCache.set(f, { mt, h: history }); } } catch {} }
    }
    const folders = { ...folderList({ workspacePath: windowPath, favorites: favorites(), sessions: raw, revealed }), revealed };
    // Arbeitsordner je Agent: Sitzung seines letzten Schritts (externe Worker über ihren Lauf), sonst die von Opus
    const cwdOfSession = new Map(raw.map(s => [s.sessionId, s.cwd || null])), agentCwd = {};
    for (const e of visible) { const sid = e.session || externalSession.get(e.run); if (sid && cwdOfSession.get(sid)) agentCwd[e.agent] = cwdOfSession.get(sid); }
    for (const name of Object.keys(reduced.agents)) if (!agentCwd[name] && agentCwd.opus) agentCwd[name] = agentCwd.opus;
    if (!expandedCache) expandedCache = expandFolders(bereiche, openFolders);
    const expanded = expandedCache; folderDirs = expanded.dirs;
    const agentUrl = {};
    for (const e of visible) if (e.detail?.tool?.startsWith('mcp__claude-in-chrome__navigate') && /^https?:\/\//i.test(e.detail.target || '')) agentUrl[e.agent] = e.detail.target;
    const flows = detectFlows({ bereiche, events: visible, sessionCwd: cwdOfSession, now });
    const instanceCwd = new Map(raw.map(s => [s.sessionId, s.cwd || null]));
    const opus = opusInstances(events, { now, sessionCwd: instanceCwd, hiddenIds });
    const syncByProfile = {};
    for (const l of learnings) {
      const ts = Date.parse(`${l.date}T00:00:00Z`); if (!Number.isFinite(ts) || now - ts < 0 || now - ts > 7 * 86400000) continue;
      const ids = String(l.bereich || 'alle').split(',').map(x => x.trim()).filter(Boolean);
      for (const id of ids.includes('alle') ? profiles.map(p => p.id) : ids) syncByProfile[id] = (syncByProfile[id] || 0) + 1;
    }
    const tische = listTische(root()).filter(t => !(t.vertraulich && windowArea.id === 'staex' && !revealed)); // wie private Blasen: im Staex-Fenster ausblenden
    const universe = buildUniverse({ bereiche, profile: profiles, learnings, agents: reduced.agents, agentCwd, agentUrl, flows, ordner: expanded.ordner, opusInstances: opus, git: gitStatus, syncByProfile, tische, windowArea, revealed, now });
    universe.layout = context.globalState.get('council.layout') || {};
    lastInventoryCtx = { events: visible, sessionCwd: cwdOfSession, visibleIds: new Set(universe.nodes.filter(n => n.kind === 'bereich').map(n => n.id.slice(2))) };
    // Tokens used today (UTC day) per provider, from visible 'end' events
    const day = now.toISOString().slice(0, 10), today = { openai: 0, xai: 0, anthropic: 0 };
    for (const e of visible) if (e.type === 'end' && e.tokens && String(e.ts).startsWith(day) && e.tokens.provider in today) today[e.tokens.provider] += (e.tokens.in || 0) + (e.tokens.out || 0);
    // Knowledge list for the Erkenntnisse view: newest first, one-sentence summary
    const learningsList = learnings.map(l => ({ key: l.key, type: l.type, worker: l.worker, arbeitsfeld: l.arbeitsfeld, date: l.date, isNew: newKeys.includes(l.key),
      summary: String(l.body || '').replace(/\s+/g, ' ').trim().slice(0, 220) })).sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.key.localeCompare(b.key));
    return { type: 'state', agents: reduced.agents, log, graph, universe, notes, newKeys, skipped, sessions, trees, history, historyInfo, folders, areaFilter, today, learningsList, tische };
  }
  function post() { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => { const s = state(); for (const w of hosts) try { w.postMessage(s); } catch {} }, 250); }
  function scanToday(full = false) {
    const d = new Date(), days = [0, 1].map(delta => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - delta)); return `events-${x.toISOString().slice(0,10)}.jsonl`; });
    if (full || !activeFile || activeFile !== path.join(logRoot(), days[0])) {
      events = []; skipped = 0;
      for (const name of days.slice().reverse()) { const f = path.join(logRoot(), name); try { const parsed = parseEventLines(fs.readFileSync(f, 'utf8')); events.push(...parsed.events); skipped += parsed.skipped; } catch {} }
      events = events.slice(-5000); activeFile = path.join(logRoot(), days[0]);
      try { offset = fs.statSync(activeFile).size; } catch { offset = 0; }
      buffer = ''; post(); return;
    }
    const chunk = readNew(activeFile, offset); offset = chunk.offset; buffer += chunk.text;
    const last = buffer.lastIndexOf('\n'); if (last >= 0) { const parsed = parseEventLines(buffer.slice(0, last + 1)); events = events.concat(parsed.events).slice(-5000); skipped += parsed.skipped; buffer = buffer.slice(last + 1); }
    post();
  }
  function loadAux() { refreshAux(); expandedCache = null; post(); }
  // owner = WebviewView or WebviewPanel (only these have onDidDispose; a Webview itself does not)
  function handler(webview, owner) { hosts.add(webview); owner.onDidDispose(() => { hosts.delete(webview); if (openTisch?.webview === webview) openTisch = null; revealed = false; }); webview.onDidReceiveMessage(async m => {
    if (m.type === 'tisch') { const id = String(m.id || ''); let dir = tischPfad(root(), id); if (dir && readTisch(dir).meta?.vertraulich === true && classify(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || null).id === 'staex' && !revealed) dir = null; openTisch = dir ? { id, dir, webview } : null; if (dir) webview.postMessage({ type: 'tischDetail', tisch: { id, ...readTisch(dir) } }); return; }
    if (m.type === 'chatStop') { const job = chats.get(String(m.id || '')); if (job) job.child.kill(); return; }
    if (m.type === 'chatSend' || m.type === 'handoffRun') {
      const b = bereiche.find(x => x.id === String(m.id || ''));
      if (!b || !lastInventoryCtx?.visibleIds.has(b.id)) return;
      if (!/^[A-Za-z0-9_-]+$/.test(b.id)) return;
      if (chats.has(b.id)) return;
      const id = b.id, profile = profiles.find(p => p.id === b.profil), options = chatOptions(b, profile);
      const worker = m.type === 'handoffRun' ? String(m.agent || '') : String(m.agent || chatAgentFor(b, profile));
      if (!allowedAgent(b, profile, worker)) return;
      if (m.type === 'chatSend' && !String(m.text || '').trim()) return;
      if (m.type === 'handoffRun' && (!String(m.auftrag || '').trim() || String(m.auftrag).length > 2000)) return;
      const transcript = readChat(root(), id);
      if (m.type === 'chatSend') appendChat(root(), id, { von: 'kevin', text: String(m.text || '').slice(0, 4000) });
      let context = [];
      for (const file of b.chatKontext || []) try { const filename = path.resolve(root(), file); if (fs.existsSync(filename) && fs.statSync(filename).isFile()) context.push({ path: file, text: fs.readFileSync(filename, 'utf8').slice(0, 20000) }); } catch {}
      const team = (buildUniverse({ bereiche: [b], profile: profiles }).nodes.filter(n => n.kind === 'member').map(n => n.label));
      const prompt = buildPrompt({ bereich: b, agent: worker, options, team, kontext: context, verlauf: transcript, text: m.type === 'handoffRun' ? String(m.auftrag).slice(0, 2000) : String(m.text || '').slice(0, 4000) });
      const cwd = path.join(os.tmpdir(), 'council-chat', b.id); fs.mkdirSync(cwd, { recursive: true });
      const task = path.join(cwd, 'TASK.md'); fs.writeFileSync(task, prompt, 'utf8');
      if (/^[gG]:[\\/]/.test(cwd) || /^[gG]:[\\/]/.test(task)) { try { fs.unlinkSync(task); } catch {} return; }
      const runner = path.resolve(__dirname, '..', 'tools', 'run', 'council-run.mjs');
      const child = worker === 'claude'
        ? spawn(claudeBin(), ['-p', prompt, '--output-format', 'text'], { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
        : spawn(process.execPath, [runner, worker, task, '--sandbox', 'read-only'], { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      const job = { child, buffer: '', answer: '', worker }; chats.set(id, job);
      child.on('error', err => { chats.delete(id); try { webview.postMessage({ type: 'chatChunk', id, text: `\n[Start fehlgeschlagen: ${err.code || err.message}]` }); webview.postMessage({ type: 'chatDone', id, code: 1 }); } catch {} });
      const send = (type, text, code) => { try { webview.postMessage({ type, id, agent: worker, ...(text !== undefined ? { text } : {}), ...(code !== undefined ? { code } : {}) }); } catch {} };
      child.stdout.on('data', chunk => { const raw = chunk.toString('utf8'); if (worker === 'claude') { job.answer += raw; send('chatChunk', raw); return; } job.buffer += raw; const rows = job.buffer.split(/\r?\n/); job.buffer = rows.pop(); const output = textFromJsonl(rows.join('\n')); if (output) { job.answer += output; send('chatChunk', output); } });
      child.on('close', code => { if (worker !== 'claude' && job.buffer) { const output = textFromJsonl(job.buffer); job.answer += output; if (output) send('chatChunk', output); } chats.delete(id); if (job.answer) appendChat(root(), id, { von: worker, text: job.answer }); send('chatDone', undefined, code ?? 1); });
      return;
    }
    if (m.type === 'openUrl' && /^https?:\/\//i.test(String(m.url || ''))) { try { await vscode.env.openExternal(vscode.Uri.parse(m.url)); } catch {} return; }
    if (m.type === 'addNote') { try { const dir = path.join(root(), 'notes'); fs.mkdirSync(dir, { recursive: true }); const note = noteFile(String(m.target || ''), String(m.text || ''), new Date()); fs.writeFileSync(path.join(dir, note.name), note.content, 'utf8'); loadAux(); } catch {} }
    if (m.type === 'toggleFolder') { const id = String(m.id || ''); if (openFolders.has(id)) { for (const k of [...openFolders]) if (k === id || k.startsWith(id.replace(/^b:/, 'o:') + '/')) openFolders.delete(k); } else openFolders.add(id); expandedCache = null; post(); return; }
    if (m.type === 'inventory') { const id = String(m.id || '').replace(/^b:/, ''); const b = bereiche.find(x => x.id === id); if (!b || !lastInventoryCtx || !lastInventoryCtx.visibleIds.has(id)) return; try { webview.postMessage({ type: 'inventory', id: 'b:' + id, data: buildInventory(b, lastInventoryCtx), chat: readChat(root(), id), stand: readStand(root(), id) }); } catch {} return; }
    if (m.type === 'standAdd') { const id = String(m.id || ''); if (!lastInventoryCtx?.visibleIds.has(id) || !/^[A-Za-z0-9_-]+$/.test(id)) return; if (appendStand(root(), id, String(m.text || '').slice(0, 12000))) { try { webview.postMessage({ type: 'inventory', id: 'b:' + id, data: buildInventory(bereiche.find(x => x.id === id), lastInventoryCtx), chat: readChat(root(), id), stand: readStand(root(), id) }); } catch {} } return; }
    if (m.type === 'openFile') { const id = String(m.id || '').replace(/^b:/, ''); const b = bereiche.find(x => x.id === id); if (!b || !lastInventoryCtx || !lastInventoryCtx.visibleIds.has(id)) return; const f = resolveFile(b, Number(m.root), m.rel); if (f) try { await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(f)); } catch {} return; }
    if (m.type === 'saveLayout') { const l = { ...(context.globalState.get('council.layout') || {}) }; const p = m.pos || {}; if ([p.x, p.y, p.z].every(Number.isFinite)) l[String(m.id)] = { x: p.x, y: p.y, z: p.z }; await context.globalState.update('council.layout', l); post(); return; }
    if (m.type === 'resetLayout') { await context.globalState.update('council.layout', {}); post(); return; }
    if (m.type === 'revealFolder') { const d = folderDirs.get(String(m.id || '')); if (d && d[0]) try { await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(d[0])); } catch {} return; }
    if (m.type === 'openLearning') { try { const f = path.join(root(), 'learnings', `${path.basename(String(m.key))}.md`); await vscode.window.showTextDocument(vscode.Uri.file(f)); } catch {} }
    if (m.type === 'areaFilter') { areaFilter = ['alle', 'staex', 'privat'].includes(m.value) ? m.value : 'alle'; post(); return; }
    if (m.type === 'revealPrivate') { revealed = !!m.on; post(); return; }
    if (m.type === 'toggleFavorite') { const p = String(m.path || ''); const f = favorites(); const has = f.some(x => normalize(x) === normalize(p)); await context.globalState.update('council.favorites', has ? f.filter(x => normalize(x) !== normalize(p)) : [...f, p]); post(); return; }
    if (m.type === 'openFolder') { const p = String(m.path || ''); if (p && fs.existsSync(p)) await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(p), { forceNewWindow: true }); else vscode.window.showWarningMessage('Ordner nicht gefunden: ' + p); return; }
    if (m.type === 'pickFolder') { const r = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false, openLabel: 'In neuem Fenster öffnen' }); if (r && r[0]) await vscode.commands.executeCommand('vscode.openFolder', r[0], { forceNewWindow: true }); return; }
    if (m.type === 'select') { selectedSession = m.sessionId && m.sessionId !== '*' ? String(m.sessionId) : null; post(); return; }
    if (m.type === 'gotoTab') {
      // Council titles carry an area icon (e.g. "🏢 ") and maybe " · 12:41"; VS Code tab labels do not.
      const title = String(m.title || '').replace(/^[^\p{L}\p{N}]+\s/u, '').replace(/ · \d{1,2}:\d{2}$/, ''), prefix = title.slice(0, 25); let found = null;
      outer: for (const group of vscode.window.tabGroups.all) for (let i = 0; i < group.tabs.length; i++) { const tab = group.tabs[i]; if (tab.label === title || tab.label.startsWith(prefix)) { found = { group, i }; break outer; } }
      if (!found) { vscode.window.showInformationMessage(`Tab nicht gefunden: ${title}`); return; }
      const groupIndex = vscode.window.tabGroups.all.indexOf(found.group) + 1;
      await vscode.commands.executeCommand('workbench.action.focusFirstEditorGroup');
      for (let i = 1; i < groupIndex; i++) await vscode.commands.executeCommand(`workbench.action.focus${['First','Second','Third','Fourth','Fifth','Sixth','Seventh','Eighth','Ninth'][i]}EditorGroup`);
      await vscode.commands.executeCommand('workbench.action.openEditorAtIndex', found.i + 1);
    }
  }); }
  function setup(webview, owner) { webview.options = { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.file(mediaPath)] }; webview.html = html(webview); handler(webview, owner); refreshAux(); scanToday(true); }
  const view = { resolveWebviewView(v) { viewWebview = v.webview; setup(v.webview, v); } };
  provider = vscode.window.registerWebviewViewProvider('council.dashboard', view, { webviewOptions: { retainContextWhenHidden: true } }); context.subscriptions.push(provider);
  context.subscriptions.push(vscode.commands.registerCommand('council.open', async () => { await vscode.commands.executeCommand('workbench.view.extension.council'); }));
  // Council as editor panel. where = 'above': top half of the main window, the active chat tab stays below; 'window': own VS Code window.
  async function openPanel(where) {
    if (panel) { panel.reveal(undefined, false); return; }
    panel = vscode.window.createWebviewPanel('council.window', 'Council', vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.file(mediaPath)] });
    setup(panel.webview, panel); panel.onDidDispose(() => { panel = undefined; });
    const move = { window: 'workbench.action.moveEditorToNewWindow', above: 'workbench.action.moveEditorToAboveGroup', right: 'workbench.action.moveEditorToRightGroup' }[where];
    try { await vscode.commands.executeCommand(move); } catch {}
    if (where !== 'window') { try { await vscode.commands.executeCommand('workbench.action.evenEditorWidths'); } catch {} } // council and chat get equal height
  }
  context.subscriptions.push(vscode.commands.registerCommand('council.openAbove', () => openPanel('above')));
  context.subscriptions.push(vscode.commands.registerCommand('council.openRight', () => openPanel('right')));
  context.subscriptions.push(vscode.commands.registerCommand('council.openWindow', () => openPanel('window')));
  try { fs.mkdirSync(path.join(root(), 'tische'), { recursive: true }); } catch {}
  watch(logRoot(), () => scanToday()); watch(path.join(root(), 'learnings'), loadAux); watch(path.join(root(), 'notes'), loadAux); watch(path.join(root(), 'bereiche'), loadAux); watch(path.join(root(), 'profile'), loadAux); watch(path.join(root(), 'tische'), () => post());
  timers.push(setInterval(() => { if (!openTisch) return; try { const t = readTisch(openTisch.dir), sig = t.eintraege.length + ':' + t.tokensGesamt; if (sig !== openTisch.sig) { openTisch.sig = sig; openTisch.webview.postMessage({ type: 'tischDetail', tisch: { id: openTisch.id, ...t } }); } } catch {} }, 2000));
  function watch(dir, cb) { try { const w = fs.watch(dir, { persistent: false }, () => cb()); disposables.push({ dispose: () => w.close() }); } catch {} }
  timers.push(setInterval(() => scanToday(), 1000)); context.subscriptions.push({ dispose() { deactivate(); } });
  lumaWatch(); timers.push(setInterval(lumaWatch, 3600000));
}
// Luma-Event-Suche (tools/luma, ohne KI-Modell): höchstens einmal pro 20 h, mit dem Node aus VS Code
function lumaWatch() {
  const script = path.join(root(), 'tools', 'luma', 'luma-watch.mjs');
  let last = 0; try { last = Date.parse(fs.readFileSync(path.join(root(), 'events', 'last-run.txt'), 'utf8')) || 0; } catch {}
  if (!fs.existsSync(script) || Date.now() - last < 20 * 3600000) return;
  try { spawn(process.execPath, [script], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true, stdio: 'ignore' }).on('error', () => {}); } catch {}
}
function html(webview) {
  const nonce = crypto.randomBytes(18).toString('base64'), media = vscode.Uri.file(path.join(__dirname, 'media'));
  const src = f => webview.asWebviewUri(vscode.Uri.joinPath(media, f));
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}' ${webview.cspSource}"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${src('app.css')}"><title>Council</title></head><body data-media="${webview.asWebviewUri(media)}"><div id="app"></div><script nonce="${nonce}" src="${src('logos.js')}"></script><script type="module" nonce="${nonce}" src="${src('three-loader.js')}"></script><script nonce="${nonce}" src="${src('graph.js')}"></script><script nonce="${nonce}" src="${src('history.js')}"></script><script nonce="${nonce}" src="${src('tische.js')}"></script><script nonce="${nonce}" src="${src('app.js')}"></script></body></html>`;
}
// Claude-CLI: Einstellung council.claudeBin, sonst ~/.local/bin/claude.exe, sonst die Datei der Claude-Code-Erweiterung, sonst PATH
function claudeBin() {
  const set = vscode.workspace.getConfiguration('council').get('claudeBin');
  if (set && fs.existsSync(set)) return set;
  const local = path.join(os.homedir(), '.local', 'bin', process.platform === 'win32' ? 'claude.exe' : 'claude');
  if (fs.existsSync(local)) return local;
  try {
    const ext = path.join(os.homedir(), '.vscode', 'extensions');
    const dirs = fs.readdirSync(ext).filter(d => d.startsWith('anthropic.claude-code-')).sort().reverse();
    for (const d of dirs) { const b = path.join(ext, d, 'resources', 'native-binary', process.platform === 'win32' ? 'claude.exe' : 'claude'); if (fs.existsSync(b)) return b; }
  } catch {}
  return 'claude';
}
function deactivate() { clearTimeout(debounceTimer); for (const t of timers) { clearTimeout(t); clearInterval(t); } timers = []; for (const d of disposables) try { d.dispose(); } catch {} disposables = []; }
module.exports = { activate, deactivate };
