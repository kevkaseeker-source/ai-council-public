---
key: powershell-utf8-bom-json
type: pitfall
worker: opus
arbeitsfeld: infra
confidence: 9
saves: kaputte Einstellungsdateien
date: 2026-10-20
author: kevin
---
Windows PowerShell 5.1 schreibt mit `Set-Content/Out-File -Encoding utf8` ein BOM an den Dateianfang – manche JSON-Parser (Einstellungen, Configs) scheitern daran still. JSON immer mit `[IO.File]::WriteAllText(pfad, text, (New-Object Text.UTF8Encoding $false))` schreiben. Auch die Pipeline `Get-Content datei | node …` hängt in PS 5.1 ein BOM an stdin – Dateipfad als Argument übergeben statt pipen.
