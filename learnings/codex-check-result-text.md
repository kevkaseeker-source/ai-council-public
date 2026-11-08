---
key: codex-check-result-text
type: pitfall
worker: codex
arbeitsfeld: code
confidence: 9
saves: unbemerkt nicht erledigte Aufträge
date: 2026-10-20
author: kevin
---
Codex beendet sich mit Exit 0, auch wenn er die Aufgabe nicht geschafft hat („I did not complete the requested … The replacement failed“). Immer den Antworttext (`result`-Zeile im Council-Log) lesen, nicht nur den Exit-Code. Ursache hier: Codex konnte eine Datei mit sehr langen, dichten Zeilen nicht gezielt ändern – Lösung: neue Funktion in eine **neue Datei** schreiben lassen und selbst einbinden.
