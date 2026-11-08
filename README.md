# AI-Council – Wissensdatenbank

Gemeinsames Wissen für ein „AI-Council“: Ein starkes Modell (z. B. Claude Opus) plant und prüft, günstigere Worker (Grok-CLI, Codex-CLI, Claude Haiku/Sonnet) erledigen die Fleißarbeit. Dieses Repo sammelt, was dabei funktioniert und was nicht, damit jede Runde weniger Nachbesserung und weniger Tokens braucht.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `INDEX.md` | eine Zeile pro Lernpunkt: Stichwort → Datei. **Immer zuerst hier suchen.** |
| `learnings/<key>.md` | ein Lernpunkt pro Datei (Format unten) |
| `prompt-bausteine/` | Checklisten, die an Aufträge für Worker angehängt werden |
| `tools/` | wiederverwendbare Skripte (z. B. HTML-Animation → MP4) |
| `skills/` | Claude-Code-Skills `council-learn` und `council-retro` |

## Regeln (gelten für alle, die hier schreiben)

1. **Nur Technik.** Keine Firmen-, Kunden- oder Projektdaten, keine Verträge, Preise oder internen Namen.
2. **Keine Secrets:** keine Keys, Tokens, Passwörter, `.env`-Inhalte, Wallet-Dateien – auch nicht gekürzt.
3. **Ein Lernpunkt pro Datei**, kurz. Bestehende Datei aktualisieren statt doppeln; Falsches löschen.
4. **Jede Änderung über einen Branch + Pull Request**, nicht direkt auf `main`.
5. Alles hier darf auch in Aufträge an externe Worker (Grok/Codex) – deshalb Regel 1 und 2.

## Format eines Lernpunkts

```markdown
---
key: codex-puppeteer-viewport
type: pitfall            # pattern | pitfall | tool | prompt | architecture
worker: codex            # opus | grok-4.7 | grok-4.7-build-fast | codex | haiku | sonnet | any
arbeitsfeld: video        # video | code | text | recherche | browser | infra | allgemein
confidence: 9            # 1–10
saves: eine Nachbesserungsrunde pro Render-Skript
date: 2026-10-20
author: kevin
---
Ein bis drei Sätze: Was ist passiert, was ist die Lösung, wie wendet man sie an.
```

Danach eine Zeile in `INDEX.md` ergänzen.

## Nutzung mit Claude Code

Skills einmalig verlinken (Windows, PowerShell):

```powershell
New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\skills\council-learn" -Target "<repo>\skills\council-learn"
New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\skills\council-retro" -Target "<repo>\skills\council-retro"
```

- Vor dem Delegieren: `/council-learn search <stichwort>`
- Nach einer Council-Sitzung: `/council-retro` → schlägt neue Lernpunkte vor und trägt sie nach Bestätigung ein.

## Mitschreiben (Logbuch für das Dashboard)

- `tools/hook/council-hook.mjs` – Claude-Code-Hook (in `~/.claude/settings.json`): jeder Schritt von Opus und Claude-Unteragenten wird eine Zeile in `logs/events-YYYY-MM-DD.jsonl`. Kostet keine Claude-Tokens, gibt nichts an Claude zurück.
- `tools/run/council-run.mjs` – startet Codex/Grok, reicht ihre Ausgabe unverändert durch und schreibt Schritte, Gedanken und Tokens ins selbe Logbuch: `node tools/run/council-run.mjs codex <TASK.md> [--sandbox workspace-write]`. Arbeitsordner auf `G:` werden abgelehnt.
- `logs/` und `notes/` bleiben **lokal** (`.gitignore`) – sie können Pfade oder Befehle aus Firmenarbeit enthalten.
- Tests: `node --test dashboard/test/*.test.js` (Windows: mit `*.test.js`). Vorschau: `node dashboard/preview/shot.mjs <ordner>`, Bestandsliste: `node dashboard/preview/shot-inventory.mjs <ordner>`.

