# Research: LMS Guest Quiz Testing and Global Short Links

> Created: 2026-10-11
> Status: Reviewed
> Trigger: RESEARCH follow-up for the Lyceum Intellectual Marathon guest-quiz brief and its QA-refined technical specification.
> Follow-up plan: TBD in PLAN mode.

## Research Question

How should Universo Platformo complete the current entity-based LMS so that a published application can run timed, sequential public quizzes for guests, persist authoritative attempts and responses, expose authenticated result reporting, and support a reusable deployment-wide `/l/<slug>` entry route without restoring the removed legacy canvas/UPDL quiz architecture?

The research also tests whether the current LMS entities and public-runtime code are sufficient, where the platform/LMS ownership boundary should sit, which security and accessibility invariants the implementation needs, how the Marathon fixture contract must change, and whether the supplied seven-grade answer set is safe to promote directly to canonical fixture data.

## Scope And Method

-   Re-read the stakeholder task and the QA-refined technical brief supplied for this work.
-   Inspected the current LMS template, assessment entities, guest public-runtime controller/routes, strict published-application resolver, application-alias implementation, current guest and authenticated quiz UIs, authentication consent/CAPTCHA implementation, report seeds, LMS fixture contract, related Memory Bank contracts, and the relevant E2E surfaces.
-   Used the historical 0.33-era quiz implementation only as behavioral evidence for sequential questions, guest intake, timers, links, QR, result persistence, and simple analytics. The historical persistence/UPDL graph is not a target architecture.
-   Applied `research-before-plan`, `universo-platform-architecture`, `mui-runtime-ux-patterns`, and `runtime-ux-qa` as review constraints.
-   Used OntoIndex semantic exploration for public guest/LMS routing and then verified material conclusions against current source because OntoIndex reported degraded coverage for two oversized files.
-   Queried Context7 for current React Router dynamic-segment documentation and opened the primary React Router routing documentation referenced by the brief.
-   Refreshed primary OWASP, W3C WCAG 2.2, and PostgreSQL documentation relevant to authorization, internal target resolution, timed assessments, timeout/data preservation, and partial uniqueness.
-   Ran an independent structural parser over all seven supplied Marathon files. Each file contains exactly 30 prepared multiple-choice questions, exactly four options per question, and exactly one marked option, for 210 questions and 840 options total.
-   Launched independent read-only subagent reviews of the current repository architecture and the Marathon source set. Three architecture/code reviews completed and agreed on the major boundaries below. Three earlier browser-backed agents failed at the platform transport layer; their intended areas were rechecked in the main research flow. A second parallel round then verified all 210 Marathon marked answers by grade group: 5–6 (60/60), 7–8 (60/60), and 9–11 (90/90), with no unchecked remainder.
-   A follow-up QA pass incorporated the preserved results of two additional independent architecture/UX reviewers and rechecked their findings against current source. That pass tightened attempt identity/finalization, atomic quota/session/legal writes, platform-owned consent, generic short-link adapters, anonymous DTO safety, fresh-schema DDL semantics, and the Runtime UI UX acceptance contract.

No product code, DDL/migration definition, fixture, template version, or schema version was changed in RESEARCH mode.

## Source Inventory

### Local authoritative sources

| Source                                                                                                                                                                                                | Type                   | Date / Freshness                                    | Why It Matters                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stakeholder Lyceum quiz task supplied for this research                                                                                                                                               | Primary requirements   | 2026-10-11                                          | Defines the required guest flow, timer, result reporting, short links, seven-grade fixture, clean-break constraint, and no legacy-compatibility requirement.                  |
| QA-refined LMS guest quiz/global short-link brief supplied for this research                                                                                                                          | Primary planning input | 2026-10-11                                          | Converts the stakeholder goal into explicit architecture, UX, security, fixture, and acceptance requirements.                                                                 |
| `packages/universo-react-metahubs-backend/src/domains/templates/data/lms.seed-entities.assessment.ts`                                                                                                 | Current source         | Current checkout, 2026-10-11                        | Defines `Quizzes`, `QuizResponses`, `QuizAttempts`, and `AccessLinks`.                                                                                                        |
| `packages/universo-react-applications-backend/src/controllers/runtimeGuestController.ts`                                                                                                              | Current source         | Current checkout, 2026-10-11                        | Implements LMS guest link/session/runtime/submission behavior, quota consumption, target checks, guest token validation, and current response persistence.                    |
| `packages/universo-react-applications-backend/src/routes/publicApplicationsRoutes.ts`                                                                                                                 | Current source         | Current checkout, 2026-10-11                        | Shows the current `/public/a/:applicationId/...` LMS guest API and confirms that deployment-wide `/l/:slug` does not exist.                                                   |
| `packages/universo-react-applications-backend/src/services/publicApplicationRuntime.ts`                                                                                                               | Current source         | Current checkout, 2026-10-11                        | Provides the strict anonymous published-application readiness gate that rejects private/unpublished/archived/deleted/unready materializations.                                |
| `packages/universo-react-applications-backend/src/shared/publicRuntimeAccess.ts`                                                                                                                      | Current source         | Current checkout, 2026-10-11                        | Current LMS guest runtime entry helper; its contract is materially weaker than `resolvePublicApplication()` for full publication/readiness checks.                            |
| `packages/universo-react-applications-backend/src/persistence/applicationAliasesStore.ts` and application alias migration/service/type code                                                           | Current source         | Current checkout, 2026-10-11                        | Mature precedent for normalized global names, reserved/UUID-shaped rejection, release semantics, advisory locking, partial uniqueness, and fail-closed management.            |
| `packages/universo-react-apps-template-mui/src/standalone/GuestApp.tsx`                                                                                                                               | Current source         | Current checkout, 2026-10-11                        | Current guest UI collects one display name, renders all quiz questions together, and bulk-submits answers at the end.                                                         |
| `packages/universo-react-apps-template-mui/src/dashboard/components/QuizWidget.tsx`                                                                                                                   | Current source         | Current checkout, 2026-10-11                        | Existing one-question-at-a-time UI/progress precedent; currently includes immediate correctness feedback/auto-advance behavior that does not match the Marathon event.        |
| `packages/universo-react-auth-backend/src/routes/auth.ts`, `packages/universo-react-auth-backend/src/services/captchaService.ts`, `packages/universo-react-auth-frontend/src/components/AuthView.tsx` | Current source         | Current checkout, 2026-10-11                        | Existing Terms/Privacy acceptance, document-version persistence, `/terms`/`/privacy` links, and fail-closed SmartCaptcha capability to reuse rather than duplicate.           |
| `packages/universo-react-metahubs-backend/src/domains/templates/data/lms.seed-report-elements.ts`                                                                                                     | Current source         | Current checkout, 2026-10-11                        | Generic report engine seeds exist, but there is no first-class quiz-attempt results report.                                                                                   |
| `tools/testing/e2e/support/lmsFixtureContract.ts`                                                                                                                                                     | Current source         | Current checkout, 2026-10-11                        | Current canonical LMS snapshot assumptions are demo/bilingual and hard-code current quiz/locale/attempt values; Marathon cannot be added safely by editing JSON only.         |
| Seven stakeholder-provided Intellectual Marathon source files for grades 5–11                                                                                                                         | Primary content input  | Historical content, structurally checked 2026-10-11 | Each has 30 questions, four prepared options, and one marked answer. Marked correctness is not authoritative.                                                                 |
| Historical 0.33-era quiz implementation supplied by the stakeholder                                                                                                                                   | Historical source      | 2025-era implementation, reviewed 2026-10-11        | Confirms old UX capabilities (sequential quiz, lead/intake, timer, short links, QR, analytics) without establishing a persistence model to preserve.                          |
| `memory-bank/techContext.md`, `memory-bank/systemPatterns.md`, `memory-bank/tasks.md`                                                                                                                 | Repository knowledge   | Current checkout, 2026-10-11                        | Records the existing guest-session envelope contract, fixture conventions, public runtime rules, and the tracked need to split `runtimeGuestController.ts` when next touched. |

