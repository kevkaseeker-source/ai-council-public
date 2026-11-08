---
key: codex-json-late-steps
type: tool
worker: codex
arbeitsfeld: code
confidence: 7
saves: Fehlersuche an der Live-Anzeige
date: 2026-10-20
author: kevin
---
`codex exec --json` meldet einen Befehl (`item.started command_execution`) erst, wenn er fertig ist – bei einem 25-s-Befehl kam die Zeile nach 27 s. Live-Schritte von Codex sind also grob; Status und Laufzeit kommen zuverlässig aus `council-run` (start/end). Für sichtbaren Fortschritt lieber mehrere kurze Schritte beauftragen.
