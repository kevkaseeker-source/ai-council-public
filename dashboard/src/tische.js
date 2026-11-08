'use strict';
const fs = require('fs');
const path = require('path');
const ARTEN = new Set(['frage', 'antwort', 'beitrag', 'kritik', 'synthese', 'eingriff', 'variante']);
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
function readTisch(dir) {
  const meta = readJson(path.join(dir, 'tisch.json'));
  if (!meta) return { erreichbar: false, meta: null, eintraege: [], tokensProSitz: {}, tokensProRunde: {}, tokensGesamt: 0 };
  let lines = [];
  try { lines = fs.readFileSync(path.join(dir, 'eintraege.jsonl'), 'utf8').split(/\r?\n/); } catch {}
  const eintraege = [];
  for (const line of lines) { try { const e = JSON.parse(line); if (e && ARTEN.has(e.art) && typeof e.von === 'string') eintraege.push(e); } catch {} }
  const tokensProSitz = {}, tokensProRunde = {}; let tokensGesamt = 0;
  for (const e of eintraege) {
    const t = num(e.tokens); if (!t) continue;
    tokensProSitz[e.von] = (tokensProSitz[e.von] || 0) + t;
    tokensProRunde[e.runde] = (tokensProRunde[e.runde] || 0) + t;
    tokensGesamt += t;
  }
  return { erreichbar: true, meta, eintraege, tokensProSitz, tokensProRunde, tokensGesamt };
}
function registry(root) {
  let names = [];
  try { names = fs.readdirSync(path.join(root, 'tische')).filter(n => n.endsWith('.json')); } catch { return []; }
  return names.map(n => ({ id: n.slice(0, -5), pfad: readJson(path.join(root, 'tische', n))?.pfad })).filter(r => typeof r.pfad === 'string' && r.pfad);
}
function tischPfad(root, id) {
  if (typeof id !== 'string' || path.basename(id) !== id || !/^[A-Za-z0-9._-]+$/.test(id)) return null;
  return registry(root).find(r => r.id === id)?.pfad || null;
}
function listTische(root) {
  return registry(root).map(r => {
    const t = readTisch(r.pfad), m = t.meta || {};
    return { id: r.id, titel: String(m.titel || r.id), datum: String(m.datum || ''), blasen: Array.isArray(m.blasen) ? m.blasen.map(String) : [],
      vertraulich: m.vertraulich === true, sitze: Array.isArray(m.sitze) ? m.sitze.length : 0, tokensGesamt: t.tokensGesamt, erreichbar: t.erreichbar, pfad: r.pfad };
  }).sort((a, b) => b.datum.localeCompare(a.datum) || a.id.localeCompare(b.id));
}
module.exports = { readTisch, listTische, tischPfad };
