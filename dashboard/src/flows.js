'use strict';
const { normalize } = require('./areas');

function detectFlows({ bereiche = [], events = [], sessionCwd = new Map(), now = new Date(), windowMin = 30 } = {}) {
  const pathOf = p => {
    if (!p) return null;
    const n = normalize(p); let best = null;
    for (const b of bereiche) for (const root of b.pfade || []) {
      const r = normalize(root);
      if (r && (n === r || n.startsWith(r + '/')) && (!best || r.length > best.root.length)) best = { id: b.id, root: r };
    }
    return best?.id || null;
  };
  const pairs = new Set(), cutoff = now.getTime() - windowMin * 60000;
  for (const e of events) {
    const ts = Date.parse(e.ts), from = pathOf(sessionCwd.get(e.session)), to = pathOf(e.detail?.target);
    if (Number.isFinite(ts) && ts >= cutoff && ts <= now.getTime() && from && to && from !== to) pairs.add(`${from}>${to}`);
  }
  return [...pairs].map(pair => { const [from, to] = pair.split('>'); return { from, to, active: true }; });
}
module.exports = { detectFlows };
