const fs = require('node:fs');
const path = require('node:path');

function readTitle(projectsDir, sessionId) {
  let title = null;
  let dirs;
  try { dirs = fs.readdirSync(projectsDir, { withFileTypes: true }); } catch { return null; }
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const file = path.join(projectsDir, dir.name, `${sessionId}.jsonl`);
    let lines;
    try { lines = fs.readFileSync(file, 'utf8').split(/\r?\n/); } catch { continue; }
    let firstPrompt = null;
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (event && event.type === 'ai-title' && typeof event.aiTitle === 'string') title = event.aiTitle;
        if (!firstPrompt && event && event.type === 'user' && typeof event.message?.content === 'string' && !event.isSidechain) firstPrompt = event.message.content.replace(/\s+/g, ' ').trim().slice(0, 40);
      } catch { /* Ignore malformed lines. */ }
    }
    // Fallback while Claude has not named the chat yet: beginning of the first message.
    if (!title && firstPrompt) title = firstPrompt;
  }
  return title;
}

function listSessions(events, now, titleOf = () => null) {
  const latest = new Map();
  for (const event of events) {
    if (event.session == null) continue;
    const old = latest.get(event.session);
    if (!old || Date.parse(event.ts) > Date.parse(old.ts)) latest.set(event.session, event);
  }
  const time = now instanceof Date ? now.getTime() : Date.parse(now);
  return [...latest].filter(([, e]) => time - Date.parse(e.ts) <= 7200000)
    .map(([sessionId, event]) => ({ sessionId, title: titleOf(sessionId) ?? sessionId.slice(0, 8),
      active: time - Date.parse(event.ts) <= 300000, lastTs: new Date(event.ts).toISOString() }))
    .sort((a, b) => Date.parse(b.lastTs) - Date.parse(a.lastTs));
}

function assignExternal(events) {
  const external = new Set(['codex', 'grok-4.7', 'grok-4.7-build-fast']);
  const result = new Map();
  for (const start of events.filter(e => e.type === 'start' && external.has(e.agent))) {
    const time = Date.parse(start.ts);
    const call = events.filter(e => e.agent === 'opus' && e.session != null &&
      String(e.detail?.target || '').includes('council-run') && time - Date.parse(e.ts) >= 0 && time - Date.parse(e.ts) <= 10000)
      .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))[0];
    result.set(start.run, call ? call.session : null);
  }
  return result;
}

module.exports = { readTitle, listSessions, assignExternal };
