---
key: temp-folders-vanish
type: pitfall
worker: opus
arbeitsfeld: allgemein
confidence: 10
saves: lange Fehlersuche an der falschen Stelle
date: 2026-10-20
author: kevin
---
Scratchpad- und `%TEMP%`-Ordner von Claude-Sitzungen werden zwischen Sitzungen gelöscht. Ein Render „spielte keine Videos“ – in Wahrheit fehlte der Clip-Ordner. Bei seltsamen Fehlern zuerst prüfen, ob Eingabedateien existieren. Wiederverwendbares gehört in `tools/` dieses Repos, Arbeitsdateien in einen festen Projektordner.
