'use strict';
const fs = require('fs');
const path = require('path');

function readJsonDir(dir) {
  let names = [];
  try { names = fs.readdirSync(dir).filter(n => n.endsWith('.json')).sort(); } catch { return []; }
  const out = [];
  for (const n of names) { try { out.push(JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'))); } catch {} }
  return out;
}
const str = (v, d) => (typeof v === 'string' && v ? v : d);
const list = v => (Array.isArray(v) ? v : []);

function loadProfiles(dir) {
  return readJsonDir(dir).filter(p => p && str(p.id)).map(p => ({
    id: p.id, label: str(p.label, p.id), rollen: p.rollen && typeof p.rollen === 'object' ? p.rollen : {}, bausteine: list(p.bausteine).map(String),
  }));
}

function loadBereiche(dir) {
  return readJsonDir(dir).filter(b => b && str(b.id)).map(b => ({
    id: b.id, label: str(b.label, b.id), profil: str(b.profil, null), status: b.status === 'pause' ? 'pause' : 'aktiv',
    extern: b.extern !== false, pfade: list(b.pfade).map(String),
    ...(typeof b.farbe === 'string' ? { farbe: b.farbe } : {}),
    ziele: list(b.ziele).filter(z => z && str(z.text)).map(z => (z.pruefen ? { text: z.text, pruefen: String(z.pruefen) } : { text: z.text })),
    ...(Array.isArray(b.werkzeuge) ? { werkzeuge: list(b.werkzeuge).filter(w => w && str(w.name) && /^https:\/\//i.test(str(w.url, ''))).map(w => ({ name: w.name, url: w.url })) } : {}),
    ...(Array.isArray(b.nutzt) ? { nutzt: list(b.nutzt).filter(x => x && str(x.bereich)).map(x => ({ bereich: x.bereich, was: str(x.was, '') })) } : {}),
    ...(b.chat === 'grok-4.7' || b.chat === 'claude' ? { chat: b.chat } : {}),
    ...(Array.isArray(b.chatOptions) ? { chatOptions: b.chatOptions.filter(x => ['claude', 'grok-4.7', 'codex'].includes(x)) } : {}),
    ...(Array.isArray(b.chatKontext) ? { chatKontext: list(b.chatKontext).map(String) } : {}),
  }));
}

module.exports = { loadProfiles, loadBereiche };
