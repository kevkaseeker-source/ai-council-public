// Event-Tisch: Bei neuen Anthropic/OpenAI/Hermes-Events beraten vier Sitze (Grok, nur öffentliche Daten), was Kevin
// dort für Sichtbarkeit tun kann. Runde 1 parallel und blind, Runde 2 Synthese. Protokoll: events/tische/<id>/ (live im Dashboard).
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { neu, eintrag, rundeFertig } from '../tisch/tisch.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FACTS = "G:/Meine Ablage/Kevin's stuff/Content/kampagne/public_facts.md";
const ZIEL = `Kevins Ziel: langfristig Sichtbarkeit in der Berliner KI-Szene (Anthropic, OpenAI, Hermes/Nous). Gewichtung, alle gleich wichtig:
selbst zeigen (Show & Tell, Demos, Talks), Leute kennenlernen (Organisatoren, Leute von Anthropic/OpenAI), Hackathons gewinnen und API-Credits abholen,
Posts rund um Events (X @KEBNH123 / @R0boPay, LinkedIn). Kevin wählt selbst aus, welche Events er besucht; ihr empfehlt nur.`;
export const SITZE = [
  { id: 'scout', name: 'Event-Scout', auftrag: 'Ordne die Events nach Nutzen für Kevins Ziel. Nenne die Top 5 mit je einem Satz Begründung und was vorher nötig ist (Anmeldung mit Bewerbung, Frist, Warteliste).' },
  { id: 'content', name: 'Content & Netzwerk', auftrag: 'Für die Top-Events: wen Kevin dort gezielt ansprechen sollte (Rollen, z. B. Organisator, Speaker), welcher Post davor/danach echten Wert hat (ein konkreter Fakt, kein Hype, max. 1 Emoji) und wie er nachfasst.' },
  { id: 'pitch', name: 'Pitch', auftrag: 'Wo kann Kevin selbst etwas zeigen (Show & Tell, Lightning Talk, Hackathon)? Schlage pro Event eine 2-Minuten-Demo vor, die zum Publikum passt (z. B. Claude-Code-Orchestrierung mit Subagenten, Roboter bekommt Geld auf Solana).' },
  { id: 'skeptiker', name: 'Skeptiker', auftrag: 'Was ist Zeitverschwendung oder Überschneidung (Breakpoint London 14.–17.11.)? Welche Events wirken größer, als sie sind? Welche Empfehlung der anderen würdest du streichen?' }
];

function grok(task, dir, name) {
  return new Promise(resolve => {
    const file = join(dir, `TASK_${name}.md`);
    writeFile(file, task, 'utf8').then(() => {
      const child = spawn(process.execPath, [join(ROOT, 'tools', 'run', 'council-run.mjs'), 'grok-4.7', file, '--cwd', dir], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
      let out = '', text = '';
      child.stdout.on('data', c => { out += c; const lines = out.split(/\r?\n/); out = lines.pop(); for (const l of lines) { try { const j = JSON.parse(l); if (j.type === 'text') text += j.data; } catch {} } });
      child.on('close', () => resolve(text.trim() || '(keine Antwort)'));
      child.on('error', () => resolve('(Grok nicht gestartet)'));
    });
  });
}

export function eventListe(events, now = new Date(), tage = 21) {
  const bis = now.getTime() + tage * 86400000;
  return events.filter(x => Date.parse(x.start) <= bis)
    .map(x => `- ${x.start.slice(0, 16).replace('T', ' ')} UTC | ${x.label} | ${x.name} | ${x.place || 'Berlin'} | ${x.host} | ${x.url}`).join('\n');
}

export async function tisch(events, neue, { now = new Date() } = {}) {
  const id = `${now.toISOString().slice(0, 10)}-event-tisch`;
  const ordner = join(ROOT, 'events', 'tische', id);
  const tmp = join(os.tmpdir(), 'council-event-tisch', id);
  await mkdir(tmp, { recursive: true });
  neu(ordner, { id, titel: 'Event-Tisch: Sichtbarkeit in Berlin', anlass: `Neue Events: ${neue.map(x => x.name).join(' · ')}`,
    sitze: SITZE.map(s => ({ id: s.id, name: s.name, worker: 'grok-4.7' })), moderator: 'grok-4.7', freigabe: 'öffentlich' }, { root: ROOT });
  let facts = ''; try { facts = await readFile(FACTS, 'utf8'); } catch {}
  let angemeldet = []; try { angemeldet = (await readFile(join(ROOT, 'events', 'angemeldet.txt'), 'utf8')).split(/\r?\n/).filter(l => l.startsWith('http')); } catch {}
  const fest = angemeldet.length ? `Kevin ist bereits angemeldet (feste Termine, nicht streichen, sondern dafür planen: wen ansprechen, was zeigen, welcher Post):\n${angemeldet.map(u => `- ${events.find(x => x.url === u)?.name || ''} ${u}`).join('\n')}\n\n` : '';
  const basis = `Do NOT run any shell commands and do not open files; everything you need is below. Answer in German, max 15 lines, plain text.\n\n${ZIEL}\n\n${fest}Öffentliche Fakten zu Kevin/RoboPay:\n${facts.slice(0, 4000)}\n\nAnlass (neu entdeckt): ${neue.map(x => x.name).join(' · ')}\n\nEvents in Berlin, nächste 3 Wochen:\n${eventListe(events, now)}\n`;
  const runde1 = await Promise.all(SITZE.map(s => grok(`${basis}\nDeine Rolle am Tisch: ${s.name}. ${s.auftrag}`, tmp, s.id)));
  SITZE.forEach((s, i) => eintrag(ordner, { runde: 1, von: s.id, art: 'beitrag', text: runde1[i] }));
  rundeFertig(ordner, 1);
  const synthese = await grok(`${basis}\nDu moderierst. Hier die Beiträge der vier Sitze:\n\n${SITZE.map((s, i) => `### ${s.name}\n${runde1[i]}`).join('\n\n')}\n\nFasse zusammen: zuerst die festen Termine mit je 1–3 Schritten, dann bis zu 3 weitere Events mit je 1–3 konkreten Schritten für Kevin (anmelden/bewerben, wen ansprechen, was zeigen, welcher Post). Streiche, was der Skeptiker überzeugend verworfen hat. Max 15 Zeilen.`, tmp, 'synthese');
  eintrag(ordner, { runde: 2, von: 'moderator', art: 'synthese', text: synthese });
  await appendFile(join(ROOT, 'bereiche', 'events.stand.md'), `\n## ${now.toISOString()}\nEvent-Tisch (${neue.length} neue Top-Events) – Empfehlung:\n${synthese}\n`, 'utf8');
  return { id, ordner, synthese };
}

if (process.argv[1] && import.meta.url.toLowerCase() === pathToFileURL(process.argv[1]).href.toLowerCase()) {
  // Von Hand: node tools/luma/event-tisch.mjs → berät über die aktuelle Liste (events/luma-events.json)
  (async () => {
    const events = JSON.parse(await readFile(join(ROOT, 'events', 'luma-events.json'), 'utf8'));
    const r = await tisch(events, events.filter(x => x.tier === 1).slice(0, 5));
    console.log(r.synthese);
  })().catch(err => { console.error(err.message); process.exitCode = 1; });
}
