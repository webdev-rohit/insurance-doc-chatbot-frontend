# Insurance Doc Chatbot — Backend

A FastAPI backend for an insurance policy Q&A chatbot. Users upload insurance
policy PDFs, which are extracted, chunked, embedded and stored as vectors; they
can then ask natural-language questions that are answered with a
Retrieval-Augmented Generation (RAG) pipeline over their own documents.

Built with **FastAPI + SQLAlchemy + PostgreSQL (pgvector)** on **Google Cloud**
(Cloud SQL, Cloud Storage, Vertex AI Gemini models), with JWT auth and SendGrid
email.

---

## Architecture

Every feature module follows the same layered pattern:

```
router  →  service  →  repository  →  service  →  router
```

- **router** — HTTP layer. Declares routes, request/response schemas, extracts
  the authenticated user (`get_current_user` → `UUID`), and translates service
  results/exceptions into HTTP responses.
- **service** — business logic and orchestration. Owns all validation,
  ownership checks, LLM/embedding calls and multi-step flows.
- **repository** — persistence only. Each method is a single SQL statement plus
  its execution; no business logic lives here.

All primary keys and foreign keys across the database are **UUID**. IDs are
accepted and returned as `UUID` end-to-end (request bodies, query params and
response models), so malformed IDs are rejected automatically with a `422`.

### Modules

| Module      | Prefix       | Responsibility                                            |
|-------------|--------------|-----------------------------------------------------------|
| `auth`      | `/auth`      | Registration, email verification, login, password reset   |
| `ingestion` | `/ingestion` | PDF upload, extraction, chunking, embedding, storage      |
| `query`     | `/query`     | Query classification + RAG answer generation              |
| `chat`      | `/chat`      | Conversation (chat session) management                    |
| `core`      | —            | Config, DB engine, AI clients, prompts, shared utilities  |

---

## API Endpoints

### Auth — `/auth`
| Method | Path              | Description                                             |
|--------|-------------------|---------------------------------------------------------|
| POST   | `/register`       | Register a user; sends a verification token by email    |
| POST   | `/verify-email`   | Verify a user's email with the token                    |
| POST   | `/login`          | Log in (verified users only); returns a JWT access token|
| POST   | `/forgot-password`| Email a password-reset token                            |
| POST   | `/reset-password` | Reset the password with a valid reset token             |

### Ingestion — `/ingestion` *(auth required)*
| Method | Path        | Description                                                        |
|--------|-------------|-------------------------------------------------------------------|
| POST   | `""`        | Upload a PDF; returns `202` and runs the pipeline in the background|
| POST   | `/status`   | Get the status of the latest or a specific ingestion (`ingestion_id`)|
| POST   | `/show`     | List all ingestion records, or one by `ingestion_id`              |
| POST   | `/download` | Download the original PDF + extracted JSON as a ZIP               |
| POST   | `/delete`   | Delete all ingestion records, or one by `ingestion_id`            |

### Query — `/query` *(auth required)*
| Method | Path    | Description                                          |
|--------|---------|------------------------------------------------------|
| POST   | `/text` | Ask a text question within a conversation (`convo_id`)|

### Chat — `/chat` *(auth required)*
| Method | Path            | Description                                     |
|--------|-----------------|-------------------------------------------------|
| POST   | `/new`          | Create a new conversation                       |
| POST   | `/rename`       | Rename a conversation                           |
| POST   | `/show`         | List all conversations, or one by `convo_id`    |
| POST   | `/load-history` | Load the full message history for a `convo_id`  |
| POST   | `/delete`       | Delete all conversations, or one by `convo_id`  |

Authenticated endpoints expect a `Bearer <access_token>` header.

---

## Ingestion pipeline

Runs as a FastAPI background task (its own DB session) so the upload request can
return `202` immediately. Status transitions are persisted at each stage:

```
PENDING → UPLOADED → EXTRACTING → EXTRACTED → INDEXING → INDEXED → COMPLETED
                                                                  ↘ FAILED
```

1. **Upload** — original PDF stored in Google Cloud Storage.
2. **Extract** — hybrid extractor (PyMuPDF + pdfplumber) produces a structured
   JSON of per-page text blocks and tables; the JSON is uploaded to GCS.