### External primary sources

| Source                                                                                                                                                                      | Type                              | Date / Freshness                                                      | Why It Matters                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Router routing documentation — https://github.com/remix-run/react-router/blob/main/docs/start/data/routing.md                                                         | Primary library docs              | Crawled 2026-10-11; Context7 also refreshed current React Router docs | Confirms `:slug` dynamic route segments are ordinary router syntax; the hard problem is platform resolution/authorization, not client-route mechanics.                                                                                                  |
| Context7 `/remix-run/react-router` current docs                                                                                                                             | Primary library docs via Context7 | Retrieved 2026-10-11                                                  | Confirms current route declarations such as `teams/:teamId` and multi-segment parameter parsing.                                                                                                                                                        |
| React Router current routing documentation — https://reactrouter.com/start/framework/routing                                                                                | Primary library docs              | Refreshed 2026-10-11                                                  | Independently confirms current React Router 7 dynamic-segment semantics for a route such as `/l/:slug`.                                                                                                                                                 |
| OWASP Authorization Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html                                                             | Primary security guidance         | Crawled 2026-10-11                                                    | Requires deny-by-default behavior and permission checks on every request; a slug/UUID is not authorization.                                                                                                                                             |
| OWASP Unvalidated Redirects and Forwards Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html                   | Primary security guidance         | Crawled 2026-10-11                                                    | Recommends server-side mapping from short IDs/tokens to approved destinations and avoiding arbitrary user-controlled redirect URLs.                                                                                                                     |
| OWASP Insecure Direct Object Reference Prevention Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html | Primary security guidance         | Crawled 2026-10-11                                                    | Explicitly treats slugs/UUIDs/tokens as object references; complex identifiers do not replace object-level authorization and public responses should avoid existence leakage where relevant.                                                            |
| OWASP Session Management Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html                                                   | Primary security guidance         | Refreshed 2026-10-11                                                  | Requires timeout/expiration enforcement on the server side and warns against relying on browser closure or client-owned clocks; supports server-authoritative guest-session and assessment-expiry handling.                                             |
| W3C WCAG 2.2, Understanding SC 2.2.1 Timing Adjustable — https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html                                                 | Primary accessibility guidance    | Updated 2026-08-10; crawled 2026-10-11                                | Supports accessible timing and explicitly allows third-party controlled extra time for tests where learner-controlled extension would invalidate the activity.                                                                                          |
| W3C WCAG 2.2, Understanding SC 2.2.6 Timeouts — https://www.w3.org/WAI/WCAG22/Understanding/timeouts.html                                                                   | Primary accessibility guidance    | Updated 2026-09-06; crawled 2026-10-11                                | Supports warning/preservation semantics and avoiding loss of entered data across timeouts; reinforces per-answer persistence and resumable attempts.                                                                                                    |
| PostgreSQL 18 Partial Indexes — https://www.postgresql.org/docs/current/indexes-partial.html                                                                                | Primary database docs             | Current PostgreSQL 18 docs, crawled 2026-10-11                        | Documents partial unique indexes that enforce uniqueness only for rows matching a predicate, suitable for active/unreleased short-link names.                                                                                                           |
| PostgreSQL 18 SET TRANSACTION — https://www.postgresql.org/docs/current/sql-set-transaction.html                                                                            | Primary database docs             | Current PostgreSQL 18 docs, refreshed 2026-10-11                      | Documents PostgreSQL isolation semantics, including serialization failure under `SERIALIZABLE`; reinforces that attempt allocation/quota decisions need one explicit transactional concurrency boundary and retry handling where serialization is used. |

## Key Findings

### 1. The current LMS already has most domain nouns, but not a complete assessment lifecycle

The new architecture is much closer to the requested feature than the old quiz implementation. The template already defines:

`Quizzes → QuizAttempts → QuizResponses → ScoreLedger / LearningActivityLedger`

and it already defines `AccessLinks` for LMS-specific public access policy.

The missing piece is lifecycle wiring. Current public guest submission calculates the next `AttemptNumber` from `QuizResponses`, scores the whole quiz, inserts one response per question, and returns a score. It does not create/update a canonical `QuizAttempts` row and does not enforce `Quizzes.MaxAttempts`.

This means the brief's proposed attempt model is not speculative redesign; it completes an existing domain model that is currently only partially used.

### 2. `QuizAttempts` needs to become the authoritative aggregate and must support an actual in-progress state

For the requested timer, resume, timeout, reporting, and max-attempt semantics, one server row must represent one attempt from start through completion. `QuizResponses` should remain per-question detail owned by that attempt.

The current `QuizAttempts` entity has `Started`, `Submitted`, `Passed`, and `Failed` states, but `SubmittedAt` is currently required. That is inconsistent with persisting a real `Started` row before submission. PLAN should correct the entity contract rather than inventing a side table or encoding active-attempt state in the guest session token.

Recommended conceptual lifecycle:

`start/resume → save answer(s) → finalize normally | finalize on deadline → immutable scored result`

At minimum, the attempt needs server-owned start/deadline/completion timestamps, attempt number, completion reason/status, score/total or score plus question-count basis, pass/fail state where applicable, and the participant/quiz relation. `SubmittedAt`/completion fields must be nullable until finalization.

### 3. Answer writes and finalization must be idempotent and race-safe

