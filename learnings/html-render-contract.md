---
key: html-render-contract
type: architecture
worker: any
arbeitsfeld: video
confidence: 9
saves: Renderer muss den Inhalt nie kennen → darf an externe Worker; jede neue Animation sofort renderbar
date: 2026-10-20
author: kevin
---
HTML-Animationen für Video so bauen: Seite mit Hash `#render` schaltet in den Aufnahmemodus (Stage 1920×1080 oben links, keine Autoplay-Videos), `window.__duration` = Länge, `await window.__seek(t)` setzt alle CSS-Animationen (`getAnimations({subtree:true})`, pause + currentTime) und Videos auf Zeit t. `tools/render.mjs` nimmt damit Bild für Bild auf.