3. **Chunk** — type- and size-aware chunking (`chunker.py`): short text blocks
   are merged, long blocks are split at semantic boundaries with word overlap,
   and tables are chunked per-row or whole depending on shape.
4. **Embed & store** — chunks are embedded in batches with the Vertex AI
   embedding model (`RETRIEVAL_DOCUMENT`) and bulk-inserted into the `chunks`
   table with their pgvector embeddings.

On any failure the record is marked `FAILED` with the failing stage and error
message.

## Query pipeline (RAG)

1. Load the last *N* messages of the conversation for context and append the
   new user query.
2. **Classify** the query via the LLM as `general`, `insurance`, or `other`.
3. Route:
   - `general` → answered directly by the LLM.
   - `insurance` → embed the query (`RETRIEVAL_QUERY`), retrieve the top-K most
     similar chunks for that user via pgvector cosine distance, inject them into
     the system prompt, and generate a grounded answer.
   - `other` → a fixed fallback message.
4. Persist the exchange: the `queries` row, retrieved `query_context` rows
   (insurance only), and combined `query_usage` token accounting; bump the
   conversation's `updated_at`.

> Note: chunk re-ranking after retrieval is planned but not yet implemented.

---

## Data model

| Table           | Purpose                                                        |
|-----------------|----------------------------------------------------------------|
| `users`         | Accounts, credentials, verification state                      |
| `conversations` | Chat sessions owned by a user                                  |
| `queries`       | Individual user/assistant exchanges within a conversation      |
| `query_context` | Retrieved chunks (with similarity score) used to answer a query|
| `query_usage`   | Per-query token usage accounting                               |
| `ingestions`    | One row per uploaded document + pipeline status                |
| `chunks`        | Chunked document text + `vector(768)` embeddings (pgvector)    |

All IDs are `UUID`. Deleting a chat or ingestion cascades to its dependent rows.

---

## Tech stack

- **Framework:** FastAPI, Uvicorn
- **ORM / DB:** SQLAlchemy 2.x, PostgreSQL with `pgvector`, Alembic
- **Cloud (GCP):** Cloud SQL (via `cloud-sql-python-connector` + `pg8000`),
  Cloud Storage, Vertex AI (Gemini embedding + generation models via
  `google-genai`), Cloud Run, Artifact Registry, Cloud Build
- **Auth:** JWT (PyJWT), bcrypt password hashing
- **Email:** SendGrid
- **PDF processing:** PyMuPDF (`fitz`), pdfplumber
- **Validation/Config:** Pydantic v2, pydantic-settings

---

## Getting started

### Prerequisites
- Python **3.11+**
- A GCP project with Cloud SQL (PostgreSQL + `pgvector` extension), a Cloud
  Storage bucket, and Vertex AI enabled
- A SendGrid account (for verification / reset emails)

### Setup

```bash
# 1. Create and activate a virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

# 2. Install dependencies (uses pyproject.toml)
pip install -e .
# with dev tools:
pip install -e ".[dev]"

# 3. Configure environment
cp .env.example .env          # then fill in real values
```

### Environment variables

Configuration is loaded from `.env` via `apps/core/config.py`. See
`.env.example` for the full list. Key groups:

- **App / CORS:** `APP_NAME`, `CORS_ORIGINS`
- **GCP:** `PROJECT_ID`, `INSTANCE_ID`, `REGION`
- **Database:** `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- **Auth:** `ALGORITHM`, `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`,
  `VERIFY_TOKEN_EXPIRE_HOURS`, `RESET_TOKEN_EXPIRE_MINUTES`
- **Email (SendGrid):** `SENDGRID_API_KEY`, `FROM_EMAIL`
- **Storage:** `GCS_BUCKET_NAME`
- **Vertex AI:** `EMBEDDING_MODEL_NAME`, `EMBEDDING_OUTPUT_DIMENSIONALITY`,
  `EMBEDDING_BATCH_SIZE`, `LLM_NAME`, `LLM_TEMPERATURE`,
  `LLM_MAX_OUTPUT_TOKENS`, `NUMBER_OF_CHAT_MESSAGES`, `TOP_K_CHUNKS`
- **PDF input:** `ALLOWED_CONTENT_TYPES`, `ALLOWED_CONTENT_EXTENSIONS`,
  `MAX_FILE_SIZE_BYTES`

> Requires Google Cloud credentials in the environment (e.g.
> `GOOGLE_APPLICATION_CREDENTIALS`) for Cloud SQL, Storage and Vertex AI access.

### Run

```bash
python main.py
# or
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API runs at `http://localhost:8000`. Interactive docs are available at
`http://localhost:8000/docs`.