The current final bulk insert can duplicate logical work on retry and cannot preserve progress question-by-question. The new flow should persist each answered question before navigation. `QuizResponses` should gain an explicit `AttemptId` REF to `QuizAttempts`; one logical response must be unique for `(AttemptId, QuestionId)` within the same workspace scope. Keeping only `StudentId + QuizId + AttemptNumber` is too weak for the new lifecycle because the canonical attempt already has a stable server identity.

`save-answer` should be an atomic upsert/replace-with-version-guard operation keyed by that explicit attempt/question identity. `finalize` and timeout finalization must be idempotent: concurrent/retried requests return the same completed attempt rather than creating another score or consuming another `MaxAttempts` slot.

Attempt-number allocation and `MaxAttempts` enforcement belong inside the same serialized transaction/lock boundary used to create the attempt. Resuming an existing active attempt must not consume a new attempt number.

This is a correctness requirement independent of client behavior; browser-side disabled buttons are UX protection, not the concurrency invariant.

### 4. The server deadline is authoritative; the browser timer is presentation

The browser may display an accessible countdown, but the server must decide whether an answer or finalize request is on time. Client clock changes or suspended tabs cannot extend the attempt.

The deadline should begin only after guest intake, required consent, optional CAPTCHA, and access-link checks succeed and the participant actually starts the attempt. Guest-session TTL and quiz deadline are different concepts and should remain separate.

When the deadline passes, the attempt must not remain indefinitely in `Started`. An open client should call the idempotent finalize operation when its countdown reaches zero, but server correctness cannot depend on that browser callback. Every assessment lifecycle read/resume/report/finalize boundary that observes an expired `Started` attempt should first materialize the same canonical timeout result from already persisted responses, count unanswered questions as unanswered/incorrect, and return/read the finalized state. A scheduled reconciliation sweep may be added for attempts that are never observed again, but it is a cleanup/reconciliation aid rather than the primary correctness mechanism.

This lazy-finalization rule also applies to authenticated reporting: reports must not show a permanently `Started` attempt whose authoritative deadline is already in the past.

WCAG 2.2 SC 2.2.1 does not require a learner to be able to arbitrarily extend a competitive/assessment timer when that would invalidate the activity. Its current guidance explicitly recognizes third-party-controlled accommodations such as double time on a test. The clean contract is therefore a server-authorized accommodation/override on the access policy or attempt, not a learner-controlled timer extension.

### 5. Per-answer persistence also fixes reload/reconnect and timeout data-loss behavior

W3C's current timeout guidance emphasizes that users should not unexpectedly lose entered work. Persisting each answer before advancing gives the product a natural resume contract: reload/reconnect returns the same active attempt, current deadline, persisted answers, and next unanswered/current question.

This also avoids relying on one large browser payload held until the final screen, which is the current `GuestApp` behavior.

### 6. The existing `QuizWidget` is the better sequential UX precedent, but its scoring feedback must change for Marathon

The authenticated `QuizWidget` already has one-question-at-a-time rendering, `Question N of total`, linear progress, keyboard-friendly MUI radio/checkbox controls, previous/next navigation, final results, and auto-advance machinery.

However it also exposes immediate correctness feedback and auto-advances after a correct answer. That is unsuitable for the requested Lyceum assessment because it leaks the answer before completion and creates a different scoring experience from a normal test.

The public player should reuse the generic composition/presentation patterns but use final-only scoring feedback. Sequential advance occurs after a successful persisted answer, regardless of correctness.

### 7. Guest intake should extend the modern participant/session contract rather than restore legacy Leads

The modern LMS already has guest participants/students and a persisted guest-session envelope. Current public intake only asks for one `displayName`; the historical Leads table/API should not return.

The clean general contract is a configurable intake policy with typed supported fields. At minimum: first name, last name, email, phone; each field has visible/hidden and required/optional state. The Marathon policy requires first and last name separately, with email/phone hidden.

The participant record should preserve typed values and also derive a human-friendly display name for ordinary tables/reports. Server validation must mirror configured required fields and return localized user-facing messages.

### 8. Terms/Privacy are a platform requirement; CAPTCHA is a reusable optional capability

Authentication already requires `termsAccepted` and `privacyAccepted`, renders links to `/terms` and `/privacy`, persists acceptance timestamps and document versions, and exposes a shared SmartCaptcha service with fail-closed validation.

The guest LMS flow currently has none of these checks. The two site-wide Terms/Privacy acceptances should be mandatory for this public guest flow as a platform-owned invariant, not a per-`AccessLinks` toggle. `AccessLinks` may configure the guest intake fields, CAPTCHA enablement, access quota/expiry, and quiz-specific accommodations, but it should not be able to disable the site's required legal acceptances.

There is one implementation gap in the current auth code: `auth.ts` reads `LEGAL_TERMS_VERSION` and `LEGAL_PRIVACY_VERSION` directly from environment variables. A reusable centralized legal-version service does not yet exist. Implementation should extract a shared legal policy/version helper and reuse it from both registration and guest intake instead of claiming an already-existing shared version service. The SmartCaptcha capability is already reusable through the shared CAPTCHA utilities/service.

For auditability, persist acceptance facts with the guest participant/access-link/attempt context. Do not duplicate full legal document text in every attempt, and do not persist the CAPTCHA token itself.

The exact legal policy for minors is outside this technical research; this work should faithfully reuse the site's configured consent documents and record which versions were accepted.

### 9. `/l/<slug>` must be a platform routing primitive, while LMS `AccessLinks` remains an access-policy primitive

No deployment-wide `/l/:slug` route exists in the current checkout. Current LMS links are scoped under `/public/a/:applicationId/links/:slug`, which necessarily exposes the application reference and belongs to the LMS guest runtime.

The new `/l/` registry should live in the Applications/platform routing domain and contain a typed, extensible internal target descriptor. It should never store arbitrary redirect URLs or provide an unvalidated generic record bypass.

For an LMS quiz, one target adapter can resolve the application plus the specific LMS `AccessLinks` record (and any internal workspace scope the registry must retain). Other first-class adapters can later address eligible sections or entity/resource records inside any published application. Each adapter must own its target validation and authorization/readiness rules; the platform registry only selects a supported internal adapter and target identity.

The LMS access-link record remains authoritative for `IsActive`, `ExpiresAt`, `MaxUses`, class/content/quiz targeting, guest intake policy, CAPTCHA setting, and quiz accommodations.

This separation keeps `/l/` reusable for future application-internal targets without freezing LMS policy into the global registry.

### 10. A short slug is routing input, not an authorization credential

OWASP's current Authorization and IDOR guidance is directly applicable: slugs, UUIDs, tokens, and other complex identifiers remain object references. Guess resistance is defense-in-depth; object and action eligibility must still be checked server-side.

