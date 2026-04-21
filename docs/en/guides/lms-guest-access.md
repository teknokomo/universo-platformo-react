---
description: Public guest runtime access for LMS modules and quizzes, including direct links and QR codes.
---

# LMS Guest Access

The LMS MVP supports guest access without platform registration.

## How It Works

1. An operator creates an `AccessLinks` runtime row.
2. The row points to a module or quiz target.
3. The guest opens `/public/a/:applicationId/links/:slug`.
4. The public runtime asks only for a display name.
5. The backend creates a student row with `is_guest = true` and a guest session token.
6. Progress and quiz responses are then recorded under that guest student record.

The runtime resolves guest data against the workspace attached to the access link or the current guest session.
This keeps public LMS traffic fail-closed inside the intended workspace when `workspacesEnabled` is on.

## Supported Public Endpoints

- `GET /public/a/:applicationId/links/:slug`
- `POST /public/a/:applicationId/guest-session`
- `GET /public/a/:applicationId/runtime`
- `POST /public/a/:applicationId/runtime/guest-submit`
- `POST /public/a/:applicationId/runtime/guest-progress`

## QR Codes

The `qrCodeWidget` in the shared MUI app template renders an SVG QR code entirely on the client.
Use it when you want to distribute a guest module or quiz URL to a classroom or printed handout.

## Retention Model

Guest learners are stored in the same application schema as registered learners.
This keeps statistics, progress, and quiz-response tracking inside one runtime boundary instead of introducing a separate platform-wide guest-account system.
The browser stores the guest-session token in session storage, scoped to the current application and access-link slug, so shared devices do not retain LMS guest state longer than the active session.

## Operational Notes

- Public runtime access only works for applications marked as public.
- Access-link validation checks active status and target routing before the guest runtime loads content.
- The public surface intentionally does not show workspace management or authenticated runtime controls.
