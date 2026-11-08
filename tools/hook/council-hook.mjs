import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function newState() { return { pending: [], byId: {} }; }

export function toEvent(payload, now, state) {
  const hook = payload.hook_event_name;
  if (!hook) return null;
  const tool = payload.tool_name ?? null;
  const input = payload.tool_input ?? {};
  if (hook === 'PreToolUse' && tool === 'Agent' && !payload.agent_id)
    state.pending.push(input.model ?? 'other');
  if (hook === 'SubagentStart' && payload.agent_id)
    state.byId[payload.agent_id] = state.pending.shift() ?? 'other';
  const browser = typeof tool === 'string' && tool.startsWith('mcp__claude-in-chrome__');
  // Browser steps belong to the agent that calls them; the dashboard groups by tool.
  let agent = !payload.agent_id ? 'opus' : state.byId[payload.agent_id] ?? 'other';
  if (!['opus', 'haiku', 'sonnet', 'other'].includes(agent)) agent = 'other';
  const suffix = browser ? tool.slice('mcp__claude-in-chrome__'.length) : '';
  let text;
  if (hook === 'SessionStart') text = 'Sitzung startet';
  else if (hook === 'SubagentStart') text = 'Unteragent startet';
  else if (hook === 'SubagentStop' || hook === 'Stop') text = 'fertig';
  else if (browser) text = `Browser: ${suffix}`;
  else if (tool === 'Read') text = `liest ${input.file_path ?? ''}`;
  else if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(tool)) text = `schreibt ${input.file_path ?? ''}`;
  else if (['Bash', 'PowerShell'].includes(tool)) text = `führt aus: ${input.command ?? ''}`;
  else if (['Grep', 'Glob'].includes(tool)) text = `sucht ${input.pattern ?? ''}`;
  else if (tool === 'Agent') text = `delegiert an ${input.model ?? 'other'}: ${input.description ?? ''}`;
  else text = tool ?? 'Ereignis';
  if (hook === 'PostToolUse') text = `fertig: ${text}`;
  text = String(text || 'Ereignis').slice(0, 200);
  const target = input.file_path ?? input.command ?? input.pattern ?? input.url ?? input.description ?? null;
  const type = { SessionStart: 'start', SubagentStart: 'start', PreToolUse: 'step', PostToolUse: 'result', SubagentStop: 'end', Stop: 'end' }[hook] ?? 'step';
  return { ts: now.toISOString(), agent, run: payload.agent_id ?? payload.session_id, type, text,
    detail: { tool, target: target == null ? null : String(target).slice(0, 200) }, tokens: null,
    session: payload.session_id, parent: payload.agent_id ? 'opus' : null };
}

export async function appendEvent(event, logsDir) {
  await mkdir(logsDir, { recursive: true });
  const day = event.ts.slice(0, 10);
  await appendFile(join(logsDir, `events-${day}.jsonl`), JSON.stringify(event) + '\n');
}

if (process.argv[1] && import.meta.url.toLowerCase() === pathToFileURL(process.argv[1]).href.toLowerCase()) {
  (async () => {
    try {
      const script = fileURLToPath(import.meta.url);
      const logsDir = process.env.COUNCIL_LOGS ?? join(dirname(script), '..', '..', 'logs');
      let state = newState();
      try { state = JSON.parse(await readFile(join(logsDir, 'agents-state.json'), 'utf8')); }
      catch { state = newState(); }
      const chunks = [];
      for await (const chunk of process.stdin) chunks.push(chunk);
      const event = toEvent(JSON.parse(Buffer.concat(chunks).toString()), new Date(), state);
      if (event) {
        await appendEvent(event, logsDir);
        await writeFile(join(logsDir, 'agents-state.json'), JSON.stringify(state));
      }
    } catch { /* Hook failures must stay silent. */ }
    process.exitCode = 0;
  })();
}