The resolver must therefore:

1. resolve the short-link registry row;
2. resolve the target application through the strict normal public-application readiness gate;
3. validate any stored workspace/target adapter against that application;
4. re-check the target's current eligibility and LMS `AccessLinks` policy;
5. expose one non-enumerating public-unavailable outcome for missing, released, private, unpublished, archived, deleted, or otherwise ineligible targets where distinction is unnecessary.

OWASP's redirect guidance further supports server-side mapping from a short token to an approved target instead of accepting a caller-controlled destination URL.

### 11. The current guest resolver and the strict published-application resolver must not become two competing public gates

Current LMS guest routes enter through `resolvePublicRuntimeSchema()` in `shared/publicRuntimeAccess.ts`. The normal anonymous published-application path uses `resolvePublicApplication()` in `publicApplicationRuntime.ts`.

The latter performs materially stronger readiness checks: deletion/archive flags, `is_public`, `_app_published`, schema validity/status, and coherent installed materialization. A new global short link that resolves only through the current guest helper could therefore create a second public-readiness policy and drift from `/a/<applicationRef>` behavior.

`/l/` should resolve the application through `resolvePublicApplication()` (or a factored common strict core) before handing off to the LMS access adapter. PLAN should also decide whether the existing LMS public endpoints should converge on that strict core so the same published application cannot be classified differently depending on entry URL.

### 12. Application aliases are the best in-repository precedent for the global slug registry

Application aliases already provide the right invariants:

-   shared normalization and length/pattern rules;
-   malformed/control/non-ASCII/path separator rejection;
-   reserved-word rejection;
-   UUID-shaped rejection;
-   global active-name uniqueness at the database layer;
-   explicit release semantics;
-   advisory locking around transitions;
-   UUID v7 identities;
-   service-level conflict mapping;
-   public resolution separated from authenticated management.

The short-link registry should reuse these concepts rather than copy the current LMS `AccessLinks.Slug` string directly into a deployment-global namespace.

PostgreSQL 18 explicitly documents a partial unique index as the database primitive for uniqueness over only the rows matching a predicate. That is appropriate for `released_at IS NULL` (or equivalent active-reservation semantics), while application/service logic handles normalization and authorization.

### 13. `AccessLinks.MaxUses` is already race-safe and must remain atomic with guest-session creation

Current guest code consumes `UseCount` with one conditional `UPDATE ... WHERE ... max_uses ... RETURNING`, so the quota increment itself is concurrency-safe.

The current implementation also already performs quota consumption and guest participant/session insertion inside the same `ctx.manager.transaction(...)`. The new flow should preserve that atomicity. Validate request shape, configured intake fields, mandatory Terms/Privacy, and optional CAPTCHA before entering the transaction; then consume `MaxUses`, insert the guest participant/session, and persist the legal-acceptance audit facts inside one database transaction. Any failure after quota consumption must roll the increment back together with the participant/session/audit writes.

Starting/resuming a quiz attempt is a separate quota. `MaxAttempts` is consumed only by creation of a new `QuizAttempts` row; resuming an active attempt does not consume another attempt.

### 14. Guest `MaxAttempts` cannot strongly identify a human when the configured policy collects only first and last name

The server can reliably enforce `MaxAttempts` per participant record/guest session. It cannot prove that a new guest session with the same typed name is the same physical person without a stronger stable identity signal.

For the Marathon requirements as written, the implementation should enforce the limit on the server participant identity created/bound to the guest session and document that scope. A future configured verified email/phone, invitation token, school identifier, or other stable credential can provide stronger cross-session enforcement. Name matching alone should not be treated as identity proof.

### 15. Reporting should be attempt-centric and use the existing generic report engine

The report engine already supports saved reports and runtime execution/export. What is missing is a quiz-attempt definition backed by canonical attempt rows.

The minimum report should resolve references to human labels and show participant, quiz, start time, completion/submission time, score, total/percentage, pass/status, and completion reason such as normal or timeout. It should derive one row per `QuizAttempts` record and only drill into `QuizResponses` for detail/analytics.

The UI must not display raw participant/quiz UUIDs, JSON option arrays, or internal target identifiers. This is both the project Runtime UI UX Quality Gate and a practical requirement for Lyceum operators.

### 16. The current quiz authoring model still exposes a structural UX debt around `Options JSON`

`Quizzes.Questions` is a TABLE, but each question's `Options` component is currently JSON. A normal LMS author should not have to edit raw JSON to create four answers or mark the correct one.

PLAN should make question/options authoring structured. The cleanest long-term representation is a nested structured collection/table or an equivalent generic structured editor that provides option label, stable option identity, correctness, and ordering as explicit controls. The implementation must keep raw JSON hidden even if physical storage remains JSON for this slice.

This requirement follows the project-wide MUI runtime rule that normal user surfaces must not expose raw JSON or hidden technical identifiers.

### 17. The current LMS fixture contract is demo-specific and must change before the snapshot is regenerated

`lmsFixtureContract.ts` currently assumes a canonical bilingual demo and explicitly requires English/Russian parity for quiz titles/descriptions/questions/options, fixed `PassingScorePercent` and `MaxAttempts`, and current demo access links/classes/students.

The Marathon source is Russian-authoritative. Inventing English translations solely to satisfy the old fixture oracle would turn a test helper into a product-content requirement. The contract should distinguish generic multilingual demo content from the Marathon data set and validate the Marathon in Russian without requiring fabricated translations.

The new fixture gate should prove at least:

-   seven Marathon quizzes for grades 5–11;
-   30 questions per quiz;
-   four options per question;
-   exactly one correct option per question;
-   stable unique question and option identities;
-   valid class/resource/quiz/access-link associations;
-   configured time limit and guest policy;
-   generated short-link targets;
-   import → publish/materialize → anonymous guest journey → persisted attempt/responses → authenticated report journey.

The committed snapshot should continue to be regenerated through the canonical generator/export path rather than hand-edited.

### 18. The seven supplied Marathon files are structurally ready but not semantically trustworthy as canonical answer keys

The structural parser found exactly the shape the brief expects in every grade file: 30 questions, 120 options, and 30 marked answers. Across all grades that is 210 questions, 840 options, and 210 marked selections.

At least two marked answers are already clearly wrong and one is materially ambiguous:

-   Grade 9, question 3 asks the name of Khlestakov in Gogol's _The Government Inspector_ but marks **Osip**. Osip is Khlestakov's servant; Khlestakov is Ivan Aleksandrovich.
-   Grade 10, question 22 asks whether two planes can have exactly two common points and marks **Yes**. In Euclidean geometry, two distinct planes are parallel or intersect in a line; if they share two distinct points, the line through them is common, so exactly two common points is impossible.
-   Grade 7, question 29 asks “in what year were the 19 Olympic Games held?” and gives **2002**. This is only defensible if it explicitly means the XIX Olympic Winter Games; the XIX Summer Olympiad was held in 1968. The current wording is ambiguous and should be corrected, not merely re-keyed.