## Dashboard (VS-Code-Erweiterung `dashboard/`)

- Im Universum zeigen Opus-Sitzungen als einzelne Figuren ihren Bereich; Rollen-Figuren sind blasse Zuständigkeits-Abzeichen. Der Council-Repo-Kern zeigt lokalen Git-Stand und Profil-Sync. Klick auf einen Bereich öffnet oben die letzte Übergabe; neue Sitzungen lesen `bereiche/<id>.stand.md`, am Ende ergänzen mit `node tools/stand/stand.mjs <id> "erledigt / offen / Entscheidungen"`. Stand-Dateien bleiben lokal und sind gitignored.

- Installieren: in `dashboard/` `npx --yes @vscode/vsce@3 package --allow-missing-repository --skip-license -o council-dashboard.vsix`, dann `code --install-extension council-dashboard.vsix --force` und Fenster neu laden.
- Öffnen: `Strg+Alt+C` → Council rechts neben dem Claude-Chat (weitere Befehle: „Council: Über dem Chat öffnen“, „… Als eigenes Fenster öffnen“).
- Oben: Sitzung wählen (alle Claude-Chat-Tabs, mit Bereich 🏢 Staex / 🔒 Privat / 🟠 Kevin's stuff), „→ zum Tab“, ⚙ (Ordner wechseln → neues Fenster, Bereichsfilter, private Sitzungen anzeigen, Tokens heute).
- Mitte: Organigramm – Opus oben, darunter Extern (Codex, Grok) und Claude-Helfer nach Tätigkeit; Klick auf einen Avatar zeigt Details/Gedanken.
- Unten: **Aktivität** (neueste oben, Klick zeigt Volltext), **Erkenntnisse** (Lernpunkte nach Arbeitsfeld, Suche), **Universum** (3D: ziehen dreht, Mausrad zoomt, Klick → Details; Knopf „3D“ schaltet auf das 2D-Netz mit Notizen, abarbeiten mit `/council-learn notes`). Bereiche kommen aus `bereiche/*.json` (nur lokal, gitignored: Pfade, Ziele, `extern: false` = nur Claude-Worker, `status: pause`), Team-Profile aus `profile/*.json`.
- Privatschutz: in einem Staex-Fenster erscheinen private Sitzungen nur als „🔒 Privat“ ohne Titel, Verlauf oder Log, bis man sie im ⚙-Menü einblendet.
- UI-Vorschau ohne VS Code: `node dashboard/preview/shot.mjs <ordner> 700 900` (Screenshots je Tab mit Beispieldaten).
- Liest nur lokale Dateien (`logs/`, `learnings/`, `notes/`, Claude-Protokolle für Modell/Gedanken der Unteragenten); kein Netzwerk.
- Tests: `node --test dashboard/test/*.test.js` (Windows: mit `*.test.js`). Vorschau: `node dashboard/preview/shot.mjs <ordner>`, Bestandsliste: `node dashboard/preview/shot-inventory.mjs <ordner>`.

Bereichsdateien können zusätzlich `werkzeuge: [{"name":"Dokumentation","url":"https://example.org"}]`, `nutzt: [{"bereich":"daten","was":"Messwerte"}]`, `chat: "grok-4.7"` (oder `"claude"`), `chatOptions: ["claude", "codex"]` und `chatKontext: ["public/overview.md"]` enthalten. Werkzeuge erscheinen als anklickbare Knoten; `nutzt` zeichnet feste Datenflüsse, erkannte Dateizugriffe ergänzen aktive Flüsse. Der Bereichs-Chat bietet Claude, Grok und Codex nach Bereichsfreigabe, speichert ein gemeinsames lokales Protokoll in `logs/chat-<bereich>.jsonl` und erlaubt ausdrücklich bestätigte Übergaben. Externe Agenten erhalten nur das Protokoll und ausdrücklich in `chatKontext` aufgeführte Dateien. `extern: false` erzwingt Claude.
