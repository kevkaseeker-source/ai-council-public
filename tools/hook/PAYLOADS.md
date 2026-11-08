# Hook-Payloads (Claude Code, erfasst 2026-10-20, VS-Code-Erweiterung)

Fixtures: `test/fixtures/*.json` (bereinigt), Reihenfolge wie aufgenommen in `test/fixtures/sequence.json`.

| Feld | wo | Bedeutung |
|---|---|---|
| `hook_event_name` | alle | `SessionStart, PreToolUse, PostToolUse, SubagentStart, SubagentStop, Stop` |
| `session_id` | alle | Sitzung |
| `tool_name`, `tool_input`, `tool_use_id` | Pre/PostToolUse | Werkzeug; `tool_input` je Werkzeug (`file_path`, `command`, `pattern`, `path`, Agent: `description, prompt, model, subagent_type`) |
| `tool_response`, `duration_ms` | PostToolUse | Ergebnis (nie loggen), Dauer |
| `agent_id`, `agent_type` | SubagentStart/Stop und alle Werkzeug-Events **innerhalb** eines Unteragenten | `agent_type` ist der Agententyp (z. B. `general-purpose`), **nicht** das Modell |
| `agent_transcript_path` | SubagentStop | Protokoll des Unteragenten |
| `permission_mode`, `effort`, `prompt_id`, `scratchpad_dir`, `cwd`, `transcript_path` | meist | ignorieren |
| `background_tasks` | SubagentStop | kann URLs enthalten → nie loggen |

## Wer ist wer

- Kein `agent_id` → **opus** (Hauptsitzung).
- `tool_name` beginnt mit `mcp__claude-in-chrome__` → **browser** (egal wer).
- Mit `agent_id` → Modell steht **nicht** im Payload. Regel: Bei `PreToolUse` mit `tool_name: "Agent"` (ohne `agent_id`) `tool_input.model` (`haiku|sonnet|opus`, fehlt → `other`) in eine Warteschlange legen; bei `SubagentStart` vorderstes Element entnehmen und `agent_id → modell` merken. Alle späteren Events mit diesem `agent_id` bekommen dieses Modell. Unbekannte `agent_id` → `other`.
- Zustand (Warteschlange + Zuordnung) liegt in `<logsDir>/agents-state.json`, damit er zwischen Hook-Aufrufen erhalten bleibt.

Synthetisch ergänzt (nicht aufgenommen): `opus.SessionStart.start.json`, `opus.Stop.end.json` (Felder laut Doku), `browser.PreToolUse.navigate.json` (Chrome war nicht im Einsatz).
