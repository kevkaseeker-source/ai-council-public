import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ARTEN = new Set(['frage', 'antwort', 'beitrag', 'kritik', 'synthese', 'eingriff', 'variante']);
const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function neu(ordner, meta, { root = DEFAULT_ROOT } = {}) {
  if (!/^[A-Za-z0-9._-]+$/.test(String(meta.id || ''))) throw new Error('ungültige id');
  fs.mkdirSync(ordner, { recursive: true });
  fs.writeFileSync(path.join(ordner, 'tisch.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
  if (!fs.existsSync(path.join(ordner, 'eintraege.jsonl'))) fs.writeFileSync(path.join(ordner, 'eintraege.jsonl'), '', 'utf8');
  fs.mkdirSync(path.join(root, 'tische'), { recursive: true });
  fs.writeFileSync(path.join(root, 'tische', `${meta.id}.json`), JSON.stringify({ pfad: path.resolve(ordner) }), 'utf8');
}
export function eintrag(ordner, e) {
  if (!ARTEN.has(e.art)) throw new Error('unbekannte art: ' + e.art);
  if (typeof e.von !== 'string' || !e.von) throw new Error('von fehlt');
  fs.mkdirSync(ordner, { recursive: true });
  fs.appendFileSync(path.join(ordner, 'eintraege.jsonl'), JSON.stringify({ ts: new Date().toISOString(), ...e }) + '\n', 'utf8');
}
export function rundeFertig(ordner, runde) {
  eintrag(ordner, { runde: Number(runde), von: 'moderator', art: 'eingriff', text: `Runde ${runde} fertig`,
    eingriff: { grund: 'Ergebnisse liegen vor, nächste Runde noch nicht gestartet', optionen: ['Frage an den Tisch stellen', 'Sitz austauschen', 'Runde wiederholen', 'weiter'], auto: true } });
}
if (process.argv[1] && import.meta.url.toLowerCase() === pathToFileURL(process.argv[1]).href.toLowerCase()) {
  const [cmd, ordner, flag, json] = process.argv.slice(2), obj = flag === '--json' && json ? JSON.parse(json) : {};
  if (cmd === 'neu') neu(ordner, obj);
  else if (cmd === 'runde-fertig') rundeFertig(ordner, obj.runde);
  else if (cmd === 'eintrag') eintrag(ordner, obj);
  else if (cmd === 'eingriff') eintrag(ordner, { von: 'moderator', art: 'eingriff', ...obj, eingriff: { auto: false, ...(obj.eingriff || {}) } });
  else if (cmd === 'variante') eintrag(ordner, { von: 'moderator', art: 'variante', ...obj });
  else { console.error('Nutzung: tisch.mjs <neu|eintrag|eingriff|runde-fertig|variante> <ordner> --json'); process.exit(2); }
}
