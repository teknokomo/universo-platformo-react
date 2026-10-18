# LMS Quiz Blocks And “Sixth Muse” — Implementation Plan

-   **Date:** 2026-10-17
-   **Mode:** PLAN
-   **Status:** QA-refined; ready for implementation after the content gate
-   **Research:** [lms-quiz-blocks-sixth-muse-research-2026-10-17.md](../research/lms-quiz-blocks-sixth-muse-research-2026-10-17.md)
-   **Brief:** Original product brief (workspace-only source; not included in this repository)
-   **Specification:** QA-refined specification (workspace-only source; not included in this repository)

## Overview

Extend the existing metadata-driven LMS assessment path with optional ordered quiz blocks, an explicit block-introduction phase, server-authoritative timer pause/resume on block introductions, and optional block-relative display numbering. Add the Russian “Sixth Muse” quiz as a separately validated fixture dataset and regenerate the canonical LMS application snapshot so that the existing seven grade quizzes and the new quiz are present together.

Keep one generic assessment runtime and one QuizAttempt aggregate. A block introduction is presentation/sequencing state and is never a scored pseudo-question. Do not add an LMS-specific parallel player, compatibility layer, schema/template version bump, or hand-edit the generated snapshot.

## Evidence And Constraints

-   Quizzes currently contains one Questions TABLE and has no block model.
-   QuizAttempts already persists question snapshot, digest, deadline, scoring policy, result state, and access-link/class snapshots.
-   The current guest DTO returns only the next unanswered question. The frontend currently treats “no current question while in progress” as completion, so block introductions require an explicit phase discriminator.
-   Server deadline is authoritative; the browser countdown is presentation only.
-   guestAssessmentAttemptStore.ts already uses parameterized/schema-qualified SQL and fail-closed RETURNING checks.
-   @universo-react/apps-template-mui already uses TanStack Query; @universo-react/utils already exposes browser-safe UUID v7 generation.
-   The repository already has the authoring surfaces to extend: `TabularPartEditor` / `RuntimeInlineTabularEditor` in `apps-template-mui` for published applications and `InlineTableEditor` in `metahubs-frontend` for metahub records. Neither currently resolves sibling-TABLE choices or exposes first-class row reordering.
-   Reuse the existing MUI `Select`, row action menus, TABLE editors, and atomic tabular batch API. Do not create a separate quiz-block dialog or a drag-and-drop subsystem for this MVP.
-   `apps-template-mui` already generates UUID v7 values for a special stable TABLE field. Generalize that existing row-initialization mechanism through metadata for `BlockKey` instead of adding another ID generator.
-   Dependency versions remain centralized in pnpm-workspace.yaml.
-   OntoIndex is indexed at the current HEAD. Its backend call graph is degraded for two oversized files, so source and tests remain the authority where the graph under-reports impact.
-   Agents must not run pnpm dev. Browser verification uses the existing E2E harness and minimal local Supabase.

Primary references:

-   WCAG 2.2 SC 2.2.1 Timing Adjustable: https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable
-   Playwright Clock: https://playwright.dev/docs/clock
-   TanStack Query mutation scopes: https://tanstack.com/query/latest/docs/framework/react/guides/mutations
-   QTI assessment/section/item terminology: https://www.1edtech.org/standards/qti/index

QTI is terminology/architecture background only; QTI import/export is outside this MVP.

## Architecture Decisions

### 1. Quiz metadata

Add optional block metadata directly to Quizzes and keep questions in the existing Questions TABLE.

Recommended fields:

-   Quizzes.Blocks — optional TABLE:
    -   BlockKey — required hidden STRING containing a semantic UUID v7; generated once by the existing TABLE-row initialization path generalized through metadata; never shown as a raw value.
    -   Title — required localized STRING.
    -   Introduction — optional localized multiline STRING.
    -   SortOrder — managed and hidden.
-   Quizzes.PauseTimerOnBlockIntro — BOOLEAN, default false.
-   Quizzes.BlockRelativeNumbering — BOOLEAN, default false.
-   Quizzes.Questions.BlockKey — nullable STRING semantic reference rendered through metadata as a visible block-title selector. Do not misuse platform REF semantics for a sibling TABLE row.

Use one global Questions.SortOrder. Do not introduce a second QuestionOrderInBlock source of truth.

Structural invariants:

1. Blocks empty => flat quiz and every question BlockKey is empty.
2. Blocks non-empty => every question belongs to exactly one existing block.
3. BlockKey values are unique UUID v7.
4. Questions for each block form one contiguous range in global question order.
5. Every attempt-ready block contains at least one question. Authoring may have transient local draft states, but invalid/empty blocked quizzes cannot be saved as a valid assessment or started publicly.
6. Reordering blocks reorders their question groups and normalizes global SortOrder.
7. Moving a question to a new block places it at the end of the target block and normalizes order.
8. Creating the first block in a populated flat quiz is an explicit conversion action: the UI explains that existing questions will be assigned to that first block and performs the transformation atomically after confirmation.
9. Removing the final remaining block is an explicit conversion back to flat mode: the UI explains that memberships will be cleared and performs that transformation atomically after confirmation; deleting one of several non-empty blocks is blocked until its questions are moved.

### 2. Attempt snapshot and persisted sequencing

Keep QuestionsSnapshot as the scoring snapshot and add nullable blockKey to each snapshotted question. Add a separate immutable FlowSnapshot for presentation/sequencing data.

New hidden/server-managed QuizAttempts fields:

