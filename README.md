# sicc-ryder-cup

SICC Ryder Cup — golf tournament web app (Firebase Hosting / Firestore / Storage; plain
HTML + JS per page, no framework). Live: https://sicc-ryder-cup.pages.dev ·
Repo: https://github.com/prapi01/sicc-ryder-cup

## Docs
- `Project Documentations/DESIGN.md` — main design & key decisions
- `Project Documentations/HANDOVER.md` — running project log (read at the start of each session)
- `Project Documentations/Design Documents/SICC Ryder Cup Complete Design Documentation.md` — full design
- `RELEASE_NOTES.md` — release history (current: **Version 4.0.0**, 2026-08-10)
- `Project Documentations/APP Development Rules.md` — coding & UI rules
- `.github/instructions/rules.instructions.md` — assistant working rules

## Tests
- `automated-tests/` — Playwright QA harness: Step Runner (5-window live), real-data / shotgun /
  rejoin / cascade scenarios, production regression tools (`prod-regression`, `hcp-postgame-regression`).

## Chat history / backups
- Tooling (canonical): `~/Developer/Extensions - VSCode/chat-backup-automator-vscext/backup/`
  (see its `HANDOVER.md` for the operating docs: restore template, `chat_index_lib`, web app).
- To restore chat history for this project, follow `.github/copilot-instructions.md`.
