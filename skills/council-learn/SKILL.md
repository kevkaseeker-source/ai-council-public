---
name: council-learn
description: Search, add, or prune entries in the AI-Council knowledge base (C:\Users\kevka\council). Use before delegating work to Grok/Codex/Haiku/Sonnet ("haben wir das schon gelöst?"), when a worker needed a fix or a workaround was found, or when asked to "remember this for the council", show council learnings, clean them up, or to review open notes from the dashboard.
---

# council-learn

Knowledge base: the repo containing this skill (default `C:\Users\kevka\council`). Files: `INDEX.md` (one line per learning), `learnings/<key>.md` (one learning each), `prompt-bausteine/`, `tools/`. Format and rules: `README.md` of the repo. This skill never sends anything over the network except the explicit git push in "add".

## search <stichworte>
1. Read `INDEX.md` only. Match the keywords against the backticked keyword list and the summary.
2. Open only the matching learning files (max 5). Report each in one line: key · worker · what to do.
3. If a match names a `prompt-bausteine/` file, say so — it should be appended to the worker task.
4. Nothing found → say "nicht gefunden" (not "gibt es nicht").

## add
1. Check the content against the repo rules: technology only — no company, customer or project names, no prices, contracts, keys, tokens, passwords, `.env` content. If anything confidential is needed to explain it, generalise it or drop the entry.
2. Search first (step above). If a learning with the same topic exists, update that file instead of creating a new one.
3. Write `learnings/<kebab-key>.md` with the frontmatter from README.md (key, type, worker, confidence, saves, date = today, author, bereich) and 1–3 sentences. `bereich` = team profile ids it applies to, comma-separated (e.g. `code, social-content`), or `alle`. **Ask: does it also help other areas (e.g. the company area, profile `code`)?** A learning for 2+ areas is a bridge and shows up in every one of them. Learnings from company work only in generalised form (no customer, project or data).
4. Add or update one line in `INDEX.md`: `` `keywords` → [learnings/<key>.md](learnings/<key>.md) · worker · short action ``.
5. Git: on a branch `learn/<key>`, commit "learn: <key>", push, open a PR with `gh pr create --fill`. Before committing, run `git config user.email` and continue only if it shows the owner's private address configured for this repo; otherwise stop and ask. If the user said to commit directly, skip the PR.
6. Report: key, file, PR link.

## prune
1. Read all learning files. Flag: referenced files under `tools/` that no longer exist; two learnings that contradict each other; entries older than 6 months with confidence ≤ 6.
2. Present the flagged list with a proposal each (remove / keep / update). Change nothing until the user confirms.
3. Apply confirmed changes, keep `INDEX.md` in sync, commit via branch + PR as in "add".

## notes
1. List `notes/*.md` with `status: offen` (frontmatter). None -> say so and stop.
2. For each: show target + text in one line, propose a concrete change (new/updated learning, prompt building block, or council rule).
3. After the user confirms an item: apply it via "add", then set the note's `status: erledigt`.
Notes never leave the machine and are never committed.

## stand <bereich>
At the start of a session in an area, read `bereiche/<id>.stand.md`. At the end, append 3–6 lines covering completed work, open items, and decisions with `node tools/stand/stand.mjs <id> "…"`. For the company area, write only generalised information.
