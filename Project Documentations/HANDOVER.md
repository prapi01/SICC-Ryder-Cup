# sicc-ryder-cup — HANDOVER Log

> Running project log. Updated after every milestone: new decisions, design changes,
> new technical findings. Read at the start of every session. Updated 2026-08-14.

## Current status (2026-08-12)
- SICC Ryder Cup Firebase web app — **Version 4.0.0** shipped 2026-08-10 (Team One rename,
  v3.0.0 regression fixes, automated QA harness). Verified on production.
- Root folder: `~/Developer/W/sicc-ryder-cup` (2026-08-14 category reorg — `~/Developer` is now
  B/M/O/P/S/V/W/_SYS).
  ⚠️ VS Code derives a NEW workspace hash per path. Current identity: `0a844743…` (W/sicc-ryder-cup).
  Older identities retained: `b0806d73…` (sicc-ryder-cup), `b06a4bc2…` (SICC-Ryder-Cup). All hold the chats.
- Chat-history backup/restore tooling lives at
  `~/Developer/V/chat-backup-automator-vscext/backup/` (was `~/Developer/_chat-backups/`).
  That folder's `HANDOVER.md` is the CANONICAL operating doc for backup/restore.

## Decisions
- 2026-08-10 — Team One display rename (display-only; internal Team A/B kept — no migration).
- 2026-08-10 — History record integrity fields (adjustedHandicaps / finalResults / version:3 /
  schema:"v3_strings" / archiveId).
- 2026-08-10 — Chat-backup "one folder" model: chat-backup-automator-vscext extension = front-end,
  `backup/` subfolder = backend + data.
- 2026-08-12 — `.github/copilot-instructions.md` + `AD-HOC.md` added to `.gitignore` (private paths).

## Design changes
- 2026-08-10 — v4.0.0: sign-card `submitSignature` restored, celebration photo restored + default
  photo at start, viewer back-link design compliance, storage rules fix. (Details: RELEASE_NOTES.md.)
- 2026-08-12 — Docs reorganisation committed: `Documentations/` renamed → `Project Documentations/`
  (incl. new `README.md`); `.github/copilot-instructions.md` + `AD-HOC.md` gitignored (private paths).
- 2026-08-12 — Chat-history tooling rollout: date-prefixed chat titles (start date) + removed empty
  chats for sicc-ryder-cup (5 renamed, 6 removed); generalized `rename-clean-chats.py --project`;
  wrote "Rename & Clean chat sessions" tasks into every project's `AD-HOC.md` (13 projects);
  cleaned `backup-registry.json` 19 → 13 (dead/duplicate entries removed; backups preserved).
- 2026-08-14 — Category reorg: `~/Developer` split into B/M/O/P/S/V/W/_SYS. sicc → `W/sicc-ryder-cup`;
  backup tooling → `V/chat-backup-automator-vscext`; `backup-registry.json` repointed to new paths
  (16 projects). Docs (DESIGN/HANDOVER/README) + `.github/copilot-instructions.md` updated.
- 2026-08-14 — Version integrity alignment: reconciled `js/versions.json` ↔ JS header/footer VERSIONs ↔
  HTML `?v=` cache-busting across all pages; `index.html` on-screen version → 4.00. Version/comment only,
  no logic change. Also reset local + `origin/staging` to `main` (removed garbage commits).

## Technical findings
- 2026-08-10 — VS Code's history list (`/sessions`) is driven ONLY by `chat.ChatSessionStore.index`
  in `state.vscdb`; VS Code never scans `chatSessions/`. Restoring `.jsonl` requires rebuilding the
  index (`chat_index_lib.sync_index`). Single source of truth lives in `backup/`
  (`restore-chat-history.template.sh` + `chat_index_lib.py`).
- 2026-08-11 — `pgrep -f "…/Contents/MacOS/Code"` never matches inside the VS Code sandbox; use the
  broad guard `pgrep -f "Visual Studio Code"` in restore scripts.
- 2026-08-12 — Renaming a folder's CASE changes the VS Code workspace hash (hash is case-sensitive
  even on case-insensitive APFS). Renaming to lower-case created a second identity (`b0806d73…`);
  the restore flow was re-run there.
- 2026-08-12 — Several registry entries pointed at folders that were MOVED/ARCHIVED, not renamed
  (deepseek → `_Archive/deepseek-balance-extension-vscext`; old SICC container → `_Archive/`).
  Cleaned from the registry; their backup data stays in `backup/repository/`.
- 2026-08-14 — Moving a project into a category folder changes the workspace hash AGAIN; the chats
  were re-synced into the new identity (`0a844743…`). Note: 4 of 5 titles there show the ORIGINAL
  (unprefixed) titles — re-run `rename-clean-chats.py --project "…/W/sicc-ryder-cup"` if consistent
  date prefixes are wanted.
- 2026-08-14 — Cache-busting audit: most pages hardcode `<script src="js/X.js?v=…">` tokens that had
  drifted from versions.json (e.g. hcp-adjust.html loaded game-data.js?v=2.08 while the file is v4.13 —
  stale-cache hazard); 7 pages had no `?v=` at all. Only `real-game.html` uses the `load-game.js`
  universal loader (versions.json = single source of truth).
- 2026-08-14 — `staging` carried garbage commits `17e096d }}}}}}}` + `7c0d01f {{{{{{{` (the latter deleting
  celebration photo `GM_260625_1819_97_H.jpg`); both local + `origin/staging` reset to `main` (23463b1)
  and force-pushed.

## Open questions
- Re-run rename+clean for the `W/sicc-ryder-cup` identity to make chat-title date prefixes consistent?
- Confirm each of the 13 per-project `AD-HOC.md` "Rename & Clean chat sessions" tasks completes as
  each project is opened (the next chat session in that folder drives it, then empties the file).
- If `deepseek` / the old SICC container are ever un-archived, re-add them via the web app.

## Next steps
- Open each project once so its `AD-HOC.md` rename+clean task runs (then it self-empties).
- See `backup/HANDOVER.md` for chat backup/restore operating instructions.
