---
key: codex-real-run-after-tests
type: pitfall
worker: codex
arbeitsfeld: code
confidence: 9
saves: kaputte Standardpfade, die Tests nicht abdecken
date: 2026-10-20
author: kevin
---
Codex bestand alle Tests, aber ungetestete Wege waren kaputt: Standard-Logpfad über `new URL(...).pathname` (unter Windows `/C:/…`) und `spawn("codex")` ohne Shell (npm-Shim `.cmd` braucht `shell: true`). Nach grünen Tests immer einen echten Lauf ohne Test-Umgebungsvariablen machen; Baustein `prompt-bausteine/codex-node-windows.md` anhängen.
