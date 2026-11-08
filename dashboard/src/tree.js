const GROUPS = ['Suchen & Lesen', 'Bauen', 'Ausführen', 'Browser', 'Sonstiges'];
const EXTERNAL = ['codex', 'grok-4.7', 'grok-4.7-build-fast'];
const TOOLS = {
  'Suchen & Lesen': new Set(['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch']),
  Bauen: new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']),
  Ausführen: new Set(['Bash', 'PowerShell'])
};
const timeOf = e => Date.parse(e.ts);
const isBrowserTool = tool => String(tool).startsWith('mcp__claude-in-chrome__');
// One run = one worker. Older logs split a run into 'browser'/'other' events; the real model wins.
const RANK = { haiku: 3, sonnet: 3, other: 1, browser: 0 };
const agentOf = run => run.reduce((best, e) => (RANK[e.agent] ?? 2) > (RANK[best] ?? 2) ? e.agent : best, run[0].agent);
const statusOf = type => ({ start: 'arbeitet', step: 'arbeitet', thinking: 'arbeitet', result: 'arbeitet', end: 'fertig', error: 'fehler' })[type] || 'wartet';

function groupOf(toolNames) {
  const counts = GROUPS.map(() => 0);
  for (const tool of toolNames) {
    let group = GROUPS.findIndex(name => TOOLS[name]?.has(tool));
    if (isBrowserTool(tool)) group = GROUPS.indexOf('Browser');
    if (group >= 0) counts[group]++;
  }
  const max = Math.max(...counts);
  return max === 0 ? 'Sonstiges' : GROUPS[counts.indexOf(max)];
}

function card(events, agent, now) {
  if (!events.length) return { agent, status: 'wartet', activity: null, durationMs: null, tokens: null, run: null };
  const last = events[events.length - 1];
  let status = statusOf(last.type);
  if (status === 'arbeitet' && now - timeOf(last) > 1800000) status = 'unbekannt';
  const start = events.find(e => e.type === 'start');
  const end = [...events].reverse().find(e => e.type === 'end');
  return { agent, status, activity: last.text ?? null,
    durationMs: end?.durationMs ?? (end && start ? timeOf(end) - timeOf(start) : start ? now - timeOf(start) : null),
    tokens: end?.tokens ?? null, run: last.run ?? null };
}

function buildTree(events, options) {
  const { session, title, now: date, externalSession = new Map(), windowMs = 7200000 } = options;
  const now = date instanceof Date ? date.getTime() : Date.parse(date);
  const filtered = events.filter(e => session == null || e.session === session ||
    (EXTERNAL.includes(e.agent) && externalSession.get(e.run) === session));
  const opusEvents = filtered.filter(e => e.agent === 'opus').sort((a, b) => timeOf(a) - timeOf(b));
  const lastOpus = opusEvents.at(-1);
  let opusStatus = lastOpus ? statusOf(lastOpus.type) : 'wartet';
  if (opusStatus === 'arbeitet' && now - timeOf(lastOpus) > 1800000) opusStatus = 'unbekannt';
  const sessions = new Set(events.filter(e => e.agent === 'opus' && e.session != null && now - timeOf(e) <= 300000).map(e => e.session));
  const external = EXTERNAL.map(agent => card(filtered.filter(e => e.agent === agent).sort((a, b) => timeOf(a) - timeOf(b)), agent, now));
  // Browser work belongs to the Haiku worker; count Opus doing it itself (old logs: 'browser' events in the session run).
  const sessionIds = new Set(events.filter(e => e.session != null).map(e => String(e.session)));
  const browserSteps = filtered.filter(e => e.type === 'step' && isBrowserTool(e.detail?.tool) && now - timeOf(e) <= windowMs &&
    (e.agent === 'opus' || (e.agent === 'browser' && sessionIds.has(String(e.run))))).length;
  return { opus: { title, sessions: sessions.size, status: opusStatus, activity: lastOpus?.text ?? null, browserSteps }, external,
    groups: buildGroups(filtered, events, session, now, windowMs) };
}

function buildGroups(filtered, allEvents, session, now, windowMs) {
  const runs = new Map();
  const sessionIds = new Set(allEvents.filter(x => x.session != null).map(x => String(x.session)));
  for (const e of filtered) {
    if (EXTERNAL.includes(e.agent) || e.parent !== 'opus' || e.run == null) continue;
    if (sessionIds.has(String(e.run))) continue;
    const key = String(e.run);
    if (!runs.has(key)) runs.set(key, []);
    runs.get(key).push(e);
  }
  const ordered = [...runs.values()].sort((a, b) => timeOf(a.find(e => e.type === 'start') || a[0]) - timeOf(b.find(e => e.type === 'start') || b[0]));
  const counts = new Map();
  const groups = new Map(GROUPS.map(name => [name, { name, members: [], hidden: 0 }]));
  for (const run of ordered) {
    run.sort((a, b) => timeOf(a) - timeOf(b));
    const first = run.find(e => e.type === 'start') || run[0], last = run.at(-1);
    const agent = agentOf(run);
    const n = (counts.get(agent) || 0) + 1;
    counts.set(agent, n);
    const group = groupOf(run.filter(e => e.type === 'step').map(e => e.detail?.tool).filter(Boolean));
    const end = [...run].reverse().find(e => e.type === 'end' || e.type === 'error');
    const running = !end;
    const member = { label: `${agent.charAt(0).toUpperCase()}${agent.slice(1)} #${n}`, agent,
      run: first.run, status: running ? (now - timeOf(last) > 1800000 ? 'unbekannt' : 'arbeitet') : statusOf(end.type),
      activity: last.text ?? null, durationMs: end?.durationMs ?? (end ? timeOf(end) - timeOf(first) : now - timeOf(first)),
      tokens: end?.tokens ?? null, startedAt: first.ts };
    if (!running && now - timeOf(end) > windowMs) groups.get(group).hidden++;
    else groups.get(group).members.push(member);
  }
  return GROUPS.map(name => groups.get(name)).filter(g => g.members.length || g.hidden);
}

module.exports = { GROUPS, groupOf, buildTree };
