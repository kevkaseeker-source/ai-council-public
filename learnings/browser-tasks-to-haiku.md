---
key: browser-tasks-to-haiku
type: pattern
worker: haiku
arbeitsfeld: browser
confidence: 8
saves: Opus-Tokens bei jeder Webseiten-Auswertung (Listen, Preise, Links einsammeln)
date: 2026-10-21
author: kevin
---
Browser-Aufgaben mit mehreren Schritten (Seite auslesen, Listen/Preise scrapen, Detail-Links per Klick einsammeln) gehen an den Browser-Worker (Haiku-Unteragent mit Chrome-Tools), auch wenn sie klein wirken; Opus schreibt nur Auftrag und prüft das Ergebnis – Opus hatte so eine Aufgabe einmal selbst erledigt und der Nutzer hat es bemerkt. Faustregel: ab ~3 Seiten oder wenn Listen/Preise/Links gesammelt werden → Haiku; ein einzelner kurzer Blick oder Klick → Opus direkt (Unteragent hat feste Grundlast, siehe claude-subagent-base-cost). Haiku ist ungenauer (z. B. 2 von 6 Detail-Links nicht gefunden) → Auftrag mit Fallback ("not found") und Opus prüft. Tricks: Ergebnisse aus `javascript_tool` in Blöcken (~15–20 Einträge) zurückgeben, sonst wird die Ausgabe abgeschnitten; URLs mit Query-String werden vom Tool blockiert → nur `origin + pathname` auslesen; Entfernungen ohne API-Key per Nominatim (1 Anfrage/s, eigener User-Agent) + Haversine, ~3 % Fehlortungen → Ausreißer (z. B. > 15 km im Stadtgebiet) verwerfen.