Several other items are sufficiently context-sensitive, historically phrased, or internally mismatched that they require source-by-source review before fixture acceptance. The dedicated answer-key review is therefore a data-quality gate, not optional polish.

That first semantic review is now complete for **210/210** marked answers. It classified **170** as acceptable for the intended school-quiz level and flagged **40** for correction, narrower wording, provenance clarification, or an explicit decision to retain an educational simplification. The 40 flagged items are not all equally severe: some have a plainly wrong marked option, while others have a defensible answer attached to a question that is too broad, outdated, historically disputed, or no longer semantically equivalent to its source wording.

The completed grade 5–6 pass checked all 60 marked answers and flagged ten items:

| Grade / Q | Current key                                                                    | Review result                                   | Required correction                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5 / 6     | `Italy` for where Saint Valentine lived                                        | Historically/geographically ambiguous           | Identify which Valentine/tradition and ask for the concrete place of life/service rather than projecting a modern state name onto the third century.      |
| 5 / 22    | All organisms are divided into four kingdoms: fungi, animals, plants, bacteria | Outdated as a universal modern scientific claim | Tie the question to a specific school classification if it is intentionally historical, or replace it with a current classification question.             |
| 6 / 1     | `Agricultural` as the stage/type of society                                    | Terminology imprecise                           | Prefer the standard school term `agrarian society` (or explicitly name the classification being used).                                                    |
| 6 / 2     | Julius Caesar for “Et tu, Brute?”                                              | Literature/history ambiguity                    | Ask which character says the line in Shakespeare's _Julius Caesar_ if the literary answer is intended; do not present it as proven historical last words. |
| 6 / 3     | Watermelon as the plant with the largest berry                                 | Scientifically unreliable as stated             | Rewrite around a precisely defined botanical category/record; giant pumpkins are also pepos and can be much larger.                                       |
| 6 / 4     | `Water lily`                                                                   | Too generic                                     | Use the giant water lily / _Victoria amazonica_ if the intended fact is a leaf supporting a child under distributed load.                                 |
| 6 / 17    | Protons and neutrons are “elementary particles” forming the nucleus            | Terminology wrong in modern physics             | Ask “which particles form the atomic nucleus?”; protons/neutrons are nucleons but are not elementary particles.                                           |
| 6 / 26    | Diaghilev's “Russian Seasons” = Russian theatre tours in 1908–1909             | Materially incomplete                           | Rewrite as the broader Diaghilev Russian arts/performance project, with the 1909 ballet season as the famous milestone rather than the whole definition.  |
| 6 / 27    | Indefinite article `a` means `one`                                             | Over-simplified grammar                         | Ask about its indefinite singular count-noun function; historical relation to `one` is not its complete present-day grammatical meaning.                  |
| 6 / 29    | Acquaintances in Britain stand exactly one metre apart                         | Unsupported fixed social rule                   | Remove or tie to a named proxemics model/range and concrete situation; there is no single objective national distance.                                    |

The grade 5–6 review used sources including Vatican material on Saint Valentine, NCBI biological taxonomy references, Folger Shakespeare Library, Royal Botanic Gardens Kew, CERN particle-physics material, V&A/Library of Congress material on Diaghilev, and British Council grammar guidance.

The completed independent grade 7–8 pass checked all 60 marked answers and classified 49 as substantively acceptable for the intended school-quiz level. It found five clear correctness problems and six additional items whose wording/scope should be corrected before canonicalization:

| Grade / Q | Current key or conversion                                                                         | Review result                                       | Required correction                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7 / 12    | `Parallel` after the prepared MC wording changed the setting from a plane to space                | Ambiguous after conversion                          | Restore “in a plane”, or allow the 3D distinction between parallel and skew lines.                                                                                               |
| 7 / 18    | Criminal responsibility starts at 14                                                              | Wrong as a general rule                             | The general threshold in Criminal Code Article 20 is 16; 14 applies to the listed offences. Rewrite the question or key accordingly.                                             |
| 7 / 20    | Southern Hemisphere shortest day = 22 June                                                        | Over-specific                                       | Ask for the June solstice or use a year-specific date; the solstice date varies by year/time zone.                                                                               |
| 7 / 21    | Relative population indicators are measured in per mille                                          | Question too broad                                  | Narrow to demographic coefficients such as birth/death rates, for which per-mille usage is appropriate.                                                                          |
| 7 / 28    | Renaissance architecture styles = Romanesque, Gothic, Renaissance                                 | Wrong taxonomy                                      | Rewrite around actual Renaissance architecture/periodization; Romanesque and Gothic are primarily medieval styles.                                                               |
| 7 / 29    | Original XIX Olympic Games = 2002; prepared MC changed the question to XXXIII Summer Games = 2024 | Source/MC semantic mismatch plus original ambiguity | Decide which question is intended. If 2002, explicitly say XIX Olympic Winter Games; if 2024, treat it as a deliberate replacement question with provenance.                     |
| 8 / 13    | Minors = ages 14–18                                                                               | Legally overgeneralized                             | Persons under 18 are minors; under-14s are also minors (minors/young children have a separate Civil Code category). Rewrite to the intended 14–18 category or change the answer. |
| 8 / 16    | “What do Chinese people call themselves?” = Han                                                   | Over-broad ethnicity wording                        | Ask for China's majority ethnic group if `Han` is the intended answer; China has multiple officially recognized ethnic groups.                                                   |
| 8 / 17    | Strategic strait for European trade = English Channel                                             | Plausible but non-unique clue                       | Narrow the geographic clue (for example Britain/continental Europe or North Sea/Atlantic) so one answer is intended.                                                             |
| 8 / 18    | Adult skeleton = “about 200”, while the prepared choices also contain “about 206”                 | Prepared MC key is needlessly imprecise             | Use the conventional 206-bone answer when that option is explicitly present, while recognizing anatomical variation.                                                             |
| 8 / 27    | Most abundant element “on Earth” = oxygen                                                         | Scope-dependent/wrong for whole-Earth composition   | Change the question to “in Earth's crust” if oxygen is intended.                                                                                                                 |

The completed grade 9–11 pass checked all 90 marked answers, classified 71 as acceptable, and flagged 19:

