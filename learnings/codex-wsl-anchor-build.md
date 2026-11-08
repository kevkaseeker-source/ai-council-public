---
key: codex-wsl-anchor-build
type: pitfall
worker: codex-wsl
confidence: 8
saves: einen langen Codex-Lauf (~5,5 Mio. Input-Tokens) pro Anchor-Aufgabe
date: 2026-11-02
author: claude
bereich: solana
---
Codex in der WSL-Sandbox (`workspace-write`) kann `anchor build` / `cargo build-sbf` nicht abschließen: build-sbf will den Platform-Tools-Cache unter `~/.cache/solana` reparieren, und HOME ist dort schreibgeschützt. Codex probiert dann lange mit CARGO_HOME/HOME-Tricks herum. Besser so:

1. Im Auftrag sagen: „Run `cargo check`, `cargo clippy` and `cargo test` only. Do NOT run `anchor build`; the reviewer builds the .so.“ Tests, die die .so brauchen, dürfen dann rot sein.
2. Der Reviewer (Opus) baut außerhalb der Sandbox und startet die Tests.
3. Anchor 0.32.1 + Solana CLI 3.0.x: Die Standard-Platform-Tools v1.51 (Cargo 1.84) scheitern an edition-2024-Crates (`blake3` ≥1.8.3, `zeroize_derive` 1.5). Lösung: `anchor build --no-idl -- --tools-version v1.54` und danach `anchor idl build -o target/idl/<name>.json`. Ein `--` direkt nach `anchor build` ohne `--no-idl` landet auch beim IDL-`cargo test` und scheitert.
4. LiteSVM-Tests: Den .so-Pfad mit `concat!(env!("CARGO_MANIFEST_DIR"), "/../../target/deploy/<name>.so")` angeben. `cargo test` läuft im Paketordner, deshalb findet ein relativer Pfad `target/deploy/...` die Datei nicht.
5. Warteschleife mit `pgrep -f 'codex exec --json'` findet sich selbst (Muster steht in der eigenen Befehlszeile) und endet nie → `pgrep -f '[c]odex exec --json'` nutzen.
