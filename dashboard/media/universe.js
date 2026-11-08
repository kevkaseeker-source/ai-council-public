(function () {
  'use strict';
  let graph = null, el = null, legend = null, sig = '', structSig = '', fitPending = false, fitTimer = 0, observer = null, asideEl = null, asideClick = null;
  let figures = [], raf = 0, running = false, fitted = false, current = null, helper = null, shiftDown = false;
  const chatThreads = new Map();
  const chatChoices = new Map();
  const COLORS = ['#7c6cff', '#2fb9c4', '#f0a54a', '#4cc27f', '#e5607a', '#c792ea', '#82aaff'];
  const colorOf = (() => { const m = new Map(); return g => { if (g === 'council') return '#ffffff'; if (g === 'privat' || g === 'alle') return '#8a8fa8'; if (!m.has(g)) m.set(g, COLORS[m.size % COLORS.length]); return m.get(g); }; })();
  const encode = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const STATUS_TEXT = { arbeitet: 'arbeitet', fertig: 'fertig', wartet: 'wartet', fehler: 'Fehler', unbekannt: 'keine Meldung seit 30 min' };

  // ---------- Figuren (three.js aus window.THREE, dieselbe Instanz nutzt 3d-force-graph) ----------
  const FAMILY = { claude: { body: '#d97757', disc: '#f5efe6' }, openai: { body: '#e9e9e9', disc: '#ffffff' }, grok: { body: '#9aa0ae', disc: '#000000' } };
  const SCALE = { opus: 1.7, sonnet: 1.25, haiku: 0.9, browser: 0.9, codex: 1.15, grok: 1.15, 'grok-fast': 1.05 };
  const logoCache = new Map();
  function logoTexture(T, family) {
    if (logoCache.has(family)) return logoCache.get(family);
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'), tex = new T.CanvasTexture(c);
    const paint = img => {
      g.clearRect(0, 0, 256, 256);
      g.fillStyle = FAMILY[family].disc; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
      g.lineWidth = 8; g.strokeStyle = FAMILY[family].body; g.stroke();
      if (img) { const s = family === 'grok' ? 200 : 150; g.save(); g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.clip(); g.drawImage(img, 128 - s / 2, 128 - s / 2, s, s); g.restore(); }
      tex.needsUpdate = true;
    };
    paint(null);
    const src = window.CouncilLogos && window.CouncilLogos[family === 'openai' ? 'openai' : family];
    if (src) { const img = new Image(); img.onload = () => paint(img); img.src = src; }
    logoCache.set(family, tex);
    return tex;
  }
  function textSprite(T, text, { size = 28, color = '#ffffff', bg = 'rgba(10,12,24,.72)', height = 3 } = {}) {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = `600 ${size}px system-ui, sans-serif`;
    const w = Math.ceil(g.measureText(text).width) + 24; c.width = w; c.height = size + 18;
    g.font = `600 ${size}px system-ui, sans-serif`;
    if (bg) { g.fillStyle = bg; const r = 10; g.beginPath(); g.moveTo(r, 0); g.arcTo(w, 0, w, c.height, r); g.arcTo(w, c.height, 0, c.height, r); g.arcTo(0, c.height, 0, 0, r); g.arcTo(0, 0, w, 0, r); g.fill(); }
    g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(text, 12, c.height / 2 + 1);
    const tex = new T.CanvasTexture(c); tex.minFilter = T.LinearFilter;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(height * w / c.height, height, 1);
    return sp;
  }
  const short = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '');

  function makeFigure(T, n) {
    const fam = FAMILY[n.family] || FAMILY.claude, member = n.kind === 'member', dim = n.status === 'wartet';
    const mat = color => new T.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.15, transparent: dim || (member && n.status !== 'arbeitet'), opacity: member && n.status !== 'arbeitet' ? 0.45 : dim ? 0.7 : 1 });
    const root = new T.Group(), inner = new T.Group(); root.add(inner);
    const body = new T.Mesh(new T.CapsuleGeometry(2.2, 3.2, 6, 16), mat(fam.body)); inner.add(body);
    for (const side of [-1, 1]) {
      const arm = new T.Mesh(new T.CapsuleGeometry(0.65, 2.6, 4, 10), mat(fam.body));
      arm.position.set(side * 3.1, 0.3, 0); arm.rotation.z = side * 0.35; inner.add(arm);
    }
    const head = new T.Sprite(new T.SpriteMaterial({ map: logoTexture(T, n.family), transparent: true, opacity: member && n.status !== 'arbeitet' ? 0.45 : dim ? 0.75 : 1 }));
    head.scale.set(5.4, 5.4, 1); head.position.y = 6.2; inner.add(head);
    if (n.variant === 'opus') {
      const halo = new T.Mesh(new T.TorusGeometry(4.6, 0.28, 10, 48), new T.MeshBasicMaterial({ color: '#ffd479' }));
      halo.rotation.x = Math.PI / 2; halo.position.y = 9.2; inner.add(halo); root.userData.halo = halo;
    }
    if (n.variant === 'browser') {
      const globe = new T.Mesh(new T.SphereGeometry(1.4, 12, 8), new T.MeshBasicMaterial({ color: '#82aaff', wireframe: true }));
      globe.position.set(4.4, -1.2, 0.6); inner.add(globe); root.userData.globe = globe;
    }
    if (n.variant === 'grok-fast') {
      for (let k = 0; k < 3; k++) { const s = new T.Mesh(new T.BoxGeometry(0.25, 0.25, 4 - k), new T.MeshBasicMaterial({ color: '#9aa0c0' })); s.position.set(-1.2 + k * 1.2, -1.5 + k * 1.1, -3.6); inner.add(s); }
    }
    if (n.status === 'arbeitet' || n.status === 'fertig') {
      const ring = new T.Mesh(new T.TorusGeometry(3.4, 0.22, 8, 40), new T.MeshBasicMaterial({ color: n.status === 'arbeitet' ? '#4cc27f' : '#5aa9ff', transparent: true, opacity: 0.9 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = -4.2; root.add(ring); root.userData.ring = ring;
    }
    const name = textSprite(T, n.kind === 'member' && n.detail ? `${n.label} · ${n.detail.rollen.join(', ')}` : n.label, { size: 30, height: 3.4, bg: 'rgba(10,12,24,.55)', color: dim ? '#9aa0c0' : '#ffffff' });
    name.position.y = -7; root.add(name);
    if (n.status === 'arbeitet' && n.activity) { const act = textSprite(T, short(n.activity, 42), { size: 30, height: 3.6, color: '#c8ffd9' }); act.position.y = 12.4; inner.add(act); }
    if (n.status === 'fertig') { const ok = textSprite(T, '✓', { size: 40, height: 3, color: '#5aa9ff', bg: null }); ok.position.y = 10.8; inner.add(ok); }
    if (n.kind === 'member') {
      const ring = new T.BufferGeometry(), points = [];
      for (let k = 0; k <= 64; k++) { const a = k / 64 * Math.PI * 2; points.push(new T.Vector3(Math.cos(a) * 3, -4.6, Math.sin(a) * 3)); }
      ring.setFromPoints(points);
      const dashed = new T.Line(ring, new T.LineDashedMaterial({ color: n.color || '#9aa0c0', dashSize: 0.65, gapSize: 0.45, transparent: true, opacity: n.status === 'arbeitet' ? 1 : 0.45 }));
      dashed.computeLineDistances(); // gehört zur Linie, nicht zur Geometrie
      root.add(dashed);
    }
    const s = (SCALE[n.variant] || 1) * (n.kind === 'member' ? 0.55 : 1); root.scale.set(s, s, s);
    root.userData.inner = inner; root.userData.active = n.status === 'arbeitet'; root.userData.seed = Math.random() * 6;
    figures.push(root);
    return root;
  }
  function makeArea(T, n) {
    const root = new T.Group();
    const ball = new T.Mesh(new T.SphereGeometry(4.2, 24, 16), new T.MeshStandardMaterial({ color: n.color || colorOf(n.group), roughness: 0.4, emissive: n.paused ? '#000000' : (n.color || colorOf(n.group)), emissiveIntensity: 0.18 }));
    root.add(ball);
    const label = textSprite(T, n.label + (n.paused ? ' (Pause)' : ''), { size: 32, height: 4.2 }); label.position.y = 8; root.add(label);
    return root;
  }
  function makeSitzung(T, n) {
    const root = new T.Group(), color = n.color || '#e3b341';
    root.add(new T.Mesh(new T.SphereGeometry(2.2, 20, 14), new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, roughness: 0.4 })));
    const label = textSprite(T, n.label, { size: 24, height: 2.4 }); label.position.y = 3.6; root.add(label);
    return root;
  }
  function makeFolder(T, n) {
    const root = new T.Group(), color = n.color || colorOf(n.group);
    const box = new T.Mesh(new T.BoxGeometry(3.6, 2.6, 2.6), new T.MeshStandardMaterial({ color, roughness: 0.5, transparent: true, opacity: 0.85, emissive: color, emissiveIntensity: n.detail && n.detail.open ? 0.35 : 0.1 }));
    root.add(box);
    const label = textSprite(T, `${n.label} · ${(n.detail && n.detail.files) || 0}`, { size: 26, height: 2.6 }); label.position.y = 3.6; root.add(label);
    return root;
  }
  function makeTool(T, n) {
    const root = new T.Group(), color = n.color || colorOf(n.group);
    const mesh = new T.Mesh(new T.OctahedronGeometry(2.8, 0), new T.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.35, emissive: color, emissiveIntensity: 0.12 }));
    root.add(mesh);
    const label = textSprite(T, n.label, { size: 26, height: 2.6 }); label.position.y = 4; root.add(label);
    return root;
  }
  function makeCore(T, n) {
    const root = new T.Group(), cube = new T.Mesh(new T.IcosahedronGeometry(5, 0), new T.MeshStandardMaterial({ color: '#b6c7ff', emissive: '#526bff', emissiveIntensity: 0.8, metalness: 0.65, roughness: 0.25 }));
    root.add(cube); const label = textSprite(T, 'Council-Repo', { size: 30, height: 3.4 }); label.position.y = 8; root.add(label);
    const shield = textSprite(T, '◆', { size: 42, height: 3, color: '#ffffff', bg: null }); shield.position.y = -1; root.add(shield); return root;
  }
  // ---------- Zonen: halbdurchsichtige Blase je Bereich und fürs Council ----------
  let zones = new Map();
  function zoneKey(n) { if (n.kind === 'tisch' || n.kind === 'tischsitzung') return 'tisch'; if (n.kind === 'kern' || n.kind === 'council' || n.kind === 'agent') return 'council'; if (n.kind === 'bereich' || n.kind === 'member' || n.kind === 'ordner') return n.group; return null; }
  function buildZones(T, data) {
    for (const z of zones.values()) graph.scene().remove(z.group);
    zones = new Map();
    for (const n of data.nodes) {
      const k = zoneKey(n); if (!k || zones.has(k)) continue;
      const area = data.nodes.find(x => x.id === 'b:' + k) || {};
      const color = k === 'council' ? '#ffffff' : k === 'tisch' ? '#e3b341' : area.color || '#9aa0c0';
      const title = k === 'council' ? 'AI-Council' : k === 'tisch' ? 'Runder Tisch' : area.label || k;
      const group = new T.Group();
      const shell = new T.Mesh(new T.SphereGeometry(1, 40, 24), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.06, depthWrite: false, side: T.DoubleSide }));
      const rim = new T.Mesh(new T.SphereGeometry(1, 24, 14), new T.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.035, depthWrite: false }));
      const label = textSprite(T, title, { size: 44, height: 9, color, bg: 'rgba(10,12,24,.6)' });
      group.add(shell, rim, label); graph.scene().add(group);
      zones.set(k, { group, shell, rim, label });
    }
  }
  function updateZones() {
    if (!graph || !zones.size) return;
    const acc = new Map();
    for (const n of graph.graphData().nodes) {
      const k = zoneKey(n); if (!k || !zones.has(k) || !Number.isFinite(n.x)) continue;
      if (!acc.has(k)) acc.set(k, []); acc.get(k).push(n);
    }
    for (const [k, z] of zones) {
      const pts = acc.get(k); if (!pts) { z.group.visible = false; continue; }
      z.group.visible = true;
      const c = pts.reduce((s, p) => ({ x: s.x + p.x / pts.length, y: s.y + p.y / pts.length, z: s.z + p.z / pts.length }), { x: 0, y: 0, z: 0 });
      const r = Math.max(18, ...pts.map(p => Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z))) + 14;
      z.group.position.set(c.x, c.y, c.z); z.shell.scale.setScalar(r); z.rim.scale.setScalar(r); z.label.position.set(0, r + 4, 0);
    }
  }
  // Aufgaben-Strahl: Röhre mit laufenden Streifen in Bereichsfarbe und Weiß
  const stripeCache = new Map();
  function stripeCanvas(color) {
    if (stripeCache.has(color)) return stripeCache.get(color);
    const c = document.createElement('canvas'); c.width = 8; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = color; g.fillRect(0, 0, 8, 32); g.fillStyle = '#ffffff'; g.fillRect(0, 32, 8, 32);
    stripeCache.set(color, c); return c;
  }
  let beams = [];
  function linkObject(l) {
    const T = window.THREE; if (!T) return null;
    if (l.kind === 'sync') { const geo = new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3(0, 1, 0)]); return new T.Line(geo, new T.LineDashedMaterial({ color: '#b8c9ff', dashSize: 1, gapSize: 1, transparent: true, opacity: 0.65 })); }
    if (l.kind !== 'task') return null;
    const tex = new T.CanvasTexture(stripeCanvas(l.color || '#4cc27f')); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.magFilter = T.NearestFilter;
    const mesh = new T.Mesh(new T.CylinderGeometry(0.7, 0.7, 1, 10, 1, true), new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95 }));
    mesh.userData.tex = tex; beams.push(mesh); return mesh;
  }
  function linkPosition(obj, { start, end }, l) {
    if (l.kind === 'sync' && obj) { const T = window.THREE; obj.geometry.setFromPoints([new T.Vector3(start.x, start.y, start.z), new T.Vector3(end.x, end.y, end.z)]); obj.computeLineDistances(); return true; }
    if (l.kind !== 'task' || !obj || !obj.userData.tex) return false;
    const T = window.THREE, dx = end.x - start.x, dy = end.y - start.y, dz = end.z - start.z, len = Math.max(0.01, Math.hypot(dx, dy, dz));
    obj.position.set(start.x + dx / 2, start.y + dy / 2, start.z + dz / 2);
    obj.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(dx / len, dy / len, dz / len));
    obj.scale.set(1, len, 1); obj.userData.tex.repeat.set(1, len / 5);
    return true;
  }
  function nodeObject(n) {
    const T = window.THREE; if (!T) return null;
    if (n.kind === 'tisch' || n.kind === 'kern') return makeCore(T, n);
    if (n.kind === 'tischsitzung') return makeSitzung(T, n);
    if (n.kind === 'council' || n.kind === 'agent' || n.kind === 'member') return makeFigure(T, n);
    if (n.kind === 'bereich' || n.kind === 'privat') return makeArea(T, n);
    if (n.kind === 'ordner') return makeFolder(T, n);
    if (n.kind === 'werkzeug') return makeTool(T, n);
    return null; // Lernpunkte: Standardkugel
  }
  function animate() {
    if (!running) return;
    const t = performance.now() / 1000;
    for (const f of figures) {
      const u = f.userData;
      if (u.active) { u.inner.position.y = Math.sin(t * 3 + u.seed) * 0.7; if (u.ring) { const p = 1 + 0.12 * Math.sin(t * 4 + u.seed); u.ring.scale.set(p, p, p); } }
      if (u.halo) u.halo.rotation.z = t * 0.8;
      if (u.globe) u.globe.rotation.y = t * 1.5;
    }
    for (const b of beams) b.userData.tex.offset.y = -t * 0.8; // Streifen laufen zum Bereich
    updateZones();
    raf = requestAnimationFrame(animate);
  }

  // ---------- Detailfeld ----------
  function detailHtml(n, esc) {
    if (!n) return '';
    const d = n.detail || {};
    if (n.kind === 'tisch') return `<h3>Runder Tisch</h3><p>${d.anzahl} Sitzung(en) · zuletzt: ${esc(d.letzte)}</p>`;
    if (n.kind === 'member') return `<h3>${esc(n.label)} · ${esc(d.bereich || '')}</h3><p>Rolle: ${esc((d.rollen || []).join(', '))}</p><p>${esc(d.description || 'Zuständigkeit, kein eigener Agent.')}</p><p>${n.status === 'arbeitet' ? `arbeitet hier gerade${n.activity ? ` · ${esc(n.activity)}` : ''}` : 'bereit'}</p>`;
    if (n.kind === 'kern') { const g = d.git || {}; return `<h3>Council-Repo</h3><p>Lokale Änderungen: ${Number(g.changed) || 0}</p><p>GitHub: ${g.ahead == null || g.behind == null ? 'kein Upstream' : `${g.ahead} voraus · ${g.behind} zurück`}</p><p>Letzter Commit: ${esc(g.lastCommit || 'unbekannt')}</p><p>Hochladen über PR (council-learn)</p>`; }
    if (n.kind === 'council' || n.kind === 'agent') {
      const roles = (d.rollen || []).map(r => `<li><b>${esc(r.bereich)}:</b> ${esc(r.rollen.join(', '))}</li>`).join('');
      return `<h3>${esc(n.label)}${n.kind === 'council' ? ' · Orchestrator' : ''}</h3><p>${esc(STATUS_TEXT[n.status] || n.status)}${n.activity ? ` · ${esc(n.activity)}` : ''}</p>${n.url ? `<button type="button" data-open-url="${esc(n.url)}">Seite öffnen, auf der er arbeitet</button>` : ''}${roles ? `<p>Rollen je Bereich:</p><ul>${roles}</ul>` : '<p>Keine Rolle in einem aktiven Bereich.</p>'}`;
    }
    if (n.kind === 'ordner') return `<h3>📁 ${esc(n.label)}</h3><p>${(d.files || 0)} Dateien · ${d.open ? 'aufgeklappt (nochmal klicken = zuklappen)' : 'klicken = Unterordner zeigen'}</p><button type="button" data-reveal-folder="${esc(n.id)}">Im Explorer zeigen</button>`;
    if (n.kind === 'werkzeug') return `<h3>${esc(n.label)}</h3><button type="button" data-open-url="${esc(n.url)}">Seite öffnen</button>`;
    if (n.kind === 'bereich') return `<h3>${esc(n.label)}</h3><p>Klicken klappt die Ordner auf bzw. zu.</p><p>Profil: ${esc(d.profil || '–')} · ${d.extern ? 'externe Worker erlaubt' : 'nur Claude-Worker'}${n.paused ? ' · pausiert' : ''}</p>${(d.ziele || []).map(z => `<p>🎯 ${esc(z.text)}</p>`).join('')}`;
    if (n.kind === 'learning') return `<h3>${esc(n.label)}${n.isNew ? ' ★' : ''}</h3><p>${esc(d.summary || '')}</p><button type="button" data-open-learning="${esc(n.label)}">Öffnen</button>`;
    return `<h3>${esc(n.label)}</h3>`;
  }

  // Detail-/Bestandsfeld als Seitenleiste über dem 3D-Bild (im 2D-Netz hat es eine eigene Breite)
  function openAside(aside, html) {
    aside.classList.add('universe-aside'); aside.style.display = '';
    aside.innerHTML = '<button type="button" class="aside-close" data-close-aside aria-label="Schließen">✕</button>' + html;
  }
  // ---------- Bestandsliste einer Blase ----------
  function inventoryHtml(area, inv, esc, stand = '') {
    const d = area.detail || {}, data = current || { nodes: [], links: [] };
    const team = data.nodes.filter(n => n.kind === 'member' && n.group === area.group);
    const learnIds = new Set(data.links.filter(l => l.kind === 'learning' && l.target === area.id).map(l => l.source));
    const learns = data.nodes.filter(n => learnIds.has(n.id)).sort((a, b) => (b.bridge ? 1 : 0) - (a.bridge ? 1 : 0));
    const time = ts => { const t = new Date(typeof ts === 'number' ? ts : Date.parse(ts)); return Number.isFinite(t.getTime()) ? t.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''; };
    const sec = (title, body) => (body ? '<h4>' + title + '</h4>' + body : '');
    const li = items => '<ul>' + items.join('') + '</ul>';
    let html = '<h3>' + esc(area.label) + '</h3><p class="inv-sub">Profil ' + esc(d.profil || '–') + ' · ' + (d.extern ? 'externe Worker erlaubt' : 'nur Claude-Worker') + (area.paused ? ' · pausiert' : '') + '</p>';
    html += '<h4>Stand (letzte Übergabe)</h4><p>' + (stand ? esc(stand).replace(/\n/g, '<br>') : '<span class="inv-sub">Noch keine Übergabe-Notiz.</span>') + '</p><button type="button" data-stand-toggle="' + esc(area.id.slice(2)) + '">Stand ergänzen</button><div data-stand-form hidden><textarea data-stand-text aria-label="Stand-Notiz"></textarea><button type="button" data-stand-add="' + esc(area.id.slice(2)) + '">Speichern</button></div>';
    html += sec('Team', team.length ? li(team.map(t => '<li><b>' + esc(t.label) + '</b> – ' + esc((t.detail.rollen || []).join(', ')) + (t.status === 'arbeitet' ? ' · <span class="inv-run">arbeitet' + (t.activity ? ': ' + esc(t.activity) : '') + '</span>' : '') + '</li>')) : '');
    html += sec('Ziele', (d.ziele || []).length ? li(d.ziele.map(z => '<li>🎯 ' + esc(z.text) + '</li>')) : '');
    html += sec('Erkenntnisse (' + learns.length + ')', learns.length ? li(learns.map(l => '<li>' + (l.bridge ? '🌉 ' : '') + '<button type="button" class="link" data-open-learning="' + esc(l.label) + '">' + esc(l.label) + '</button></li>')) : '');
    if (!inv) return html + '<p class="inv-sub">Bestand wird geladen …</p>';
    html += sec('Ordner (' + inv.folders.length + ')', inv.folders.length ? li(inv.folders.map(f => '<li>📁 ' + esc(f.name) + ' <span class="inv-sub">' + f.files + ' Dateien</span></li>')) : '');
    html += sec('Zuletzt geändert', inv.files.length ? li(inv.files.map(f => '<li><button type="button" class="link" data-area="' + esc(area.id) + '" data-root="' + f.root + '" data-open-file="' + esc(f.rel) + '">' + esc(f.rel) + '</button> <span class="inv-sub">' + time(f.mtime) + '</span></li>')) : '');
    html += sec('Letzte Aktivität', inv.activity.length ? li(inv.activity.map(a => '<li><span class="inv-sub">' + time(a.ts) + ' · ' + esc(a.agent) + '</span> ' + esc(a.text) + '</li>')) : '<p class="inv-sub">Noch keine Schritte aus Sitzungen in diesem Bereich.</p>');
    const inbound = data.links.filter(l => l.kind === 'fluss' && l.target === area.id).map(l => '<li>' + esc(data.nodes.find(n => n.id === l.source)?.label || l.source) + ': ' + esc(l.label || '') + '</li>');
    const outbound = data.links.filter(l => l.kind === 'fluss' && l.source === area.id).map(l => '<li>' + esc(data.nodes.find(n => n.id === l.target)?.label || l.target) + ': ' + esc(l.label || '') + '</li>');
    html += sec('Nutzt Daten aus', inbound.length ? li(inbound) : '');
    html += sec('Liefert Daten an', outbound.length ? li(outbound) : '');
    const id = area.id.slice(2), options = d.chat?.options || (d.chatEnabled === false ? [] : ['claude']), agent = chatChoices.get(id) || d.chat?.standard || d.chatAgent || options[0], thread = chatThreads.get(id) || [];
    const name = who => ({ kevin: 'Du', claude: 'Claude', codex: 'Codex', 'grok-4.7': 'Grok 4.7' }[who] || who || 'Du');
    const handoffs = text => String(text || '').split(/\r?\n/).flatMap(line => { const m = line.match(/^\s*@(claude|grok|grok-4\.7|codex):\s*(.+?)\s*$/i); if (!m) return []; const worker = /^grok/i.test(m[1]) ? 'grok-4.7' : m[1].toLowerCase(); return options.includes(worker) && m[2].length <= 2000 ? [{ worker, task: m[2] }] : []; });
    const colors = { claude: 'chat-claude', codex: 'chat-codex', 'grok-4.7': 'chat-grok' };
    const buttons = options.map(o => '<button type="button" class="chat-agent ' + (colors[o] || '') + (agent === o ? ' selected' : '') + '" data-chat-agent="' + esc(o) + '" data-chat-area="' + esc(id) + '" aria-pressed="' + (agent === o) + '">' + esc(name(o)) + '</button>').join('');
    const messages = thread.map(m => '<div class="chat-message ' + (colors[m.von || (m.role === 'assistant' ? agent : '')] || '') + '"><b>' + esc(name(m.von || (m.role === 'assistant' ? agent : 'kevin'))) + ':</b> <span>' + esc(m.text) + '</span>' + handoffs(m.text).map(h => '<div class="handoff"><b>' + esc(name(h.worker)) + ':</b> ' + esc(h.task) + ' <button type="button" data-handoff-run="' + esc(id) + '" data-handoff-agent="' + esc(h.worker) + '" data-handoff-task="' + esc(h.task) + '">Ausführen</button> <button type="button" data-handoff-dismiss>Verwerfen</button></div>').join('') + '</div>').join('');
    html += '<section class="area-chat"><h4>Chat</h4><div class="chat-agents">' + buttons + '</div><div class="area-chat-log">' + messages + '</div><textarea data-chat-text aria-label="Nachricht"></textarea><button type="button" data-chat-send="' + esc(id) + '"' + (options.length ? '' : ' disabled') + '>Senden</button><button type="button" data-chat-stop="' + esc(id) + '">Stopp</button></section>';
    return html;
  }
  function showInventory(msg) {
    if (!asideEl || !current) return;
    const area = current.nodes.find(n => n.id === msg.id); if (!area) return;
    const esc = (helper && (helper.esc || helper.safe)) || encode;
    if (Array.isArray(msg.chat)) chatThreads.set(area.id.slice(2), msg.chat.map(m => ({ von: m.von, text: m.text })));
    openAside(asideEl, inventoryHtml(area, msg.data, esc, msg.stand || ''));
  }
  // Lernpunkte in der Farbe ihres Bereichs; allgemeine grau
  function prepare(data) {
    const colorById = new Map(data.nodes.map(n => [n.id, n.color]));
    const learnColor = new Map();
    for (const l of data.links) if (l.kind === 'learning' && String(l.target).startsWith('b:') && !learnColor.has(l.source)) learnColor.set(l.source, colorById.get(l.target));
    return { nodes: data.nodes.map(n => ({ ...n, colorHex: n.bridge ? '#ffd479' : (learnColor.get(n.id) || n.color || colorOf(n.group)),
      ...(data.layout && data.layout[n.id] ? { fx: data.layout[n.id].x, fy: data.layout[n.id].y, fz: data.layout[n.id].z } : {}), val: n.kind === 'learning' ? n.size * 0.35 : n.size })), links: data.links.map(l => ({ ...l })) };
  }
  function renderLegend(data, esc) {
    const areas = data.nodes.filter(n => n.kind === 'bereich' || n.kind === 'privat');
    const items = areas.map(n => ({ label: n.label + (n.paused ? ' (Pause)' : ''), color: n.color || colorOf(n.group), paused: n.paused }))
      .concat([{ label: 'Erkenntnis allgemein', color: '#8a8fa8' }, { label: 'Brücken-Erkenntnis', color: '#ffd479' }]);
    legend.innerHTML = items.map(it => `<span${it.paused ? ' class="paused"' : ''}><i></i>${esc(it.label)}</span>`).join('');
    legend.querySelectorAll('i').forEach((dot, k) => { dot.style.background = items[k].color; }); // CSSOM: CSP blockiert style-Attribute
  }
  function scheduleFit() {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(() => { if (graph && fitPending) { fitPending = false; if (graph.graphData().nodes.length > 1) fitted = true; graph.zoomToFit(600, 30); } }, 2500);
  }

  function render(container, aside, universe, h) {
    const esc = (h && (h.esc || h.safe)) || encode;
    if (!window.ForceGraph3D) { container.textContent = '3D nicht verfügbar – bitte auf 2D umschalten.'; return; }
    const data = universe || { nodes: [], links: [] };
    current = data; helper = h;
    const nextSig = JSON.stringify([data.nodes.map(n => [n.id, n.label, n.status, n.activity, n.paused, n.isNew, n.bridge, n.detail]), data.links.map(l => [l.source, l.target, l.kind, l.active, l.label]), data.layout || {}]);
    if (!graph || el !== container) {
      dispose();
      el = container; container.textContent = '';
      graph = window.ForceGraph3D({ controlType: 'orbit' })(container)
        .backgroundColor('rgba(0,0,0,0)')
        .showNavInfo(false)
        .cooldownTicks(150)
        .nodeLabel(n => (n.kind === 'learning' ? esc(n.label) : ''))
        .nodeVal(n => n.val)
        .nodeColor(n => (n.paused ? '#555a70' : n.colorHex))
        .nodeOpacity(0.9)
        .nodeRelSize(2.2)
        .nodeThreeObject(nodeObject)
        .linkColor(l => (l.kind === 'sync' ? '#b8c9ff' : l.kind === 'fluss' ? (l.active ? '#d7e7ff' : l.color || '#9aa0c0') : l.kind === 'task' ? '#4cc27f' : l.kind === 'bereich' || l.kind === 'team' ? '#9aa0c0' : '#5c6280'))
        .linkOpacity(l => l.kind === 'fluss' && l.active ? 0.9 : 0.45)
        .linkWidth(l => (l.kind === 'task' ? 1.6 : l.kind === 'bereich' ? 1 : l.kind === 'team' ? 0.6 : l.kind === 'fluss' ? 1.1 : 0.3))
        .linkThreeObject(linkObject)
        .linkPositionUpdate(linkPosition)
        .linkDirectionalParticles(l => l.kind === 'fluss' ? (l.active ? 5 : 2) : 0)
        .linkDirectionalParticleWidth(1.8)
        .linkDirectionalParticleColor(() => '#c8ffd9')
        .enableNodeDrag(false)
        .onNodeDragEnd(n => {
          n.fx = n.x; n.fy = n.y; n.fz = n.z;
          if ((n.kind === 'bereich' || n.kind === 'kern' || n.kind === 'council') && h && h.post) h.post({ type: 'saveLayout', id: n.id, pos: { x: n.x, y: n.y, z: n.z } });
        })
        .onEngineStop(() => { if (fitPending) { fitPending = false; if (graph.graphData().nodes.length > 1) fitted = true; graph.zoomToFit(600, 30); } })
        .onNodeClick(n => {
          if (n.kind === 'tisch' && h && h.openTisch) { h.openTisch(''); return; }
          if (n.kind === 'tischsitzung' && h && h.openTisch) { h.openTisch(n.detail.id); return; }
          if (h && h.closeTisch) h.closeTisch();
          openAside(aside, detailHtml(n, esc));
          if ((n.kind === 'bereich' || n.kind === 'ordner') && h && h.post) h.post({ type: 'toggleFolder', id: n.id });
          if (n.kind === 'bereich' && h && h.post) { openAside(aside, inventoryHtml(n, null, esc)); h.post({ type: 'inventory', id: n.id }); }
          if (![n.x, n.y, n.z].every(Number.isFinite)) return;
          const r = 1 + 70 / Math.max(1, Math.hypot(n.x, n.y, n.z));
          graph.cameraPosition({ x: n.x * r, y: n.y * r, z: n.z * r }, n, 800);
        });
      graph.d3Force('link').distance(l => (l.kind === 'bereich' ? 130 : l.kind === 'member' ? 20 : l.kind === 'ordner' ? 22 : l.kind === 'team' ? 26 : l.kind === 'task' ? 140 : 55)).strength(l => (l.kind === 'task' ? 0.02 : 0.6));
      graph.d3Force('charge').strength(n => (n.kind === 'agent' || n.kind === 'council' || n.kind === 'kern' ? -180 : n.kind === 'learning' ? -12 : -60));
      if (window.THREE) { const sc = graph.scene(); sc.add(new window.THREE.HemisphereLight('#ffffff', '#30334a', 1.6)); }
      legend = document.createElement('div'); legend.className = 'universe-legend'; container.appendChild(legend);
      if (!window.__councilShift) {
        window.__councilShift = true;
        const setShift = on => { if (on === shiftDown) return; shiftDown = on; if (graph) graph.enableNodeDrag(on); if (el) el.classList.toggle('dragmode', on); };
        window.addEventListener('keydown', e => { if (e.key === 'Shift') setShift(true); });
        window.addEventListener('keyup', e => { if (e.key === 'Shift') setShift(false); });
        window.addEventListener('blur', () => setShift(false));
      }
      asideEl = aside;
      asideClick = ev => { if (ev.target.closest('[data-close-aside]')) { aside.style.display = 'none'; aside.classList.remove('universe-aside', 'tisch-panel'); if (h && h.closeTisch) h.closeTisch(); return; }
        const choose = ev.target.closest('[data-chat-agent]'); if (choose) { chatChoices.set(choose.dataset.chatArea, choose.dataset.chatAgent); openAside(aside, inventoryHtml(current.nodes.find(n => n.id === 'b:' + choose.dataset.chatArea), null, esc)); return; }
        const standToggle = ev.target.closest('[data-stand-toggle]'); if (standToggle) { const form = aside.querySelector('[data-stand-form]'); if (form) form.hidden = false; aside.querySelector('[data-stand-text]')?.focus(); return; }
        const standAdd = ev.target.closest('[data-stand-add]'); if (standAdd && h && h.post) { const input = aside.querySelector('[data-stand-text]'), text = input.value.trim(); if (text) h.post({ type: 'standAdd', id: standAdd.dataset.standAdd, text }); standAdd.disabled = true; return; }
        const run = ev.target.closest('[data-handoff-run]'); if (run && h && h.post) { h.post({ type: 'handoffRun', id: run.dataset.handoffRun, agent: run.dataset.handoffAgent, auftrag: run.dataset.handoffTask }); run.disabled = true; return; }
        const dismiss = ev.target.closest('[data-handoff-dismiss]'); if (dismiss) { dismiss.closest('.handoff').remove(); return; }
        const send = ev.target.closest('[data-chat-send]'); if (send && h && h.post) { const id = send.dataset.chatSend, input = aside.querySelector('[data-chat-text]'), text = input.value.trim(); if (!text) return; const thread = chatThreads.get(id) || []; thread.push({ von: 'kevin', text }); chatThreads.set(id, thread); h.post({ type: 'chatSend', id, text, agent: chatChoices.get(id) || current.nodes.find(n => n.id === 'b:' + id)?.detail?.chat?.standard }); openAside(aside, inventoryHtml(current.nodes.find(n => n.id === 'b:' + id), null, esc)); return; }
        const stop = ev.target.closest('[data-chat-stop]'); if (stop && h && h.post) h.post({ type: 'chatStop', id: stop.dataset.chatStop });
        const url = ev.target.closest('[data-open-url]'); if (url && h && h.post) h.post({ type: 'openUrl', url: url.dataset.openUrl });
        const of = ev.target.closest('[data-open-file]'); if (of && h && h.post) h.post({ type: 'openFile', id: of.dataset.area, root: Number(of.dataset.root), rel: of.dataset.openFile });
        const b = ev.target.closest('[data-open-learning]'); if (b && h && h.post) h.post({ type: 'openLearning', key: b.dataset.openLearning });
        const rf = ev.target.closest('[data-reveal-folder]'); if (rf && h && h.post) h.post({ type: 'revealFolder', id: rf.dataset.revealFolder }); };
      aside.addEventListener('click', asideClick);
      aside.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.ctrlKey && ev.target.matches('[data-chat-text]')) aside.querySelector('[data-chat-send]')?.click(); });
      if (window.ResizeObserver) { observer = new ResizeObserver(() => { if (graph && container.clientWidth && container.clientHeight) graph.width(container.clientWidth).height(container.clientHeight); }); observer.observe(container); }
    }
    resume();
    if (nextSig !== sig) {
      sig = nextSig;
      const nextStruct = JSON.stringify([data.nodes.map(n => n.id), data.links.map(l => [l.source, l.target, l.kind]), data.layout || {}]);
      if (nextStruct !== structSig) {
        structSig = nextStruct; figures = []; beams = [];
        graph.graphData(prepare(data));
        if (!fitted) { fitPending = true; scheduleFit(); } // nach dem ersten Einpassen bleibt die Kamera, wo Kevin sie hingedreht hat
      } else patchGraph(data); // nur Status/Aktivität neu: Kugeln bleiben stehen, Simulation startet nicht neu
      renderLegend(data, esc);
      if (window.THREE) buildZones(window.THREE, data);
    }
  }
  const POSITION = new Set(['x', 'y', 'z', 'vx', 'vy', 'vz', 'fx', 'fy', 'fz', '__threeObj', 'index']);
  const endId = end => (end && typeof end === 'object' ? end.id : end);
  function patchGraph(data) {
    const fresh = prepare(data), { nodes, links } = graph.graphData();
    const nodeById = new Map(fresh.nodes.map(n => [n.id, n]));
    for (const n of nodes) { const f = nodeById.get(n.id); if (f) for (const k in f) if (!POSITION.has(k)) n[k] = f[k]; }
    const linkKey = l => `${endId(l.source)}\0${endId(l.target)}\0${l.kind}`;
    const linkByKey = new Map(fresh.links.map(l => [linkKey(l), l]));
    for (const l of links) { const f = linkByKey.get(linkKey(l)); if (f) for (const k in f) if (k !== 'source' && k !== 'target' && !k.startsWith('__')) l[k] = f[k]; }
    figures = []; beams = [];
    graph.refresh();
  }
  // Reiter verborgen: WebGL-Schleife und Figuren-Animation anhalten
  function pause() { running = false; cancelAnimationFrame(raf); if (graph) graph.pauseAnimation(); }
  function resume() { if (graph) graph.resumeAnimation(); if (!running) { running = true; raf = requestAnimationFrame(animate); } }
  function dispose() {
    if (asideEl) { asideEl.classList.remove('universe-aside'); asideEl.style.display = 'none'; }
    pause(); clearTimeout(fitTimer); figures = []; beams = []; zones = new Map();
    if (observer) { observer.disconnect(); observer = null; }
    if (asideEl && asideClick) asideEl.removeEventListener('click', asideClick);
    asideEl = null; asideClick = null;
    if (graph) { graph._destructor && graph._destructor(); }
    graph = null; el = null; legend = null; sig = ''; structSig = ''; fitPending = false; fitted = false;
  }
  function chatMessage(msg) { const thread = chatThreads.get(msg.id) || []; if (msg.type === 'chatChunk') { const last = thread[thread.length - 1]; if (last?.von !== 'kevin') last.text += msg.text; else thread.push({ von: msg.agent || chatChoices.get(msg.id) || 'claude', text: msg.text }); } chatThreads.set(msg.id, thread); if (asideEl && current) { const area = current.nodes.find(n => n.id === 'b:' + msg.id); if (area) openAside(asideEl, inventoryHtml(area, null, (helper && (helper.esc || helper.safe)) || encode)); } }
  window.CouncilUniverse = { render, dispose, pause, resume, showInventory, chatMessage };
})();
