function parseLearning(markdown, fileName) {
  const lines = String(markdown).split(/\r?\n/); const first = lines.indexOf('---');
  const end = first < 0 ? -1 : lines.indexOf('---', first + 1); const meta = {};
  if (end > first) for (const line of lines.slice(first + 1, end)) {
    const m = /^([\w-]+):\s*(.*?)\s*$/.exec(line.replace(/\s+#.*$/, ''));
    if (m) meta[m[1]] = m[2];
  }
  const body = end > first ? lines.slice(end + 1).join('\n').trim() : String(markdown).trim();
  return { key: meta.key || String(fileName).replace(/\.md$/i, ''), type: meta.type || null, worker: meta.worker || null, arbeitsfeld: meta.arbeitsfeld || 'allgemein', bereich: meta.bereich || 'alle', confidence: meta.confidence === undefined ? null : Number(meta.confidence), saves: meta.saves || null, date: meta.date || null, body };
}

function buildGraph(learnings) {
  const nodes = [], edges = [], ns = new Set(), es = new Set();
  const node = (id, kind, label) => { if (!ns.has(id)) { ns.add(id); nodes.push({ id, kind, label }); } };
  const edge = (from, to, kind) => { const k = `${from}\0${to}\0${kind}`; if (!es.has(k)) { es.add(k); edges.push({ from, to, kind }); } };
  for (const l of learnings) { node(`l:${l.key}`, 'learning', l.key); node(`f:${l.arbeitsfeld || 'allgemein'}`, 'feld', l.arbeitsfeld || 'allgemein'); edge(`l:${l.key}`, `f:${l.arbeitsfeld || 'allgemein'}`, 'feld');
    if (l.worker && l.worker !== 'any') { node(`w:${l.worker}`, 'worker', l.worker); edge(`l:${l.key}`, `w:${l.worker}`, 'worker'); }
  }
  for (const l of learnings) for (const other of learnings) if (other.key !== l.key && (String(l.body || '').includes(`learnings/${other.key}.md`) || String(l.body || '').includes(`\`${other.key}\``))) edge(`l:${l.key}`, `l:${other.key}`, 'ref');
  return { nodes, edges };
}

function isNew(dateStr, now, hours = 24) { const t = Date.parse(`${dateStr}T00:00:00Z`); return Number.isFinite(t) && t <= now.getTime() && now.getTime() - t <= hours * 3600000; }
function noteFile(target, text, now) { const date = now.toISOString(), day = date.slice(0, 10); const slug = String(target).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40).replace(/-+$/g, ''); return { name: `${day}-${slug}.md`, content: `---\ntarget: ${target}\nstatus: offen\ndate: ${date}\n---\n\n${text}` }; }
function parseNote(markdown, fileName) { const lines = String(markdown).split(/\r?\n/); const a = lines.indexOf('---'), b = a < 0 ? -1 : lines.indexOf('---', a + 1), meta = {}; if (b > a) for (const line of lines.slice(a + 1, b)) { const m = /^([^:]+):\s*(.*)$/.exec(line); if (m) meta[m[1]] = m[2]; } return { name: fileName, target: meta.target || null, status: meta.status || null, date: meta.date || null, text: b > a ? lines.slice(b + 1).join('\n').trim() : String(markdown).trim() }; }
module.exports = { parseLearning, buildGraph, isNew, noteFile, parseNote };
