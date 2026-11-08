# render.mjs – HTML-Animation → MP4

Nimmt eine Seite nach dem Vertrag in `learnings/html-render-contract.md` Bild für Bild mit Chrome auf und legt Sprach-/Ton-Cues darunter.

```powershell
npm install            # einmalig, installiert puppeteer-core
node render.mjs --page <seite.html> --audio <cues.json> --out <film.mp4> `
  --chrome "C:\Program Files\Google\Chrome\Application\chrome.exe" --ffmpeg <ffmpeg.exe> [--fps 25] [--from 0] [--to 30] [--lufs -23]
```

`cues.json`: `[{"file": "C:/…/vo1.wav", "start": 0.3, "gain": 1}]`

Richtwert: 30 s bei 25 fps (750 Bilder) ≈ 100 s auf einem Laptop. Erst mit `--from/--to` 2 Sekunden testen und ein Bild ansehen, dann komplett rendern.
Geschrieben von Codex, geprüft und korrigiert von Opus (2026-10-20).
