# Insurance Doc Chatbot — Frontend

A **React + Vite + TypeScript** single-page app for the Insurance Doc Chatbot,
built to integrate directly with the FastAPI backend documented in
[`Backend_docs/API_documentation.md`](./Backend_docs/API_documentation.md). The
UI implements the handoff mockups in [`mockups/`](./mockups) (ChatGPT-inspired
theme — clean neutrals, dark sidebar, green accent) using the same design tokens.

## Backend services

The backend is deployed as **two independent Cloud Run services** rather than
one monolith, split along the same line the API docs already draw:

| Service         | Deployed URL | Paths it owns |
|-----------------|--------------|----------------|
| **Ingestion**   | https://insurance-ingestion-591946978201.asia-south1.run.app ([docs](https://insurance-ingestion-591946978201.asia-south1.run.app/docs)) | `/ingestion*` |
| **Query**       | https://insurance-query-591946978201.asia-south1.run.app ([docs](https://insurance-query-591946978201.asia-south1.run.app/docs)) | `/auth*`, `/query*`, `/chat*` |

The API client (`src/api/client.ts`) picks the base URL **per-request by path
prefix** — `resolveBaseUrl()` routes anything starting with `/ingestion` to the
ingestion service and everything else to the query service — so the rest of
the app (`api/auth.ts`, `api/chat.ts`, `api/query.ts`, `api/ingestion.ts`)
doesn't need to know or care that it's talking to two different origins.

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

# 2. Run the dev server — proxies /auth, /ingestion, /query, /chat to a LOCAL
#    backend at http://localhost:8000 (see .env.development)
npm run dev                 # http://localhost:5173
```

Make sure a local backend is running at `http://localhost:8000` (per
`Backend_docs/`). API calls are same-origin and forwarded by the Vite proxy,
so **no CORS configuration is required** in dev.

### Production build

```bash
# Type-checks, builds static assets into dist/ using .env.production
# (the two deployed Cloud Run URLs baked in)
npm run build
```

A production build calls the two backend services **directly** — there's no
dev proxy — so each service's CORS config must allow the SPA's origin. See
[Deploying to Cloud Run](#deploying-to-cloud-run) below to ship it — the
frontend is already live there, so this build step normally runs inside the
Docker image, not by hand.

### Switching which env file is used

Vite loads env files by **mode**, automatically — no manual copying:

| Command                    | Mode          | File loaded        |
|-----------------------------|---------------|---------------------|
| `npm run dev`               | `development` | `.env.development` |
| `npm run build` / `npm run preview` | `production`  | `.env.production`  |

`.env` holds defaults shared by every mode (left empty by default); values in
the mode-specific file always win. See `.env.example` for what each variable
does before editing `.env.development` / `.env.production`.

## Deploying to Cloud Run

The SPA ships as a container: a multi-stage `Dockerfile` builds the static
assets (using `.env.production`, so the two backend URLs are baked in) and
serves them with **nginx**, listening on the `$PORT` Cloud Run injects
(`nginx.conf.template` is envsubst'd by nginx's own entrypoint — no extra
scripting needed).

```bash
# One-time: pick the GCP project this deploys into
gcloud config set project <PROJECT_ID>

# Build the image remotely (Cloud Build — no local Docker required)
gcloud builds submit --tag gcr.io/<PROJECT_ID>/insurance-frontend

# Deploy it
gcloud run deploy insurance-frontend \
  --image gcr.io/<PROJECT_ID>/insurance-frontend \
  --region asia-south1 \
  --allow-unauthenticated \
  --port 8080
```

After the first deploy, **add the frontend's Cloud Run URL to both backend
services' CORS allow-list** (`CORS_ORIGINS` per `Backend_docs/`) — the
built SPA calls the ingestion/query services directly, cross-origin, with no
proxy in front of it in production.

To ship a config change (e.g. a new backend URL), edit `.env.production` and
re-run both commands above — Cloud Build always rebuilds from source, so
there's no separate "redeploy" step.

## Environment variables

| Variable                             | Purpose |
|---------------------------------------|---------|
| `VITE_INGESTION_API_BASE_URL`        | Ingestion service origin (`/ingestion*`). Empty in `.env.development` (dev proxy handles it); set to the Cloud Run URL in `.env.production`. |
| `VITE_QUERY_API_BASE_URL`            | Query service origin (`/auth*`, `/query*`, `/chat*`). Empty in `.env.development`; set to the Cloud Run URL in `.env.production`. |
| `VITE_DEV_PROXY_INGESTION_TARGET`    | Where `npm run dev` forwards `/ingestion*` calls. `.env.development` sets this to `http://localhost:8000`. Ignored in production. |
| `VITE_DEV_PROXY_QUERY_TARGET`        | Where `npm run dev` forwards `/auth*`, `/query*`, `/chat*` calls. `.env.development` sets this to `http://localhost:8000`. Ignored in production. |

## Architecture

```
src/
├── api/            # typed client + one module per backend area
│   ├── client.ts   # fetch wrapper: POST-only, per-path base URL routing (ingestion vs. query
│   │               #   service), bearer auth, FastAPI error parsing, 401 handling
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
- **Two backends, one client.** `client.ts` resolves the base URL per-request
  from the path prefix (`/ingestion*` → ingestion service, everything else →
  query service — see [Backend services](#backend-services)), so callers in
  `api/*.ts` just use the same relative paths from the API docs regardless of
  which service actually serves them.
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
