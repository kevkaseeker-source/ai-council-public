---
name: council-retro
description: Retrospective after a session that used the AI-Council (Grok/Codex/Haiku/Sonnet workers). Finds expensive or failed steps and turns them into knowledge-base entries. Use when the user asks for a council retro, "was lernen wir daraus", or at the end of a council session.
disable-model-invocation: true
---

# council-retro

Goal: make the next council session cheaper. Look at the current session (or the one the user names) and propose at most 5 learnings.

## 1. Collect
Go through what happened in this session and note concrete events, each with its cost:
- **Tool economy:** expensive calls — whole large files read into context, long searches/timeouts, images read, repeated runs. Could a cheaper call or a worker have done it?
- **Worker results:** what did each worker deliver, how many Opus fixes were needed, what did it cost (tokens, minutes)?
- **Information access:** what was missing and caused detours (deleted temp files, unknown paths, missing tools)?
- **Automated checks:** which error could a check have caught earlier (syntax check, file-exists check, a test frame before a full render)?
- **Delegation:** was work done by Opus that a worker could have done — or delegated work that cost more to review than to do?

## 2. Filter
Keep only events that will recur. Drop one-offs. Remove anything confidential (company, customer, project data, prices, keys) — learnings are technology only.

## 3. Propose
Show a table, most expensive first: event · cost · proposed learning (1 sentence) · type · worker · target (new learning / update existing / prompt building block / tool).
Ask which to keep. Write nothing yet.

## 4. Write
For the confirmed items follow the "add" steps of the `council-learn` skill (search first, one file per learning, INDEX line, branch + PR).
