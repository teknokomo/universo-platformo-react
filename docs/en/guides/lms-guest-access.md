---
description: Public guest runtime access for LMS learning content and quizzes, including direct links and QR codes.
---

# LMS Guest Access

The LMS MVP supports guest access without platform registration.

## How It Works

![Lyceum Marathon guest entry screen](../.gitbook/assets/lms-user-guide/guest-access.png)

1. An operator creates an active `AccessLinks` entry in a public, ready application and assigns it to learning content or a quiz.
2. A guest opens the direct URL `/public/a/:applicationId/links/:slug`, or a global short URL `/l/:slug` configured for that access link.
3. The access-link intake settings decide which fields appear and are required. First name and last name use separate fields; current Lyceum Marathon quiz links require both. A link can also require email or phone.
4. The guest form presents both the Terms of Service and Privacy Policy. Quiz and assessment sessions require acceptance of both, and the accepted document versions and timestamps are recorded with the guest learner.
5. CAPTCHA is shown only when the access link has CAPTCHA enabled.
6. The backend creates a guest learner and session token. Learning progress, quiz answers, and attempts are saved in that application and scoped to the access link and its workspace.

The browser keeps the guest-session token in session storage, scoped to the application and access-link slug. Runtime data stays within the workspace attached to the access link or guest session when workspaces are enabled.

## Authoring and Sharing

Owners can create and edit quiz records from **Quizzes** in the application sidebar or from **Content Projects → Quizzes**. They manage each quiz's guest intake policy under **Content Projects → Guest links**. To copy a complete direct guest URL, open the application board and select **Guest and short links**; the **Full guest quiz links** table lists each available URL and its copy action. The application must be public for anonymous access. Creating an optional `/l/<slug>` alias is available on the same page.

## Global Short Links

A global short link uses the deployment-wide browser path `/l/<slug>`. The public SPA resolves it through `GET /api/v1/public/l/:slug`. The resolver returns a validated target; when the target is an LMS access link, the SPA opens the guest runtime for that application's access-link slug. The target application must remain public and ready, and the quiz access link must remain active and resolve to an available public quiz. Releasing a short link disables its public resolution.

The **Guest and short links** page is application-scoped and reuses the platform's shared table and confirmation controls. It lists complete direct guest URLs and supports optional `/l/<slug>` aliases; QR-code generation is outside this MVP and can use an external QR-code service.

Short links can open other supported public application destinations as well. They do not grant access to application administration, private runtime data, or reports. See [Public applications and global short links](../platform/public-applications-and-aliases.md) for the supported destinations and management rules.

## Public API Routes

The following routes are mounted under `/api/v1`:

-   Access-link lookup: `GET /public/a/:applicationId/links/:slug`
-   Guest session creation: `POST /public/a/:applicationId/guest-session`
-   Guest runtime: `GET /public/a/:applicationId/runtime`
-   Quiz attempt start: `POST /public/a/:applicationId/runtime/attempts/start?locale=<locale>`
-   Quiz attempt resume/read: `GET /public/a/:applicationId/runtime/attempts/:attemptId?locale=<locale>`
-   Save an answer: `PUT /public/a/:applicationId/runtime/attempts/:attemptId/answers?locale=<locale>`
-   Finalize an attempt: `POST /public/a/:applicationId/runtime/attempts/:attemptId/finalize?locale=<locale>`
-   Save learning progress: `POST /public/a/:applicationId/runtime/guest-progress`
-   Public modules: `GET /public/a/:applicationId/runtime/modules` and `GET /public/a/:applicationId/runtime/modules/:moduleId/client`
-   Resolve a global short link: `GET /public/l/:slug`

For a quiz or assessment target, `POST /public/a/:applicationId/guest-session` requires every intake field marked required by the access link, both consent values set to `true`, and a valid `Idempotency-Key`. A CAPTCHA token is required when that link enables CAPTCHA. The old `{ displayName, accessLinkId }` request remains available for non-quiz content links only; it cannot create a quiz session.

## Quiz Attempts, Scores, and Reports

A quiz attempt is started on the server and keeps its saved deadline and question snapshot. The guest runtime saves each selected answer before moving to the next unanswered question and can restore the same attempt after a reload. Correct answers are not included in the question data shown during the quiz. On submission or timeout, the server scores the saved answers and stores the score, total questions, pass state, completion time, and finish reason with the attempt.

For the Lyceum Marathon, each of the seven quizzes has 30 questions, four choices per question, and a 2,700-second time limit. The timer uses the server deadline; expired attempts are finalized before an authorized report is read. Locale is passed to the attempt lifecycle endpoints so both the interface and the closing message match the participant's selected language.

The public guest session can retrieve only its own attempt and final result. It cannot open the Reports area or read another learner's result. Signed-in application staff with the `readReports` permission can use the saved `QuizAttemptResults` report, which shows quiz, learner, start and completion times, score, total questions, attempt status, and finish reason. See [LMS Reports](../lms/reports.md).

![Completed Lyceum Marathon guest result](../.gitbook/assets/lms-user-guide/guest-access-step-4.png)

![Authorized application report with Lyceum Marathon results](../.gitbook/assets/lms-user-guide/guest-access-step-5.png)

## QR Codes

Create a QR code from either the direct guest URL or the global `/l/<slug>` URL. A global short link can route learners to a specific eligible quiz access link without putting the application ID and access-link slug in the shared address.

## Publishing and Operations

-   Public guest access requires an application that is marked public and ready, plus an active access link whose target remains available.
-   Revoking an access link blocks new sessions and quiz reads; any in-progress attempt is finalized as revoked and the public response contains no question content.
-   The current quiz runtime uses the explicit attempt lifecycle routes listed above. A previously published runtime that calls the former one-shot submission flow must be republished with the current runtime template; there is no compatibility route for that old flow.
-   The public guest surface does not expose application administration or the staff Reports area.

## User Guide Link

For day-to-day work inside the published LMS application, use the [Guest Access](../lms/guest-access.md).
