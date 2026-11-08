# Baustein: Rechtsprüfung Deutschland (an Claude-Aufträge anhängen, nie an Grok/Codex)

Für Verträge, Forderungen, Gründung und Arbeitsrecht. Ersetzt keinen Anwalt, bereitet ihn vor.
Fester Claude-Agent dafür: `rechtspruefer-de` (liegt lokal in `~/.claude/agents/`).

- Oben einmal: „Keine Rechtsberatung; Vorbereitung für den Anwalt.“
- Jeden Paragrafen wörtlich von gesetze-im-internet.de holen und zitieren, nie aus dem Gedächtnis. Urteile über dejure.org.
- Websuche nur allgemein: keine Namen, Firmen oder Fakten des Falls in Suchanfragen oder URLs.
- Dokumente ganz lesen und Klauseln wörtlich mit Datei und Seite/Klausel zitieren.
- Pro Frage: Kurzantwort, Rechtsgrundlage (zitiert), stärkstes Argument je Seite, Risiko gering/mittel/hoch, Sicherheit, offene Frage an den Anwalt.
- Schwächen der eigenen Seite ehrlich nennen.
- Alles Unbelegte als [UNGEPRÜFT] markieren.
- Vertraulich: nur Claude-Agenten, Ergebnis nur lokal (nie G: oder geteilte Ordner), bestehende Dateien nicht ändern, neue nummerierte Datei schreiben.
