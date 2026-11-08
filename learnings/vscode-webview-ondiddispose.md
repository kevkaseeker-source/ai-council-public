---
key: vscode-webview-ondiddispose
type: pitfall
worker: codex
arbeitsfeld: code
confidence: 9
saves: halb kaputte VS-Code-Erweiterung (leere Ansicht, tote Knöpfe, kein eigenes Fenster)
date: 2026-10-20
author: kevin
---
In VS-Code-Erweiterungen hat nur `WebviewView`/`WebviewPanel` ein `onDidDispose`, die `Webview` selbst nicht. Codex rief es an der Webview auf – die Ausnahme brach das Einrichten mitten drin ab (keine Daten, keine Nachrichten-Verarbeitung, `moveEditorToNewWindow` lief nicht). Tests decken Erweiterungs-Code nicht ab → nach jedem Einbau einmal live öffnen und auf Fehlermeldungen unten rechts achten.
