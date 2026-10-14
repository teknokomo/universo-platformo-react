# Implementation Plan: LMS Guest Quiz Testing, Global Short Links, and Lyceum Marathon

> Date: 2026-10-11<br>
> Mode: IMPLEMENT — user authorized all phases of this plan on 2026-10-11.<br>
> Target: stable, maintainable MVP with production-grade integrity and comprehensive tests.<br>
> Status: Approved for implementation; the user confirmed a 45-minute event timer. Answer-key/content review remains a release gate where source items are incorrect or ambiguous.

## Overview and Intended Outcome

Finish the entity-based LMS assessment journey in a published Universo Platformo application. An editor creates a quiz with ordered single-answer questions, four answer options (for the Marathon), an optional server-enforced timer, guest registration policy, completion copy, and a report. A guest opens a short `/l/<slug>` link without platform registration, enters first and last name, accepts both platform legal documents, answers one question at a time, and sees the final score. Each answer, attempt state, deadline, and result are authoritative server records. Authenticated authorized editors view filtered attempts and scores.

Create an independent **platform-wide** short-link registry able to address supported destinations within published applications, with an LMS `AccessLinks` adapter for these tests. Regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` containing seven Lyceum Intellectual Marathon assessments (grades 5–11; 30 questions each; four options each), and prove the actual imported/published application flow in a browser.

**Inputs (read before implementation):**

-   Stakeholder requirements and the QA-refined technical brief were reviewed from the local planning workspace; those source files are not distributed with this repository.
-   [Completed research, source inventory, content-key audit, architecture and QA decisions](../research/lms-quiz-guest-testing-global-short-links-research-2026-10-11.md)
-   Historical reference only: `.backup/universo-platformo-react-0.33.0-alpha`; content source: `.backup/Марафон`.

### Scope, decisions, and non-goals

1. **Clean break:** no old UPDL/canvas quiz engine, AR.js, legacy `Leads`, legacy API compatibility, historical-data migration, or old quiz-builder AI. Recreate disposable test DB/metahubs/applications as requested.
2. **No database schema-version or metahub-template version bump.** Changes to an existing LMS seed definition and canonical fresh-install platform DDL/migration definitions are allowed and necessary; no upgrade/backfill path for historical data. Keep registration in `migrations-platform` correct.
3. **MVP authoring:** existing `Quizzes.Questions` TABLE + typed `Options` JSON is acceptable as the _storage_ representation if the normal editor exposes an accessible structured **ordered option list** and the backend validates it. The generic single-answer quiz contract must not hard-code four choices; the Marathon preset/fixture requires exactly four. Avoid prematurely adding a new entity type or full question-bank management subsystem.
4. **One attempt, one source of truth:** `QuizAttempts` is the aggregate; `QuizResponses` contains unique effective per-question answers; `Started` does not require `SubmittedAt`. A completed attempt becomes immutable except explicit authorized administrative correction (not in MVP).
5. **Time limit:** `Quizzes.TimeLimitSeconds` is the base source of truth. The user confirmed a `2700`-second (45 min) Marathon default, configurable per quiz, with server-owned `deadlineAt` and terminal `finishedReason: submitted | timed_out | revoked`; countdown only mirrors the deadline. `revoked` is reserved for an explicit hard access revocation, not ordinary expiry/quota. Do not create a second ordinary time-limit source on `AccessLinks`. If a future accommodation/override is required, model it explicitly, authorize it server-side, and persist the effective value plus provenance on the attempt.
6. **Default public quiz policy:** single correct option per question, no reveal of the correct answer or explanations until finalization; final screen shows `correct / total` and configured localized completion text. The platform may support other question types later; no extra engine in this delivery.
7. **Approved Marathon questions are fixed:** include all 210 questions from the seven supplied files. The first open-answer block is authoritative for the approved question and intended key; the later multiple-choice block supplies candidate distractors only because it contains prompt/key substitutions. Preserve each first-block question verbatim by default. Permit only a minimal, logged correction for an evident typo/grammar error, factual or terminological error, or ambiguity that prevents the retained answer from being valid; the correction must keep the same question and intent. Never paraphrase, replace, omit, or invent a question based on research recommendations. If a question remains ambiguous or its intended answer cannot be verified without changing its premise, retain the approved wording and record the review limitation for the content owner. Improve distractors and correct a demonstrably wrong answer key when authoritative evidence supports the correction; keep exactly four choices and one correct answer. Record every question/key edit with source question number and concise reason. Use a deterministic per-question ordering so correct positions vary and remain stable between fixture builds.
8. **Attempt and retention policy:** `MaxAttempts` counts each successfully created attempt (including timed-out attempts), with resume of the same `Started` attempt not consuming a new slot. Limit enforcement is per server participant/guest-session identity; first+last name cannot reliably identify one human across fresh sessions. No false anti-retake promise for name-only guests.
   An `ExpiresAt` cutoff or exhausted `MaxUses` rejects **new intake** but does not interrupt an already started, otherwise-valid quiz attempt. Explicit manual `AccessLinks` disable or application unpublish/withdrawal is a **hard revocation** for subsequent guest mutations/reads and terminates the attempt with a server-owned `revoked` result based only on already persisted answers. Releasing/disabling the platform `/l/` mapping stops future short-link resolution but does not independently revoke an already-created valid LMS guest session. Link/application hard revocation preserves committed results for authorized reports. Deleting a workspace archives the attempt and response rows with the workspace; active reports no longer include that archived workspace. Verify each boundary in E2E.
9. **Global names:** `/l/<slug>` is globally unique and a public router, not an authorization credential. The initial allowlisted target kinds are `application-entry`, `application-section` (an existing eligible published route resolved against application metadata), `application-resource` (an eligible published Page/Object runtime route resolved through authoritative metadata), and `lms-access-link` (a direct link to one quiz AccessLink). `application-resource` does not identify an arbitrary Object row. Generic public record-detail links are deferred until the platform has an authoritative record-detail route and loader with publication/workspace checks. Never store open arbitrary redirect URLs, raw table names, record IDs as client authority, or unvalidated target paths.
10. **QR and AI question generation deferred**; the external QR workaround is acceptable. No complex proctoring, leaderboard, certificate, invitation email, geoblocking, or new authentication service.
11. **Marathon fixture replaces seeded demo assessment rows**, not other independent LMS learning functionality. Preserve existing unrelated content/fixtures as needed for regression. Do not seed fake completed attempts into the canonical event fixture.

## Architectural Ownership and Affected Areas

| Layer                               | Ownership and likely touchpoints                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| LMS template and seed               | `packages/universo-react-metahubs-backend/src/domains/templates/data/lms.seed-entities.assessment.ts`, `lms.seed-report-elements.ts`, related dashboard/seed layout metadata; normal Object/Component/TABLE/REF contract.                                                                                                                                                                                          |
| Public assessment and LMS policy    | `packages/universo-react-applications-backend/src/controllers/runtimeGuestController.ts` to be split; new focused `services/guestIntake*`, `services/quizAttempts*`, `persistence/guest*` / `quizAttempts*` stores, `shared/publicRuntimeAccess.ts`, `routes/publicApplicationsRoutes.ts`; verify existing `publicApplicationRuntime.ts` readiness path.                                                           |
| Platform short links                | `applications` schema via `packages/universo-react-applications-backend/src/migrations/`, registration in `packages/universo-react-migrations-platform/src/platformMigrations.ts`, focused `persistence/globalShortLinksStore.ts`, service/route/controller, common contract in `@universo-react/types`; adapter registry. Existing `applicationAliasesStore.ts` is a behavior precedent, not a shared link table. |
| Existing platform legal/CAPTCHA     | `packages/universo-react-auth-backend/src/routes/auth.ts`, shared legal-version/policy helper, `captchaService.ts`; guest controller/service shares authoritative config without copying the auth UI or captcha verification algorithm.                                                                                                                                                                            |
| Published application UI            | `packages/universo-react-apps-template-mui/src/standalone/GuestApp.tsx`, quiz player and report/authoring generic runtime components, dashboard `QuizWidget.tsx`, application runtime renderer; preserve apps-template isolation.                                                                                                                                                                                  |
| Application control plane / routing | `packages/universo-react-applications-frontend` application settings + short-link create/list/copy/release UI; `packages/universo-react-core-frontend` public `/l/:slug` entry routing as appropriate. Reuse existing application routing and published section resolution.                                                                                                                                        |
| Common UI/i18n                      | `packages/universo-react-template-mui` **only for normal control-plane reuse**; `apps-template-mui` must not import it across its isolation boundary. Shared contracts in `@universo-react/types`, generic helpers in `@universo-react/utils`, shared translated keys in `@universo-react/i18n`, feature-local en/ru bundles where already established.                                                            |
| Tests/data/docs                     | `tools/testing/e2e/support/lmsFixtureContract.ts`, existing `lms-guest-public-runtime*.spec.ts`, `snapshot-import-lms-runtime.spec.ts`, `application-aliases.spec.ts`, new focused Jest/Vitest/Playwright tests, `tools/fixtures/metahubs-lms-app-snapshot.json`, affected package READMEs, `docs/en/` and `docs/ru/` GitBook sections and `SUMMARY.md`.                                                           |

### Technical boundaries to preserve

-   PostgreSQL via `DbExecutor.query(sql, params)` in store modules; schema-qualified parameterized SQL. Request-scoped executor for authenticated RLS operations; pool executor only for explicitly public/bootstrap/admin boundaries with independent authorization. Knex confined to canonical DDL/migrations. Use `qSchema`, `qSchemaTable`, `qColumn` for metadata-derived identifiers.
-   UUID v7 for new server-owned record identities. Trust neither client-provided workspace/application IDs nor a short-link target; derive scope from the authorized/published resolver.
-   `apps-template-mui` does not depend on `template-mui`, `metahubs-*`, `applications-*`, or any deprecated feature UI packages. Reuse existing internal MUI dashboard primitives and duplicate isolated presentational primitives only when necessary.
-   Central library-version policy through `pnpm-workspace.yaml` catalog; do not introduce additional dependencies without a concrete need. Use existing TanStack Query where available. Preserve existing router and React conventions.
-   `check:runtime-no-lms-forks` must stay green: add generic app runtime capabilities/components rather than LMS-specific forks in generic surfaces. LMS data/configuration may still be named `lms` within the domain.
-   Read the relevant package READMEs, `AGENTS.md`, architecture/UX/security/Playwright skills, and current source before touching a module. Use OntoIndex search/context/impact before any function edits and verify the diff before commit; if index is stale, refresh once and separately inspect dirty files. Run Thermos/autoreview on implementation before acceptance.

## Phase 0 — Baseline, data contract and test harness

-   [ ] Reconcile all three inputs against current HEAD, dirty worktree, imported application routing, source-generated LMS metadata and source-readiness paths. Inventory canonical methods/paths, package README instructions, and existing Jest/Vitest/Playwright infrastructure; record commands in the implementation PR/QA evidence.
-   [ ] Build a compact contract matrix of roles (`guest`, signed-in learner, authorized editor, application manager), resources (`publication`, `application`, `workspace`, `quiz`, `link`, `participant`, `attempt`) and allowed operations. One editor permission must not imply cross-workspace report access.
-   [ ] Fix the exact first-version field semantics before coding: `Quizzes.TimeLimitSeconds?`, `Quizzes.CompletionText`, `QuizAttempts.{StartedAt,DeadlineAt,SubmittedAt?,Status,FinishedReason?,Score?,TotalQuestions?,AttemptNumber,ParticipantId,QuizId,GuestSessionId?,AccessLinkId?,AssessmentRevision,QuestionSetDigest,EffectiveTimeLimitSeconds,TimeLimitSource,LegalAcceptanceAuditId?}`, `QuizResponses.{AttemptId,QuestionId,SelectedOptionIds,IsCorrect,SubmittedAt}`. Keep storage naming consistent with existing `Students` / `StudentId` models; avoid a second competing participant ID. Store references/versions needed for provenance rather than copying legal-document bodies into each attempt.
-   [ ] Document the `QuizAttempts` transactional `recordBehavior` lifecycle: active attempts persist without a final score; normal, timed-out and revoked outcomes are finalized idempotently from saved answers. The MVP does not post to a Score/LearningActivity ledger; adding generic ledger integration requires a separate product decision.
-   [ ] Inspect **all anonymous** generic runtime/object/TABLE/widget access paths for early exposure of quiz answer keys or explanations; do not rely only on the new quiz DTO projection. Add direct endpoint regression probes for alternate publication and record URLs.
-   [ ] Establish immutable scoring provenance for attempts across quiz edits/republishing: pin the assessment publication version and question-set digest when an attempt starts; if runtime materialization can be replaced, retain a server-private scoring snapshot. Specify how withdrawal of an application affects in-progress attempts, while keeping completed results accessible to authorized reports.
-   [ ] Use the isolated `apps-template-mui` runtime and its existing MUI dashboard/form primitives. A focused `AssessmentOptionsEditorDialog` is acceptable for the nested answer structure because the generic TABLE field cannot expose stable ordered options and a correct-choice selector accessibly; keep the rest of quiz creation/editing on the existing runtime row form and never import control-plane packages into the published runtime.
-   [ ] Lock the creator UI contract: create/edit `Quizzes` through the published LMS dashboard, use localized title/description/completion fields and a quiz-owned time limit, and edit each ordered question's four choices in a structured dialog with one correct selector. Persist stable option UUID v7 values, never expose raw JSON or internal IDs, and validate the event's four-choice rule at both UI and server boundaries.
-   [ ] Explicitly place `QuizAttemptResults` in **both** `lms.seed-report-elements.ts` and `buildLmsReportsSeedZoneWidgets()`/`tab:reports` in `lms.seed-dashboard.ts` (currently only LearningContentSummary and LearnerProgress appear). Source role matrix `applications-backend/src/routes/guards.ts`: `owner`, `admin` and `editor` have `readReports`; `member` and guest do not. E2E must prove the organizer logs in to the actual published application → Reports → Marathon results with these permissions.
-   [ ] Reserve isolated test fixtures/data and authoring/reset helpers. Do not run `pnpm dev`; use the repository Playwright harness and local minimal Supabase when implementation reaches E2E.

**Gate:** named data contracts and security matrix are reviewable; current test baseline is recorded, no existing uncommitted work overwritten.

## Phase 1 — Correct LMS quiz entities, authoring and template/report metadata

-   [ ] Update LMS `Quizzes` with a configurable 2700-second default time limit for Marathon, localized completion copy, explicit quiz availability or publication settings as required; validate `TimeLimitSeconds` as an integer in a bounded range (e.g. 60 to 10800), and question ordering as an integer. Preserve generic entity-type seed conventions.
-   [ ] Make `QuizAttempts.SubmittedAt` nullable while active; keep `StartedAt`, add authoritative `DeadlineAt?`, completion reason, total question count, unique stable record identity and reporting fields. `QuizResponses.AttemptId` references the aggregate and enforces `(workspace, attempt, question)` uniqueness at the persistence boundary; verify dynamic metahub record table constraints or an equally atomic store guard under a single lock.
-   [ ] Refine `AccessLinks` for typed intake policy (first name, last name, optional email/phone visibility/requiredness), boolean optional SmartCaptcha policy, target references, active/expiry/quota policy; two mandatory platform legal acceptance checkboxes cannot be disabled by this config. Keep the ordinary quiz time limit on `Quizzes`, not `AccessLinks`. Avoid exposing raw policy JSON in the UI.
-   [ ] Author `AccessLinks` from the LMS **Guest links** relation-builder tab for a selected quiz, reusing the generic entity row form. Its standard multi-step form configures title/slug, field visibility/requiredness and CAPTCHA; legal confirmations remain mandatory in the guest intake and cannot be overridden by link metadata. Keep the quiz time limit on `Quizzes`; validate the shared intake policy at UI and API boundaries. The Marathon fixture requires first and last name, hides email/phone and disables CAPTCHA.
-   [ ] Implement structured quiz edit workflow by extending/reusing the generic Object/TABLE editor: title/description, quiz-owned time limit, passing criterion, completion text, ordered question rows, prompt, ordered answer-option list, one correct-option selector, add/reorder/delete, localized errors. Backend Zod/contract validation mirrors UI and enforces bounded prompt/label/list sizes, rejects duplicate/invalid option IDs, too few choices, zero/multiple correct choices in single-answer mode, empty prompt, and invalid locale payloads. Marathon fixture/preset validation additionally requires exactly four options.
-   [ ] Enable the currently disabled quiz authoring action in the existing LMS dashboard using supported generic Object/TABLE editing. Preserve other template users; no manual database authoring. Add a simple quiz-attempt report definition (one row/attempt, name, grade/class, quiz title, started/finished, correct/total, reason/status), with server-side filtering/pagination and authorized-scoped access.
-   [ ] Add Jest entity-template/record-behavior tests, Vitest form/controller tests and a Playwright editor happy path before proceeding.

**Gate:** an editor creates and edits a functioning single-answer quiz with a structured option list without editing JSON or UUIDs; the Marathon preset enforces four choices, and a started attempt can exist without a submission timestamp.

## Phase 2 — Platform-wide `/l/<slug>` routing and policies

-   [ ] Introduce canonical physical registry such as `applications.obj_global_short_links` with UUID v7 link id; case/Unicode policy-normalized ASCII slug; application ref; `target_kind` allowlist; validated typed target reference; active/released flags; creator/owner and timestamps. Use indexes for _active globally unique slug_ and by application/owner. Implement DDL through the package's `createSchemaMigrationDefinition` pattern + `platformMigrations` registration, without increasing the schema-version constant or retroactive backfill.
-   [ ] Specify a versioned target descriptor (`applicationId`, optional validated workspace scope, `targetKind`, adapter-specific validated locator). Resolve application sections through published runtime navigation metadata. The `application-resource` adapter is limited to an eligible published Page/Object runtime route and its server-resolved entity type; it does not promise navigation to an arbitrary Object row. Defer generic record-detail links until the platform has an authoritative public record-detail route and loader that rechecks publication, workspace and record lifecycle. Use `lms-access-link` for a direct link to one quiz and its anonymous intake policy.
-   [ ] Reuse alias normalization behavior where suitable (reserved names, case fold, length, disallow UUID-shaped slugs and path delimiters). `GET /l/:slug` resolves one active mapping then checks strict published application readiness, target adapter eligibility, and LMS access policy on every request. Uniform 404 for unavailable/deleted/unpublished targets; appropriate no-store cache semantics for changing access policy.
-   [ ] Ship four typed adapters: `application-entry`, `application-section` (server resolves a published, navigable internal section by authoritative metadata), `application-resource` (server resolves an eligible published Page/Object runtime route and its available layout through the application runtime contract) and `lms-access-link` (application + concrete LMS `AccessLinks`). Adapter output is a verified internal canonical entry/view, never an unvalidated user URL. Arbitrary record-detail links remain deferred until an authoritative public route and loader exist. If a target class is not represented by authoritative runtime metadata, deny it rather than accept an arbitrary path/table/record payload.
-   [ ] Route short-link registry management through authenticated application-owner/admin `manageApplication` permission checks (editors can author quizzes but do not have this permission in current `routes/guards.ts`) and the same application/workspace isolation predicates as alias management. The registry owns slug, typed target, routing active/released lifecycle, creator and timestamps; include create/list/copy/disable/release with race-safe uniqueness/reuse handling. It does **not** own LMS expiry/quota/intake policy. Do not expose internal target IDs in normal controls.
-   [ ] Keep LMS `AccessLinks` authoritative for `IsActive`, `ExpiresAt`, `MaxUses`, class/quiz target and intake/CAPTCHA policy. A registry lookup must **never** consume a use or allocate a guest identity. Consumption happens exactly once at successful intake/session creation.
-   [ ] Differentiate an intake cutoff (`AccessLinks.ExpiresAt` or all `MaxUses` consumed) from hard security revocation. Intake cutoff rejects new guest sessions but allows an already-started valid attempt to continue to its result. Manual `AccessLinks` disable, application unpublish/withdrawal, or scope removal is hard revocation: subsequent guest operations fail through the shared resolver and the server idempotently terminates the attempt as `revoked` using only already persisted answers; only authorized reporting remains available. Registry link disable/release blocks future `/l/` resolution but does not itself revoke a bound guest session. Verify direct APIs cannot bypass either class of rule.
-   [ ] Add the global short-link creator to the existing application board route `/a/:applicationId/admin/short-links`: select a human-readable quiz access link, enter a short ASCII slug, create/copy/release the routing record, and show a localized conflict or unavailable state. Keep intake/quota/CAPTCHA settings on the LMS `AccessLinks` row. Do not embed an external QR library in MVP.
-   [ ] Verify the actual organizer path: create the quiz and its `AccessLink` under **Content Projects → Guest links**, then open the application board → **Manage short links**, choose **Quiz access link**, select the intended quiz link, and create/copy `/l/<slug>`. A user lacking `manageApplication` sees localized permission guidance. Browser E2E checks each of the seven event slugs resolves to its own expected grade and takes an author-created quiz end to end.
-   [ ] Route both `/l/` and existing `/public/a/:applicationId/...` guest paths through the same strict `resolvePublicApplication`/publication readiness decision to avoid a weaker alternate public entry.
-   [ ] Test slug case/reserved/Unicode/path attacks, concurrent claims, release/reuse, guessed target, cross-workspace mutation, unpublished/archived application, stale materialization, disallowed target kind, disabled/expired LMS link and alternate direct API bypass.

**Illustrative platform SQL:** the migration must use real registered columns and repository naming; this shows the security invariants, not a copy-paste-ready migration.

```sql
CREATE UNIQUE INDEX uq_global_short_links_active_slug
ON applications.obj_global_short_links (normalized_slug)
WHERE released_at IS NULL AND _upl_deleted = false;