| Grade / Q | Current key                                                        | Review result                                        | Required correction                                                                                                                                  |
| --------- | ------------------------------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9 / 3     | `Osip` as Khlestakov's name                                        | Wrong                                                | Khlestakov is Ivan Aleksandrovich; Osip is his servant.                                                                                              |
| 9 / 6     | 3–4–5 triangle = `right-angled`                                    | MC has two true classifications                      | `Scalene` is also true; ask specifically for classification by angles if `right-angled` is intended.                                                 |
| 9 / 7     | Russo-Japanese War as the war in which _Varyag_ “died”             | Answer is defensible, wording historically imprecise | Keep the war but replace “died” with a precise description of the cruiser being scuttled after battle and later raised.                              |
| 9 / 20    | Sakhalin Oblast composition omits Tyuleny Island in MC             | Source-to-MC information loss                        | Restore the omitted island or deliberately rewrite both source and prepared form to the same accepted geographic scope.                              |
| 9 / 21    | “Does snow warm the Earth?” = `No`                                 | Ambiguous physical wording                           | Snow does not generate heat but insulates the ground and reduces cooling; ask about insulation if that is the intended concept.                      |
| 9 / 22    | Galileo as “the first natural scientist”                           | Historically ambiguous/wrong without scope           | Define the era/criterion; Aristotle is commonly treated as an early systematic natural scientist.                                                    |
| 9 / 24    | More reactions on Earth are `exothermic`                           | Scientifically ill-defined                           | Remove or define the population/context over which “more” is being measured.                                                                         |
| 10 / 3    | Stalin said “I don't trade a field marshal for a soldier”          | Attribution uncertain                                | Treat as a disputed/apocryphal quotation unless a reliable documentary source is chosen; rewrite around a verifiable event if possible.              |
| 10 / 13   | `Squid` as the animal using jet propulsion                         | MC may have more than one correct animal             | Jellyfish also use jet/reaction-like propulsion; narrow the question or remove competing correct options.                                            |
| 10 / 14   | Water does not boil in district-heating/main pipelines             | Condition-dependent                                  | Specify pressure/temperature operating conditions; the unconditional yes/no form is too broad.                                                       |
| 10 / 15   | Earthquake cause = `inertia`                                       | Wrong if asking physical cause                       | Rewrite around release of accumulated elastic stress/fault movement; inertia is not the cause of tectonic earthquakes.                               |
| 10 / 22   | Two planes can have exactly two common points = `Yes`              | Wrong                                                | Correct answer is `No`; two shared distinct points imply the whole line through them is shared.                                                      |
| 10 / 30   | Hemingway received the Nobel Prize “for _The Old Man and the Sea_” | Overstates the official award wording                | Keep the literary association but phrase the Nobel question according to the official motivation rather than as a prize for one work.                |
| 11 / 6    | Americans especially fear leap years                               | Unverified quiz folklore                             | Remove unless a reliable cultural source and precise population/context are supplied.                                                                |
| 11 / 10   | Scythian question = `after death`                                  | Question too unclear to determine objectively        | Rewrite with the concrete custom/object/process being asked about.                                                                                   |
| 11 / 16   | “Banker country” = Luxembourg                                      | Non-standard nickname                                | Replace with a measurable financial/geographic fact; both Luxembourg and Switzerland can appear under similar informal labels.                       |
| 11 / 23   | First radio telegram = `Heinrich Hertz`                            | Question/answer type mismatch and priority dispute   | If asking Popov's 1896 experiment, ask for the transmitted words/name and date explicitly; avoid an unqualified “first in the world” priority claim. |
| 11 / 25   | `Adiabatic` as a gas law explaining cooling                        | Concept category imprecise                           | Ask about adiabatic expansion/process, not a “gas law”.                                                                                              |
| 11 / 29   | Paper whiteness comes from `whitewash/white pigment`               | Too vague/technically weak                           | Ask about mineral fillers/pigments and name an intended example such as titanium dioxide or calcium carbonate.                                       |

The grade 7–8 pass used current legal/scientific/primary references including Russian Civil/Criminal Code material, IOC/Olympic records, NCBI anatomy references, Chinese census material, USGS geochemistry material, and museum/history references. The 9–11 pass combined direct source comparison with cross-domain factual checking. These content-level findings are evidence for correction, but the final revised wording and accepted key should still be approved by the Lyceum/content owner before the snapshot is treated as canonical.

An automated source-to-MC consistency pass also compared the original short-answer half of each supplied file with the marked option in its prepared four-choice half. Most non-identical strings are harmless grammatical/formatting normalization (for example `1 V ...` to `1 part ...`, initials expanded, or word order changes). Grade 7 question 29 is the material exception detected by this mechanical pass: the source answer is `2002`, while the prepared MC section marks `2024`, confirming that the conversion changed the question rather than merely expanding its options.

### 19. The proposed 45-minute limit is a product default, not an externally established standard

The brief's 2700-second value is reasonable as an initial event configuration for 30 mixed-discipline questions, but no authoritative source establishes it as the correct Lyceum duration. Keep it configurable and label it as the proposed event default until the Lyceum confirms the duration.

### 20. The implementation should split the guest controller as part of the next touch

`runtimeGuestController.ts` is already tracked in `memory-bank/tasks.md` as a large file to split when next touched. This feature would otherwise add short-link handoff, intake policy, consent/CAPTCHA, attempt lifecycle, answer persistence, timer enforcement, and reporting-related logic to the same controller.

PLAN should factor focused stores/services for public application/access resolution, guest intake/session policy, and assessment attempts/responses before or while adding the lifecycle. This is consistent with the repository's SQL-first store/service/controller boundaries and avoids creating another monolithic runtime seam.

### 21. The current anonymous quiz payload can leak answer-bearing explanation text

`buildQuizPayload(..., includeAnswers = false)` currently normalizes each full question, spreads the complete normalized question object into the anonymous DTO, and only removes `isCorrect` from each option. Because the normalized object also contains fields such as `explanation`, anonymous clients can receive answer-bearing explanation text even though option correctness is hidden.

The public quiz DTO must be built from an explicit allowlist rather than by spreading the internal question object. The anonymous shape should contain only fields needed to render and submit the question, such as stable opaque question/option identities, prompt, safe description, question type/order, and option labels. It must exclude explanation, correctness flags, expected-answer metadata, scoring internals, and any future teacher-only hints by default.

This needs a negative integration test that asserts the anonymous/public payload never contains `isCorrect`, explanation/solution text, or other answer-bearing metadata, while the server-side scoring path retains the private data it needs.

### 22. “No migration” means no historical data migration; canonical DDL is still required

The brief's clean-break statement says there is no migration for the disposable test database and no database-schema/metahub-template version increase solely for this work. Read literally, “no migration” conflicts with the repository rule that new platform-owned physical persistence must be represented through the normal DDL/platform-migration mechanism.

