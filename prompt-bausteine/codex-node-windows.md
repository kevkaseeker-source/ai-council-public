# Baustein: Node-Skripte unter Windows (an Codex-Aufträge anhängen)

- Pfad des eigenen Skripts: `fileURLToPath(import.meta.url)`, nie `new URL(...).pathname`.
- Start-Check: `import.meta.url.toLowerCase() === pathToFileURL(process.argv[1]).href.toLowerCase()`.
- npm-Programme (z. B. `codex`) unter Windows nur mit `shell: true` bzw. `codex.cmd` starten.
- JSON ohne BOM schreiben.
- Neben den Tests einen Standardweg ohne Test-Umgebungsvariablen bedenken (Default-Pfade).