---

## Deployment

In production this backend runs as **two independent Cloud Run services**
rather than the single combined app used for local dev:

| Service            | Entrypoint          | Routers mounted          | Dockerfile              |
|---------------------|-----------------------|-----------------------------|----------------------------|
| Query service        | `main_query.py`       | `auth`, `query`, `chat`    | `Dockerfile.query`       |
| Ingestion service      | `main_ingestion.py`   | `ingestion`                | `Dockerfile.ingestion`   |

`main.py` (mounting all four routers together) is kept only for local,
single-process dev convenience — it isn't deployed.

The split follows the actual code dependencies rather than a naive 1:1 router
mapping: `query`'s service layer imports `chat`'s repository directly, so
those two can't be separated; `auth` lives with the query service since
that's the only place tokens are issued. The ingestion service never mounts
the auth router — it only *verifies* JWTs via a stateless `jwt.decode()`
(`apps/core/global_utils.py`), so both services independently trust tokens
issued by the query service as long as they share the same `SECRET_KEY`.

### Local Docker

```bash
docker build -f Dockerfile.query -t insurance-query:local .
docker build -f Dockerfile.ingestion -t insurance-ingestion:local .

docker run --rm -p 8000:8000 --env-file .env \
  -e GOOGLE_APPLICATION_CREDENTIALS=/gcp/adc.json \
  -v <path-to-your-adc-credentials.json>:/gcp/adc.json:ro \
  insurance-query:local
```

Both containers listen on `PORT` (default `8000` — see `settings.port` in
`apps/core/config.py`, which Cloud Run overrides automatically at runtime);
map to different host ports to run both at once. GCP calls (Cloud SQL, GCS,
Vertex AI) need Application Default Credentials mounted in, since a container
can't see your host's `gcloud auth application-default login` credentials by
default.

### Cloud Run

Images are built via Cloud Build (`cloudbuild.query.yaml`,
`cloudbuild.ingestion.yaml` — needed because `gcloud builds submit --tag`
only works with a file literally named `Dockerfile`) and deployed with
`gcloud run deploy --env-vars-file=deploy-env.yaml` (a git-ignored file
holding every `.env` value except `PORT`, which Cloud Run reserves and
injects itself via the `--port` flag).

Two Cloud Run-specific settings matter for the ingestion service in
particular:

- **`--memory=1Gi`** — the platform's 512Mi default isn't enough headroom for
  PyMuPDF/pdfplumber PDF parsing; Cloud Run kills the container outright (no
  catchable exception, no `error_message`) if it's exceeded.
- **`--no-cpu-throttling`** — ingestion returns `202` immediately and does
  the real work in a `BackgroundTasks` job after the response; Cloud Run
  throttles CPU to near-zero once it considers a request "done" unless this
  is set.

Full step-by-step (GCP project setup, IAM, build/deploy commands, and the
issues hit along the way) is documented in `docs/Deployment_Steps.docx` —
not committed to git (`docs/` is git-ignored), so it stays local
documentation only.

---

## Project structure

```
backend/
├── main.py                  # combined FastAPI app (local dev only — all routers + CORS)
├── main_query.py            # Cloud Run entrypoint: auth + query + chat
├── main_ingestion.py        # Cloud Run entrypoint: ingestion only
├── Dockerfile.query
├── Dockerfile.ingestion
├── .dockerignore
├── cloudbuild.query.yaml    # Cloud Build config (custom Dockerfile name)
├── cloudbuild.ingestion.yaml
├── deploy-env.yaml          # gcloud run deploy --env-vars-file (git-ignored)
├── pyproject.toml
├── .env.example
└── apps/
    ├── core/                # config, database, AI clients, prompts, shared utils
    ├── auth/                # registration, login, verification, password reset
    ├── ingestion/           # PDF upload → extract → chunk → embed → store
    │   └── chunker.py       # type/size-aware document chunking
    ├── query/               # classification + RAG answer generation
    └── chat/                # conversation management
```

Each feature module contains `router.py`, `services.py`, `repository.py`,
`schemas.py`, `models.py` and `utils.py` where applicable.