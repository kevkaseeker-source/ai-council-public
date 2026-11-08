---
key: claude-hook-no-model
type: tool
worker: opus
arbeitsfeld: code
confidence: 9
saves: falsche Zuordnung Haiku/Sonnet im Log
date: 2026-10-20
author: kevin
---
Claude-Code-Hooks liefern bei Unteragenten nur `agent_id` und `agent_type` (z. B. general-purpose), nicht das Modell. Das Modell steht nur im vorherigen `PreToolUse` mit `tool_name: Agent` (`tool_input.model`). Zuordnung per Warteschlange bis `SubagentStart` – siehe `tools/hook/PAYLOADS.md`.
