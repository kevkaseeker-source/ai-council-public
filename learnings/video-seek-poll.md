---
key: video-seek-poll
type: pattern
worker: any
arbeitsfeld: video
confidence: 8
saves: hängende Render-Läufe (Protokoll-Timeout nach 180 s)
date: 2026-10-20
author: kevin
---
Beim Ansteuern eines `<video>` für Einzelbild-Aufnahmen nicht auf `loadeddata`/`seeked` warten – das Ereignis kommt nicht erneut, wenn es schon gefeuert hat. Stattdessen alle 5 ms prüfen: `readyState>=1` → `currentTime` setzen, fertig wenn `!seeking && readyState>=2`, Not-Ausgang nach 5 s.
