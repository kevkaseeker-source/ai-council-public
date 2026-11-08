'use strict';
const { classify, normalize } = require('./areas');
const { chatAgentFor, chatOptions } = require('./chat');

const isPrivatePath = p => { const id = classify(p).id; return id === 'kevin' || id === 'privat'; };

// Figur je Agent: Familie bestimmt Logo/Farbe, Variante Größe und Extras
const AGENTS = {
  sonnet: { label: 'Sonnet', family: 'claude', variant: 'sonnet' },
  haiku: { label: 'Haiku', family: 'claude', variant: 'haiku' },
  browser: { label: 'Browser', family: 'claude', variant: 'browser' },
  codex: { label: 'Codex', family: 'openai', variant: 'codex' },
  'grok-4.7': { label: 'Grok 4.7', family: 'grok', variant: 'grok' },
  'grok-4.7-build-fast': { label: 'Grok build-fast', family: 'grok', variant: 'grok-fast' },
};
const ROLE_NAME = { 'grok-image': 'grok-4.7' };
const OPUS = { label: 'Opus', family: 'claude', variant: 'opus' };
// Bereichsfarbe: Feld farbe in bereiche/*.json, sonst aus dieser Reihe
const PALETTE = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#14b8a6', '#ef4444'];

function buildUniverse({ bereiche = [], profile = [], learnings = [], agents = {}, agentCwd = {}, agentUrl = {}, flows = [], ordner = {}, opusInstances = [], git = null, syncByProfile = {}, tische = [], windowArea = { id: 'unbekannt' }, revealed = false, now = new Date() }) {
  const nodes = [], links = [], seen = new Set();
  const add = n => { if (!seen.has(n.id)) { seen.add(n.id); nodes.push({ paused: false, active: false, isNew: false, detail: null, ...n }); } };
  const hide = windowArea.id === 'staex' && !revealed;
  const byProfil = new Map(profile.map(p => [p.id, p]));
  const visible = [], hidden = [];
  for (const b of bereiche) (hide && (!Array.isArray(b.pfade) || b.pfade.some(isPrivatePath)) ? hidden : visible).push(b);

  // Bereich eines Arbeitsordners: längster passender Pfad über alle Bereiche
  const areaOf = cwd => {
    if (!cwd) return null;
    const c = normalize(cwd); let best = null, len = -1;
    for (const b of bereiche) for (const p of b.pfade || []) { const n = normalize(p); if (n && (c === n || c.startsWith(n + '/')) && n.length > len) { best = b; len = n.length; } }
    if (!best) return null;
    return hidden.includes(best) ? 'privat' : `b:${best.id}`;
  };
  const rollenOf = name => visible.filter(b => b.status !== 'pause').map(b => {
    const p = byProfil.get(b.profil); if (!p) return null;
    const external = AGENTS[name] && AGENTS[name].family !== 'claude';
    if (external && b.extern === false) return null;
    const r = Object.entries(p.rollen).filter(([, w]) => (ROLE_NAME[w] || w) === name).map(([k]) => k);
    return r.length ? { bereich: b.label, rollen: r } : null;
  }).filter(Boolean);
  const agentNode = (id, name, info, size) => {
    const card = agents[name] || { status: 'wartet', activity: null };
    const task = card.status === 'arbeitet' ? areaOf(agentCwd[name]) : null;
    add({ id, kind: id === 'council' ? 'council' : 'agent', label: info.label, group: 'council', size, family: info.family, variant: info.variant,
      status: card.status || 'wartet', active: card.status === 'arbeitet', activity: task === 'privat' ? null : (card.activity || null), ...(task && task !== 'privat' && /^https?:\/\//i.test(agentUrl[name] || '') ? { url: agentUrl[name] } : {}),
      detail: { rollen: rollenOf(name) } });
    return task;
  };

  const core = agents.opus || {};
  add({ id: 'council', kind: 'kern', label: 'Council-Repo', group: 'council', size: 14, family: 'openai', variant: 'kern', status: 'bereit', detail: { git } });
  if (tische.length) { add({ id: 'tisch', kind: 'tisch', label: 'Runder Tisch', group: 'tisch', color: '#e3b341', size: 7, status: 'bereit', detail: { anzahl: tische.length, letzte: tische[0].titel } }); links.push({ source: 'tisch', target: 'council', kind: 'bereich' });
    for (const t of tische) { add({ id: `t:${t.id}`, kind: 'tischsitzung', label: `${t.vertraulich ? '🔒 ' : ''}${t.titel}`.slice(0, 48), group: 'tisch', color: '#e3b341', size: 3, detail: { id: t.id, datum: t.datum, sitze: t.sitze, tokens: t.tokensGesamt } }); links.push({ source: `t:${t.id}`, target: 'tisch', kind: 'member' }); } }
  const taskLinks = [];
  if (!opusInstances.length) {
    add({ id: 'a:opus', kind: 'agent', label: OPUS.label, group: 'council', size: 10, family: OPUS.family, variant: OPUS.variant, status: core.status || 'wartet', active: core.status === 'arbeitet', activity: core.activity || null, detail: { rollen: rollenOf('opus') } });
    links.push({ source: 'a:opus', target: 'council', kind: 'team' });
    const legacyTask = core.status === 'arbeitet' ? areaOf(agentCwd.opus) : null;
    if (legacyTask) taskLinks.push({ source: 'a:opus', target: legacyTask, kind: 'task', agent: 'opus' });
  }
  for (const [index, instance] of opusInstances.entries()) {
    const task = instance.hidden ? null : areaOf(instance.cwd);
    const area = task && task !== 'privat' ? bereiche.find(b => `b:${b.id}` === task) : null;
    const folder = !area && task && task !== 'privat' && instance.cwd ? instance.cwd.replace(/\\/g, '/').split('/').filter(Boolean).pop() : null;
    const id = `o:${instance.session}`;
    add({ id, kind: 'agent', label: instance.hidden ? '🔒 Privat' : `Opus #${index + 1} · ${area?.label || folder || 'Council'}`, group: 'council', size: 10, family: 'claude', variant: 'opus', status: instance.status || 'wartet', active: instance.status === 'arbeitet', activity: instance.hidden ? null : instance.activity, detail: { session: instance.hidden ? null : instance.session } });
    links.push({ source: id, target: 'council', kind: 'team' });
    if (task && task !== 'privat') taskLinks.push({ source: id, target: task, kind: 'task', agent: 'opus' });
  }
  for (const name of Object.keys(AGENTS)) {
    if (!agents[name]) continue;
    const id = `a:${name}`;
    const small = AGENTS[name].variant === 'haiku' || AGENTS[name].variant === 'browser';
    const task = agentNode(id, name, AGENTS[name], small ? 4 : 6);
    links.push({ source: id, target: 'council', kind: 'team' });
    if (task) taskLinks.push({ source: id, target: task, kind: 'task', agent: name });
  }

  if (hidden.length) { add({ id: 'privat', kind: 'privat', label: '🔒 Privat', group: 'privat', color: '#8a8fa8', size: 6 }); links.push({ source: 'privat', target: 'council', kind: 'bereich' }); }
  const colorOf = {};
  bereiche.forEach((b, k) => { colorOf[b.id] = /^#[0-9a-f]{6}$/i.test(b.farbe || '') ? b.farbe : PALETTE[k % PALETTE.length]; });
  const working = {}; for (const t of taskLinks) working[t.agent] = t.target;
  for (const b of visible) {
    const paused = b.status === 'pause', color = paused ? '#555a70' : colorOf[b.id];
    const profile = byProfil.get(b.profil);
    const options = chatOptions(b, profile), proposed = chatAgentFor(b, profile), standard = options.includes(proposed) ? proposed : options[0] || null;
    add({ id: `b:${b.id}`, kind: 'bereich', label: b.label, group: b.id, color, size: 8, paused, detail: { profil: b.profil, extern: b.extern, ziele: b.ziele, chatAgent: standard, chatEnabled: options.length > 0, chat: { standard, options } } });
    links.push({ source: `b:${b.id}`, target: 'council', kind: 'bereich' });
    const count = Number(syncByProfile[b.profil]) || 0;
    if (count > 0) links.push({ source: 'council', target: `b:${b.id}`, kind: 'sync', label: `${count} neue Erkenntnisse` });
    for (const [i, w] of (paused ? [] : b.werkzeuge || []).entries()) {
      let host = ''; try { host = new URL(w.url).host; } catch {}
      if (!/^https:\/\//i.test(w.url || '') || !host) continue;
      const slug = String(w.name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || String(i);
      add({ id: `w:${b.id}:${slug}`, kind: 'werkzeug', label: w.name, url: w.url, group: b.id, color, size: 3 });
      links.push({ source: `w:${b.id}:${slug}`, target: `b:${b.id}`, kind: 'werkzeug' });
    }
    // Team des Bereichs laut Profil (externe Worker nicht in extern:false-Bereichen)
    const p = byProfil.get(b.profil); if (!p || paused) continue;
    const team = new Map();
    for (const [rolle, w] of Object.entries(p.rollen)) { const name = ROLE_NAME[w] || w; if (b.extern === false && AGENTS[name] && AGENTS[name].family !== 'claude') continue; if (name !== 'opus' && !AGENTS[name]) continue; team.set(name, [...(team.get(name) || []), rolle]); }
    for (const [name, rollen] of team) {
      const info = name === 'opus' ? OPUS : AGENTS[name], here = working[name] === `b:${b.id}`, card = agents[name] || {};
      add({ id: `t:${b.id}:${name}`, kind: 'member', label: info.label, group: b.id, color, size: 3, family: info.family, variant: info.variant,
        status: here ? 'arbeitet' : 'bereit', active: here, activity: here ? (card.activity || null) : null, detail: { bereich: b.label, rollen, description: `Zuständigkeit, kein eigener Agent. Wird aktiv, wenn ${info.label} für diesen Bereich arbeitet.` } });
      links.push({ source: `t:${b.id}:${name}`, target: `b:${b.id}`, kind: 'member' });
    }
  }
  // Aufgaben-Strahl endet bei der Team-Figur im Bereich, Farbe = Bereichsfarbe
  for (const t of taskLinks) {
    const area = t.target.startsWith('b:') ? t.target.slice(2) : null;
    if (area && seen.has(`t:${area}:${t.agent}`)) t.target = `t:${area}:${t.agent}`;
    t.color = area ? colorOf[area] : '#8a8fa8';
  }
  // Browser-Aufgabe endet am passenden Werkzeug im sichtbaren Zielbereich.
  for (const t of taskLinks) {
    const areaId = t.target.startsWith('b:') ? t.target.slice(2) : (t.target.startsWith('t:') ? t.target.split(':')[1] : null);
    const area = visible.find(b => b.id === areaId);
    const url = agentUrl[t.agent]; if (!area || !url || area.status === 'pause') continue;
    try { const host = new URL(url).host; const tool = nodes.find(n => n.kind === 'werkzeug' && n.group === area.id && new URL(n.url).host === host); if (tool) t.target = tool.id; } catch {}
  }
  // aufgeklappte Ordner (nur unter sichtbaren Bereichen)
  const addFolders = (parentId, parent) => { for (const f of ordner[parentId] || []) {
    add({ id: f.id, kind: 'ordner', label: f.label, group: parent.group, color: parent.color, size: 4, paused: parent.paused, detail: { files: f.files, open: !!ordner[f.id] } });
    links.push({ source: f.id, target: parentId, kind: 'ordner' });
    addFolders(f.id, nodes[nodes.length - 1]);
  } };
  for (const b of visible) addFolders(`b:${b.id}`, nodes.find(n => n.id === `b:${b.id}`));
  links.push(...taskLinks);
  const flowMap = new Map();
  for (const b of visible) for (const use of b.nutzt || []) if (visible.some(x => x.id === use.bereich) && use.bereich !== b.id)
    flowMap.set(`${b.id}>${use.bereich}`, { source: `b:${b.id}`, target: `b:${use.bereich}`, kind: 'fluss', label: use.was || '', active: false, color: colorOf[b.id] });
  for (const f of flows) if (visible.some(x => x.id === f.from) && visible.some(x => x.id === f.to) && f.from !== f.to) {
    const key = `${f.from}>${f.to}`, prior = flowMap.get(key);
    flowMap.set(key, { source: `b:${f.from}`, target: `b:${f.to}`, kind: 'fluss', label: prior?.label || f.label || '', active: true, color: colorOf[f.from] });
  }
  links.push(...flowMap.values());

  for (const l of learnings) {
    const timestamp = Date.parse(`${l.date}T00:00:00Z`);
    const fresh = Number.isFinite(timestamp) && now - timestamp <= 24 * 3600000 && now >= timestamp;
    add({ id: `l:${l.key}`, kind: 'learning', label: l.key, group: l.bereich || 'alle', size: 2 + (l.confidence || 5) / 2, isNew: fresh, detail: { worker: l.worker || null, summary: String(l.body || '').replace(/\s+/g, ' ').trim().slice(0, 220) } });
    const profiles = String(l.bereich || 'alle').split(',').map(x => x.trim()).filter(x => x && x !== 'alle');
    const targets = visible.filter(b => b.status !== 'pause' && profiles.includes(b.profil)).map(b => `b:${b.id}`);
    if (targets.length > 1) nodes[nodes.length - 1].bridge = true;
    for (const target of targets.length ? targets : ['council']) links.push({ source: `l:${l.key}`, target, kind: 'learning' });
  }
  return { nodes, links };
}

module.exports = { buildUniverse };
