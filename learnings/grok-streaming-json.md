---
key: grok-streaming-json
type: tool
worker: grok-4.7
arbeitsfeld: code
confidence: 8
saves: Live-Sicht auf Grok statt Antwort erst am Ende
date: 2026-10-20
author: kevin
---
`grok -p … --output-format streaming-json` liefert NDJSON: `thought` (Gedanken-Häppchen), `text` (Antwort-Häppchen), `tool_call`/`tool_call_update`, `usage` (Tokens), `end`. Häppchen gleicher Art zusammenfassen. Im Plan-Modus bricht Grok Terminal-Befehle ab (`status: failed`, „User cancelled“).
