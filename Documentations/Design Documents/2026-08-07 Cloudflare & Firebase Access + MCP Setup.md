# Cloudflare & Firebase — Access Verification + MCP Server Setup

- **Version:** 1.0
- **Date:** 2026-08-07
- **Purpose:** Record the verified live reachability of the SICC Ryder Cup Cloudflare Pages site and Firebase project, the latest official MCP servers for both, and the globally-installed tooling (usable in future projects).

---

## 1. Live Reachability Verification (2026-08-07)

Checked via the environment's web-fetch tool (real internet access). HTTP responses were returned by the actual Cloudflare/Google servers:

| Target | Result | Meaning |
|--------|--------|---------|
| `https://sicc-ryder-cup.pages.dev` (PROD) | **200 – live app served** ("SICC RYDER CUP", v3.67) | Cloudflare Pages production is deployed & reachable ✅ |
| `https://staging.sicc-ryder-cup.pages.dev` (STAGING) | **200 – live app served** (v3.58) | Cloudflare Pages staging is deployed & reachable ✅ |
| `https://firebasestorage.googleapis.com/v0/b/sicc-ryder-cup.firebasestorage.app/o` | **403** | Firebase Storage server reached; 403 is the expected response for an unauthenticated list on a private bucket ✅ |
| `https://firestore.googleapis.com/v1/projects/sicc-ryder-cup` | **404** | Firestore server reached; 404 is the expected response for a bare project path without auth ✅ |

**Conclusion:** Both Cloudflare (deployment) and Firebase (storage/database) are **reachable**. Any 403/404 above are authentication/path responses, not connectivity failures.

Note: the sandboxed terminal in this environment reports no HTTP egress for raw `curl`, but the environment's web tooling and `npm` do have network — hence installs below succeeded.

---

## 2. Globally Installed Tooling (so we can use them in future projects)

Installed 2026-08-07 into the global Node prefix (`/Users/piti/.nvm/versions/node/v24.15.0`):

| Tool | Version | Purpose |
|------|---------|---------|
| `firebase-tools` | 15.26.0 | Firebase CLI **and** the official Firebase MCP server (`firebase mcp`) |
| `wrangler` | 4.120.0 | Cloudflare CLI (Workers / Pages / KV / R2 / D1 / DNS) |

Global packages confirmed with `npm ls -g --depth=0`:
```
├── corepack@0.34.6
├── firebase-tools@15.26.0
├── npm@11.12.1
└── wrangler@4.120.0
```

> `@cloudflare/mcp-server-cloudflare` (npm) was attempted but the registry returns **403 Forbidden** for the tarball. This is fine — Cloudflare's official/recommended MCP is the **remote server** (Section 4), not a local npm package.

---

## 3. Firebase MCP Server (OFFICIAL — built into the Firebase CLI)

- Official docs: <https://firebase.google.com/docs/ai-assistance/mcp-server>
- No separate install — it ships with `firebase-tools` (verified: `firebase mcp --help` works).
- Transport: **stdio** (default) or `--mode sse`.
- Auth: uses the same credentials as the Firebase CLI — `firebase login` (browser OAuth) **or** Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS`).
- Key tools: `firestore_*` (query/get/add/update/delete docs), `storage_*`, `auth_*`, `firebase_list_projects`, `firebase_login`, `firebase_get_environment`, etc.

### MCP client config (VS Code / Claude / Cursor, etc.)

```json
{
  "mcpServers": {
    "firebase": {
      "command": "npx",
      "args": ["-y", "firebase-tools@latest", "mcp"]
    }
  }
}
```

If you prefer the globally-installed CLI (no `npx` download each time):

```json
{
  "mcpServers": {
    "firebase": {
      "command": "firebase",
      "args": ["mcp"]
    }
  }
}
```

Optional flags (see `firebase mcp --help`):
- `--dir <ABSOLUTE_PATH>` — point at a directory containing `firebase.json` (project context).
- `--only core,firestore,storage` — limit tools to specific feature groups.
- `--mode sse` — HTTP/SSE transport instead of stdio.

### Auth (one-time)

```sh
firebase login
```
Sign in with the Google account that owns `sicc-ryder-cup` / `sicc-ryder-cup-dev`.

---

## 4. Cloudflare MCP Server (OFFICIAL — REMOTE, no install)

- Official docs: <https://github.com/cloudflare/mcp> (Code Mode server) and <https://github.com/cloudflare/mcp-server-cloudflare> (domain-specific servers).
- The recommended server is the **remote Code Mode server**: `https://mcp.cloudflare.com/mcp`
  - Token-efficient (~1k tokens; the full Cloudflare API spec is ~2M tokens).
  - Covers **Workers, Pages, KV, R2, D1, DNS, Firewall, Stream, Images, AI Gateway**, etc.
- **No local install needed** — it's a URL you register in any MCP client.

### MCP client config (Option 1 — OAuth, recommended)

```json
{
  "mcpServers": {
    "cloudflare": {
      "type": "http",
      "url": "https://mcp.cloudflare.com/mcp"
    }
  }
}
```
You'll be redirected to Cloudflare to authorize and select permissions.

### Option 2 — API token (for CI/CD / automation)

Create a token at <https://dash.cloudflare.com/profile/api-tokens> with the needed permissions (for account tokens include `Account Resources: Read`). Then use it as a Bearer token when connecting.

### Optional: disable Code Mode (register every endpoint as its own tool)

```
https://mcp.cloudflare.com/mcp?codemode=false
```
(Only if needed — increases token cost dramatically.)

### Domain-specific remote servers (from cloudflare/mcp-server-cloudflare)

| Server | URL |
|--------|-----|
| Documentation | `https://docs.mcp.cloudflare.com/mcp` |
| Workers Bindings | `https://bindings.mcp.cloudflare.com/mcp` |
| Workers Builds | `https://builds.mcp.cloudflare.com/mcp` |
| Observability | `https://observability.mcp.cloudflare.com/mcp` |
| Browser Run | `https://browser.mcp.cloudflare.com/mcp` |
| (etc.) | See the repo README |

---

## 5. Deployment / Storage Notes for SICC Ryder Cup

- **Deployment:** Cloudflare Pages **Git integration** — push `main` → prod (`sicc-ryder-cup.pages.dev`), `staging` branch → `staging.sicc-ryder-cup.pages.dev`. No `wrangler.toml` in repo (deploy driven by the GitHub→Pages integration). `wrangler` is available if CLI deploys are ever needed.
- **Firebase:** client config in `js/firebase-config.js` (PROD project `sicc-ryder-cup`, DEV `sicc-ryder-cup-dev`); Storage used for celebration photos. `firebase` CLI now available for rules/tooling; `firebase mcp` for AI-assisted Firebase work.

---

## 6. Document History

| Version | Date | Summary |
|---------|------|---------|
| 1.0 | 2026-08-07 | Reachability verification + latest official MCP servers + global tooling install |
