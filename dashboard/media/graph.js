(function () {
  'use strict';

  const state = {
    canvas: null, aside: null, ctx: null, parent: null, observer: null,
    nodes: [], edges: [], byId: new Map(), positions: new Map(),
    signature: '', data: null, helper: null,
    zoom: 1, panX: 0, panY: 0, hover: null, selected: null,
    dragging: false, moved: false, lastX: 0, lastY: 0,
    dpr: 1, width: 0, height: 0, detailKey: '', detailNotes: '',
    listenersSet: false, asideListenerSet: false, frame: 0
  };

  function css(name, fallback) {
    try { return state.helper && state.helper.css(name) || fallback; } catch (_) { return fallback; }
  }
  function graphSignature(nodes, edges) {
    const ids = nodes.map(n => String(n.id)).sort();
    const es = edges.map(e => [e.from, e.to, e.kind].map(String).join('\u001f')).sort();
    return JSON.stringify([ids, es]);
  }
  function edgeNodes(edge) { return [state.byId.get(String(edge.from)), state.byId.get(String(edge.to))]; }
  function resize() {
    const c = state.canvas;
    if (!c || !state.parent) return;
    const rect = state.parent.getBoundingClientRect();
    const visible = state.aside && state.aside.style.display !== 'none';
    const width = Math.max(1, rect.width - (visible ? 310 : 0));
    const height = Math.max(240, rect.height || (window.innerHeight - 170)); // fill the Netz pane, not the window
    const oldW = state.width, oldH = state.height;
    state.width = width; state.height = height; state.dpr = window.devicePixelRatio || 1;
    c.style.width = width + 'px'; c.style.height = height + 'px';
    c.width = Math.round(width * state.dpr); c.height = Math.round(height * state.dpr);
    state.ctx = c.getContext('2d');
    if (state.ctx) state.ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    if (oldW && oldH && (oldW !== width || oldH !== height)) {
      const dx = (width - oldW) / 2, dy = (height - oldH) / 2;
      state.positions.forEach(p => { p.x += dx; p.y += dy; });
      if (!state.userMoved) fitView();
    }
    draw();
  }
  // Zoom/pan so that all nodes fit into the canvas (until the user zooms or drags himself).
  function fitView() {
    if (!state.positions.size || !state.width) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    state.positions.forEach(p => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
    const pad = 70, bw = x1 - x0 + 2 * pad, bh = y1 - y0 + 2 * pad;
    const z = Math.max(.4, Math.min(1.6, Math.min(state.width / bw, state.height / bh)));
    state.zoom = z;
    state.panX = -((x0 + x1) / 2 - state.width / 2) * z;
    state.panY = -((y0 + y1) / 2 - state.height / 2) * z;
  }
  function placeNodes() {
    const w = state.width || 800, h = state.height || 500;
    const cx = w / 2, cy = h / 2, base = Math.min(w, h);
    const felds = state.nodes.filter(n => n.kind === 'feld').slice().sort((a,b) => String(a.id).localeCompare(String(b.id)));
    const learnings = state.nodes.filter(n => n.kind === 'learning');
    const workers = state.nodes.filter(n => n.kind === 'worker');
    const feldAngles = new Map();
    felds.forEach((n, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / Math.max(1, felds.length);
      feldAngles.set(n.id, a);
      state.positions.set(n.id, { x: cx + Math.cos(a) * base * .32, y: cy + Math.sin(a) * base * .32 });
    });
    const byFeld = new Map();
    learnings.forEach(n => {
      const links = state.edges.filter(e => String(e.from) === String(n.id) || String(e.to) === String(n.id));
      const feld = links.map(e => state.byId.get(String(e.from) === String(n.id) ? String(e.to) : String(e.from))).find(x => x && x.kind === 'feld');
      if (!feld) return;
      if (!byFeld.has(feld.id)) byFeld.set(feld.id, []);
      byFeld.get(feld.id).push(n);
    });
    byFeld.forEach((arr, id) => {
      arr.sort((a,b) => String(a.id).localeCompare(String(b.id)));
      const center = state.positions.get(id), radius = 55 + 6 * arr.length;
      arr.forEach((n, i) => {
        const a = -Math.PI / 2 + i * 2 * Math.PI / Math.max(1, arr.length);
        state.positions.set(n.id, { x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius });
      });
    });
    workers.slice().sort((a,b) => String(a.id).localeCompare(String(b.id))).forEach(n => {
      const angles = [];
      state.edges.forEach(e => {
        if (String(e.from) !== String(n.id) && String(e.to) !== String(n.id)) return;
        const other = state.byId.get(String(e.from) === String(n.id) ? String(e.to) : String(e.from));
        if (other && other.kind === 'learning') {
          const p = state.positions.get(other.id);
          if (p) angles.push(Math.atan2(p.y - cy, p.x - cx));
        }
      });
      let a = -Math.PI / 2;
      if (angles.length) a = Math.atan2(angles.reduce((s,x)=>s+Math.sin(x),0), angles.reduce((s,x)=>s+Math.cos(x),0));
      state.positions.set(n.id, { x: cx + Math.cos(a) * base * .46, y: cy + Math.sin(a) * base * .46 });
    });
    state.nodes.forEach((n, i) => { if (!state.positions.has(n.id)) state.positions.set(n.id, { x: cx + Math.cos(i * 2.4) * 30, y: cy + Math.sin(i * 2.4) * 30 }); });
    const fixed = new Set(felds.map(n => n.id));
    for (let iter = 0; iter < 80; iter++) {
      for (let i = 0; i < state.nodes.length; i++) for (let j = i + 1; j < state.nodes.length; j++) {
        const a = state.nodes[i], b = state.nodes[j], pa = state.positions.get(a.id), pb = state.positions.get(b.id);
        let dx = pb.x - pa.x, dy = pb.y - pa.y, d = Math.hypot(dx, dy);
        if (d >= 34) continue;
        if (!d) { dx = .01; dy = .01; d = Math.hypot(dx,dy); }
        const push = (34 - d) / 2, ux = dx / d, uy = dy / d;
        if (!fixed.has(a.id)) { pa.x -= ux * push; pa.y -= uy * push; }
        if (!fixed.has(b.id)) { pb.x += ux * push; pb.y += uy * push; }
      }
    }
  }
  function radius(n) { return n.kind === 'feld' ? 13 : n.kind === 'worker' ? 9 : 6; }
  function screen(p) { return { x: (p.x - state.width/2) * state.zoom + state.width/2 + state.panX, y: (p.y - state.height/2) * state.zoom + state.height/2 + state.panY }; }
  function neighbors(id) {
    const out = new Set();
    state.edges.forEach(e => { if (String(e.from) === String(id)) out.add(String(e.to)); if (String(e.to) === String(id)) out.add(String(e.from)); });
    return out;
  }
  function draw() {
    const ctx = state.ctx; if (!ctx || !state.canvas) return;
    const w = state.width, h = state.height;
    ctx.clearRect(0,0,w,h);
    const bg = css('--vscode-editor-background', '#1e1e1e');
    const border = css('--vscode-panel-border', '#555');
    const orange = css('--vscode-charts-orange', '#d18616'), blue = css('--vscode-charts-blue', '#3794ff'), green = css('--vscode-charts-green', '#89d185');
    const hot = state.hover ? neighbors(state.hover) : new Set();
    state.edges.forEach(e => {
      const a = state.byId.get(String(e.from)), b = state.byId.get(String(e.to)); if (!a || !b) return;
      const pa = screen(state.positions.get(a.id)), pb = screen(state.positions.get(b.id));
      const active = !state.hover || a.id === state.hover || b.id === state.hover;
      ctx.save(); ctx.globalAlpha = state.hover && !active ? .25 : 1; ctx.strokeStyle = border; ctx.lineWidth = 1;
      ctx.setLineDash(e.kind === 'ref' ? [5,4] : []); ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.lineTo(pb.x,pb.y); ctx.stroke(); ctx.restore();
    });
    state.nodes.forEach(n => {
      const p = screen(state.positions.get(n.id)), r = radius(n), active = !state.hover || n.id === state.hover || hot.has(n.id);
      ctx.save(); ctx.globalAlpha = state.hover && !active ? .25 : 1;
      const fill = n.kind === 'feld' ? orange : n.kind === 'worker' ? green : blue;
      ctx.fillStyle = fill;
      if (n.kind === 'worker') { ctx.beginPath(); ctx.roundRect(p.x-r,p.y-r,r*2,r*2,3); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.fill(); }
      if (n.id === state.hover || n.id === state.selected) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
      const show = n.kind !== 'learning' || state.zoom >= 1.1 || n.id === state.hover || n.id === state.selected || hot.has(n.id);
      if (show) {
        const label = String(n.label || ''), star = n.kind === 'learning' && state.data && Array.isArray(state.data.newKeys) && state.data.newKeys.includes(String(n.id).replace(/^l:/,'')) ? '★ ' : '';
        const text = star + label; ctx.font = n.kind === 'feld' ? 'bold 13px sans-serif' : '12px sans-serif';
        const tw = ctx.measureText(text).width, tx = p.x + r + 5, ty = p.y + 4;
        ctx.fillStyle = bg; ctx.globalAlpha = (state.hover && !active ? .25 : 1) * .78; ctx.fillRect(tx-3,ty-12,tw+6,16);
        ctx.globalAlpha = state.hover && !active ? .25 : 1; ctx.fillStyle = css('--vscode-foreground','#ddd'); ctx.fillText(text,tx,ty);
      }
      ctx.restore();
    });
    if (state.hover) {
      const n = state.byId.get(state.hover), p = n && screen(state.positions.get(n.id));
      if (n && p) { const text = String(n.label || ''), tw = Math.min(360, ctx.measureText(text).width + 14), x = Math.max(4,Math.min(w-tw-4,p.x+15)), y = Math.max(24,p.y-16);
        ctx.save(); ctx.font='12px sans-serif'; ctx.fillStyle=bg; ctx.globalAlpha=.95; ctx.fillRect(x,y-18,tw,24); ctx.fillStyle=css('--vscode-foreground','#ddd'); ctx.globalAlpha=1; ctx.fillText(text,x+7,y-2); ctx.restore(); }
    }
  }
  function post(msg) { if (state.helper && typeof state.helper.post === 'function') state.helper.post(msg); }
  function noteSignature(node) {
    const target = node ? String(node.label) : '';
    return JSON.stringify((state.data && state.data.notes || []).filter(n => String(n.target) === target).map(n => [n.target,n.text,n.date,n.status]));
  }
  function renderDetail(force) {
    const node = state.selected && state.byId.get(state.selected);
    const key = node ? String(node.id) : '';
    const notesSig = noteSignature(node);
    if (!force && key === state.detailKey && notesSig === state.detailNotes) return;
    state.detailKey = key; state.detailNotes = notesSig;
    if (!state.aside) return;
    if (!node) { state.aside.innerHTML = ''; state.aside.style.display = 'none'; resize(); return; }
    state.aside.style.display = 'block';
    const safe = s => state.helper && typeof state.helper.safe === 'function' ? state.helper.safe(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const linked = [];
    state.edges.forEach(e => {
      let id = null; if (String(e.from) === key) id = String(e.to); else if (String(e.to) === key) id = String(e.from);
      const other = id && state.byId.get(id); if (other && !linked.some(x=>x.id===id)) linked.push(other);
    });
    const notes = (state.data && state.data.notes || []).filter(n => String(n.target) === String(node.label));
    state.aside.innerHTML = '<div class="council-graph-detail">' +
      '<h2 class="graph-title">'+safe(node.label)+'</h2>' +
      (node.kind === 'learning' ? '<button type="button" data-action="open">Lernpunkt öffnen</button>' : '') +
      '<h3>Verbundene Knoten</h3><ul>'+linked.map(n=>'<li><button type="button" data-node="'+safe(n.id)+'">'+safe(n.label)+'</button></li>').join('')+'</ul>'+
      '<h3>Notizen</h3><div>'+notes.map(n=>'<article class="graph-note"><small>'+safe(n.date || '')+'</small><div>'+safe(n.text || '')+'</div></article>').join('')+'</div>'+ 
      '<textarea data-note rows="4" class="graph-note-input" aria-label="Notiz"></textarea><button type="button" data-action="save">Notiz speichern</button></div>';
    resize();
  }
  function pointerPos(ev) { const r=state.canvas.getBoundingClientRect(); return {x:ev.clientX-r.left,y:ev.clientY-r.top}; }
  function hit(x,y) {
    for (let i=state.nodes.length-1;i>=0;i--) { const n=state.nodes[i], p=screen(state.positions.get(n.id)); if (Math.hypot(p.x-x,p.y-y) <= radius(n)+5) return n.id; }
    return null;
  }
  function attach() {
    if (!state.canvas || state.listenersSet) return;
    state.listenersSet = true;
    // plain wheel scrolls the page; Ctrl+wheel zooms the graph
    state.canvas.addEventListener('wheel', ev => { if (!ev.ctrlKey) return; ev.preventDefault(); state.userMoved=true; const p=pointerPos(ev), old=state.zoom, next=Math.max(.4,Math.min(3,old*Math.exp(-ev.deltaY*.001))); const wx=(p.x-state.width/2-state.panX)/old+state.width/2, wy=(p.y-state.height/2-state.panY)/old+state.height/2; state.zoom=next; state.panX=p.x-(wx-state.width/2)*next-state.width/2; state.panY=p.y-(wy-state.height/2)*next-state.height/2; draw(); }, {passive:false});
    state.canvas.addEventListener('pointerdown', ev=>{ const p=pointerPos(ev); if (!hit(p.x,p.y)) { state.dragging=true; state.moved=false; state.lastX=ev.clientX; state.lastY=ev.clientY; state.canvas.setPointerCapture(ev.pointerId); }});
    state.canvas.addEventListener('pointermove', ev=>{ const p=pointerPos(ev); if (state.dragging) { const dx=ev.clientX-state.lastX,dy=ev.clientY-state.lastY; if (Math.abs(dx)+Math.abs(dy)>1) { state.moved=true; state.userMoved=true; } state.panX+=dx;state.panY+=dy;state.lastX=ev.clientX;state.lastY=ev.clientY;draw();return; } const id=hit(p.x,p.y); if (id!==state.hover) { state.hover=id;state.canvas.style.cursor=id?'pointer':'grab';draw(); }});
    const stop=()=>{state.dragging=false;}; state.canvas.addEventListener('pointerup',stop); state.canvas.addEventListener('pointercancel',stop);
    state.canvas.addEventListener('click',ev=>{ if (state.moved) {state.moved=false;return;} const p=pointerPos(ev), id=hit(p.x,p.y); if (id) {state.selected=id;renderDetail(true);draw();} });
    state.canvas.addEventListener('dblclick',ev=>{const p=pointerPos(ev);if(!hit(p.x,p.y)){state.userMoved=false;fitView();draw();}});
    if (state.aside && !state.asideListenerSet) { state.asideListenerSet=true; state.aside.addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b)return;const n=state.selected&&state.byId.get(state.selected);if(!n)return;if(b.dataset.node){state.selected=b.dataset.node;renderDetail(true);draw();}else if(b.dataset.action==='open'&&n.kind==='learning'){post({type:'openLearning',key:String(n.id).replace(/^l:/,'')});}else if(b.dataset.action==='save'){const area=state.aside.querySelector('textarea[data-note]'), text=area?area.value:'';post({type:'addNote',target:String(n.label),text});if(area)area.value='';}}); }
  }
  // zoom buttons (＋ / − / Alles zeigen) call this; factor 0 = fit everything
  function zoomBy(factor) {
    if (!factor) { state.userMoved = false; fitView(); draw(); return; }
    state.userMoved = true;
    const old = state.zoom, next = Math.max(.4, Math.min(3, old * factor));
    state.panX = state.panX * next / old; state.panY = state.panY * next / old; state.zoom = next; draw();
  }
  function render(canvas, aside, data, h) {
    state.canvas=canvas;state.aside=aside;state.data=data||{};state.helper=h||{};
    if (!canvas) return;
    state.parent=canvas.parentElement;
    if (aside && aside.style.display === '') aside.style.display='none';
    if (!state.observer && state.parent && typeof ResizeObserver!=='undefined') { state.observer=new ResizeObserver(resize);state.observer.observe(state.parent); }
    if (!state.width || !state.height) resize();
    const graph=state.data.graph||{}, nodes=Array.isArray(graph.nodes)?graph.nodes:[], edges=Array.isArray(graph.edges)?graph.edges:[];
    const sig=graphSignature(nodes,edges);
    state.nodes=nodes.map(n=>({id:String(n.id),kind:n.kind,label:String(n.label==null?n.id:n.label)}));
    state.edges=edges.map(e=>({from:String(e.from),to:String(e.to),kind:e.kind}));
    state.byId=new Map(state.nodes.map(n=>[n.id,n]));
    if(sig!==state.signature){state.signature=sig;state.positions.clear();placeNodes();if(!state.userMoved)fitView();if(state.selected&&!state.byId.has(state.selected))state.selected=null;if(state.hover&&!state.byId.has(state.hover))state.hover=null;}
    attach();
    if (!state.parent || !state.width) resize();
    renderDetail(false);draw();
  }
  window.CouncilGraph = { render, zoomBy };
})();