-   FlowSnapshot JSON: ordered block snapshots, pause policy, numbering policy, and immutable learner-facing completion text. Completion text is intentionally snapshotted so source edits cannot change the learner-facing completion state of an already-started attempt.
-   Phase STRING: block_intro | question while Status=Started.
-   PhaseRevision NUMBER: monotonic generation for Continue idempotency.
-   TimerState STRING: untimed | running | paused.
-   FrozenRemainingMs NUMBER: exact positive integer milliseconds while a Started attempt is paused; null otherwise.

DeadlineAt remains the authoritative running deadline:

| TimerState | DeadlineAt | FrozenRemainingMs                                   |
| ---------- | ---------- | --------------------------------------------------- |
| untimed    | null       | null                                                |
| running    | required   | null                                                |
| paused     | null       | required and strictly positive while Status=Started |

Never infer paused from a null deadline. CurrentQuestionIndex and the current block are derived from persisted responses plus QuestionsSnapshot / FlowSnapshot; do not persist another question or block cursor.

Before entering `paused`, reconcile the running deadline first. If `DeadlineAt <= now`, finalize the attempt as timed out at that exact deadline instead of persisting a zero-budget paused state. This keeps `SubmittedAt` precise without adding another historical-deadline field solely for an impossible steady state.

FlowSnapshot may contain an internal contractVersion: 1 for Zod parsing. This is not a metahub template/schema version bump.

### 3. Shared public DTO

Place reusable public attempt phase/timer schemas in @universo-react/types. Keep UI-only view state inside apps-template-mui.

Illustrative phase contract:

```ts
const publicAttemptPhaseSchema = z.discriminatedUnion('kind', [
    z.object({
        kind: z.literal('block_intro'),
        revision: z.number().int().nonnegative(),
        block: z.object({
            ordinal: z.number().int().positive(),
            total: z.number().int().positive(),
            title: z.string(),
            introduction: z.string().nullable()
        })
    }),
    z.object({
        kind: z.literal('question'),
        revision: z.number().int().nonnegative(),
        displayNumber: z.string().min(1)
    })
])
```

Illustrative timer contract:

```ts
const publicAttemptTimerSchema = z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('untimed') }),
    z.object({
        mode: z.literal('running'),
        deadlineAt: z.string().datetime(),
        serverNow: z.string().datetime()
    }),
    z.object({
        mode: z.literal('paused'),
        remainingMs: z.number().int().nonnegative(),
        serverNow: z.string().datetime()
    })
])
```

The public attempt may expose the revision, block ordinal/title/introduction, global progress, one current question, and display numbering. It must not expose BlockKey, TABLE row UUIDs, future questions, correctness/explanations, SQL identifiers, or writable internal timer state.

### 4. State machine

```text
flat quiz:
START -> question -> question -> ... -> finalize

blocked quiz:
START -> block_intro(1) -> question... -> block_intro(2) -> question...
      -> block_intro(N) -> question... -> finalize
```

When PauseTimerOnBlockIntro=false, a timed blocked attempt creates its normal deadline at START and time continues through introductions.

When PauseTimerOnBlockIntro=true, a timed blocked attempt starts paused with the full millisecond budget. Continue resumes that budget exactly once. Saving the final answer in a non-final block atomically enters the next block intro and freezes the remaining budget. Reload preserves the same frozen value.

### 5. Continue API and idempotency

Add:

```text
POST /public/a/:applicationId/runtime/attempts/:attemptId/continue
```

Body includes the existing guest/session claims plus `phaseRevision`. Parse it with a strict Zod request schema before reading attempt state; validate `attemptId` as UUID v7 and `phaseRevision` as a non-negative safe integer.

Transaction semantics:

1. stay inside the existing public-runtime request transaction; do not create an independently committing nested Continue transaction;
2. preserve the established lock ordering: application/runtime context -> workspace/current AccessLink lock -> transactional guest-session revalidation -> attempt advisory lock -> attempt row `FOR UPDATE`;
3. preserve existing-started-attempt AccessLink semantics: natural `expiresAt` or exhausted start quota does not consume another use or invalidate an already-started attempt, while hard link/session revocation and existing publication/withdrawal rules continue to apply;
4. parse the combined persisted snapshot/phase/revision/timer state fail-closed;
5. if stored revision equals expected revision and phase is block_intro, perform exactly one transition;
6. if stored revision is greater than expected, treat it as an idempotent replay and return current state without advancing or adding time;
7. if expected revision is ahead of stored state, fail closed;
8. accepted transition increments PhaseRevision; if a paused attempt has zero remaining budget, finalize it as timed out instead of briefly resuming it;
9. build the public projection from the locked state; the HTTP response is released only after the outer transaction commits successfully.

This makes a delayed block-1 Continue harmless when the attempt is already at block 2.

Illustrative service shape:

```ts
// `tx` is the request's existing transaction after application/workspace/link/session checks.
await acquireAttemptLock(tx, attemptId)
const attempt = await findGuestAssessmentAttempt(tx, table, attemptId, studentId, true)
if (!attempt) throw new NotFoundError()

const state = parseAttemptRuntimeState(attempt)
if (expectedRevision < state.phaseRevision) return projectAttempt(state)
if (expectedRevision !== state.phaseRevision || state.phase !== 'block_intro') {
    throw new AttemptTransitionConflictError()
}

const next = resumeBlockIntroOrTimeout(state, now)
await updateGuestAssessmentAttempt(tx, table, attemptId, studentId, toColumns(next), actorId)
return projectAttempt(next)
```

### 6. Answer rules

