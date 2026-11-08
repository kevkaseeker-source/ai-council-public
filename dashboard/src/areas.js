'use strict';

const DEFAULT_AREAS = [
  { id: 'kevin', label: "Kevin's stuff", icon: '🟠', note: 'liegt auf dem Staex-Drive', match: ["kevin's stuff"] },
  { id: 'staex', label: 'Staex', icon: '🏢', match: ['staex all 2026', 'g:/'] },
  { id: 'privat', label: 'Privat', icon: '🔒', match: ['c:/users/'] },
];

function normalize(p) {
  if (p == null) return '';
  return String(p).replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');
}

function classify(path, areas = DEFAULT_AREAS) {
  const normalized = normalize(path);
  return areas.find(area => area.match.some(match => normalized.includes(match))) ||
    { id: 'unbekannt', label: 'Unbekannt', icon: '❔', match: [] };
}

function applyPrivacy(sessions, windowArea, { revealed = false, areaFilter = 'alle', areas = DEFAULT_AREAS } = {}) {
  return sessions.map(session => {
    const area = classify(session.cwd, areas);
    const hidden = windowArea.id === 'staex' && !revealed && (area.id === 'kevin' || area.id === 'privat');
    const result = { ...session, area, hidden };
    if (hidden) {
      result.title = '🔒 Privat';
      result.cwd = null;
    }
    return result;
  }).filter(session => {
    if (areaFilter === 'staex') return session.area.id === 'staex';
    if (areaFilter === 'privat') return session.area.id === 'kevin' || session.area.id === 'privat';
    return true;
  });
}

function folderList({ workspacePath, favorites = [], sessions = [], revealed = false, areas = DEFAULT_AREAS }) {
  const currentArea = workspacePath ? classify(workspacePath, areas) : null;
  const privateHidden = !!currentArea && currentArea.id === 'staex' && !revealed;
  const favoritePaths = favorites.map(p => normalize(p));
  const seen = new Set();
  const recent = [];

  for (const session of sessions) {
    const path = session.cwd;
    if (path == null) continue;
    const key = normalize(path);
    if (key === normalize(workspacePath) || favoritePaths.includes(key) || seen.has(key)) continue;
    seen.add(key);
    const area = classify(path, areas);
    if (privateHidden && (area.id === 'kevin' || area.id === 'privat')) continue;
    recent.push({ path, area, favorite: false });
  }

  return {
    current: workspacePath ? { path: workspacePath, area: currentArea } : null,
    favorites: favorites.map(path => ({ path, area: classify(path, areas), favorite: true })),
    recent,
    privateHidden,
  };
}

module.exports = { DEFAULT_AREAS, normalize, classify, applyPrivacy, folderList };
