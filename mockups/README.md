# Frontend Screens — Insurance Doc Chatbot

Static HTML prototype screens for developer handoff. The theme is inspired by
the OpenAI ChatGPT platform (clean neutrals, dark sidebar, green accent).

## How to view
Open **`index.html`** in a browser — it links to every screen. No build step;
plain HTML + one shared `styles.css`.

## Screens

| File                    | Screen                 |
|-------------------------|------------------------|
| `index.html`            | Screens overview       |
| `login.html`            | Login                  |
| `register.html`         | Register               |
| `verify-email.html`     | Verify email           |
| `forgot-password.html`  | Forgot password        |
| `reset-password.html`   | Reset password         |
| `documents.html`        | Documents (upload & manage PDFs) |
| `chat.html`             | Chat (policy Q&A)      |

The API each screen should call is documented separately in
[`../docs/API_documentation.md`](../docs/API_documentation.md).

## Design notes
- Single shared stylesheet: `styles.css` (design tokens, components, layouts).
- Includes the states a developer needs to build: form fields, status badges,
  progress bar, loading state, and confirm modals.
- Emoji are used as placeholder icons — swap for the real icon set / logo.
- Colours live as CSS variables at the top of `styles.css`; change them in one
  place to re-theme.