-- A transaction-scoped mutation uses $1/$2 bind parameters; never interpolate slug.
UPDATE applications.obj_global_short_links
   SET released_at = CURRENT_TIMESTAMP
 WHERE id = $1 AND application_id = $2
   AND released_at IS NULL AND _upl_deleted = false
RETURNING id;
```

**Gate:** a supported target of any eligible published application has a clean `/l/` entry; invalid/stale/private mappings never disclose content or redirect outside the platform.

## Phase 3 — Guest intake, legal audit, CAPTCHA and quota

-   [ ] Move guest form field policy to typed shared contracts with server-side validation (`firstName`, `lastName`, optional `email`, `phone`, required/visible), display-name derivation and bounded text sizes. Marathon preset requires **first and last name**, no email/phone and CAPTCHA disabled. Optional richer identity policy is future-facing, not mandatory to use at the event.
-   [ ] Extract authoritative Terms/Privacy document version resolution from current auth registration code into a shared backend legal helper. Guest intake always displays both `/terms` and `/privacy` links with separately **required**, unchecked-by-default consents, and persists acceptance timestamps and exact versions in an audit record linked to participant, guest session and access link; when an attempt is created it stores the audit reference (or equivalent immutable provenance link). The guest form must not allow a link to disable legal checkboxes, and the attempt must not copy full legal-document bodies.
-   [ ] Reuse existing fail-closed SmartCaptcha service when an access policy enables it; never store token or inject CAPTCHA validation into the quiz score computation. With CAPTCHA off, show no widget or unnecessary challenge.
-   [ ] Use server-generated opaque guest session secret, hash the persisted secret, and bind session to the actual published application, workspace, access link and participant. Do not log headers, secrets, names, phone or email; set no-store and protective rate limits/size limits. Do not accept client `StudentId` or target IDs as authorization proof.
-   [ ] Inspect the existing guest-header transport, cross-origin/CORS rules and secret storage. If switching to cookies, enforce `HttpOnly`, `Secure`, `SameSite` plus explicit CSRF/origin checks on mutations. Protect all credentialed guest endpoints from cross-origin calls and sanitize their public error messages.
-   [ ] Validate target, fields, legal versions and CAPTCHA before the DB transaction; then within **one transaction** conditionally increment link `UseCount` (`MaxUses`/active/expiry guard), create participant, legal audit and session, and return session credentials after commit. Transaction failure must roll back consumption. Race-safe repeated intake with a stable idempotency key must not consume another use.
-   [ ] Clearly define session TTL separate from quiz deadline; revocation/expired session behavior preserves completed results for authorized reporting.
-   [ ] Add negative Jest/integration tests for missing consents, server/client policy mismatch, expired legal versions, invalid CAPTCHA (enabled only), disabled/expired/exhausted link, two racing intakes for last slot, duplicate request and injected workspace/participant IDs.

**Illustrative transactional quota guard (inside a `DbExecutor.transaction()` callback):**

```ts
const claimed = await tx.query<{ id: string }>(
    `UPDATE ${qSchemaTable('lms_workspace_schema', 'access_links')}
      SET use_count = use_count + 1
    WHERE id = $1
      AND is_active = TRUE
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      AND (max_uses IS NULL OR use_count < max_uses)
    RETURNING id`,
    [trustedAccessLinkId]
)
if (claimed.rows.length !== 1) throw new AccessDeniedError()
// Insert the participant, consent audit and guest session using the SAME tx.
// Resolve actual generated schema/table/column names from trusted runtime metadata.
```

**Gate:** only a valid fully persisted guest session consumes link capacity; rejected/rolled-back requests consume none.

## Phase 4 — Server-authoritative quiz attempt lifecycle

-   [ ] Extract cohesive stores/services from `runtimeGuestController.ts`: strict public/access resolution; guest intake/session; quiz question DTO and grading; attempt lifecycle; response persistence; reporting. Keep thin Express controllers/routers with Zod schemas, rate-limit middleware and typed DTOs.
-   [ ] Introduce explicit actions: `POST start-or-resume` (or equivalent), `GET attempt-state`, `PUT/POST answer`, `POST finalize`, `GET result`; keep route naming consistent with existing `/public/a/:applicationId/runtime` endpoints. All require a valid bound guest session; all revalidate publication/link/quiz availability as appropriate.
-   [ ] On start, lock the participant+quiz attempt allocation key using the existing transaction/advisory-lock convention; find any active existing attempt; lazily finalize if expired; otherwise resume it with the same original deadline. For a fresh attempt enforce `MaxAttempts`, allocate monotonic attempt number and server UUID v7, resolve the quiz-owned `TimeLimitSeconds` (plus only an explicitly authorized accommodation if such a model is later enabled), and store `StartedAt`, `DeadlineAt`, `EffectiveTimeLimitSeconds`, `TimeLimitSource`, guest-session/access-link provenance, legal-audit reference, assessment revision and question-set digest in the same transaction.
-   [ ] `answer` checks session, attempt ownership, quiz association, question membership, allowed option IDs and **server deadline** in the same transaction as persistence. Guarantee one effective answer per `(workspace, attempt, question)`; use canonical unique constraint/atomic upsert (or transaction-locked equivalent) and a client `requestId`/response version as appropriate to avoid stale duplicate writes. Prevent editing an already submitted answer for this one-way Marathon player. Advance only after server acknowledgment.
-   [ ] If expired at any read/save/finalize/report boundary, call the **same idempotent finalization** from existing persisted responses; mark unanswered as unanswered/incorrect; one score and one terminal result. Late writes are denied and cannot mutate grade. A reconciliation job may clean unobserved expirations but is not a correctness prerequisite.
-   [ ] Finalize uses one transaction and row lock on `QuizAttempts`, recomputes score from persisted answers and server-only keys, and sets `Score`, `TotalQuestions`, `SubmittedAt`, `FinishedReason` and terminal `Status`. Second/concurrent/retried finalize returns the stored identical result. Reject payloads with score or answer correctness from the guest. No ledger write is part of this MVP.
-   [ ] Score each submission using the attempt-pinned immutable assessment revision, not the quiz's current editable/published state. Cover republish or correct-option changes during an active run and ensure the result remains deterministic after finalization.
-   [ ] Use explicit **allowlisted public DTO serialization**. For example, expose `{ attemptId, questionId, prompt, order, options: [{ id, label }], deadlineAt, answeredQuestionIds }`; never spread internal question rows. Withhold `isCorrect`, correct keys, explanations, solutions, teacher hints and scoring internals until appropriate authorized post-completion policy.
-   [ ] Final result reports `{ correctCount, totalQuestions, finishReason, completionText }`, never scoring source data or other guests' PII. Distinguish `submitted`, `timed_out` and `revoked`; a hard-revoked guest receives a safe localized unavailable/revoked state while authorized reporting retains the persisted score/provenance.
-   [ ] Add Jest tests against actual store/transaction boundaries where practical, attempt ID/number uniqueness, `MaxAttempts`, deadline boundaries, stale answer/duplicate finalize, partial failure/rollback, resume with no deadline reset, and expired finalization triggered by report reads. Do not invent a ledger assertion for a ledger integration outside the approved scope.

**Illustrative idempotent answer SQL:** generated metahub table/column names must come from validated runtime metadata with `qSchemaTable/qColumn`; the SQL demonstrates expected transactional uniqueness.

```sql
INSERT INTO <trusted_schema_qualified_quiz_response_table>
  (id, attempt_id, question_id, selected_option_ids, submitted_at)
VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
ON CONFLICT (attempt_id, question_id)
DO NOTHING
RETURNING id;
-- When no row is returned, read and return the committed existing answer;
-- reject an attempt to change the selected option for this one-way quiz.
-- This statement runs only after locking and checking the canonical attempt.
```

**Illustrative safe public projection:** construct DTOs from an explicit allowlist rather than spreading ORM rows. Verify that other anonymous record APIs enforce the same secrecy boundary.

```ts
import { z } from 'zod'

const publicQuestionSchema = z
    .object({
        id: z.string().uuid(),
        prompt: z.string().min(1),
        options: z
            .array(z.object({ id: z.string(), label: z.string().min(1).max(MAX_OPTION_LABEL_LENGTH) }).strict())
            .min(2)
            .max(MAX_QUIZ_OPTIONS)
    })
    .strict()

function toGuestQuestion(question: ServerQuizQuestion) {
    return publicQuestionSchema.parse({
        id: question.id,
        prompt: question.prompt,
        options: question.options.map((option) => ({ id: option.id, label: option.label }))
    })
}
```

**Gate:** 30 validated answers become exactly 30 effective response records, one final attempt row and one stable score; reload, concurrent retries and timeout cannot inflate results.

## Phase 5 — Published guest quiz player and result view

-   [ ] Implement a generic single-question player in `apps-template-mui` using isolated existing MUI primitives. Read only public allowlisted DTOs; do not preload or render correct answers/explanations. One question at a time, render the ordered option list supplied by the quiz (four for Marathon), progress `N / 30`, automatic forward transition only after an acknowledged durable save, and remaining time from the server deadline.
-   [ ] Preserve the requested **answer → save → auto-advance** behavior without an extra Confirm/Next step. Use an accessible deliberate option-activation control built from the closest existing MUI choice/button pattern: click/tap or keyboard Enter/Space on a focused option submits that answer once; navigation/focus movement alone must not issue a mutation. Disable all answer controls during save/finalize, keep focus/ARIA semantics correct, and test keyboard activation, double activation and retry in Playwright.
-   [ ] Honor server-owned response state after refresh/reconnect and when a second tab is opened. Failed writes preserve selected radio value and show a localized retry without advancing; duplicate click and optimistic UI must not create extra responses. Prefer a small TanStack Query hook when available: `useQuery` for attempt state, `useMutation` for save, `invalidateQueries` on success; no auto-retry of non-idempotent writes without an idempotency key.
-   [ ] Automatic timeout invokes finalize for immediate UX; if tab sleeps or loses network, resume/report endpoints finalize server-side. Display normal or timed-out result with immutable correct/total and configured completion text. Honor question/quiz locale fallback without requiring Russian source content to be invented in English.
-   [ ] Model explicit UX states `answer-saving`, `finalizing`, `result-loading`, `retryable-network-error`, `completed`, `timed-out`, `revoked/unavailable`. If timeout finalize loses network, show a localized retry/loading view without reopening answer controls; on reconnect/reload read the authoritative result (or invoke idempotent finalize) and move focus to the completed-result heading. Hard revocation closes answer controls and shows no private target details. Never invent a local score before server confirmation.
-   [ ] Return `serverNow` with authoritative `deadlineAt` for countdown clock-skew adjustment; re-sync after visibility/reconnect. A write racing with timeout must display the canonical final result and retain all earlier persisted answers.
-   [ ] Keep guest entry accessible: clear form labels and checkbox links; error summaries tied to fields; meaningful `aria-live` status for question advance and final state, non-spamming countdown; announced warning near time end; restore focus to question heading on advance, no focus loss after modal/error. Provide server-authorized accommodation/extra time if required, never client-controlled deadline changes.
-   [ ] Test EN/RU visible labels/validation, dark/light, keyboard Tab/Space/arrow/Enter, mobile touch target and reflow, no raw UUID/JSON or answer hints, no horizontal document overflow.

**Illustrative React/TanStack Query pattern:**

```tsx
import { generateUuidV7 } from '@universo-react/utils'