-   Require Started + Phase=question.
-   Require the submitted question to be the current unanswered snapshotted question.
-   Reject answers during block_intro.
-   Persist the response before progression.
-   If the next question is in the same block, remain in question phase.
-   If the saved answer ends a non-final block, atomically enter the next block_intro, increment PhaseRevision, and freeze time when configured.
-   If it is the final question, preserve the existing deterministic finalize/result path.

The response insert and next-intro transition must be one transaction.

### 7. Canonical timing module

Create a small backend timing helper used by start/resume, GET, answer, Continue, finalize, timeout reconciliation, revocation, and authenticated report reconciliation.

```ts
type AssessmentClock = { state: 'untimed' } | { state: 'running'; deadlineMs: number } | { state: 'paused'; remainingMs: number }

export function freezeClock(clock: AssessmentClock, nowMs: number): AssessmentClock {
    if (clock.state !== 'running') return clock
    return { state: 'paused', remainingMs: Math.max(0, clock.deadlineMs - nowMs) }
}

export function resumeClock(clock: AssessmentClock, nowMs: number): AssessmentClock {
    if (clock.state !== 'paused') return clock
    return { state: 'running', deadlineMs: nowMs + clock.remainingMs }
}
```

Use integer millisecond precision internally. UI rounds for display. Completion timestamps are explicit: `timed_out` uses the authoritative effective expiry instant (the running deadline after all pause/resume adjustments), `submitted` uses the actual submission time, and `revoked` uses the revocation time. Reconciliation `now` only decides whether expiry has happened; it must not replace the timeout timestamp.

### 8. TanStack Query

Do not optimistically advance phase. Continue/answer/finalize should share an attempt-scoped TanStack mutation scope so client mutations are serialized, while the server remains authoritative.

```ts
const attemptMutationScope = { id: 'guest-quiz-attempt:' + attemptId }

useMutation({
    mutationFn: continueAttempt,
    scope: attemptMutationScope,
    onSuccess: (authoritativeAttempt) => setQuizAttempt(authoritativeAttempt)
})
```

Pending controls prevent repeated activation; backend locking/revision checks remain the real safety boundary.

### 9. Accessibility timing scope

PauseTimerOnBlockIntro decides whether instructional boundary screens consume assessment time. It does not by itself satisfy WCAG 2.2 SC 2.2.1.

For this MVP:

-   preserve untimed quiz configuration through TimeLimitSeconds=0/null;
-   document that conformance of timed assessments is deployment/configuration dependent;
-   do not claim timing compliance from intro pause alone;
-   keep participant-specific extra-time/accommodation as a separate feature if a deployment requires it without an applicable timing exception.

## Affected Areas

### Metahub template

-   packages/universo-react-metahubs-backend/src/domains/templates/data/lms.seed-entities.assessment.ts
-   LMS template seed/manifest validators and tests
-   lmsQuizAuthoringDashboardSeed/templateManifestValidator tests

### Shared packages

-   packages/universo-react-types — public assessment DTO/schema and shared metadata types where appropriate
-   packages/universo-react-utils — only reusable pure block/order helpers; reuse existing UUID v7 utilities

Keep Node-only secure option shuffling in the backend.

### Applications backend

-   assessmentAttemptLifecycle.ts
-   new focused timing/flow helper modules
-   guestAssessmentAttemptLifecycleService.ts
-   guestAssessmentRuntimeTables.ts
-   publicGuestRuntimeConfig.ts
-   guestAssessmentAttemptStore.ts
-   assessmentAttemptSupport.ts
-   assessmentAttemptStartHandler.ts
-   assessmentAttemptGetHandler.ts
-   assessmentAttemptAnswerHandler.ts
-   assessmentAttemptFinalizeHandler.ts
-   new assessmentAttemptContinueHandler.ts
-   assessmentAttemptHandlers.ts
-   public route registration/tests
-   authenticated report reconciliation/projection where it handles expiry or nullable class data

### Published app runtime

-   packages/universo-react-apps-template-mui/src/standalone/guestRuntimeTypes.ts or shared imports
-   guestRuntimeUtils.ts
-   useGuestQuizAttempt.ts
-   GuestQuizPanel.tsx
-   focused block-intro/question components if needed for maintainability
-   real EN/RU apps/quiz locale resources

### Generic MUI authoring

-   `apps-template-mui`: extend the existing `FormDialog`, `TabularPartEditor`, `RuntimeInlineTabularEditor`, `buildTabularColumns`, and tabular batch API path rather than adding a block-specific authoring dialog.
-   `metahubs-frontend`: extend the existing record `InlineTableEditor` with the same metadata semantics so metahub and published-application authoring do not diverge.
-   `@universo-react/types` / `@universo-react/utils`: share only the small metadata contract and pure row-initialization/order helpers that both authoring surfaces genuinely need.
-   Resolve sibling-TABLE semantic choices into the existing MUI Select/editor path; use the existing row action menu for Move Up / Move Down. Pointer drag-and-drop is outside this MVP.
-   For transformations that touch both `Blocks` and `Questions`, reuse the existing parent-form/deferred TABLE state and commit both sibling TABLE values through the normal parent record Save. Do not add a separate LMS endpoint or a new cross-TABLE batch API for this MVP. Keep `batchUpdateTabularRows()` for atomic multi-row updates inside one already-persisted TABLE where it is actually needed.
-   Reuse existing StandardDialog/form/table/card primitives; do not migrate or rewrite the current editors merely for this feature.

Cross-product strings belong in @universo-react/i18n only when actually shared. Published-app feature strings remain in the isolated apps-template locale bundle.

### Fixture/E2E

