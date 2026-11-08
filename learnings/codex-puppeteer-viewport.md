---
key: codex-puppeteer-viewport
type: pitfall
worker: codex
arbeitsfeld: video
confidence: 9
saves: eine Nachbesserungsrunde pro Render-Skript
date: 2026-10-20
author: kevin
---
Codex schrieb `browser.newPage({viewport})` – puppeteer ignoriert das, die Seite lief in 800×600. Und der Ton blieb mono. Lösung: Baustein `prompt-bausteine/codex-render.md` an jeden Render-Auftrag hängen (`defaultViewport` im `launch`, `aformat=channel_layouts=stereo`).
