---
key: webview-preview-screenshots
type: tool
worker: opus
arbeitsfeld: code
confidence: 9
saves: viele Hin-und-her-Runden mit Screenshots vom Nutzer
date: 2026-10-20
author: kevin
---
UI einer VS-Code-Webview selbst prüfen statt auf Screenshots vom Nutzer zu warten: `dashboard/preview/` lädt die echten `media/*.js` mit einer Fake-`acquireVsCodeApi`, einem synthetischen Zustand (`make-state.js`) und VS-Code-Farbvariablen; `node dashboard/preview/shot.mjs <outDir> 600 900` macht per puppeteer je Tab ein Bild in Panel-Breite. Damit fielen sofort auf: Linien durch Beschriftungen, Netz nicht eingepasst (Canvas nahm Fensterhöhe statt Bereichshöhe).
