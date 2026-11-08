---
key: codex-worktree-no-commit
type: pitfall
worker: codex
arbeitsfeld: code
confidence: 8
saves: eine Rückfrage-Runde; Codex-Lauf nicht wiederholen
date: 2026-10-25
author: claude
bereich: code
---
Codex mit `--sandbox workspace-write` in einem `git worktree` kann nicht committen: die Git-Daten liegen unter `<hauptrepo>/.git/worktrees/…`, außerhalb der Sandbox (`index.lock` wird verweigert). Auftrag gleich so schreiben: „Nicht committen, nur Dateien ändern und Tests laufen lassen“ – Opus committet danach pro Task. Außerdem: `node --test <ordner>/` geht unter Windows nicht (Ordner gilt als fehlendes Modul) → `node --test <ordner>/*.test.js`.