-   new tools/fixtures/sixth-muse/source.json (or equivalent canonical source directory)
-   new lmsSixthMuseFixtureContract.ts
-   lmsFixtureContract.ts and lmsFixtureContract.test.ts
-   checkLmsFixtureContract.ts
-   metahubs-lms-app-export.spec.ts
-   tools/fixtures/metahubs-lms-app-snapshot.json regenerated only via generator
-   existing LMS guest/runtime/report E2E helpers/specs

### Documentation

-   relevant package README.md / README-RU.md files
-   docs/en|ru/lms/guest-access.md
-   docs/en|ru/guides/quiz-application-tutorial.md
-   learner/report pages if behavior changes there
-   docs/en|ru/SUMMARY.md only if a new page is added
-   docs-lms-user-guide-screenshots.spec.ts and checked screenshot assets

## Runtime UI Contract

### Guest intake

-   Existing short-link flow stays intact.
-   Seeded Sixth Muse AccessLink requires first and last name, CAPTCHA disabled, and the existing mandatory Terms / Privacy acceptance.
-   Successful intake returns the first authoritative attempt phase.

### Block introduction

-   Show localized block title and optional multiline introduction.
-   Show “Block X of Y”.
-   Keep global progress such as “Answered 10 of 30”; intro is not a question.
-   Keep timed countdown visible.
-   Running policy visibly counts down.
-   Paused policy shows frozen time plus localized paused explanation.
-   Timer keeps role=timer and aria-live=off; pause/resume state is announced once through a status region.
-   Continue is a normal keyboard-operable MUI button.
-   Focus enters the block heading.
-   Failed Continue keeps contextual focus and gives a localized retry.
-   Pending Continue disables duplicate activation.

### Question

-   Successful Continue focuses the first question heading.
-   Exactly one current question is visible.
-   Existing confirm-before-next option remains supported; Sixth Muse uses immediate save/advance.
-   Global mode displays 11, 12...; block-relative mode displays 2.1, 2.2...
-   Progress remains answered/total globally in both modes.
-   Server response decides the next visible phase.

### Result/report

-   Blocks never affect score denominator.
-   Result heading receives focus.
-   Sixth Muse appears in the existing authenticated attempt report.
-   Missing class association is rendered as a localized empty value, never raw null/ID/object.

### Authoring

-   Blocks are edited by visible title/introduction.
-   Introduction is multiline.
-   BlockKey, physical UUIDs, JSON, and numeric sort fields are hidden.
-   Reorder uses explicit Move Up/Move Down actions in the existing row action menu. This is keyboard-operable by construction and avoids a new drag-and-drop subsystem.
-   Question Block selector reads sibling Blocks rows and displays localized titles.
-   First-block and last-block conversions are explicit, confirmed transformations; block reorder, question move, and deletion guards preserve a valid parent quiz.
-   Validation is localized and actionable.
-   No page-level horizontal overflow on desktop/tablet/mobile.

## PLAN UX Reviewer Checklist

-   [ ] A normal learner can complete intake -> intro -> questions -> next intro -> result without knowing internal IDs or data model details.
-   [ ] A normal author can create/reorder blocks and assign/move questions using visible titles only.
-   [ ] No BlockKey, UUID, JSON blob, object cell, technical SortOrder, database name, or protocol value is visible on normal surfaces.
-   [ ] Introduction and other semantic long text fields use multiline controls.
-   [ ] All validation/error/pause/retry/numbering text is localized in real EN/RU resources.
-   [ ] Continue, row-menu reorder, question selection, and retry work by keyboard and retain meaningful focus.
-   [ ] Focus changes are keyed to the actual presentation phase/revision so intro -> question -> intro -> result transitions are deterministic.
-   [ ] Timer has distinct running/paused/untimed presentation and does not announce every second.
-   [ ] Global progress semantics remain answered/total even when question labels use block-relative numbering.
-   [ ] Existing MUI/StandardDialog/table/form primitives are reused before introducing new primitives.
-   [ ] Any new nested TABLE primitive is metadata-driven and reusable rather than branching on LMS codenames.
-   [ ] Desktop/tablet/mobile browser evidence proves no page-level horizontal overflow.
-   [ ] Screenshots are opened and visually inspected; passing locators/assertions alone do not satisfy UI QA.

## Step-by-Step Plan

### Phase 0 — Baseline and content gate

-   [ ] Record the existing dirty worktree and leave unrelated changes untouched.
-   [ ] Reconfirm OntoIndex HEAD/index equality before edits; run impact for every edited symbol.
-   [ ] Turn the research corrections into a 30-question source review register.
-   [ ] Resolve all remaining evidence gates, especially Q4/Q7/Q17/Q20 noted in research.
-   [ ] Apply confirmed wording/fact corrections, including pair-answer Q19/Q23/Q24.
-   [ ] Create three plausible, unique, fact-checked distractors per question.
-   [ ] Assign stable source identities; persisted authored identities use UUID v7.
-   [ ] Reject source data with unresolved provenance, duplicate options, !=4 choices, or !=1 correct choice.

Exit: deterministic reviewed 30-question source independent of generated snapshot.

### Phase 1 — Shared contracts

-   [ ] Add strict Zod schemas/types for public attempt phase/timer in @universo-react/types.
-   [ ] Define normalized block/policy snapshot types.
-   [ ] Add reusable pure block structure/order helpers only where genuinely shared.
-   [ ] Reuse generateUuidV7/isUuidV7.
-   [ ] Add Vitest for discriminators, UUID v7, orphan/duplicate/interleaved membership, and numbering derivation.

### Phase 2 — Template metadata

