(function (root) {
  'use strict';
  const fmt = n => Number(n || 0).toLocaleString('de-DE');
  function listHtml(items, esc) {
    if (!items || !items.length) return '<div class="empty">Noch keine Sitzungen. Start per Prompt: „Runder Tisch zu …“</div>';
    return '<ul class="tisch-liste">' + items.map(t => `<li><button type="button" class="tisch-item" data-tisch="${esc(t.id)}">` +
      `<b>${t.vertraulich ? '🔒 ' : ''}${esc(t.titel)}</b><span>${esc(t.datum)} · ${t.sitze} Sitze · ${fmt(t.tokensGesamt)} Tokens</span>` +
      `<span class="tisch-chips">${t.blasen.map(b => `<i>${esc(b)}</i>`).join('')}</span>` +
      `${t.erreichbar ? '' : '<em>nicht erreichbar</em>'}</button></li>`).join('') + '</ul>';
  }
  function eintragHtml(e, sitzName, esc) {
    if (e.art === 'eingriff') {
      const g = e.eingriff || {};
      return `<div class="tisch-eingriff"><b>${g.auto ? 'Hier hättest du eingreifen können' : 'Eingriffspunkt'}:</b> ${esc(e.text)}` +
        `${g.grund ? `<p>${esc(g.grund)}</p>` : ''}${Array.isArray(g.optionen) && g.optionen.length ? `<ul>${g.optionen.map(o => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}</div>`;
    }
    if (e.art === 'variante') return `<div class="tisch-variante"><b>Variante:</b> ${esc(e.aenderung || '')} · Tokens ${fmt(e.tokens_vorher)} → ${fmt(e.tokens_nachher)}<p>${esc(e.text || e.ergebnis || '')}</p></div>`;
    const kurz = String(e.text || '').slice(0, 280);
    return `<details class="tisch-eintrag tisch-${esc(e.art)}"><summary><b>${esc(sitzName(e.von))}</b> · ${esc(e.art)}${e.tokens ? ` · ${fmt(e.tokens)} Tokens` : ''}${e.datei ? ` · ${esc(e.datei)}` : ''}<span>${esc(kurz)}</span></summary><div class="tisch-text">${esc(e.text || '')}</div></details>`;
  }
  function detailHtml(t, esc) {
    if (!t || !t.erreichbar) return '<div class="empty">Sitzung nicht erreichbar (Ordner fehlt?)</div>';
    const m = t.meta || {}, sitze = Array.isArray(m.sitze) ? m.sitze : [];
    const sitzName = id => { const s = sitze.find(x => x.id === id); return s ? s.rolle : id === 'moderator' ? 'Moderator' : id === 'kevin' ? 'Kevin' : id; };
    const kopf = `<div class="tisch-kopf"><button type="button" class="tisch-zurueck" data-tisch-zurueck>← Alle Sitzungen</button><h3>${esc(m.titel || t.id)}</h3><span>${fmt(t.tokensGesamt)} Tokens gesamt</span></div>`;
    const leiste = '<div class="tisch-sitze">' + sitze.map(s => `<span class="tisch-sitz" data-blase="${esc(s.blase)}">${esc(s.rolle)} · ${esc(s.modell)} · ${fmt(t.tokensProSitz[s.id])}</span>`).join('') + '</div>';
    const nummern = [...new Set([...(m.runden || []).map(r => r.nr), ...t.eintraege.map(e => e.runde)])].filter(n => n != null).sort((a, b) => a - b);
    const runden = nummern.map(nr => { const r = (m.runden || []).find(x => x.nr === nr), liste = t.eintraege.filter(e => e.runde === nr);
      return `<section class="tisch-runde"><h4>Runde ${esc(nr)}${r ? ` · ${esc(r.titel)}` : ''}<span>${fmt(t.tokensProRunde[nr])} Tokens</span></h4>${liste.map(e => eintragHtml(e, sitzName, esc)).join('')}</section>`; }).join('');
    const leg = m.legende && typeof m.legende === 'object' ? Object.entries(m.legende) : [];
    const legende = leg.length ? `<details class="tisch-legende" open><summary>Legende (nur lokal)</summary><dl>${leg.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></details>` : '';
    return kopf + leiste + legende + runden;
  }
  const api = { listHtml, detailHtml };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CouncilTische = api;
})(this);
