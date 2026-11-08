'use strict';
const fs = require('fs');
const path = require('path');
const { normalize } = require('./areas');
const { listFolders } = require('./folders');

const SKIP = new Set(['node_modules', '.git', '__pycache__', '.venv', 'venv', 'dist', 'build']);

// Zuletzt geänderte Dateien bis Tiefe 2 (G: ist langsam: nur auf Klick, begrenzt)
function recentFiles(dirs, { depth = 2, limit = 8, maxScan = 2000 } = {}) {
  const out = []; let scanned = 0;
  const walk = (dir, root, d) => {
    let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (++scanned > maxScan) return;
      if (e.name.startsWith('.') || e.name === 'desktop.ini') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (d < depth && !SKIP.has(e.name)) walk(full, root, d + 1); continue; }
      try { out.push({ root, rel: path.relative(dirs[root], full).split(path.sep).join('/'), mtime: fs.statSync(full).mtimeMs }); } catch {}
    }
  };
  dirs.forEach((dir, i) => walk(dir, i, 1));
  return out.sort((a, b) => b.mtime - a.mtime).slice(0, limit);
}

// Bestand eines Bereichs: Ordner, letzte Dateien, letzte Schritte aus Sitzungen in seinen Pfaden
function buildInventory(bereich, { events = [], sessionCwd = new Map() } = {}) {
  const dirs = (bereich.pfade || []).filter(p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } });
  const inside = cwd => { const c = normalize(cwd); return (bereich.pfade || []).some(p => { const n = normalize(p); return n && (c === n || c.startsWith(n + '/')); }); };
  const activity = events.filter(e => { const cwd = sessionCwd.get(e.session); return cwd && inside(cwd) && e.text; })
    .slice(-8).reverse().map(e => ({ ts: e.ts, agent: e.agent, text: String(e.text).slice(0, 120) }));
  return {
    folders: dirs.flatMap(d => listFolders(d, 30).map(f => ({ name: f.name, files: f.files }))),
    files: recentFiles(dirs),
    activity,
  };
}

// Pfad einer Datei aus der Liste auflösen, nie außerhalb des Bereichs
function resolveFile(bereich, root, rel) {
  const dir = (bereich.pfade || [])[root]; if (!dir || !rel) return null;
  const abs = path.resolve(dir, String(rel));
  const base = path.resolve(dir);
  return abs === base || !abs.startsWith(base + path.sep) ? null : abs;
}

module.exports = { recentFiles, buildInventory, resolveFile };
