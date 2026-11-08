'use strict';
function chatAgentFor(bereich, profile = {}) {
  if (bereich.extern === false) return 'claude';
  if (bereich.chat) return bereich.chat;
  const workers = Object.entries(profile.rollen || {});
  const textWorker = workers.find(([role]) => role === 'texte-entwerfen')?.[1];
  if (textWorker === 'grok-4.7') return 'grok-4.7';
  const counts = new Map();
  for (const [, worker] of workers) if (['grok-4.7', 'grok-4.7-build-fast', 'codex'].includes(worker)) counts.set(worker, (counts.get(worker) || 0) + 1);
  const winner = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  return winner === 'grok-4.7' || winner === 'grok-4.7-build-fast' ? 'grok-4.7' : 'claude';
}
const CHAT_AGENTS = ['claude', 'grok-4.7', 'codex'];
function chatOptions(bereich = {}, profile = {}) {
  if (bereich.status === 'pause') return [];
  const base = bereich.extern === false ? ['claude'] : CHAT_AGENTS;
  return Array.isArray(bereich.chatOptions) ? base.filter(x => bereich.chatOptions.includes(x)) : base.slice();
}
function allowedAgent(bereich, profile, agent) { return chatOptions(bereich, profile).includes(agent); }
function parseHandoffs(text, options = CHAT_AGENTS) {
  const allowed = new Set(options), out = [];
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/^\s*@(claude|grok|grok-4\.7|codex):\s*(.*?)\s*$/i); if (!m) continue;
    const agent = /^grok/i.test(m[1]) ? 'grok-4.7' : m[1].toLowerCase(), auftrag = m[2].trim();
    if (allowed.has(agent) && auftrag && auftrag.length <= 2000) out.push({ agent, auftrag });
  }
  return out;
}
function buildPrompt({ bereich, kontext = [], verlauf = [], text = '', agent = 'claude', options = CHAT_AGENTS, team = [] }) {
  const history = verlauf.slice(-(verlauf.some(m => m.von) ? 20 : 6)).map(m => `${m.von ? ({ kevin: 'Kevin', claude: 'Claude', codex: 'Codex', 'grok-4.7': 'Grok 4.7' }[m.von] || m.von) : m.role === 'assistant' ? 'Agent' : 'Nutzer'}: ${m.text}`).join('\n');
  const files = kontext.map(f => `--- ${f.path} ---\n${f.text}`).join('\n\n');
  const name = agent === 'grok-4.7' ? 'Grok 4.7' : agent[0].toUpperCase() + agent.slice(1);
  return `Du bist ${name} im Council des Bereichs ${bereich.label}. Team: ${team.join(', ') || 'Claude, Grok 4.7, Codex'}. Wenn ein anderes Teammitglied eine Teilaufgabe besser kann, schreibe eine eigene Zeile \`@<agent>: <Auftrag>\` (agent ∈ chatOptions: ${options.join(', ')}). Antworte knapp und arbeite nur im Lese-/Plan-Modus.\n\nÖffentlicher Kontext:\n${files}\n\nVerlauf:\n${history}\n\nNutzer: ${text}\nAgent:`;
}
function textFromJsonl(lines) {
  return String(lines).split(/\r?\n/).flatMap(line => { try { const j = JSON.parse(line); if (j.type === 'text' && typeof j.data === 'string') return [j.data]; if (j.type === 'item.completed' && j.item?.type === 'agent_message') return [j.item.text || '']; return []; } catch { return []; } }).join('');
}
module.exports = { chatAgentFor, chatOptions, allowedAgent, parseHandoffs, buildPrompt, textFromJsonl };
