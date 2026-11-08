---
key: external-cli-inherits-mcp
type: pitfall
worker: grok-4.7
arbeitsfeld: infra
confidence: 8
saves: unbemerkter Zugriff externer Worker auf eigene Server
date: 2026-10-20
author: kevin
---
Die Grok-CLI listet MCP-Werkzeuge, die nur in der Claude-Konfiguration (`~/.claude.json`) eingetragen sind – sie übernimmt also MCP-Server von Claude. Externe Worker können damit eigene Server erreichen. Vor dem Einsatz die Werkzeugliste prüfen (`available_commands` in streaming-json) und unerwünschte MCP-Server für die CLI abschalten. Lösung Grok-CLI 1.0.62: in `~/.grok/config.toml` Abschnitt `[compat.claude]` mit `mcps = false`, `hooks = false`, `rules = false` (sonst geht die globale CLAUDE.md bei jedem Aufruf an xAI), `skills = false`, `agents = false`; prüfen mit `grok inspect` (Einträge zeigen `[disabled]`). Claude-Plugins (z. B. superpowers) lassen sich dort nicht abschalten.
