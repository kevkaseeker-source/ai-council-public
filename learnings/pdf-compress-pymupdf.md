---
key: pdf-compress-pymupdf
type: gotcha
worker: alle
arbeitsfeld: code
confidence: 9
saves: ein kaputtes, unbemerkt unlesbares PDF beim Verkleinern von Scans
date: 2026-11-06
author: kevin
bereich: alle
---
Gescannte PDFs verkleinern **nicht** mit pypdf `img.replace(...)`: FlateDecode-Bilder (Predictor) werden falsch dekodiert, das Ergebnis ist invertiert/verrauscht, obwohl Dateigroesse und Seitenzahl stimmen. Stattdessen PyMuPDF: je Bild-xref `fitz.Pixmap(doc, xref)` → nach RGB, auf ~2000 px Breite verkleinern, JPEG q≈75 → `page.replace_image(xref, stream=...)`, `doc.save(garbage=4, deflate=True)` (8,4 → 3,7 MB bei 12 Scan-Seiten). Danach immer 1–2 Seiten mit `page.get_pixmap(dpi=110)` rendern und ansehen.
