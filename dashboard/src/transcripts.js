const fs = require('node:fs');
const path = require('node:path');

function transcriptPath(projectsDir, sessionId, agentId) {
  try { for (const project of fs.readdirSync(projectsDir)) { const candidate = path.join(projectsDir, project, sessionId, 'subagents', `agent-${agentId}.jsonl`); if (fs.existsSync(candidate)) return candidate; } } catch {}
  return null;
}

function readTranscript(file, maxThoughts = 5) {
  let content; try { content = fs.readFileSync(file, 'utf8'); } catch { return { model: null, thoughts: [], tokens: null }; }
  let model = null, inTokens = 0, outTokens = 0, foundUsage = false; const thoughts = [];
  for (const line of content.split(/\r?\n/)) {
    try {
      const row = JSON.parse(line); if (row.type !== 'assistant' || !row.message) continue;
      const msg = row.message;
      if (model === null && msg.model) { const raw = String(msg.model), lower = raw.toLowerCase(); model = ['haiku', 'sonnet', 'opus'].find(x => lower.includes(x)) || raw; }
      const usage = msg.usage;
      if (usage) { inTokens += Number(usage.input_tokens) || 0; outTokens += Number(usage.output_tokens) || 0; foundUsage = true; }
      for (const block of Array.isArray(msg.content) ? msg.content : []) if (block.type === 'thinking' && typeof block.thinking === 'string' && block.thinking.trim()) thoughts.push(block.thinking.slice(0, 200));
    } catch {}
  }
  return { model, thoughts: thoughts.slice(-Math.max(0, maxThoughts)), tokens: foundUsage ? { in: inTokens, out: outTokens, provider: 'anthropic' } : null };
}
module.exports = { transcriptPath, readTranscript };
