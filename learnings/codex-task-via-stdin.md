---
key: codex-task-via-stdin
type: tool
worker: codex
arbeitsfeld: code
confidence: 9
saves: kaputte Aufträge durch Anführungszeichen in PowerShell 5.1
date: 2026-10-20
author: kevin
---
Auftrag als `TASK.md` in einen eigenen Temp-Ordner schreiben und per stdin übergeben: `Get-Content TASK.md -Raw | codex exec --skip-git-repo-check --sandbox workspace-write -`. Auftrag endet mit „nur `node --check`, Bericht ≤ 10 Zeilen, nicht ausführen“. Kosten-Richtwert: ~90-Zeilen-Skript ≈ 24.000 OpenAI-Tokens.