For this delivery, the intended invariant should be explicit: there is no compatibility migration, backfill, or preservation path for old quiz data because the test database will be recreated. New physical structures that the current product requires — for example a platform-owned global short-link registry, indexes/constraints, or other non-metahub storage — still need canonical DDL/migration definitions so a fresh database is created correctly. Entity-template changes remain expressed through the LMS template/materialization model where appropriate.

Neither of those needs a database schema-version bump or metahub-template version bump. The prohibition is on historical-data migration/version inflation, not on defining the fresh target schema.

### 23. Every touched runtime surface needs an explicit UI contract and browser acceptance

The Runtime UI UX Quality Gate applies separately to quiz authoring, guest intake, the sequential player, completion/result view, short-link management, and the authenticated results report. PLAN should give each touched screen/dialog/table/card an explicit UI contract: actor/role, fields and labels, default/focused control, visible state, hidden technical identity, validation messages, loading/error/empty states, and navigation/focus behavior.

All new user-facing strings and validation must have real EN/RU resources. Use shared MUI primitives such as the existing dialog/table patterns, render semantic long text as multiline, and never expose raw IDs, JSON, object cells, or internal target descriptors. `apps-template-mui` must remain isolated from legacy feature packages.

Browser acceptance should cover keyboard-only operation and focus after sequential advance, timer announcements that do not spam assistive technology, and no page-level horizontal overflow at representative desktop/tablet/mobile sizes (at minimum 1920×1080, 768×1024, and 390×844). These checks are required for the public player and the authenticated management/reporting surfaces, not only for the final score screen.

## Conflicts And Uncertainty

### Supplied answer keys

The prepared files are structurally consistent but the marked answers are explicitly non-authoritative. The first semantic review is complete for all 210 marked answers and flagged 40 items. Those findings must now be resolved into approved corrected wording/keys before the fixture is considered canonical; “exactly one marked option” is only a structural invariant, never evidence of factual correctness.

### `MaxAttempts` identity scope

First and last name are sufficient for the requested intake UX but are not a reliable cross-session identity credential. The platform can guarantee per-participant/session attempt limits now; stronger human-level enforcement requires a stronger configured identity signal.

### Exact global short-link target shape

The registry must remain platform-generic. This research recommends a typed adapter model whose LMS target is an application plus a specific `AccessLinks` record and optional validated workspace scope. PLAN still needs to name/version the target-kind schema and decide which non-LMS target kinds, if any, ship in the first slice. The first implementation should keep the set intentionally small rather than accepting arbitrary entity/table/URL payloads.

### Current public resolver divergence

The strict published application resolver and the existing LMS guest resolver currently have different readiness responsibilities. `/l/` can be made safe by calling the strict resolver first, but PLAN should decide whether to refactor existing guest routes onto the same strict core in this delivery to eliminate drift completely.

### Attempt entity fields

The existing `QuizAttempts` shape is directionally correct but `SubmittedAt` being required conflicts with persisting `Started` attempts. Exact field names for deadline, completion reason, total, consent/accommodation references, and status should be resolved in PLAN together with report needs and posting-module behavior.

### Marathon content freshness

Some questions ask time-sensitive legal, geographic, cultural, or historical facts using historical wording. “Correct for the original school event” and “correct as of 2026” may differ. The fixture should use corrected, unambiguous content agreed for the new event rather than silently preserve an obsolete key.

## Project Implications

### Applications/platform routing

-   Add a deployment-wide typed short-link registry and `/l/:slug` resolver in the Applications/platform domain.
-   Reuse application-alias normalization/lifecycle/concurrency patterns where applicable.
-   Define an extensible adapter contract for eligible application sections/resources instead of baking LMS-specific payload into the platform registry.
-   Resolve the target application through the strict public readiness path before dispatching an internal target adapter.
-   Keep management authorization separate from anonymous resolution and normalize unavailable responses to avoid unnecessary target-existence leakage.
-   Represent any new platform-owned registry/index/constraint through the canonical DDL/platform-migration path for fresh databases, without historical-data backfill and without a schema-version bump.

Likely affected areas include `@universo-react/types` shared contracts, applications-backend migrations/stores/services/routes, applications frontend management UI, and core/frontend route entry.

### LMS template/domain

-   Refine `QuizAttempts` for persisted active attempts and server deadline/completion state.
-   Add explicit `QuizResponses.AttemptId` REF to `QuizAttempts` and enforce one logical response per `(AttemptId, QuestionId)` within workspace scope.
-   Add configurable time-limit and guest-access/intake policy in typed LMS entities.
-   Preserve LMS `AccessLinks` as policy/target records integrated with global `/l/` routing.
-   Add an attempt-centric quiz-results report definition.
-   Keep QR generation out of scope for this delivery.

### LMS public runtime backend

-   Replace one-shot guest quiz submission with start/resume, answer-save, and idempotent finalize/timeout operations.
-   Enforce `MaxAttempts` on new attempt creation.
-   Persist answers before sequential navigation.
-   Validate deadline server-side on every assessment mutation and lazily finalize expired `Started` attempts on resume/read/report/finalize so expired attempts cannot remain permanently active.
-   Extract/reuse one shared legal policy/version source for mandatory Terms/Privacy; reuse shared CAPTCHA validation separately as an optional access-policy capability.
-   Validate intake/consent/CAPTCHA before the guest-session transaction, then atomically consume `AccessLinks.MaxUses` together with participant/session creation and legal-acceptance audit persistence.
-   Replace public question spreading with an explicit anonymous DTO allowlist that excludes explanations, correctness flags, solutions/hints, and scoring internals.
-   Preserve current guest-session secret hashing/binding/expiry.
-   Split the large guest controller into focused services/stores rather than expanding the current monolith.

### MUI runtime/UI

-   Build one public sequential quiz player with final-only correctness feedback, progress, accessible timer, reload/resume behavior, and the same completion surface for normal/timeout completion.
-   Add configurable guest intake with separate first/last name for Marathon plus mandatory Terms/Privacy checkboxes and optional CAPTCHA.
-   Add normal short-link create/copy/manage UI from eligible application targets.
-   Add an authenticated quiz-results table/report with resolved labels and no raw IDs/JSON.
-   Provide structured question/answer authoring; hide physical IDs and raw option JSON.
-   Define an explicit UI contract for quiz authoring, guest intake, player, completion, short-link management, and report surfaces, including fields/default focus, hidden IDs, validation/loading/error/empty states, and navigation behavior.
-   Provide real EN/RU resources, reuse shared MUI dialogs/table patterns, preserve `apps-template-mui` package isolation, and render semantic long text as multiline.
-   Prove keyboard/focus behavior and no page-level horizontal overflow at 1920×1080, 768×1024, and 390×844.

