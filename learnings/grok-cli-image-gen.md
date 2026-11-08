---
key: grok-cli-image-gen
type: workaround
worker: grok-4.7
arbeitsfeld: content
confidence: 6
saves: Browser-Läufe (Flow/DaVinci) für Entwurfsbilder; Grok-Bild in ~15 s ohne Claude-Tokens
date: 2026-10-25
author: claude
---
Grok-CLI hat ein eingebautes `image_gen` (Imagine), headless aber nur mit `--tools image_gen,write,list_dir --always-approve --sandbox workspace-write` (`--allow imagine`/`image_gen(*)` werden nicht erkannt; `council-run.mjs` erzwingt Plan-Modus → dort geht es noch nicht). Das Bild landet NICHT im Arbeitsordner, sondern in `~/.grok/sessions/<cwd url-kodiert>/<session-id>/images/1.jpg` (Pfad steht im JSON-Stream nach "saved to") → selbst kopieren; Grok ohne Shell legt sonst Platzhalter-Dateien an. Ergebnis 3:4 = 864×1152 (Flow: 1792×2400); Schwächen im Test: harte Kante bei „empty sky in the top quarter“ (eigenes Himmelsband) und Fantasie-Schrift auf Schildern trotz „no letters“ → für Entwürfe/Varianten gut (Hauptbilder: siehe Update 2026-10-31). Stream-Text der Grok-CLI steht in Events `{"type":"text","data":...}`.

Update 2026-10-27: funktionierender Aufruf `grok -p "<auftrag>" --tools image_gen,write,list_dir --always-approve --sandbox workspace-write --output-format streaming-json > out.jsonl` (`stream-json` gibt es nicht → exit 2). 2 Bilder in einem Auftrag ok, Pfade per `grep -o 'saved to C:[^"]*'`. Qualität beim Kleinstadt-Motiv gut (Licht, Fachwerk, Linien-Skizze sauber, kein Himmelsband dank "sky blends smoothly, no hard band"); Schwächen: „drives toward the camera“ ignoriert (Roboter fährt weg), winzige Pseudo-Schrift auf Paket/Gehäuse, nur 864×1152.

Update 2026-10-31 (Kevin): Google Flow ist nur die kostenlose Version → nicht für Hauptbilder. Bezahlt sind Grok (Imagine) und DaVinci → Hauptbilder über DaVinci oder Grok Imagine, Grok-CLI auch für schnelle Entwürfe/Varianten; Flow höchstens als Notlösung.