-   [ ] Add Quizzes.Blocks, PauseTimerOnBlockIntro, BlockRelativeNumbering, Questions.BlockKey.
-   [ ] Add FlowSnapshot, Phase, PhaseRevision, TimerState, FrozenRemainingMs to QuizAttempts; derive the current block from snapshots + responses.
-   [ ] Mark all new QuizAttempts runtime-state fields hidden/server-owned (and reset-on-copy where the current attempt metadata convention requires it) so ordinary authoring cannot mutate phase/timer/snapshot state.
-   [ ] Extend QuestionsSnapshot question contract with nullable blockKey.
-   [ ] Mark introductions multiline; hide keys/sort fields; model BlockKey / Questions.BlockKey as semantic STRING values, not physical REF targets.
-   [ ] Generalize the existing stable TABLE-cell UUID v7 initialization from the hard-coded stable-cell case to a small metadata flag reusable by both authoring surfaces.
-   [ ] Add metadata for sibling-TABLE value/label resolution and order semantics; render it through existing Select and row-action primitives.
-   [ ] Make assessment config mapping fail closed when required fields are incomplete.
-   [ ] Keep template/schema versions unchanged.

### Phase 3 — Extend existing TABLE authoring UX

-   [ ] Resolve metadata-driven sibling-table source/value/display fields into the existing Select cell/editor; no new selector component unless the existing Select path proves technically insufficient.
-   [ ] Resolve options from the current parent form state, including unsaved blocks, in both published-app and metahub record editors.
-   [ ] Generate BlockKey once with UUID v7 through the generalized existing TABLE-row initializer and preserve it through edits/copy rules.
-   [ ] Add Move Up / Move Down to the existing TABLE row action menus and normalize hidden SortOrder; use the existing atomic tabular batch endpoint when persisted rows need multiple order updates.
-   [ ] Describe block-group coupling through metadata/pure helpers so shared widgets do not branch on `Quizzes` / `Blocks` codenames.
-   [ ] Make flat -> blocked and blocked -> flat conversions explicit confirmed actions. Apply both sibling TABLE changes in the existing deferred parent-form state and persist them through one normal parent record Save; do not invent a cross-TABLE LMS mutation endpoint.
-   [ ] Keep both authoring implementations behaviorally equivalent; do not create a third authoring surface.

Vitest: row-menu keyboard reorder, focus restoration, semantic labels, hidden technical values, confirmed flat/block conversion, group reorder, question move, deletion guards, and identical metadata behavior across the two authoring surfaces where applicable.

### Phase 4 — Backend snapshot/timing primitives

-   [ ] Extend assessmentAttemptLifecycle snapshot parsing/building with block membership without changing scoring.
-   [ ] Add strict FlowSnapshot parsing.
-   [ ] Add one strict combined `parseAttemptRuntimeState()` validation step (for example Zod `superRefine`) over QuestionsSnapshot + FlowSnapshot + status/phase/revision/timer fields; reject impossible cross-field combinations before state transitions.
-   [ ] Add one backend untimed/running/paused timing module.
-   [ ] Use integer millisecond arithmetic.
-   [ ] Fail closed on impossible persisted timer/phase combinations.
-   [ ] Reconcile expiry before every running -> paused transition; if the deadline has already been reached, finalize at the authoritative deadline and never persist `TimerState=paused` with `FrozenRemainingMs=0`.
-   [ ] Derive current block/ordinal from the first unanswered snapshotted question; do not add a persisted block cursor.
-   [ ] Define finish timestamps centrally: timeout = effective expiry, submitted = actual submit, revoked = revocation instant.
-   [ ] Centralize display-number derivation.

Jest: flat/blocked snapshots, numbering, repeated freeze/resume precision, zero time, invalid combinations, blocks excluded from scoring.

### Phase 5 — Start/resume

-   [ ] Refactor resume so an existing Started attempt reconstructs from persisted snapshots after session/access authorization, without mutable live quiz/block data.
-   [ ] Flat quiz starts in question.
-   [ ] Blocked quiz starts in block_intro at block 0.
-   [ ] Running-intro timed quiz gets deadline immediately.
-   [ ] Paused-intro timed quiz starts paused with full FrozenRemainingMs and no active deadline.
-   [ ] Untimed quiz gets explicit TimerState=untimed.
-   [ ] Snapshot completion/presentation policy required for stable resume.
-   [ ] Preserve attempt limits and access-link/class snapshots.

### Phase 6 — Continue + answer transition

-   [ ] Add public Continue route/handler.
-   [ ] Add a strict Continue request schema (`guestAttemptSessionSchema` + bounded non-negative `phaseRevision`) and UUID v7 route-param validation.
-   [ ] Reuse existing CSRF, Origin/CORS, session, access-link, workspace, publication and write-limiter composition; do not add duplicate security middleware in the handler.
-   [ ] Preserve existing started-attempt access semantics: natural link expiry or exhausted start quota does not consume quota again or invalidate the active attempt; hard link/session revocation follows the existing revoke path.
-   [ ] Lock attempt before compare-and-transition.
-   [ ] Implement duplicate/stale PhaseRevision semantics.
-   [ ] Resume paused time only for accepted transition.
-   [ ] Treat `paused + FrozenRemainingMs <= 0` as invalid persisted state in the combined runtime-state parser; normal transitions must have already finalized at the prior running deadline.
-   [ ] Make answer submission phase-aware.
-   [ ] Atomically enter/freeze next intro after a block's final saved answer.
-   [ ] Preserve deterministic/retryable final-question behavior.
-   [ ] Ensure revoke can finish any active phase without reviving paused time.
-   [ ] Capacity-check the existing shared-IP guest write limiter against a full 30-answer + 3-Continue classroom flow; tune the existing limiter if needed rather than trusting a client-supplied participant ID as a rate-limit key.

