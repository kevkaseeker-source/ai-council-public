---
key: claude-subagent-base-cost
type: pitfall
worker: haiku
arbeitsfeld: allgemein
confidence: 9
saves: zehntausende Claude-Tokens bei Kleinstaufgaben
date: 2026-10-20
author: kevin
---
Jeder Claude-Unteragent (auch Haiku) kostete ~45.000 Tokens Grundlast, selbst für 2–3 Werkzeugaufrufe. Kleine Aufgaben (eine Datei lesen, eine kurze Prüfung) macht Opus direkt; Unteragenten nur, wenn sie viel lesen/suchen und wenig zurückgeben. Code-Prüfung kleiner Dateien: Opus liest selbst statt Prüf-Unteragent.
