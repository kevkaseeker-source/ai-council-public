---
key: grok-plan-keine-befehle
type: pitfall
worker: grok-4.7
confidence: 8
saves: einen verlorenen Grok-Lauf pro Textauftrag
date: 2026-10-27
author: claude
bereich: alle
---
Grok im Plan-Modus (`council-run.mjs`, headless) will bei Textaufträgen mit Längenvorgabe (z. B. „≤ 280 Zeichen“) gern einen Shell-Befehl zum Zeichenzählen ausführen; das wird ohne Freigabe abgebrochen und die Antwort ist leer (`permission required … headless run cannot ask`). Bei reinen Text-/Beratungsaufträgen oben in den Auftrag schreiben: „Führe keinerlei Befehle oder Werkzeuge aus (auch nicht zum Zählen) – nur Text antworten.“ Antworttext steht in den `{"type":"text","data":…}`-Events.