Concurrency tests:

-   simultaneous Continue with same revision;
-   committed response lost then retried;
-   stale block-1 Continue during block-2 intro;
-   answer during intro;
-   final block answer racing GET;
-   timeout/Continue boundary;
-   revoke/Continue boundary;
-   natural AccessLink expiry and exhausted quota on an already-started attempt;
-   session revocation while Continue waits on the established link/attempt locks;
-   missing/invalid CSRF and disallowed Origin regression.

### Phase 7 — GET/finalize/reconciliation/report

-   [ ] Use the canonical timing helper and public projection in GET.
-   [ ] Reject ordinary explicit finalize from invalid incomplete/intro states.
-   [ ] Reconcile expiry only for `TimerState=running` attempts with active deadlines; update the store predicate so expiry is not inferred from deadline nullability alone.
-   [ ] Persist `SubmittedAt=effective expiry` for timed-out attempts even when report/batch reconciliation happens later; keep actual submit/revoke timestamps for their respective reasons.
-   [ ] Use the same interpretation in report reconciliation.
-   [ ] Preserve completed/revoked score/result policy.
-   [ ] Verify no-class Sixth Muse attempt displays correctly in authenticated report.

### Phase 8 — Guest runtime

-   [ ] Parse the strict shared DTO instead of inferring completion from empty questions.
-   [ ] Add continueBlockMutation.
-   [ ] Give Continue/answer/finalize one attempt-scoped TanStack mutation scope.
-   [ ] Never optimistically advance phase; accept only authoritative responses.
-   [ ] Render dedicated block-intro state.
-   [ ] Preserve question/result/retry/session-loss behavior.
-   [ ] Render running/paused/untimed timer states.
-   [ ] Never trigger local zero-time finalize while paused.
-   [ ] Separate global progress from display numbering.
-   [ ] Key focus by status + phase + revision/current-question identity.
-   [ ] Add real EN/RU locale keys and test real resources.

### Phase 9 — Sixth Muse fixture and snapshot

-   [ ] Add separate tools/fixtures/sixth-muse source and contract; do not fold it into grade-marathon constants.
-   [ ] Seed exactly one quiz, three blocks, ten questions per block, four unique options/question, one correct option/question.
-   [ ] Seed normal AccessLink with first/last name required, CAPTCHA disabled, and the existing Terms / Privacy requirements.
-   [ ] Seed `ConfirmAnswerBeforeNext=false`, `PauseTimerOnBlockIntro=false`, global numbering, and `TimeLimitSeconds=2700` unless a later stakeholder-approved decision explicitly changes it.
-   [ ] Reuse the established deterministic balanced authored-option schedule so each of the four correct-answer positions occurs 7 or 8 times across 30 questions; runtime still securely shuffles once per attempt and persists that shuffled order.
-   [ ] Do not create an artificial class/cohort.
-   [ ] Extend generator assertions for Quizzes.Blocks and Questions.BlockKey.
-   [ ] Regenerate metahubs-lms-app-snapshot.json only through metahubs-lms-app-export.spec.ts.
-   [ ] Require exactly 8 quizzes and 10 AccessLinks for the current canonical fixture.
-   [ ] Semantically revalidate all seven existing grade quiz datasets (stable keys/order/question counts, flat/no-block structure, guest-link association and current policies), not only the aggregate counts.
-   [ ] Run fixture contract/drift checks.

### Phase 10 — Jest/Vitest gates

-   [ ] Applications backend Jest: lifecycle/snapshot, timing, store mapping, start/get/continue/answer/finalize, concurrency, timeout/report, config mapping, AccessLink/session/publication semantics, CSRF/Origin regressions.
-   [ ] Metahubs backend Jest: template seed, manifest validation, authoring metadata.
-   [ ] Apps-template-mui Vitest: DTO normalization, intro, timer modes, Continue retry, focus, numbering/progress, sibling selector, row-menu reorder, no raw technical values.
-   [ ] Shared types/utils Vitest for common contracts.
-   [ ] Public DTO allowlist/negative-leakage tests: intro/question responses contain no BlockKey, physical UUID, future question, correct option/explanation, timer internals or writable persistence fields.
-   [ ] Started-attempt immutability tests: editing live quiz blocks/questions/policies/completion text after START does not rewrite the active attempt's snapshotted flow, scoring or option order.
-   [ ] Option-order resume test: one attempt sees the same securely shuffled option order after GET/reload/resume.
-   [ ] Timeout timestamp tests: delayed reconciliation and report reconciliation preserve authoritative effective expiry as `SubmittedAt`, including after repeated pause/resume.
-   [ ] Transition tests cover answer-during-intro, stale Continue from an earlier block, duplicate committed Continue with a lost response, deadline-at-freeze timeout, and rejection of impossible persisted zero-budget paused state.

Run focused suites first, then package-wide suites.

### Phase 11 — Minimal-Supabase Playwright

Use:

```bash
pnpm supabase:e2e:start:minimal
pnpm env:e2e:local-supabase
pnpm doctor:e2e:local-supabase
pnpm run build:e2e
```

Do not use pnpm dev.

Required journeys:

