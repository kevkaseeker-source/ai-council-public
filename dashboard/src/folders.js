'use strict';
const fs = require('fs');
const path = require('path');

const SKIP = new Set(['node_modules', '.git', '__pycache__', '.venv', 'venv', 'dist', 'build', '.superpowers']);

// Unterordner eines Ordners mit Dateizahl; Fehler (fehlt, kein Zugriff) → leere Liste
function listFolders(dir, max = 40) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('.') || SKIP.has(e.name)) continue;
    let files = 0;
    try { files = fs.readdirSync(path.join(dir, e.name), { withFileTypes: true }).filter(x => x.isFile()).length; } catch {}
    out.push({ name: e.name, files, dir: path.join(dir, e.name) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name)).slice(0, max);
}

// Aufgeklappte Knoten → { parentId: [{ id, label, files }] } und id → Ordnerpfade
function expandFolders(bereiche, open, list = listFolders) {
  const ordner = {}, dirs = new Map();
  for (const b of bereiche) dirs.set(`b:${b.id}`, b.pfade || []);
  const walk = id => {
    if (!open.has(id)) return;
    const key = id.replace(/^[bo]:/, '');
    ordner[id] = [];
    for (const d of dirs.get(id) || []) for (const f of list(d)) {
      const cid = `o:${key}/${f.name}`;
      if (dirs.has(cid)) continue;
      dirs.set(cid, [f.dir]); ordner[id].push({ id: cid, label: f.name, files: f.files });
      walk(cid);
    }
  };
  for (const b of bereiche) walk(`b:${b.id}`);
  return { ordner, dirs };
}

module.exports = { listFolders, expandFolders };
