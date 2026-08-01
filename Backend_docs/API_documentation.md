# Insurance Doc Chatbot — API Documentation

Complete reference for the Insurance Doc Chatbot backend REST API.

- **Base URL (local):** `http://localhost:8000`
- **Interactive docs:** `http://localhost:8000/docs` (Swagger UI) · `http://localhost:8000/redoc`
- **Content type:** `application/json` unless noted (file upload uses `multipart/form-data`)

## Contents
- [Authentication](#authentication)
- [Conventions](#conventions)
- [Auth API](#auth-api--auth)
- [Ingestion API](#ingestion-api--ingestion)
- [Query API](#query-api--query)
- [Chat API](#chat-api--chat)
- [Error handling](#error-handling)
- [Data types](#data-types)

---

## Authentication

Protected endpoints (all of `/ingestion`, `/query`, `/chat`) require a JWT
**access token** in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Obtain the token from [`POST /auth/login`](#post-authlogin). The token encodes
the user id (`sub`) and `type: "access"`; the server decodes it on each request
via the `get_current_user` dependency and resolves the caller's `UUID`. A
missing, malformed, expired, or non-access token yields `401`.

## Conventions

- **IDs are UUIDs.** Every id accepted or returned (`convo_id`, `ingestion_id`,
  user id) is a UUID string like `550e8400-e29b-41d4-a716-446655440000`. A
  malformed UUID in a request body or query parameter returns `422` automatically.
- **HTTP methods.** All endpoints use `POST` (including list/read operations).
- **Optional id query params.** For `show` / `delete` / `status` / `download`,
  omitting the id operates on **all** of the user's records (or the latest,
  where noted); providing an id targets that single record.
- **Ownership.** Every record is scoped to the authenticated user. Requesting a
  record you don't own is indistinguishable from "not found" (`404`).

---

## Auth API — `/auth`

No authentication required for these endpoints.

### POST `/auth/register`
Register a new user. A verification token is emailed (via SendGrid) and also
returned in the response.

**Request body**
| Field        | Type   | Required | Rules                                                        |
|--------------|--------|----------|--------------------------------------------------------------|
| `email`      | string | yes      | Valid email address                                          |
| `first_name` | string | yes      | 1–100 chars; letters, spaces, hyphens, apostrophes only      |
| `last_name`  | string | yes      | 1–100 chars; letters, spaces, hyphens, apostrophes only      |
| `password`   | string | yes      | ≥ 8 chars, at least one letter and one number                |

```json
{
  "email": "john.doe@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "password": "secure_password1"
}
```

**Response `200`**
```json
{
  "message": "Registered successfully. Check email to verify.",
  "verify_token": "<jwt-verify-token>"
}
```

**Errors:** `400` email already registered · `422` validation failure.

---

### POST `/auth/verify-email`
Verify a user's email using the token from registration.

**Request body**
| Field   | Type   | Required | Description             |
|---------|--------|----------|-------------------------|
| `token` | string | yes      | Verification JWT token  |

```json
{ "token": "<jwt-verify-token>" }
```

**Response `200`**
```json
{ "message": "Email verified successfully" }
```

**Errors:** `400` invalid token type / already verified / expired or invalid token · `404` user not found.

---

### POST `/auth/login`
Authenticate and receive an access token. The account must be verified.

**Request body**
| Field      | Type   | Required |
|------------|--------|----------|
| `email`    | string | yes      |
| `password` | string | yes      |

```json
{ "email": "john.doe@example.com", "password": "secure_password1" }
```

**Response `200`**
```json
{
  "access_token": "<jwt-access-token>",
  "token_type": "bearer"
}
```

**Errors:** `401` invalid credentials · `403` email not verified.

---

### POST `/auth/forgot-password`
Email a password-reset token. The token is also returned in the response.

**Request body**
| Field   | Type   | Required |
|---------|--------|----------|
| `email` | string | yes      |

```json
{ "email": "john.doe@example.com" }
```

**Response `200`**
```json
{
  "message": "Password reset link sent.",
  "reset_token": "<jwt-reset-token>"
}
```

**Errors:** `404` user not found.

---

### POST `/auth/reset-password`
Set a new password using a valid reset token.

**Request body**
| Field          | Type   | Required | Rules                                          |
|----------------|--------|----------|------------------------------------------------|
| `token`        | string | yes      | Reset JWT token                                |
| `new_password` | string | yes      | ≥ 8 chars, at least one letter and one number  |

```json
{ "token": "<jwt-reset-token>", "new_password": "new_secure_password1" }
```

**Response `200`**
```json
{ "message": "Password reset successfully" }
```

**Errors:** `400` invalid token type / new password same as old / expired or invalid token · `404` user not found · `422` validation failure.

---

## Ingestion API — `/ingestion`

**Auth required.** Handles uploading insurance policy PDFs and running the
extract → chunk → embed → store pipeline.

### POST `/ingestion`
Upload a PDF. The record is created synchronously and the heavy pipeline runs in
the background, so the endpoint returns immediately with `202 Accepted`.

**Request** — `multipart/form-data`
| Part   | Type | Required | Description                     |
|--------|------|----------|---------------------------------|
| `file` | file | yes      | A PDF (`application/pdf`) only  |

**Response `202`** — `IngestionResponse`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "file_url": "",
  "json_url": "",
  "status": "pending",
  "chunk_count": null,
  "created_at": "2026-07-09T10:15:30"
}
```
> `file_url`/`json_url` are populated and `status` advances as the background
> pipeline progresses — poll [`/ingestion/status`](#post-ingestionstatus).

**Errors:** `400` non-PDF file · `404` user not found · `500` unexpected error.

---

### POST `/ingestion/status`
Get the processing status of an ingestion. With no `ingestion_id`, returns the
**latest** ingestion for the user.

**Query params**
| Param          | Type      | Required | Description                                  |
|----------------|-----------|----------|----------------------------------------------|
| `ingestion_id` | UUID      | no       | Target a specific record; omit for the latest|

**Response `200`** — `IngestionStatusResponse`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "error_message": null
}
```

**Status values:** `pending`, `uploaded`, `extracting`, `extracted`,
`indexing`, `indexed`, `completed`, `failed`. On `failed`, `error_message`
describes the failure.

**Errors:** `404` no ingestion record found · `500` unexpected error.

---

### POST `/ingestion/show`
List ingestion records. With no `ingestion_id`, returns **all** of the user's
records (newest first); with one, returns that single record. Either way the
response is a **list** of `IngestionResponse`.

**Query params**
| Param          | Type | Required | Description                       |
|----------------|------|----------|-----------------------------------|
| `ingestion_id` | UUID | no       | Target a specific record          |

**Response `200`**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "file_url": "gs://bucket/prefix/original_uploads/....pdf",
    "json_url": "gs://bucket/prefix/converted_data/....json",
    "status": "completed",
    "chunk_count": 317,
    "created_at": "2026-07-09T10:15:30"
  }
]
```

**Errors:** `404` no records found · `500` unexpected error.

---

### POST `/ingestion/download`
Download the original PDF and the extracted JSON for an ingestion, bundled as a
ZIP. With no `ingestion_id`, uses the **latest** completed ingestion.

**Query params**
| Param          | Type | Required | Description               |
|----------------|------|----------|---------------------------|
| `ingestion_id` | UUID | no       | Target a specific record  |

**Response `200`** — `application/zip`
```
Content-Type: application/zip
Content-Disposition: attachment; filename="ingestion.zip"
```
(binary ZIP stream containing the PDF and JSON files)

**Errors:** `400` ingestion not completed · `404` no record found · `500` unexpected error.

---

### POST `/ingestion/delete`
Delete ingestion records along with their GCS files and chunk rows. With no
`ingestion_id`, deletes **all** of the user's ingestions; with one, deletes that
record.

**Query params**
| Param          | Type | Required | Description               |
|----------------|------|----------|---------------------------|
| `ingestion_id` | UUID | no       | Target a specific record  |

**Response `200`**
```json
{ "message": "All ingestion records deleted successfully" }
```
or, for a single record:
```json
{ "message": "Ingestion record 550e8400-e29b-41d4-a716-446655440000 deleted successfully" }
```

**Errors:** `404` no record found · `500` unexpected error.

---

## Query API — `/query`

**Auth required.** Runs the RAG pipeline: classify → (retrieve →) answer.

### POST `/query/text`
Ask a text question inside an existing conversation. The service loads recent
conversation history for context, classifies the query, and either answers
generally, answers from the user's document chunks (insurance), or returns a
fallback. Token usage is aggregated across the classification and answer calls.

**Request body**
| Field      | Type   | Required | Description                                |
|------------|--------|----------|--------------------------------------------|
| `query`    | string | yes      | The user's question                        |
| `convo_id` | UUID   | yes      | Conversation the query belongs to          |

```json
{
  "query": "What is the grace period for premium payment?",
  "convo_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response `200`** — `QueryResponse`
```json
{
  "answer": "The grace period for premium payment is 30 days...",
  "token_usage": {
    "input_tokens": 1240,
    "output_tokens": 86,
    "thinking_tokens": 0,
    "total_tokens": 1326
  }
}
```

**Notes**
- Classification is one of `general`, `insurance`, `other`.
- For `insurance`, the top-K most similar chunks (per-user, pgvector cosine
  similarity) are injected into the system prompt and recorded in `query_context`.
- For `other`, a fixed message is returned:
  *"This is something I am unable to answer at the moment. Please contact support for further assistance."*

**Errors:** `404` conversation not found or not owned by the user · `422` malformed `convo_id` · `500` unexpected error.

---

## Chat API — `/chat`

**Auth required.** Manages conversations (chat sessions). A conversation groups a
sequence of queries and their answers.

### POST `/chat/new`
Create a new, empty conversation.

**Request body:** none.

**Response `200`** — `NewChatResponse`
```json
{
  "message": "New chat created successfully.",
  "convo_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Errors:** `500` unexpected error.

---

### POST `/chat/rename`
Rename a conversation.

**Request body**
| Field      | Type   | Required | Description                 |
|------------|--------|----------|-----------------------------|
| `convo_id` | UUID   | yes      | Conversation to rename      |
| `new_name` | string | yes      | New conversation title      |

```json
{
  "convo_id": "550e8400-e29b-41d4-a716-446655440000",
  "new_name": "Term life policy questions"
}
```

**Response `200`** — `RenameChatResponse`
```json
{
  "convo_id": "550e8400-e29b-41d4-a716-446655440000",
  "new_name": "Term life policy questions"
}
```

**Errors:** `404` conversation not found · `422` malformed `convo_id` · `500` unexpected error.

---

### POST `/chat/show`
List conversations. With no `convo_id`, returns **all** of the user's
conversations; with one, returns that single conversation. The response is
always a **list** of `ShowChatResponse`.

**Query params**
| Param      | Type | Required | Description                 |
|------------|------|----------|-----------------------------|
| `convo_id` | UUID | no       | Target a specific chat      |

**Response `200`**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Term life policy questions",
    "created_at": "2026-07-09T10:15:30",
    "updated_at": "2026-07-09T10:42:11"
  }
]
```

**Errors:** `404` no chat records found · `500` unexpected error.

---

### POST `/chat/load-history`
Load the full, chronologically-ordered message history for a conversation, so
a client can replay it up to the most recent point.

**Query params**
| Param      | Type | Required | Description                 |
|------------|------|----------|-----------------------------|
| `convo_id` | UUID | yes      | Conversation to load        |

**Response `200`** — `LoadHistoryResponse`
```json
{
  "convo_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Term life policy questions",
  "messages": [
    {
      "id": "6e1b1f2a-2f3a-4c9a-8f1a-1a2b3c4d5e6f",
      "query_type": "insurance",
      "input_text": "What is the grace period for premium payment?",
      "response_text": "The grace period for premium payment is 30 days...",
      "created_at": "2026-07-09T10:15:30"
    }
  ]
}
```

**Errors:** `404` no chat record found · `422` malformed `convo_id` · `500` unexpected error.

---

### POST `/chat/delete`
Delete conversations and their associated queries (and query context/usage).
With no `convo_id`, deletes **all** of the user's conversations; with one,
deletes that conversation.

**Query params**
| Param      | Type | Required | Description                 |
|------------|------|----------|-----------------------------|
| `convo_id` | UUID | no       | Target a specific chat      |

**Response `200`**
```json
{ "message": "All chat records deleted successfully" }
```
or, for a single record:
```json
{ "message": "Chat record 550e8400-e29b-41d4-a716-446655440000 deleted successfully" }
```

**Errors:** `404` no chat record found · `500` unexpected error.

---

## Error handling

Errors are returned in FastAPI's standard shape:

```json
{ "detail": "Conversation not found." }
```

Validation errors (`422`) return the standard FastAPI list of field errors:

```json
{
  "detail": [
    {
      "type": "uuid_parsing",
      "loc": ["query", "convo_id"],
      "msg": "Input should be a valid UUID",
      "input": "not-a-uuid"
    }
  ]
}
```

**Common status codes**

| Code  | Meaning                                                                 |
|-------|-------------------------------------------------------------------------|
| `200` | Success                                                                  |
| `202` | Accepted — ingestion upload queued for background processing            |
| `400` | Bad request (e.g. non-PDF upload, invalid token type, business rule)    |
| `401` | Missing/invalid/expired access token, or invalid login credentials      |
| `403` | Forbidden (e.g. email not verified at login)                            |
| `404` | Resource not found or not owned by the caller                           |
| `422` | Request validation failed (bad body/query types, malformed UUID)        |
| `500` | Unexpected server error                                                  |

---

## Data types

### TokenUsage
| Field             | Type | Description                                        |
|-------------------|------|----------------------------------------------------|
| `input_tokens`    | int  | Prompt tokens consumed                             |
| `output_tokens`   | int  | Generated (candidate) tokens                       |
| `thinking_tokens` | int  | Reasoning tokens (0 for non-thinking models)       |
| `total_tokens`    | int  | Total tokens for the request                       |

### QueryHistoryItem
| Field           | Type          | Description                              |
|-----------------|---------------|-------------------------------------------|
| `id`            | UUID          | Query record id                          |
| `query_type`    | string \| null| `general`, `insurance`, or `other`       |
| `input_text`    | string \| null| The user's question                      |
| `response_text` | string \| null| The generated answer                     |
| `created_at`    | datetime      | When the exchange was recorded           |

### IngestionStatus (enum)
`pending` → `uploaded` → `extracting` → `extracted` → `indexing` → `indexed` →
`completed`, or `failed` at any stage.

### Timestamps
All timestamps are ISO-8601 datetimes (e.g. `2026-07-09T10:15:30`).