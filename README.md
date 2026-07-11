# Insurance Doc Chatbot — Frontend

A **React + Vite + TypeScript** single-page app for the Insurance Doc Chatbot,
built to integrate directly with the FastAPI backend documented in
[`Backend_docs/API_documentation.md`](./Backend_docs/API_documentation.md). The
UI implements the handoff mockups in [`mockups/`](./mockups) (ChatGPT-inspired
theme — clean neutrals, dark sidebar, green accent) using the same design tokens.

## Screens

| Route              | Screen           | Backend endpoints used |
|--------------------|------------------|------------------------|
| `/login`           | Login            | `POST /auth/login` |
| `/register`        | Register         | `POST /auth/register` |
| `/verify-email`    | Verify email     | `POST /auth/verify-email` |
| `/forgot-password` | Forgot password  | `POST /auth/forgot-password` |
| `/reset-password`  | Reset password   | `POST /auth/reset-password` |
| `/documents`       | Documents        | `POST /ingestion`, `/ingestion/status`, `/ingestion/show`, `/ingestion/download`, `/ingestion/delete` |
| `/chat`            | Chat (policy Q&A)| `POST /chat/new`, `/chat/rename`, `/chat/show`, `/chat/delete`, `/query/text` |

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure the backend URL
cp .env.example .env        # optional — the defaults work for local dev

# 3. Run the dev server (proxies /auth, /ingestion, /query, /chat → backend)
npm run dev                 # http://localhost:5173
```

Make sure the FastAPI backend is running at `http://localhost:8000` (or point
`VITE_DEV_PROXY_TARGET` at wherever it lives). In dev, API calls are same-origin
and forwarded by the Vite proxy, so **no CORS configuration is required**.

### Production build

```bash
npm run build     # type-checks then emits static assets to dist/
npm run preview   # serve the built app locally
```

For a deployed build the SPA and API are usually on different origins, so set
`VITE_API_BASE_URL` to the backend origin (e.g. `https://api.example.com`) and
ensure the backend's `CORS_ORIGINS` includes the SPA's origin.

## Environment variables

| Variable                | Purpose |
|-------------------------|---------|
| `VITE_API_BASE_URL`     | Backend origin the SPA calls at runtime. Leave **empty** to use the dev proxy (same-origin). Set for deployed builds. |
| `VITE_DEV_PROXY_TARGET` | Where `npm run dev` forwards API calls. Default `http://localhost:8000`. |

## Architecture

```
src/
├── api/            # typed client + one module per backend area
│   ├── client.ts   # fetch wrapper: POST-only, bearer auth, FastAPI error parsing, 401 handling
│   ├── types.ts    # request/response types mirrored from the API docs
│   ├── auth.ts  ingestion.ts  chat.ts  query.ts
├── context/
│   ├── AuthContext.tsx   # token + profile, login/logout, global 401 → logout
│   └── ToastContext.tsx  # transient notifications
├── components/     # AppLayout (sidebar), Modal, Alert, Spinner, route guards, …
├── pages/          # one component per screen
├── lib/            # formatting, JWT decode, client-side chat message cache
└── styles.css      # the mockups' design system, verbatim + a few live-state additions
```

### Key integration decisions

- **Every endpoint is `POST`.** The client's `action()` helper sends the optional
  `ingestion_id` / `convo_id` as **query params** on a POST with an empty body,
  matching the API's "omit id ⇒ all/latest" convention.
- **Auth** — the JWT access token is stored in `localStorage` and sent as
  `Authorization: Bearer …`. Any `401` on an authenticated call clears the
  session and redirects to `/login`. The register/forgot flows carry the
  `verify_token` / `reset_token` returned by the API straight to the next screen.
- **Ingestion** — uploads use `multipart/form-data` and return `202`; the
  Documents page then **polls `/ingestion/show`** every 3s while any record is
  non-terminal, showing a live progress card. Downloads stream the ZIP blob.
- **Chat** — `/query/text` returns only `answer` + `token_usage` (no source
  chunks or classification), so the thread renders the answer text with the
  token counts tucked behind a **"Show tokens"** toggle per message (rather than
  always shown). Because the backend exposes **no endpoint to read a
  conversation's past messages**, rendered messages are cached in `localStorage`
  per conversation so threads survive reloads. New conversations are auto-titled
  from the first question via `/chat/rename`. Bot answers are run through a
  small inline-markdown renderer (`lib/markdown.tsx`) so `**bold**` from the LLM
  renders as `<strong>` instead of literal asterisks — no `dangerouslySetInnerHTML`
  involved, so there's no injection risk from model output.
- **Dev proxy is POST-only.** The SPA's client-side route `/chat` collides with
  the backend's `/chat` API prefix. `vite.config.ts` only forwards `POST`
  requests to the backend; any other method (e.g. a hard refresh's plain `GET
  /chat`) falls through to Vite's own server so the SPA shell still loads.

## Notes / limitations

- Client-side chat history is per-browser (cleared storage or another device
  starts a thread empty). If the backend later adds a "list messages" endpoint,
  swap `lib/chatStore.ts` for it in `pages/Chat.tsx`.
- User profile name is only known when the user registered in this browser (the
  login response carries no profile); otherwise the sidebar shows the email.
