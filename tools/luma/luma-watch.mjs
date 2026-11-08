// Sucht täglich auf Luma nach Events in Berlin (und Umgebung) zu Anthropic/OpenAI/Hermes, Blockchain und KI-Agenten.
// Kein KI-Modell: liest nur die öffentlichen Luma-Daten. Ergebnis: events/luma-berlin.md + neue Treffer im Bereich "events".
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BERLIN = { lat: 52.52, lon: 13.405 };
const RADIUS_KM = 60;
const API = 'https://api.lu.ma';
const SOURCES = [
  { name: 'Berlin', url: `${API}/discover/get-paginated-events?discover_place_api_id=discplace-gCfX0s3E9Hgo3rG` },
  ...['ai', 'crypto', 'tech'].map(c => ({ name: c, url: `${API}/discover/get-paginated-events?discover_category_api_id=cat-${c}&latitude=${BERLIN.lat}&longitude=${BERLIN.lon}` })),
  { name: 'Claude Community', url: `${API}/calendar/get-items?calendar_api_id=cal-TOpA5LAFfuDeFpu&period=future` }
];
// Stufe 1 = Anthropic/OpenAI/Hermes oder Credits, 2 = Blockchain, 3 = KI-Builder-Themen.
export const TIERS = [
  { tier: 1, label: 'Anthropic / OpenAI / Hermes', words: ['claude', 'anthropic', 'openai', 'codex', 'chatgpt', 'hermes', 'nous research', 'api credits', 'credits'] },
  { tier: 2, label: 'Blockchain', words: ['solana', 'superteam', 'blockchain', 'web3', 'crypto', 'depin', 'ethereum', 'defi', 'peaq', 'onchain', 'on-chain', 'stablecoin'] },
  { tier: 3, label: 'KI-Agenten & Robotik', words: ['agent', 'agents', 'agentic', 'llm', 'mcp', 'hackathon', 'robotics', 'robot', 'gpt', 'vibe coding'] }
];

const km = (a, b) => {
  const r = x => x * Math.PI / 180, dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

export function classify(entry) {
  const text = [entry.event?.name, entry.calendar?.name, ...(entry.hosts || []).map(h => h.name)].join(' ').toLowerCase();
  for (const t of TIERS) {
    const hit = t.words.find(w => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(text));
    if (hit) return { tier: t.tier, label: t.label, hit };
  }
  return null;
}

export function nearBerlin(event) {
  const c = event?.coordinate;
  if (c && Number.isFinite(c.latitude)) return km(BERLIN, { lat: c.latitude, lon: c.longitude }) <= RADIUS_KM;
  return /berlin|potsdam/i.test(event?.geo_address_info?.city || '');
}

async function fetchAll(source, pages = 5) {
  const out = [];
  let cursor = '';
  for (let i = 0; i < pages; i++) {
    const res = await fetch(`${source.url}&pagination_limit=50${cursor ? `&pagination_cursor=${encodeURIComponent(cursor)}` : ''}`, { headers: { 'User-Agent': 'Mozilla/5.0 council-luma-watch' } });
    if (!res.ok) throw new Error(`${source.name}: HTTP ${res.status}`);
    const json = await res.json();
    out.push(...(json.entries || []));
    if (!json.has_more || !json.next_cursor) break;
    cursor = json.next_cursor;
  }
  return out;
}

export function pick(entries, now = new Date()) {
  const byId = new Map();
  for (const e of entries) {
    const ev = e.event;
    if (!ev?.api_id || byId.has(ev.api_id) || new Date(ev.end_at || ev.start_at) < now || !nearBerlin(ev)) continue;
    const match = classify(e);
    if (!match) continue;
    byId.set(ev.api_id, { id: ev.api_id, name: ev.name, start: ev.start_at, tz: ev.timezone || 'Europe/Berlin',
      place: ev.geo_address_info?.short_address || ev.geo_address_info?.city || '', url: `https://luma.com/${ev.url}`,
      host: e.calendar?.name || (e.hosts || [])[0]?.name || '', ...match });
  }
  return [...byId.values()].sort((a, b) => a.tier - b.tier || a.start.localeCompare(b.start));
}

const when = x => new Date(x.start).toLocaleString('de-DE', { timeZone: x.tz, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const line = x => `- **${when(x)}** · [${x.name.replace(/[[\]]/g, '')}](${x.url}) · ${x.place || 'Ort auf der Seite'} · ${x.host} _(${x.hit})_`;

export function markdown(events, now = new Date()) {
  const parts = [`# Luma-Events Berlin\n\nStand ${now.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} · ${events.length} Treffer · Anmelden macht Kevin selbst.\n`];
  for (const t of TIERS) {
    const list = events.filter(x => x.tier === t.tier).sort((a, b) => a.start.localeCompare(b.start));
    if (list.length) parts.push(`## ${t.label}\n\n${list.map(line).join('\n')}\n`);
  }
  return parts.join('\n');
}

export async function run({ now = new Date() } = {}) {
  const dir = join(ROOT, 'events');
  await mkdir(dir, { recursive: true });
  const entries = [], errors = [];
  for (const s of SOURCES) { try { entries.push(...await fetchAll(s)); } catch (err) { errors.push(err.message); } }
  const events = pick(entries, now);
  let seen = [];
  try { seen = JSON.parse(await readFile(join(dir, 'luma-seen.json'), 'utf8')); } catch {}
  const fresh = events.filter(x => !seen.includes(x.id));
  await writeFile(join(dir, 'luma-berlin.md'), markdown(events, now) + (errors.length ? `\n> Quellen mit Fehler: ${errors.join('; ')}\n` : ''), 'utf8');
  await writeFile(join(dir, 'luma-seen.json'), JSON.stringify([...new Set([...seen, ...events.map(x => x.id)])].slice(-2000)), 'utf8');
  await writeFile(join(dir, 'luma-events.json'), JSON.stringify(events, null, 1), 'utf8');
  await writeFile(join(dir, 'last-run.txt'), now.toISOString(), 'utf8');
  if (fresh.length) {
    const stand = join(ROOT, 'bereiche', 'events.stand.md');
    await appendFile(stand, `\n## ${now.toISOString()}\n${fresh.length} neue Luma-Events:\n${fresh.slice(0, 15).map(line).join('\n')}\n`, 'utf8');
  }
  // Nur bei neuen Anthropic/OpenAI/Hermes-Treffern berät der Event-Tisch (Grok, öffentliche Daten).
  const top = fresh.filter(x => x.tier === 1);
  if (top.length && tischErlaubt) { const { tisch } = await import('./event-tisch.mjs'); await tisch(events, top, { now }); }
  return { total: events.length, fresh: fresh.length, top: top.length, errors };
}
let tischErlaubt = false;

if (process.argv[1] && import.meta.url.toLowerCase() === pathToFileURL(process.argv[1]).href.toLowerCase()) {
  tischErlaubt = !process.argv.includes('--ohne-tisch');
  run().then(r => console.log(`${r.total} Treffer, ${r.fresh} neu${r.errors.length ? `, Fehler: ${r.errors.join('; ')}` : ''}`))
    .catch(err => { console.error(err.message); process.exitCode = 1; });
}
