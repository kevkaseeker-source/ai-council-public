const known = ['opus', 'haiku', 'sonnet', 'browser', 'codex', 'grok-4.7', 'grok-4.7-build-fast', 'other'];

function parseEventLines(text) {
  const events = []; let skipped = 0;
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (!e || !e.agent || !e.type || !e.ts) { skipped++; continue; }
      events.push(e);
    } catch { skipped++; }
  }
  return { events, skipped };
}

function reduceEvents(events, now) {
  const agents = {};
  for (const name of [...known, ...events.map(e => e.agent)]) if (!agents[name]) agents[name] = { agent: name, status: 'wartet', activity: null, run: null, startedAt: null, durationMs: null, tokens: null, model: null };
  const runs = {};
  for (const e of events) {
    const card = agents[e.agent];
    const id = e.run == null ? '__default' : String(e.run);
    if (card.run !== id) { card.run = id; card.startedAt = e.ts; card.durationMs = null; card.tokens = null; }
    const r = runs[e.agent];
    if (!r || r.id !== id) runs[e.agent] = { id, last: e };
    else runs[e.agent].last = e;
    if (e.type === 'start' && card.startedAt === e.ts) card.startedAt = e.ts;
    card.activity = e.text == null ? null : e.text;
    card.status = ({ start: 'arbeitet', step: 'arbeitet', thinking: 'arbeitet', result: 'arbeitet', end: 'fertig', error: 'fehler' })[e.type] || card.status;
    if (e.type === 'end') { card.durationMs = e.durationMs == null ? null : e.durationMs; card.tokens = e.tokens == null ? null : e.tokens; }
    card.model = null;
  }
  for (const card of Object.values(agents)) if (card.status === 'arbeitet') {
    card.durationMs = Math.max(0, now.getTime() - new Date(card.startedAt).getTime());
    const last = runs[card.agent] && runs[card.agent].last;
    if (last && now.getTime() - new Date(last.ts).getTime() > 30 * 60 * 1000) card.status = 'unbekannt';
  }
  return { agents, log: events.slice(-300) };
}

module.exports = { parseEventLines, reduceEvents };
