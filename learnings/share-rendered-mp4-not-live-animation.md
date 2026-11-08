---
key: share-rendered-mp4-not-live-animation
type: pitfall
worker: opus
arbeitsfeld: video
confidence: 9
saves: peinliche Standbilder beim Kunden / Chef
date: 2026-10-21
author: kevin
---
Eine Vorschau-Seite, die mehrere Clips per Skript stumm abspielt (Live-Animation), zeigt auf dem iPhone und im Telegram-In-App-Browser oft nur ein Standbild (Autoplay-Sperre, Stromsparmodus, Decoder-Limit). Zum Weitergeben immer die **gerenderte MP4** in einem normalen `<video controls playsinline poster>` zeigen; fürs Web auf 720p (`-crf 25 -movflags +faststart`, ~3–4 MB für 30 s) verkleinern.
