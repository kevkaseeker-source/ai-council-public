---
key: gdrive-recursive-search-slow
type: pitfall
worker: any
arbeitsfeld: infra
confidence: 9
saves: 5+ Minuten pro Suche
date: 2026-10-20
author: kevin
---
Rekursive Suche (`find`, `Glob`, `Get-ChildItem -Recurse`) über ein gestreamtes Google-Drive-Laufwerk (G:) läuft in Timeouts. Zuerst im wahrscheinlichen Unterordner suchen (z. B. `Sales/Collateral`), Tiefe begrenzen, nach Dateinamen statt Inhalt suchen.
