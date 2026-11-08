# Baustein: Render-/Video-Skripte (an Codex-Aufträge anhängen)

- puppeteer: Viewport über `defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 }` in `puppeteer.launch` setzen – nicht in `newPage()`.
- Ton: am Ende der Filterkette `aformat=channel_layouts=stereo`; Lautheit für TV `loudnorm=I=-23:TP=-1.5:LRA=11`.
- Frames per `image2pipe` (mjpeg) an ffmpeg, Backpressure beachten (`drain`).
- Keine Paket-Installationen, kein Netzwerk; nur `node --check` ausführen, Bericht ≤ 10 Zeilen.
- Seite nicht inhaltlich kennen müssen: nur über `window.__duration` und `await window.__seek(t)` steuern (siehe learnings/html-render-contract.md).
