---
key: webview-csp-vendored-libs
type: pitfall
worker: any
arbeitsfeld: code
confidence: 8
saves: eine Runde „sieht in VS Code anders aus als in der Vorschau“
date: 2026-10-25
author: claude
bereich: code
---
VS-Code-Webviews haben `style-src` ohne `unsafe-inline`: `style="…"` in innerHTML und `<style>`, das Bibliotheken (z. B. 3d-force-graph-Tooltip) selbst einfügen, werden still blockiert. Farben per `el.style.x = …` (CSSOM, erlaubt) setzen und die Bibliotheks-CSS in die eigene CSS-Datei kopieren. Damit es auffällt, bekommt die Puppeteer-Vorschau dieselbe CSP als `<meta http-equiv>`; CSP-Verstöße erscheinen dann als Konsolenfehler.
