---
key: codex-sandbox-blocks-wsl
type: pitfall
worker: codex
arbeitsfeld: code
confidence: 9
saves: einen Codex-Lauf, der Rust/Anchor-Builds in WSL nicht ausführen kann
date: 2026-11-02
author: claude
bereich: code
---
Codex unter Windows (`--sandbox workspace-write`) darf `wsl …` nicht starten („rejected: blocked by policy“), kann also Toolchains, die nur in WSL liegen (Rust, Solana CLI, Anchor), nicht bauen/testen. Lösung: Worker `codex-wsl` (Codex + Node über nvm in WSL installiert, `codex login` einmal durch den Besitzer): `node tools/run/council-run.mjs codex-wsl TASK.md --sandbox workspace-write [--network]` – läuft in der Linux-Sandbox, baut und testet selbst; `--network` nur, wenn `cargo` Crates laden muss. Nie `danger-full-access`.
