// three.js gibt es ab r16x nur als ES-Modul. 3d-force-graph nimmt window.THREE beim Laden,
// darum: erst three setzen, dann Bibliothek und Universum nachladen (eine einzige three-Instanz).
import * as THREE from './vendor/three/three.module.js';
window.THREE = THREE;
const nonce = document.querySelector('script[nonce]')?.nonce || '';
const base = new URL('.', import.meta.url).href;
const load = src => new Promise((resolve, reject) => {
  const s = document.createElement('script'); s.src = base + src; s.nonce = nonce; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
});
await load('vendor/3d-force-graph.min.js');
await load('universe.js');
window.dispatchEvent(new Event('council-universe-ready'));
