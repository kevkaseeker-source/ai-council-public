---
key: powershell-german-quotes
type: pitfall
worker: opus
arbeitsfeld: infra
confidence: 9
saves: abgebrochene Befehle beim Schreiben deutscher Texte
date: 2026-10-20
author: kevin
---
Windows PowerShell behandelt die typografischen Anführungszeichen „ und “ wie normale Anführungszeichen – ein deutscher Text mit „…“ in einem "…"-String bricht den ganzen Befehl ab (ParserError). Deutsche Texte nicht per PowerShell-String schreiben, sondern mit dem Edit/Write-Werkzeug oder aus einer Datei lesen. Außerdem: Sicherheitsfilter blockieren `Remove-Item` mit Pfadlisten wie `"$env:TEMP\a","…"` – je Pfad einzeln mit `-LiteralPath`.