### Fixture and tests

-   Update `lmsFixtureContract.ts` before regenerating `metahubs-lms-app-snapshot.json`.
-   Treat Russian Marathon content as authoritative rather than inventing English parity.
-   Resolve the 40 flagged answer/question defects and obtain content-owner approval before canonical snapshot generation.
-   Prove 7 × 30 × 4 structure, stable identities, associations, and link targets.
-   Add browser/integration evidence for normal completion, timeout, reload/resume, duplicate finalize, read/report-triggered lazy timeout finalization, post-deadline writes, `MaxAttempts`, consent, optional CAPTCHA, expired/released/exhausted access policy, target tampering, persisted attempts/responses, and authenticated report visibility.
-   Add transaction rollback proof showing that a failed participant/session/legal-audit creation does not permanently consume `AccessLinks.MaxUses`.
-   Add a negative anonymous-payload assertion proving that public quiz responses contain no explanation/solution/correctness metadata.

## Recommended Decision

Proceed to PLAN with a clean entity-based assessment lifecycle and a platform/LMS two-layer link architecture:

1. **Platform routing layer:** `/l/<slug>` owns only globally unique short-name resolution to a typed internal application target. It uses alias-style normalization/reservation/release invariants and the strict published-application readiness resolver. No arbitrary redirect URL is stored.
2. **Target-adapter layer:** keep the registry generic enough for eligible sections/resources inside any published application. Ship only explicitly supported typed adapters; the LMS adapter resolves to a concrete `AccessLinks` record and no arbitrary-record/URL bypass is accepted.
3. **LMS access layer:** `AccessLinks` remains authoritative for activation, expiry, use quota, class/content/quiz eligibility, configured guest intake, optional CAPTCHA, and quiz accommodations. The two site-wide Terms/Privacy acceptances are platform-owned mandatory requirements rather than an LMS toggle.
4. **Assessment layer:** `QuizAttempts` becomes the canonical aggregate with stable server `AttemptId`. `QuizResponses` explicitly references that attempt and is unique by attempt/question. Creating a new attempt atomically enforces `MaxAttempts` and establishes a server deadline. Resume reuses the active attempt; expired active attempts are idempotently materialized as timed-out results whenever lifecycle reads/writes/reports observe them.
5. **Participant/compliance layer:** extend modern guest participant/session data with configurable typed intake; extract one shared Terms/Privacy version source and reuse shared CAPTCHA. Validate intake/legal/CAPTCHA first, then atomically consume `AccessLinks.MaxUses`, create the guest participant/session, and persist legal acceptance facts in one transaction.
6. **Public DTO/security layer:** construct anonymous quiz payloads from an explicit allowlist so explanation, correctness, solution/hint, and scoring metadata never cross the public boundary.
7. **UI layer:** converge on a single sequential MUI quiz experience with final-only scoring, accessible timer/focus/progress, structured authoring, short-link management, and an attempt-centric report. Give each touched screen/dialog/table/card an explicit EN/RU UI contract and browser acceptance at representative desktop/tablet/mobile sizes.
8. **Persistence/versioning layer:** perform no historical-data migration/backfill for the disposable database, but define every required new physical platform structure through normal canonical DDL/migration definitions. Do not bump database schema or metahub-template versions solely for this work.
9. **Fixture/data layer:** update the LMS fixture contract first, convert the completed 210/210 semantic review into approved corrections for the 40 flagged items, then regenerate the canonical snapshot through supported export/generator flows. Do not copy legacy UPDL/AR.js persistence and do not add QR generation or the historical AI quiz builder in this slice.

The architecture has no blocker for PLAN. Canonical fixture acceptance remains blocked on resolving and approving the 40 flagged content items, not on an unchecked remainder: all 210 marked answers received a first semantic review.

## Open Questions Before PLAN

None block PLAN. The plan should explicitly resolve these bounded implementation decisions:

1. The exact first-version target-kind schema for the global short-link registry. Recommended minimum: a typed application target-adapter envelope with an LMS `AccessLinks` adapter plus only the smallest additional section/entity-resource adapters needed for the generic sitewide contract, optional validated workspace scope, and no generic arbitrary-record routing.
2. Whether existing `/public/a/:applicationId/...` LMS guest endpoints are migrated onto the same strict published-application readiness core in this delivery or only `/l/` uses that core initially. Convergence is preferred to prevent policy drift.
3. The exact `QuizAttempts` field/state model and posting-module trigger after making in-progress attempts first-class.
4. Whether the seven Marathon quizzes replace the current three demo quizzes in the canonical fixture or coexist in a clearly separated demo + event data set. The event acceptance path should not depend on seeded played attempts.
5. The Lyceum's final confirmed event duration. Until confirmed, keep 45 minutes as a configurable proposed default.
6. The final approved correction set for the 40 flagged questions. Structural validation and the first semantic review are complete; final wording/key approval remains the fixture-acceptance gate.

## Sources

-   https://github.com/remix-run/react-router/blob/main/docs/start/data/routing.md
-   https://github.com/remix-run/react-router/blob/main/docs/start/framework/routing.md
-   https://reactrouter.com/start/framework/routing
-   https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
-   https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html
-   https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html
-   https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
-   https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html
-   https://www.w3.org/WAI/WCAG22/Understanding/timeouts.html
-   https://www.postgresql.org/docs/current/indexes-partial.html
-   https://www.postgresql.org/docs/current/sql-set-transaction.html
-   https://www.consultant.ru/document/cons_doc_LAW_10699/fd969cc22a68d513db2c83a94d6ad355a95dbec7/
-   https://www.consultant.ru/document/cons_doc_LAW_5142/7b6abd47219e2aa6081ac21b41e9e83d80fb45df/
-   https://www.consultant.ru/document/cons_doc_LAW_5142/cc856395792cdd3ebdb55d49f5f2f9b8d6cabced/
-   https://newsroom.olympics.com/record/1271
-   https://www.ncbi.nlm.nih.gov/books/NBK441968/
-   https://www.stats.gov.cn/english/PressRelease/202105/t20210510_1817187.html
-   https://pubs.usgs.gov/pp/0440d/report.pdf
-   https://www.kew.org/plants/watermelon
-   https://www.kew.org/plants/squash
-   https://www.kew.org/plants/giant-waterlily
-   https://home.cern/science/physics/subatomic-particles/
-   https://www.vam.ac.uk/articles/diaghilev-and-the-ballets-russes
-   https://www.loc.gov/exhibits/ballets-russes/exhibition-items.html
-   https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/indefinite-article
-   https://www.folger.edu/explore/shakespeares-works/julius-caesar/read/3/1/
