---
key: browser-follow-submission-links
type: pattern
worker: haiku
arbeitsfeld: browser
confidence: 8
saves: einen zweiten Browser-Lauf und Rückfragen an Kevin
date: 2026-10-26
author: kevin
---
Wenn der Browser-Worker Einreichungen/Belege sammelt (Superteam Earn, Colosseum, Grants), soll er die eingereichten Links selbst öffnen und kurz festhalten, was dahinter liegt (Drive-Ordner: Ordnername, Dateinamen, Änderungsdatum in der Listenansicht; Repo/Video: Titel + Datum) – nur lesen, nichts herunterladen oder teilen. Haiku hatte „View Submission“-Links ausgelassen (Earn öffnet sie über einen Dialog „Open external link“, die URL steht im Dialogtext → abschreiben, auf „Cancel“ und die URL direkt im selben Tab aufrufen). Exakte Einreichungszeiten liefert Gmail besser als die Plattform (Earn-Feed zeigt nur „4d“, „1mo“ und das Gewinndatum): Suche `"submission received" OR "is submitted to"` + Zeitraum; `find` auf die Ergebniszeilen gibt die Datums-Tooltips mit Uhrzeit zurück, ohne jede Mail zu öffnen.