type AnswerCommand = { questionId: string; optionId: string; requestId: string }
const pendingAnswer = useRef<AnswerCommand | null>(null)
const queryClient = useQueryClient()
const saveAnswer = useMutation({
    mutationFn: (command: AnswerCommand) => assessmentApi.saveAnswer({ attemptId, ...command }),
    retry: false,
    onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ['guest-quiz', attemptId] })
        pendingAnswer.current = null
        // Advance only after the persisted attempt state has been refreshed.
        moveFocusToQuestionHeading()
    }
})
function submitAnswer(questionId: string, optionId: string) {
    const saved = pendingAnswer.current
    const command =
        saved?.questionId === questionId && saved.optionId === optionId ? saved : { questionId, optionId, requestId: generateUuidV7() }
    pendingAnswer.current = command // Retain on failure for a deliberate retry.
    saveAnswer.mutate(command)
}
// Server validates attempt ownership, option membership and deadline independently.
```

Note: the mutation's idempotency key stays stable **across retries of the same logical answer**. On conflicting or ambiguous outcomes, fetch authoritative server state before allowing a changed selection; disable controls while saving. The code illustrates the retry boundary and must be integrated into the actual component with its existing hooks/translation conventions.

**Gate:** a guest opens `/l/...` in an incognito session, consents, takes the quiz sequentially with timer, reloads and resumes, sees the correct end score without platform sign-in.

## Phase 6 — Authorized attempt report and link/quiz management UX

-   [ ] Surface attempt-centric report through the existing generic report runner and standard MUI DataGrid/list primitives. Columns: participant full name, class/grade, quiz, started/completed time (localized), number correct/total, result/status, finish reason. Paginate/sort/filter by quiz, class and completion date **server-side**; exclude PII from public/report endpoints without authorized workspace scope.
-   [ ] Display score `correct / total`, percentage (define 0-question handling), threshold/passed flag and localized Submitted/Timed-out/Revoked labels. Protect existing CSV report export with the same `readReports`+workspace scope as the table; escape formula-like name/text values for spreadsheet import, and never include internal tokens/IDs. On mobile prioritize learner/score and confine horizontal scrolling to a bounded DataGrid rather than the page.
-   [ ] Report read must reconcile expired active attempts before returning final counts. Back-end permission requires role and workspace; test a manager/editor in a different workspace and guest against report endpoints.
-   [ ] Short-link registry management displays human-readable app/section/resource/quiz target labels and clean generated URLs with copy button. Include registry disabled/released/conflict states; no LMS quota/expiry fields and no technical UUID fields in ordinary lists. Reuse the existing application-alias `StandardDialog`/table/delete-confirmation patterns and localized errors rather than inventing a parallel management UI.
-   [ ] Make quiz authoring, preview, published entry and report navigation work from the current LMS dashboard, respecting actual publication/application ownership and normal application permissions.
-   [ ] Extend existing report UI/serialization tests plus browser verification of search/sort/filter, empty/error/loading states and one terminal row per submitted/timed-out/revoked attempt.

**Gate:** an authorized user can inspect Lyceum test results; a guest or another workspace cannot read them; report counts equal database aggregates.

## UI Contract and Explicit UX Acceptance

| Surface / actor                                  | Visible editable fields and default controls                                                                                                                                                                                                   | Hidden/system fields; feedback and evidence                                                                                                                                                                                                                                                        |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quiz editor / authorized editor                  | Localized title and multiline description/completion text; quiz-owned time-limit numeric control; ordered multiline question prompts; structured ordered choice list (four in Marathon), one correct selector; Save/Cancel in standard dialog. | Hide quiz/row/option UUID, scoring JSON and ownership IDs; localized required/range errors, unsaved edits, empty state, keyboard reorder or accessible alternative.                                                                                                                                |
| Global short-link settings / application manager | Human-readable app/section/resource/quiz target selector; short slug text field; routing active/released lifecycle; copy final `/l/` URL.                                                                                                      | Registry owns only routing identity/target/lifecycle. Hide target descriptors, workspace IDs, raw JSON and internal registry ID; localized conflict/unavailable state and disabled target explanation.                                                                                             |
| Guest-link authoring / workspace editor          | Existing LMS **Guest links** relation-builder tab scoped to a selected quiz; standard entity form for the access key/title, visible/required identity fields and CAPTCHA.                                                                  | Reuse the generic relation builder and runtime form. Hide target IDs/counters/policy JSON; legal consents remain mandatory and server-controlled; quiz time stays on `Quizzes`; localized validation and saved target confirmation.                                                   |
| Guest entry / anonymous user                     | First and last name text (required by Marathon), two separate unchecked required legal checkboxes with links, optional configured email/phone, conditional CAPTCHA, Start button.                                                              | Never expose session token or keys; localized validation and CAPTCHA failure, clear Terms/Privacy versions via linked docs; default focus on first name.                                                                                                                                           |
| Player / guest                                   | One prompt, structured option choices (4 in Marathon), `Question N / 30`, server-derived remaining time, progress and an explicit answer-save/continue action.                                                                                | No correct-answer hint/explanation, UUID, JSON or raw server stack; selecting a choice does not silently submit it; advance only after the server confirms the saved response; retry retains the choice and timer warning is accessible.                                                  |
| Completion / guest                               | Score `correct / total` for normal/timeout completion, localized configured text, distinct timed-out state, accessible main heading; safe unavailable/revoked screen after hard revocation.                                                    | No other participants, answer key or hidden score metadata; revoked screen reveals no private target details; no repeated finalize on browser reload.                                                                                                                                              |
| Invalid link or session / guest                  | Localized unavailable, expired session, attempt-limit and network error screens; safe Retry/Return/Contact organizer options as appropriate.                                                                                                   | Treat private/deleted/unauthorized targets as indistinguishable public 404; never display target existence, internal IDs, session secrets or stack traces.                                                                                                                                         |
| Results table / authorized editor                | Human name, quiz/class, start/end time, final score, state/reason, filtering/sorting/pagination.                                                                                                                                               | No raw participant/attempt IDs, JSON/object cells or secret data; loading/empty/error states and formatted dates.                                                                                                                                                                                  |

Browser acceptance sizes: **1920×1080, 768×1024, 390×844**, at least English and Russian, MUI light/dark modes for touched surfaces. Use real Playwright screenshots (full-page plus focused dialogs/quiz/report), inspect visually for cropping/overlap, and assert `document.documentElement.scrollWidth <= window.innerWidth` outside intentionally scrollable grids. Check focus, labels, contrast, accessible timer behavior, desktop keyboard and mobile touch. If visual evidence reveals a UX defect, repair before calling the phase complete; unit passing alone is insufficient.

**Screenshot/UX oracle matrix:** capture and inspect the implemented quiz editor, ordered four-option dialog, quiz-scoped Guest links relation builder and its multi-step form, application short-link creator/list, public guest intake, question, completion/timeout, and authorized report. Exercise EN/RU, required consents, field validation, keyboard answer selection, mobile reflow, saved values, no raw IDs/JSON, no page overflow and accessibility checks. Add further offline, dark-mode and broad report-filter scenarios when those states are exposed by this MVP; do not claim unimplemented UI states as verified.

## Phase 7 — Content review, canonical Marathon fixture and application provisioning

-   [ ] Review all **40 research flags** against the 210 first-block questions, but treat them as verification findings rather than authorization to rewrite. Keep every approved question and its intent; make only minimal evidence-based corrections under the fixed-content rule above. Record the original wording/key, final wording/key, source number, reason, and authoritative evidence for each change; leave unresolved items unchanged with an explicit review note. Keep the original `.backup/Марафон` source untouched.
-   [ ] Keep the event fixture **generated**: update canonical generator inputs, contract, export, snapshot-envelope/hash validation and drift guards, never edit the JSON independently. Preserve pre-existing demo constants and regression tests in a separate demo dataset if needed; do not seed played records in the event snapshot.
-   [ ] Rework `lmsFixtureContract.ts` and fixture generation/export assertions **before** regenerating JSON: seven grade quizzes, exactly 30 ordered questions per grade, 4 nonblank options per question, 1 accepted correct answer in a varied position, valid stable IDs, grade-specific targets and 2700s configured time limits. Total is **210 questions and 840 options**. Do not impose false EN/RU parity on historical Russian-language source data; UI/system strings remain localized, content locale fallback is explicit.
-   [ ] Add seven grade/class records and seven `AccessLinks` targeting exact quizzes with Marathon intake policy; quiz duration comes from each `Quizzes.TimeLimitSeconds`. Preserve other independent LMS entities/safe demo flows as required; replace the existing three demo quizzes and sample quiz-response history to make the event fixture unambiguous. Seed **no fake participants, scored responses, or attempts** into the canonical event fixture.
-   [ ] Generate/export `tools/fixtures/metahubs-lms-app-snapshot.json` via the established metahub snapshot generator/export flow, validate JSON structural and semantic contract, then import into a **fresh** minimal local Supabase DB, publish/create the application through the real flow, and check all seven targets.
-   [ ] Do not assume the platform-owned global registry can be fully installed inside a metahub snapshot: application IDs and ownership are created after import. Create `/l/` registry entries using the authenticated application control-plane UI/API after application creation; if an automated E2E provisioner is added, it must exercise the same authorization/adapter validation, not unsafe direct SQL. Ensure resulting URLs can be copied to participants.
-   [ ] Assess all 40 research flags before declaring the **event fixture** ready. Correct answer-key errors only when reliable evidence supports the correction, and lightly clarify a question only when the minimum change preserves the approved question and intent. Do not replace or omit any of the 210 approved questions to accommodate a research recommendation. For unresolved ambiguity or evidence gaps, preserve the source wording and intended key, record the limitation, and keep owner review as a release note; never label an unverified claim as verified.

**Gate:** fresh metahub import and published app show seven usable tests, full question counts, working quiz targets and independently created short links; acceptance of factual keys requires content-owner sign-off.

## Phase 8 — Deep automated QA, real-browser evidence and Thermos review

Tests should cover the actual contracts and critical transitions; do not create tests that merely repeat a helper's implementation. Follow current package runners and existing E2E runner conventions. For DB effects, use real minimal local Supabase rather than relying solely on mocks.

| Suite                                                                                   | Required assertions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Jest backend unit** (`applications-backend`, `metahubs-backend`, auth helper)         | Zod intake/question schemas, normalized slug/reserved names, typed target adapters, public DTO allowlist negative assertions, scoring (0/30, 30/30, partial), answer options and version, access policy/consent/CAPTCHA fail closed, no client-controlled deadline.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Jest SQL/route/integration** with isolated Postgres transactions                      | Platform link uniqueness/claim/release, workspace/application scope and published readiness, session policy/legal consent/CAPTCHA, answer-key DTO boundaries, attempt identity/answer uniqueness, deadline and idempotent finalization, hard revocation, authorized report scope, transactional application deletion cleanup, and workspace archival. The MVP does not post to a learning ledger.                                                                                                                                                                                                                                                                                                    |
| **Vitest frontend** (`apps-template-mui`, applications frontend, common hook/config UI) | Form labels/defaults/validation EN+RU, generic structured option-list authoring plus Marathon four-option constraint, mutation errors and selection retention, focus after progress, timer render vs server deadline, completion state and timeout, public DTO no leaks, typed link copying, report formatting; use real translation resources.                                                                                                                                                                                                                                                                                                                                                                                       |
| **Playwright E2E real minimal Supabase**                                                | Import/publish the generated fixture; author a quiz in the published app; create its `AccessLink` from the quiz-scoped Guest links tab; copy and delete an access link without changing the original; create `/l/` mappings through the application short-link UI; verify all seven fixture routes resolve to their own grades; run an anonymous name/consent/timed quiz to completion and inspect the authorized report. Also verify timeout, application withdrawal, workspace deletion/archive, report workspace isolation and public DTO leakage boundaries. |
| **Playwright visual/accessibility**                                                     | Capture and inspect real screenshots of authoring, guest-link setup, short-link management, guest intake, question, completion/timeout and report. Assert supported responsive layouts, EN/RU strings, keyboard/focus behavior, axe checks, no page overflow, safe user-facing errors, and no raw IDs/JSON. |
| **Fixture/docs/regression gates**                                                       | 7×30×4×1 content contract, snapshot drift, existing LMS content and publication flows, application-alias tests, runtime fork/isolation checks, i18n coverage, GitBook links and screenshot provenance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

E2E execution recipe:

```bash
pnpm supabase:e2e:start:minimal
pnpm env:e2e:local-supabase
pnpm doctor:e2e:local-supabase
# Run scoped Jest / Vitest and build:e2e as required by repository scripts.
pnpm run build:e2e
# Use the existing tools/testing/e2e/run-playwright-suite.mjs and appropriate
# flow/generator project flags. Do not run pnpm dev.
pnpm docs:lms-user-guide:check
pnpm check:runtime-no-lms-forks
pnpm check:apps-template-isolation
pnpm supabase:e2e:stop
```

When adding test scripts, keep their dependency versions under `pnpm-workspace.yaml` catalog and consolidate a focused `test:e2e:lms-quiz:local-supabase` gate rather than introducing a second browser harness. In CI, publish screenshot and trace artifacts on failures and include real screenshots for review; use `toHaveScreenshot` only for deterministic visual baselines. Run targeted lint/typechecks/builds, then root build to verify workspace propagation; global lint only if justified and approved under project instructions. For implementation review run Thermos correctness/security and maintainability rubrics, OntoIndex changed-scope verification, and `git diff --check`.

**Gate:** required tests green with actual browser/DB proof; no CRITICAL/HIGH unresolved security, correctness or blocking maintainability finding; no screenshot-hidden regression.

## Phase 9 — Documentation and final handoff

-   [ ] Update touched package `README.md` documents explaining ownership, public routes, link adapters, authoring, guest/session/legal/CAPTCHA policy, authoritative attempt state, testing commands and SQL/DDL boundaries; preserve English repo-comment/Memory Bank conventions.
-   [ ] Extend **both GitBook locales** `docs/en/lms/` and `docs/ru/lms/`: create quiz, configure timer, author its guest link from **Content Projects → Guest links**, publish the app, create/copy `/l` from the application board, run a guest assessment, resume/timeout, open results, and explain hard-revocation versus workspace-archive behavior. Update both `SUMMARY.md` tables of contents and relevant architecture references only when those pages change.
-   [ ] Regenerate the real documented UI screenshots using the LMS Playwright docs generator, store assets under existing `docs/.gitbook/assets/` convention and preserve capture/provenance metadata. Check `pnpm docs:lms-user-guide:check`, `pnpm docs:i18n:check`, `pnpm docs:gitbook-screenshot-assets:check`, and relevant drift guards; do not invent screens in docs.
-   [ ] Deliver a concise operational walkthrough using the **imported fixture**: import → publish → create app → create 7 global links → guest self-registration and required consents → timed test → completion → authorized reports. Record test evidence, artifact paths, any evidence gaps that still block a disputed item, and important security limitations.

**Gate:** source, docs, screenshots, test suite and real application workflow agree; all seven links can be generated and tested from the newly created application.

## Dependency Order and Acceptance Checklist

Implement in this order: **0 contracts → 1 entity/authoring → 2 platform `/l` → 3 intake → 4 attempt engine → 5 public player → 6 reporting → 7 fixture → 8 E2E/QA → 9 docs/handoff**. Develop targeted tests _alongside every phase_, then finish with a cross-layer E2E and security review; phases 2–4 can be delegated by domain to independent agents only after their shared contracts are locked.

End-to-end product acceptance:

-   [ ] Fresh LMS fixture import contains **seven grades (5–11), seven quizzes, 210 ordered questions, 840 options** and a configurable initially 45-minute limit; no test-run history is seeded.
-   [ ] Editor can create and modify a single-answer test with a structured ordered option list/correct choice, quiz-owned time limit, guest policy and completion text in ordinary localized GUI controls; the Marathon preset/fixture enforces exactly four options.
-   [ ] A copied `/l/<slug>` entry resolves an eligible target inside a published application with **no path of UUIDs**, no arbitrary URL redirects and no private publication bypass.
-   [ ] Guest signs in only to the local mini-form (first/last name), separately accepts Terms and Privacy; CAPTCHA policy is configurable but off for Marathon.
-   [ ] One question visible at a time; next question appears after **durable** answer save. No correct answer or explanation leaks before completion. Error/reload/resume preserves original deadline and progress.
-   [ ] Server finalizes on normal finish **or** expiry, persists one immutable aggregate result and one response per answered question, enforces attempts/quota atomically, and displays correct/total with localized completion copy.
-   [ ] Authorized application user can filter/paginate the attempt report; unauthorized guest/different workspace cannot access any other participant's personal data.
-   [ ] Hard revocation of a guest link or application preserves saved results for authorized reports; deleting a workspace archives results with it and removes that workspace from the normal report.
-   [ ] Full Jest/Vitest/Playwright QA, fresh local Supabase, real visual screenshots and accessibility checks pass; docs/README/EN+RU GitBook and screenshot provenance are updated.
-   [ ] All 40 research flags are reviewed. Correct definite answer-key errors only with reliable evidence and preserve the approved question wording apart from logged minimal corrections; retain unresolved source keys with review notes and identify them for Lyceum confirmation before the event. No uncertain key is presented as verified. The confirmed 45-minute timer is configurable and reflected in every Marathon quiz.

## Potential Challenges and Mitigations

1. **Dynamic metahub Object/Component schema:** physical SQL table/columns are generated, so never hardcode illustrative `access_links` identifiers in production. Resolve trusted metadata and route through existing DbExecutor stores, and verify database uniqueness works in the actual regenerated schema.
2. **Transactional attempt finalization:** the MVP stores its authoritative score on `QuizAttempts`; no generic Score/LearningActivity ledger is in scope. Lock and finalize once from persisted answers, and preserve the same result on retries.
3. **Global short-link route vs LMS policy:** application readiness, workspace and access-link revocation must be checked in every path, including the existing direct public API. Do not mistake secret-looking slug or UUID v7 for access authorization.
4. **Guest identity privacy and limits:** duplicate person with a new name-only session is not provably detectable. Preserve an honest per-participant limit; optional stronger verified identity belongs to a later phase unless the event requires it.
5. **Timing and accessibility:** client timers drift, background tabs sleep and internet connections fail. Persist each answer, rely on server time, lazy-finalize, and support server-authorized accommodations without enabling client deadline override.
6. **Snapshot vs platform registry:** metahub snapshot must remain application-agnostic; actual `/l` mappings necessarily reference post-creation application IDs and belong to a separate application management workflow.
7. **Quiz answer correctness:** research checked all 210 keys and flagged 40 for review. Quiz correctness is a _content_ acceptance gate even when all structural/E2E tests pass.
8. **Large existing controller and generic UI isolation:** split focused backend services/stores without overabstracting, and keep generic runtime components free of domain forks. `check:runtime-no-lms-forks`/`check:apps-template-isolation` enforce this.
9. **Existing dirty changes:** preserve `AGENTS.md`, `CLAUDE.md`, `memory-bank/currentResearch.md` and the untracked research file that were present when this plan was prepared; avoid accidental broad commit or overwrites.
10. **Workspace deletion retention:** revoke active guest sessions and finalize from already-saved responses, then archive `QuizAttempts` and `QuizResponses` with all other workspace rows. The active report remains scoped to active workspaces; this differs from hard link/application revocation, where authorized reports continue to show the saved results.

## Research and Source Verification Notes

-   Local research: `memory-bank/research/lms-quiz-guest-testing-global-short-links-research-2026-10-11.md` contains primary OWASP/WCAG/PostgreSQL sources and the full 40-item question audit.
-   Code navigation: OntoIndex semantic search was used for guest/public assessment flows and cross-checked with `runtimeGuestController.ts`, `lms.seed-entities.assessment.ts`, fixture contract and project test scripts. Recheck index freshness/impact when actually editing.
-   Current Context7 documentation consulted during PLAN: [TanStack Query React mutations, invalidation and retry](https://github.com/tanstack/query/blob/main/docs/framework/react/guides/invalidations-from-mutations.md), [Playwright screenshot assertions and trace config](https://github.com/microsoft/playwright/blob/main/docs/src/test-use-options-js.md), [PostgreSQL 17 `ON CONFLICT`](https://www.postgresql.org/docs/17/sql-insert.html) and [PostgreSQL 17 row-level locks](https://www.postgresql.org/docs/17/explicit-locking.html).
-   UX and implementation patterns: `.agents/skills/universo-platform-architecture/SKILL.md`, `.agents/skills/mui-runtime-ux-patterns/SKILL.md`, `.agents/skills/runtime-ux-qa/SKILL.md`, `.agents/skills/playwright-best-practices/SKILL.md`, `.agents/skills/research-before-plan/SKILL.md`. The UI Contract above applies their plan-UX gate.

## Release Content Gate

The user confirmed that the approved question set is the first/open-answer block in each `.backup/Марафон` file and authorized a 45-minute default. The prepared multiple-choice block is a candidate source for answer choices, not authority to replace or rewrite the approved questions. Keep source files intact. Record every correction and its evidence; correct answer keys only where reliable evidence supports it, and leave unresolved ambiguous items with their approved source wording/key and an explicit review note for Lyceum confirmation before the event.

## Implementation reconciliation (2026-10-12)

The implementation uses the existing LMS dashboard and app-template MUI runtime. Quiz questions and ordered answer options are edited through the isolated `AssessmentOptionsEditorDialog`; quiz access links are authored in the generic **Guest links** relation-builder tab; `/l/` mappings use the existing application-board short-link manager. The app/workspace lifecycle rule above is the accepted retention behavior. No ledger posting, QR integration, AI question generation, legacy compatibility reader, schema-version bump, or metahub-template-version bump is part of this MVP.

The user guide now documents both organizer paths in English and Russian. The final closeout records exact build, test, fixture, browser, screenshot, lint, documentation and review evidence; phase completion must be read together with that evidence and the three retained source-question review notes, which still require Lyceum content-owner confirmation.

The implementation phase is complete; the preceding checklist describes the accepted design and its completed verification, while this reconciliation records deliberate MVP boundaries. No database migration backfill or compatibility implementation was added.
