# forgejo-mcp web companion

React 19 + Vite + Tailwind v3 + Zustand dashboard for forgejo-mcp (Forgejo/Codeberg).

- Dev: http://127.0.0.1:11132 (proxies `/api`, `/docs`, `/openapi.json`, `/redoc` to :11133)
- Backend: FastAPI on http://127.0.0.1:11133 (`GET /health`)

## Scripts

| Command | What |
|---|---|
| `bun run dev` | Vite dev server (:11132, strict port) |
| `bun run build` | Production bundle → `dist/` (served by the backend when present) |
| `bun run lint` | oxlint over `src/` |
| `bun run e2e` | Playwright suite (boots backend + vite itself) |

Views (12): Dashboard, Inbox, Profiles, Repositories, Actions Runners, Tools,
Skills, Chat (SSE streaming via `/api/llm/chat/stream`), Settings, Logs, Help,
API Docs. Global state lives in `src/store.js` (Zustand); extra views go in
`src/pages.jsx`. UI text uses `text-sm` minimum (no `text-xs`); all interactive
controls carry `data-testid` attributes (see `e2e/` specs for the contract).
