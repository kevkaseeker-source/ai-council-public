---
key: x-com-browser-reading
type: workaround
worker: haiku
arbeitsfeld: browser
confidence: 7
saves: Browser-Worker-Tokens beim Auslesen von X (DMs, Posts, Antworten)
date: 2026-10-25
author: claude
---
Auf x.com liefern `get_page_text`/`read_page`/JS oft keinen Text (DMs, Einzelposts) → gleich Screenshots mit `scale: 0.6` lesen; bei Einzelposts steht der volle Text schon im Tab-Titel (billigster Weg). Antworten eines Accounts unter fremden Posts findet die X-Suche `from:<handle> to:<account>` mit `&f=live` zuverlässig, die Ergebnis-Karten zeigen Aufrufe/Likes. Lange DM-Verläufe per Screenshot-Scrollen sind zu teuer (~120k Tokens, Anfang nicht erreicht) → Nutzer den Ausschnitt kopieren lassen; Worker immer den echten @-Handle geben, bei Suche nach Anzeigenamen landet er leicht beim falschen Account.
