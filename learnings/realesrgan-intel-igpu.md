---
key: realesrgan-intel-igpu
type: tool
worker: opus
arbeitsfeld: video
confidence: 8
saves: Stunden Rechenzeit beim Hochskalieren
date: 2026-10-20
author: kevin
---
Real-ESRGAN (ncnn-vulkan, Windows-Release v0.2.5.0) auf Intel-iGPU: `realesrgan-x4plus` ≈ 84 s pro Bild (unbrauchbar für Video), `realesr-animevideov3 -s 2` ≈ 2,5 s pro Bild – für KI-Clips gut genug. Echte Details erfindet es nicht; „gemalte“ Artefakte bleiben. Erst ein Testbild timen, dann alles.