1. Seeded Russian Sixth Muse: import snapshot -> create/publish application -> create its `/l/<slug>` alias through the existing application-owned short-link UI -> anonymous short link -> first/last name + Terms/Privacy -> running first intro -> Continue -> all 30 questions through three introductions -> result -> authenticated report.
2. Pause-enabled quiz: frozen first/later intro, reload preserves budget, Continue resumes once, replay cannot add time/skip a block.
3. Existing flat grade quiz: starts directly at question 1 and keeps score/report/short-link behavior.
4. Both numbering modes with global progress.
5. Authoring: create/edit/reorder blocks through existing TABLE surfaces, multiline intro, move question, confirmed flat<->blocked conversion, deletion guard, no raw BlockKey/UUID/JSON/sort field.
6. Access/runtime regression: all seven seeded grade quizzes remain flat and valid; representative browser flow stays unchanged while fixture/API contracts verify all seven.

Use Playwright Clock only for deterministic browser presentation checks. Backend controlled-time tests prove authoritative timing.

Assert:

-   no page-level horizontal overflow;
-   keyboard-only completion;
-   expected focus after phase transitions;
-   axe checks where supported;
-   real EN/RU resources;
-   desktop 1920x1080, tablet 768x1024, mobile 390x844.

Capture and manually open/inspect screenshots for:

-   RU block intro at desktop/tablet/mobile;
-   RU question + timer;
-   RU result;
-   paused intro;
-   block authoring;
-   question block selector;
-   authenticated report;
-   one EN flat-quiz regression state.

Browser assertions alone are not sufficient; screenshots must be visually reviewed.

### Phase 12 — README and GitBook documentation

-   [ ] Update metahubs-backend README/README-RU with metadata/authoring semantics.
-   [ ] Update applications-backend README/README-RU with phase/timer/Continue contract.
-   [ ] Update apps-template-mui README/README-RU with guest block UX and generic authoring widgets.
-   [ ] Document reusable TABLE primitives in the appropriate MUI README if they become general platform capabilities.
-   [ ] Update EN/RU LMS guest-access and quiz tutorial docs.
-   [ ] Document block meaning, intro behavior, timer policy, numbering, authoring/reorder/assignment, resume/retry, accessibility timing scope, and reports.
-   [ ] Update SUMMARY.md only if new pages are added.
-   [ ] Extend docs-lms-user-guide-screenshots.spec.ts.
-   [ ] Generate screenshots against minimal Supabase and visually inspect them.
-   [ ] Run docs:lms-user-guide:check, docs:i18n:check, and GitBook screenshot/link checks.

### Phase 13 — Final quality gates

-   [ ] Format touched files.
-   [ ] Run focused lint for touched packages; do not run global lint unless necessary.
-   [ ] Run package builds for types, utils, metahubs-backend, applications-backend, apps-template-mui.
-   [ ] Run root build after focused builds.
-   [ ] Run check:i18n-coverage.
-   [ ] Run check:apps-template-isolation.
-   [ ] Run check:runtime-no-lms-forks.
-   [ ] Run check:mui-v9-policy.
-   [ ] Run LMS fixture contract/drift checks.
-   [ ] Run relevant minimal-Supabase Playwright flows and docs generator.
-   [ ] Apply Thermos/autoreview and fix all CRITICAL/HIGH findings.
-   [ ] Run OntoIndex gn_verify_diff/detect-changes and reconcile scope with this plan.
-   [ ] Verify no template/schema version bump.
-   [ ] Verify generated LMS snapshot was not manually edited.
-   [ ] Verify the clean-break rollout contract: backend, published runtime bundle, template metadata and regenerated fixture are released together against freshly recreated application schemas; partially upgraded LMS deployments are unsupported and fail closed rather than receiving compatibility shims.
-   [ ] Update memory-bank tasks/progress in English during IMPLEMENT/QA, not in this PLAN-only change.

## Test Matrix

| Area                         | Jest/integration                                           | Vitest                   | Playwright                                  |
| ---------------------------- | ---------------------------------------------------------- | ------------------------ | ------------------------------------------- |
| Flat regression              | start/answer/finalize                                      | direct question phase    | existing grade flow                         |
| Block intro                  | projection/transition                                      | render/focus             | seeded Sixth Muse                           |
| Running intro timer          | deadline unchanged                                         | countdown                | real intro + short Clock presentation check |
| Paused intro timer           | freeze/resume/reconcile                                    | frozen/no local finalize | reload + Continue + replay                  |
| Idempotency                  | concurrent/stale Continue                                  | pending/retry            | replay committed transition                 |
| Access/session/publication   | natural expiry vs hard revoke, quota, session, CSRF/Origin | error projection         | short-link/revocation regression            |
| DTO privacy                  | phase allowlist, no internal IDs/future/correctness        | strict parsing           | browser technical-leakage checks            |
| Started-attempt immutability | source edits cannot rewrite snapshot                       | stable projection        | reload/resume after source edit             |
| Option order                 | persisted shuffled snapshot                                | stable current question  | reload/resume keeps option order            |
| Timeout timestamp            | effective expiry vs delayed reconciliation                 | timer projection         | report shows authoritative completion time  |
| Numbering                    | derived labels                                             | global/block labels      | both modes                                  |
| Scoring                      | blocks excluded                                            | result                   | 30-question result                          |
| Authoring                    | metadata validation                                        | selector/reorder/guards  | real authoring                              |
| Fixture                      | source/generator contract                                  | n/a                      | generator + imported app                    |
| Report                       | nullable class + rows                                      | formatter if touched     | authenticated report                        |
| Accessibility                | DTO semantics                                              | focus/ARIA               | keyboard + axe + overflow + screenshots     |

## Performance And Safety

