'use strict';

function opusInstances(events, { now = new Date(), windowMin = 30, sessionCwd = {}, hiddenIds = new Set() } = {}) {
  const bySession = new Map();
  for (const e of events || []) {
    if (e.agent !== 'opus' || !e.session || !Number.isFinite(Date.parse(e.ts))) continue;
    const old = bySession.get(e.session);
    if (!old || Date.parse(e.ts) >= Date.parse(old.ts)) bySession.set(e.session, e);
  }
  const rows = [...bySession.entries()].map(([session, e]) => {
    const hidden = hiddenIds.has(session), status = ({ start: 'arbeitet', step: 'arbeitet', thinking: 'arbeitet', result: 'arbeitet', end: 'fertig', error: 'fehler' })[e.type] || 'wartet';
    const cwd = sessionCwd instanceof Map ? sessionCwd.get(session) : sessionCwd[session];
    return { session, status, activity: hidden ? null : (e.text || null), cwd: hidden ? null : (cwd || null), hidden, ts: e.ts };
  }).sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
  let selected = rows.filter(x => now.getTime() - Date.parse(x.ts) <= windowMin * 60000 && now.getTime() >= Date.parse(x.ts));
  if (!selected.length && rows.length) selected = [rows[0]];
  return selected.map(({ ts, ...row }) => row);
}

module.exports = { opusInstances };