-   Block metadata comes from the immutable attempt snapshot; block transitions do not query mutable quiz data repeatedly.
-   Continue is one small per-attempt transaction and must reuse the established lock ordering.
-   Do not add polling solely for paused state.
-   Keep future question/correctness data server-side.
-   Dynamic SQL identifiers remain validated/quoted; values remain bind parameters.
-   Persisted new identities use UUID v7.
-   Treat persisted snapshot JSON as untrusted input and fail closed through Zod.
-   Do not log session tokens, participant PII, correctness data, or complete snapshots.
-   Split timing/flow/UI helpers rather than growing existing large handlers/components.
-   Keep the existing global CSRF/CORS composition as the security boundary for Continue; test it, but do not duplicate it inside the handler.
-   Validate shared-IP write capacity for classroom use before release; if tuning is necessary, change the existing server-controlled limiter policy rather than keying security to untrusted client identity fields.

## Potential Challenges

### Mixed flat/blocked authoring

-   **Risk:** orphan/mixed question membership.
-   **Mitigation:** atomic editor transformations plus independent backend/template validation.

### Duplicate Continue/time inflation

-   **Risk:** double click/retry adds time or skips intro.
-   **Mitigation:** transaction lock + expected PhaseRevision + explicit timer state.

### Client-only pause

-   **Risk:** server/report reconciliation times out a paused learner.
-   **Mitigation:** persisted TimerState + FrozenRemainingMs + no active deadline while paused.

### Source edits during attempt

-   **Risk:** reload changes blocks/text/policy.
-   **Mitigation:** reconstruct from QuestionsSnapshot + FlowSnapshot.

### Nested TABLE references

-   **Risk:** raw BlockKey/child UUID leakage.
-   **Mitigation:** declared hidden semantic UUID v7 plus metadata-resolved options rendered by the existing Select/editor path on both current TABLE authoring surfaces.

### Dual authoring surfaces

-   **Risk:** published-application authoring and metahub authoring interpret the same block metadata differently.
-   **Mitigation:** one metadata contract + shared pure helpers, behavior tests for both existing editors, and no third block-specific editor.

### Clean-break deployment skew

-   **Risk:** new backend mapping is served with an old runtime bundle or old application schema during a partial rollout.
-   **Mitigation:** release backend/runtime/template/fixture as one clean-break contract, recreate/re-publish the disposable LMS environments, fail closed on incomplete mapping, and do not add legacy compatibility branches.

### Fixture drift

-   **Risk:** manual snapshot changes or grade assumptions hide the new dataset.
-   **Mitigation:** separate Sixth Muse contract + canonical generator + exact aggregate/drift assertions.

### Accessibility claims

-   **Risk:** treating intro pause as WCAG timing compliance.
-   **Mitigation:** accurate docs, untimed configuration, separate accommodation feature if required.

## Acceptance Criteria

1. Fresh LMS metahub/application contains seven existing grade quizzes plus Sixth Muse, and the canonical fixture contains exactly 8 quizzes and 10 AccessLinks for this baseline.
2. Sixth Muse has exactly 3 blocks with 10 scored questions each; every question has exactly 4 unique choices and exactly 1 correct choice.
3. All 30 Sixth Muse source rows pass the research content gate: approved prompt/key/three distractors, evidence notes for deliberate corrections, and zero unresolved review-blocked facts before canonical snapshot generation.
4. After application creation, the existing short-link UI can create a Sixth Muse `/l/<slug>` alias; anonymous intake through it requires first/last name and both Terms/Privacy consents, with CAPTCHA disabled.
5. Sixth Muse uses `TimeLimitSeconds=2700`, `ConfirmAnswerBeforeNext=false`, global numbering, and `PauseTimerOnBlockIntro=false`; its timer therefore runs from attempt start including introductions.
6. Optional pause freezes/resumes authoritative time without inflation across reload/retry, and timed-out `SubmittedAt` equals effective expiry.
7. Continue is duplicate-safe and stale-replay-safe while preserving existing started-attempt AccessLink/session/publication semantics.
8. All seven existing grade quizzes remain flat and preserve their fixture/guest contracts; representative browser regression remains green.
9. Global and block-relative numbering both work; score/progress stay global.
10. Authoring on existing TABLE surfaces exposes no raw IDs/JSON/sort fields and needs no block-specific dialog or drag-and-drop system.
11. Result and authenticated report work without a class on Sixth Muse.
12. Public DTO allowlists expose no future questions, correctness, BlockKey or persistence internals.
13. Full Jest/Vitest/Playwright gates are green.
14. Responsive screenshots are manually inspected and show no overflow/technical leakage.
15. EN/RU docs and package READMEs match shipped behavior.
16. Thermos/autoreview and OntoIndex diff verification have no unresolved blockers.
17. No legacy compatibility path, template/schema version bump, or hand-edited generated snapshot is introduced; clean-break components are released together.
18. Authored correct-answer positions are deterministically balanced so each of the four positions occurs 7 or 8 times across the 30 questions, while the per-attempt secure shuffle remains persisted and stable across reload/resume.

## Recommended Implementation Order

```text
content gate
  -> shared contracts
  -> template metadata
  -> extend existing TABLE authoring surfaces
  -> backend snapshot/timing primitives
  -> start/resume
  -> Continue + answer transitions
  -> GET/finalize/report reconciliation
  -> guest UI
  -> Sixth Muse fixture generation
  -> Jest/Vitest gates
  -> Playwright + screenshots
  -> docs
  -> final Thermos/OntoIndex/build gates
```

This order keeps each stage independently reviewable and makes the generated fixture/browser work exercise the final contract rather than temporary intermediate behavior.
