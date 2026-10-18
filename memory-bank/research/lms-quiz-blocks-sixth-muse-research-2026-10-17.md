# Research: LMS Quiz Blocks And “Sixth Muse”

> Created: 2026-10-17
> Status: Reviewed
> QA reviewed: 2026-10-17 (codebase, project Skills, Context7, official web sources, and independent subagent passes)
> Trigger: RESEARCH request based on the QA-refined Manager input and specification for LMS quiz blocks and the “Sixth Muse” fixture
> Follow-up plan: ../plan/lms-quiz-blocks-sixth-muse-plan-2026-10-17.md

## Research Question

What is the safest canonical architecture for optional ordered blocks inside LMS quizzes, including block-introduction screens, server-authoritative timer pause/resume, block-relative display numbering, guest resume/idempotency, authoring UX, fixture generation, and the new Russian “Sixth Muse” quiz, while preserving the existing seven flat grade quizzes and the current guest-attempt/reporting lifecycle?

The repository decision supported by this research is whether PLAN can extend the existing metadata-driven LMS quiz and guest-attempt path directly, what state must become canonical and persisted, what must remain presentation-only, and which content corrections must be completed before the “Sixth Muse” dataset can be promoted into the generated LMS snapshot.

## Decision Inputs

-   Original product brief (workspace-only source; not included in this repository)
-   QA-refined specification (workspace-only source; not included in this repository)
-   Source quiz: `.backup/Квиз-Шестая-муза.md`
-   Prior LMS guest-attempt research: `memory-bank/research/lms-quiz-guest-testing-global-short-links-research-2026-10-11.md`
-   Current LMS template, guest runtime, attempt persistence/lifecycle, report reconciliation, fixture generator, and fixture contracts
-   Project-local architecture, Runtime UI UX, Playwright, backend, and Zod Skills
-   Current W3C WCAG 2.2, 1EdTech QTI 3, Playwright, and biographical sources listed below

## Source Inventory

| Source                                                                                                                                                                                                                                                                                         | Type                                  | Date / Freshness                                                           | Why It Matters                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Original product brief (workspace-only source; not included in this repository)                                                                                                                                                                                                                | Primary requirement                   | 2026-10-17                                                                 | Original product intent and acceptance journey                                                                                                |
| QA-refined specification (workspace-only source; not included in this repository)                                                                                                                                                                                                              | QA-refined requirement                | 2026-10-17                                                                 | Canonical constraints, known content defects, UX/test requirements                                                                            |
| `.backup/Квиз-Шестая-муза.md`                                                                                                                                                                                                                                                                  | Local source content                  | Current task input                                                         | Three source blocks and 30 keyed questions                                                                                                    |
| `memory-bank/research/lms-quiz-guest-testing-global-short-links-research-2026-10-11.md`                                                                                                                                                                                                        | Prior project research                | 2026-10-11                                                                 | Existing server-authoritative attempt, deadline, guest, short-link, DTO, and WCAG decisions                                                   |
| `packages/universo-react-metahubs-backend/src/domains/templates/data/lms.seed-entities.assessment.ts`                                                                                                                                                                                          | Local source                          | Current checkout                                                           | Current flat Quizzes/Questions metadata and QuizAttempts fields                                                                               |
| `packages/universo-react-applications-backend/src/services/assessmentAttemptLifecycle.ts`                                                                                                                                                                                                      | Local source                          | Current checkout                                                           | Question snapshot, public next-question projection, and scoring invariants                                                                    |
| `packages/universo-react-applications-backend/src/controllers/runtimeGuest/assessmentAttemptStartHandler.ts`                                                                                                                                                                                   | Local source                          | Current checkout                                                           | Current attempt start, lock, snapshot, and deadline creation                                                                                  |
| `packages/universo-react-applications-backend/src/services/guestAssessmentAttemptLifecycleService.ts` and `src/persistence/guestAssessmentAttemptStore.ts`                                                                                                                                     | Local source                          | Current checkout                                                           | Timeout finalization and expired-attempt reconciliation                                                                                       |
| `packages/universo-react-applications-backend/src/controllers/runtimeReportsController.ts`                                                                                                                                                                                                     | Local source                          | Current checkout                                                           | Authenticated quiz-attempt reporting reconciles expired attempts before reads                                                                 |
| `packages/universo-react-applications-backend/src/controllers/runtimeGuest/assessmentAttemptSupport.ts`, `assessmentAttemptAnswerHandler.ts`, `assessmentAttemptGetHandler.ts`, `assessmentAttemptFinalizeHandler.ts`, `services/publicGuestRuntimeConfig.ts`, and guest runtime-table mapping | Local source                          | Current checkout                                                           | Public attempt projection, phase-sensitive mutation points, deadline checks, and the all-or-nothing persistence/config mapping surface        |
| `packages/universo-react-apps-template-mui/src/standalone/GuestQuizPanel.tsx`, `useGuestQuizAttempt.ts`, `guestRuntimeTypes.ts`, `guestRuntimeUtils.ts`                                                                                                                                        | Local source                          | Current checkout                                                           | Current one-question-at-a-time UI, countdown, focus, resume, and public DTO normalization                                                     |
| `packages/universo-react-apps-template-mui/src/components/dialogs/FormDialog.tsx`, TABLE editors, and `src/utils/tabularColumns.tsx`                                                                                                                                                           | Local source                          | Current checkout                                                           | Current TABLE authoring capabilities and the gaps around sibling-row selection and explicit reorder controls                                  |
| `tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`, LMS fixture contracts, and `tools/fixtures/lyceum-marathon/source.json`                                                                                                                                                  | Local source                          | Current checkout                                                           | Supported generated snapshot path, current seven-grade contract, stable source identities, and deterministic balanced correct-position policy |
| `.agents/skills/universo-platform-architecture/SKILL.md`                                                                                                                                                                                                                                       | Project architecture rule             | Current checkout                                                           | Metahub/application/workspace ownership and no LMS-specific shared-widget forks                                                               |
| `.agents/skills/mui-runtime-ux-patterns/SKILL.md`, `runtime-ux-qa/SKILL.md`                                                                                                                                                                                                                    | Project UX rules                      | Current checkout                                                           | No raw IDs/JSON, multiline semantic text, localization, focus, responsive/browser proof                                                       |
| `.agents/skills/playwright-best-practices/SKILL.md`                                                                                                                                                                                                                                            | Project test rule                     | Current checkout                                                           | Repository E2E workflow and deterministic clock testing guidance                                                                              |
| Playwright Clock docs, https://playwright.dev/docs/clock                                                                                                                                                                                                                                       | Primary framework docs                | Current; exact pinned 1.58.2 also checked through Context7                 | Client-side deterministic Date/timer testing                                                                                                  |
| Zod 3 discriminated unions, https://v3.zod.dev/                                                                                                                                                                                                                                                | Primary framework docs                | Zod 3 line; repository pins 3.25.76                                        | Supports an explicit discriminated public runtime phase contract                                                                              |
| WCAG 2.2 Recommendation, https://www.w3.org/TR/WCAG22/#timing-adjustable, plus Understanding SC 2.2.1, https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable                                                                                                                           | Normative standard + primary guidance | W3C Recommendation dated 2024-12-12; Understanding page checked 2026-10-17 | Normative timing-adjustability alternatives/exceptions and explanatory test/accommodation guidance                                            |
| 1EdTech QTI 3.0.1 Assessment Test, Section, and Item Information Model plus QTI 3.0 Best Practices, indexed at https://www.1edtech.org/standards/qti/index                                                                                                                                     | Primary interoperability standard     | Current official QTI 3 specification index checked 2026-10-17              | Ordered assessment sections and rubric/instructional content as a conceptual precedent without claiming Universo conformance                  |
| Anton Delvig, https://www.culture.ru/persons/12746/anton-delvig                                                                                                                                                                                                                                | Primary/curated cultural biography    | Checked 2026-10-17                                                         | Confirms 1798–1831 and age 32, exposing source Q28 wording defect                                                                             |
| Alexander Kornilov, https://www.hrono.ru/biograf/bio_k/kornilov_alal.php                                                                                                                                                                                                                       | Secondary historical biography        | Checked 2026-10-17                                                         | Gives 1801–1856, exposing source Q27 contradiction                                                                                            |
| All-Russian Pushkin Museum Lyceum sobriquet material, https://www.museumpushkin.ru/assets/files/pushkinsky_museum_2020.pdf                                                                                                                                                                     | Institutional historical publication  | Checked during 2026-10-17 content QA                                       | Strong source for several Lyceum nicknames, including Danzas as «Франт, Медведь»                                                              |
| Russian Geographical Society Matyushkin biography, https://rgo.ru/activity/redaction/articles/voln-i-bur-lyubimoe-ditya-kak-litseist-fedor-matyushkin-stal-moryakom-i-polyarnikom/                                                                                                             | Institutional biography               | Published 2024; checked 2026-10-17                                         | Supports Matyushkin nickname and states death in 1872 at age 73                                                                               |
| Presidential Library biographies for Korf/Puschin/Gorchakov/Küchelbecker, e.g. https://www.prlib.ru/history/619564                                                                                                                                                                             | Institutional historical biography    | Checked 2026-10-17                                                         | Stronger provenance for public roles, dates, and biographical distinctions used in the content gate                                           |
| Russian National Library Delvig biography, https://nlr.ru/nlr_history/persons/info.php?id=41                                                                                                                                                                                                   | Institutional biography               | Checked 2026-10-17                                                         | Confirms Delvig's full dates and age 32                                                                                                       |
| Tretyakov Gallery Lomonosov biography, https://my.tretyakov.ru/app/masterpiece/154380                                                                                                                                                                                                          | Institutional biography               | Checked 2026-10-17                                                         | Supports Sergey Lomonosov's diplomatic career and dates                                                                                       |
| Russian Biographical Dictionary texts on Wikisource, SPbU materials, Grot/Eidelman historical scholarship, and Music Encyclopedia entries cited in the per-question register                                                                                                                   | Historical/secondary evidence         | Checked 2026-10-17; strength varies by item                                | Supporting evidence only; weaker items remain review-blocked until the final source contract retains adequate provenance                      |

## Key Findings

### 1. The current quiz/attempt path is deliberately flat, so blocks require a real domain extension

The canonical LMS quiz metadata currently has one `Questions` TABLE and no block entity, block membership, block introduction, block timer policy, or block-relative numbering policy. The guest player likewise assumes one current unanswered question at a time. In the current frontend, absence of a current question while an attempt is in progress is already interpreted as “all questions answered / finalize”, so a block introduction cannot safely be represented by an empty questions array.

The backend snapshot and scoring contract is also question-only. A pseudo-question used as a block heading would enter the denominator, violate the “one answer per scored question” contract, affect `questionSetDigest`, and create false responses. A block introduction therefore must be presentation/state metadata, never a scored question.

The existing architecture should be extended rather than replaced. The user’s requested journey already fits the current `GuestApp` / guest-attempt path: guest intake → one authoritative attempt → sequential persisted answers → final result → authenticated report.

### 2. “Quiz block” should be the domain term; “block introduction” should be the learner-facing screen

1EdTech QTI 3.0.1 provides a useful conceptual precedent: an assessment test can contain ordered assessment sections that group item references. Candidate-facing instructions/rubrics are a distinct concept from the section's structural title; QTI rubric blocks can be attached at test/part/section scope and are non-interactive. Universo does not need QTI conformance for this feature, but this distinction supports the product separation between:

-   an ordered structural grouping of scored questions; and
-   non-scored instructional/presentation material at the boundary of that grouping.

The repository should use the existing product terminology from the brief: **quiz block** for the domain object and **block introduction** for the learner screen. It should not model the introduction as a standalone platform `Page`, because the introduction is part of assessment sequencing and attempt state rather than an independently navigable content entity.

### 3. Recommended canonical authoring model: ordered Blocks plus a declared semantic BlockKey

The cleanest metadata model is:

-   optional `Quizzes.Blocks` TABLE;
-   each block has a declared stable semantic `BlockKey`, localized `Title`, optional multiline `Introduction`/instructions, and `SortOrder`;
-   each question gains nullable `BlockKey`;
-   `Questions.SortOrder` remains the single global question order.

The semantic key is necessary. TABLE child rows receive physical UUID v7 identities during sync/materialization, and only declared child fields survive the metadata/seed pipeline. A fixture-only hidden value or physical TABLE-row UUID is therefore not a stable authoring identity. `BlockKey` must be a declared component stored with the block and referenced by the question while remaining hidden from ordinary user surfaces.

Do not introduce a second `QuestionOrderInBlock` source of truth. Global `Questions.SortOrder` already supplies a deterministic 1…N ordering; block-relative position can be derived from block membership plus that order. For a blocked quiz, questions belonging to each block should form a contiguous range in global order. This makes global progress, scoring, snapshot ordering, and local display numbering agree.

Validation mode should be binary:

-   `Blocks=[]`: flat quiz; every `Question.BlockKey` is empty/null and current behavior is preserved;
-   `Blocks.length>0`: every question belongs to exactly one existing block; orphan, mixed, duplicate-key, duplicate-order, gapped/interleaved block membership is rejected.

This strengthens the existing LMS template and Object/TABLE metadata rather than introducing a new platform entity kind.

### 4. One QuizAttempt remains the aggregate; add an explicit persisted phase

Block boundaries must not create new attempts or consume `MaxAttempts`. The existing attempt status lifecycle (`Started`, terminal pass/fail/timeout/revocation states) should remain the coarse lifecycle.

Within an active attempt, add a persisted presentation/sequencing phase. Conceptually:

`block_intro → question → … → block_intro → question → … → terminal result`

The public attempt DTO should expose an explicit discriminator such as `phase: "block_intro" | "question"` while `status` continues to describe attempt lifecycle. Zod 3’s discriminated-union pattern is a good fit for parsing this boundary because it selects one object schema from an explicit discriminator and produces phase-specific validation errors.

The learner-facing `block_intro` DTO should contain only the resolved localized title/instructions and display ordinal needed by the learner. It must not expose internal `BlockKey`, TABLE row UUIDs, future question payloads, correctness, explanations, or other private scoring material.

Flat quizzes should start directly in `question` phase so the seven existing grade quizzes preserve their current guest behavior.

### 5. Snapshot block structure and policies when the attempt starts

Attempt-critical scoring, sequencing, and timing inputs must not drift when an administrator edits the source quiz after the attempt starts. The current attempt already snapshots scored questions and shuffled option order. Blocks add three more immutable dimensions:

-   ordered block metadata;
-   question-to-block membership/order;
-   attempt policies that affect sequencing, timer behavior, and display numbering.

PLAN may choose one cohesive attempt snapshot such as `{ blocks, questions, policies }`, or a scored-question snapshot plus a separate presentation/policy snapshot. The invariant is more important than the physical shape: all state required to reconstruct the same attempt after reload must be snapshotted at start.

The current question snapshot and scoring code should remain the sole scoring basis. Block metadata must never be counted as a question.

The current start/resume path reloads the live quiz before it discovers an existing `Started` attempt, and completion text is also read from the live quiz. PLAN must therefore make the resume contract explicit: after session/access-link/application authorization succeeds, reconstruction of an already-started attempt must not require mutable source question/block data. If learner-facing completion text or other presentation values are intended to be immutable too, snapshot them; otherwise document them as deliberately live and do not claim full attempt immutability.

### 6. “Continue” needs a server-recognized, idempotent transition

The introduction screen is not just client presentation because it affects the authoritative phase and, optionally, effective time. It therefore needs an explicit server transition.

Required semantics:

-   Continue is accepted only while the attempt is `Started` and currently in the matching block-introduction phase;
-   the transition is serialized by the same attempt-level lock/transaction boundary used by other attempt mutations;
-   the first accepted Continue moves the attempt to the first question of that block;
-   the request carries an expected public transition revision/generation (or equivalent opaque phase token) so a delayed replay from block 1 cannot accidentally advance a later block 2 introduction; internal `BlockKey` still stays private;
-   a duplicate/retried Continue for an already-consumed revision observes the already-advanced state and returns it without adding time or skipping a question;
-   if the server commits but the response is lost, GET/reload returns the persisted question phase;
-   if the transition fails before commit, the learner remains on the same introduction and can retry.

UI disabling while a request is pending is useful UX but is not the idempotency invariant.

The answer mutation needs the same phase authority. It must reject an otherwise valid first-unanswered question while the attempt is in `block_intro`; after the last question in a block is persisted, the answer transaction must atomically move the attempt to the next `block_intro` and, when configured, freeze effective time. Otherwise a direct API call could bypass the introduction state even if the UI behaves correctly.

### 7. Timer pause on block introductions must be server-authoritative

Today attempt start immediately creates `deadlineAt = now + effectiveTimeLimitSeconds`. The browser derives a countdown from the server deadline, and the server independently rejects/finalizes work after that deadline. Authenticated reporting also runs expired-attempt reconciliation before reading quiz-attempt rows.

Therefore a React-only paused countdown would be incorrect: the server deadline would continue to expire, and simply opening a report could finalize an attempt while the learner is on a supposedly paused block introduction.

Recommended effective-time model:

-   default policy: time runs on every block introduction, including the first introduction immediately after attempt start;
-   optional pause policy: entering an introduction atomically captures the authoritative remaining effective duration at full persistence precision, persists the paused phase/budget, and removes or makes inactive the running deadline for expiry purposes;
-   while paused, GET returns the same frozen authoritative remaining value;
-   Continue atomically resumes exactly once by setting a new deadline from the frozen budget and moving to `question`;
-   entering a later block introduction after saving the final answer of the previous block atomically freezes the remaining budget again;
-   duplicate Continue/retry/reload cannot add seconds;
-   start/resume, GET, answer, Continue, explicit finalize, timeout reconciliation, revocation, and authenticated reporting use one canonical effective-time helper/state interpretation rather than duplicating deadline logic in each handler.

The current expired-attempt store query already ignores rows with a null deadline, which is compatible with one possible paused representation, but the repository must still distinguish “paused timed attempt” from “untimed attempt” explicitly in canonical state. PLAN should choose the exact fields rather than infer pause from a nullable deadline alone.

Persist the frozen budget with millisecond-equivalent precision (or an exact timestamp/delta representation); rounding to whole seconds is a DTO/UI concern. Repeated pause/resume cycles must not systematically add or remove time.

The new fields are part of the fresh canonical assessment mapping, not optional compatibility data. PLAN must update the LMS seed metadata/settings, `PublicGuestAssessmentRuntimeConfig`, runtime-table resolver, attempt-column mapping/selects, validators, and report reconciliation coherently. With the disposable database and clean-break requirement, an incomplete mapping should fail closed as a configuration error rather than silently skipping timeout reconciliation.

For `TimedOut`, prefer `SubmittedAt`/the report's “finished” time to represent the authoritative effective expiry instant rather than the later batch/report-reconciliation processing time; this avoids many expired attempts receiving the same misleading completion timestamp. Manual submission continues to use its actual submission time.

The browser timer remains presentation. On a paused introduction it should render the frozen server value and a localized paused explanation, without starting the local zero-trigger finalization path.

### 8. WCAG 2.2 does not make “pause on intro” an accessibility accommodation

The normative WCAG 2.2 Recommendation SC 2.2.1 requires each content-controlled time limit to satisfy one of its listed alternatives (turn off, adjust, extend, or an applicable exception). Its explanatory guidance additionally recognizes test scenarios where learner control would invalidate the outcome and a third party controls the time allowance, for example by granting double time.

The new `pauseOnBlockIntro` policy only decides whether instructional boundary screens consume assessment time. It does not by itself satisfy the wider timing-adjustability requirement.

Current repository evidence does **not** show an implemented per-participant/access-link extra-time override: `EffectiveTimeLimitSeconds` is presently populated directly from the quiz `TimeLimitSeconds` at attempt start. PLAN must therefore either design an explicit provider-controlled accommodation/override if that is required for the target conformance/deployment, or document why an applicable SC 2.2.1 exception (for example essential timing) is justified. The product must not claim WCAG timing compliance solely because block introductions can pause the timer, and an Axe pass alone cannot prove SC 2.2.1.

### 9. Block-relative numbering is presentation; global progress and scoring stay global

Default numbering remains `1…N`. Optional block-relative numbering may display `1.1…1.10`, `2.1…`, etc.

It must not change:

-   question identity;
-   question snapshot order;
-   response identity;
-   global answered count;
-   denominator/scoring;
-   progress bar arithmetic.

The learner should still understand global progress. In block-relative mode, the question label can show the local number and block context while a separate status/progress surface says how many of the total questions are answered. The progress bar’s accessible label should describe what its numeric value actually represents (for example, answered questions), instead of conflating global progress with the current display number.

### 10. Authoring must stay structured and user-facing

Blocks and question membership must be editable inside the published application’s normal runtime authoring surface using the MUI/runtime authoring architecture. Ordinary users must not enter UUIDs, raw JSON, TABLE row IDs, hidden keys, or technical sort numbers.

Required authoring behavior for PLAN:

-   create/edit/delete/reorder blocks by visible title;
-   edit introduction/instructions as a semantic multiline field;
-   assign or move questions between blocks through a structured selector;
-   preserve one clear order;
-   prevent deleting a block while it would orphan questions unless the product provides an explicit reassignment flow;
-   localize labels, validation, errors, and empty states in EN/RU.

The hidden semantic `BlockKey` can be generated/maintained by the system while the UI shows block names.

QA found that the current generic TABLE editor does not yet provide (a) a dynamic selector whose options come from sibling rows in another TABLE or (b) a first-class keyboard-accessible reorder control. PLAN must make that missing capability concrete instead of assuming it already exists. The preferred direction is a reusable metadata-driven sibling-row/semantic-reference selector plus generic TABLE reorder behavior; an assessment-specific authoring composition is also acceptable when built from shared `StandardDialog`/form/table primitives without adding LMS-codename branches to shared widgets. In either case, the user selects visible block titles while the system persists `BlockKey`, and reorder changes authoritative order without exposing technical fields.

### 11. Runtime UX needs an explicit phase-aware focus and responsive contract

The existing guest quiz already focuses the current question heading and uses accessible native/MUI radio behavior. Block introductions should extend the same contract:

-   intro appears → focus its `h2`/heading with `tabIndex={-1}`;
-   Continue is an ordinary keyboard-activatable MUI button;
-   successful Continue → focus first question heading;
-   next block intro → focus next block heading;
-   terminal result → focus result heading;
-   failed Continue → keep the learner in the same contextual region with a localized retryable error.

The focus effect must be keyed by presentation state (`phase` plus public phase revision/block ordinal), not only by `currentQuestionId`/attempt status; otherwise `in_progress → block_intro → question` transitions can miss focus when no question ID exists.

The current countdown uses `role="timer"` with `aria-live="off"`, which avoids announcing every second. A paused state should expose a localized paused description through `aria-describedby` or equivalent accessible naming and announce the transition to paused/resumed once via a status message, while the timer itself remains `aria-live="off"`.

Global progress needs exact semantics in both numbering modes: the progressbar value/name describes answered questions (for example, “Answered 10 of 30”), while the separate display label may show `2.1` and “Block 2 of 3”. On the second block introduction, progress remains 10/30 rather than pretending the intro is a question.

Long Russian titles/instructions are a new overflow risk. The acceptance matrix should retain the repository’s existing `390×844`, `768×1024`, and `1920×1080` widths, with no page-level horizontal overflow, safe wrapping, and no fixed-width introduction layout.

New block/paused/numbering strings must exist in the real EN/RU locale resources; tests should load those resources rather than relying only on inline `defaultValue` fallbacks.

### 12. “Sixth Muse” is a separate fixture dataset, not an eighth grade

The current canonical generated snapshot contains seven grade quizzes. The current generator/contract is intentionally grade-oriented, so “Sixth Muse” should not be inserted into the Marathon grade constants.

Create a separate stable source/contract location such as `tools/fixtures/sixth-muse/`, then let the normal LMS generator/export flow seed it into the same final `tools/fixtures/metahubs-lms-app-snapshot.json`.

The new quiz should have:

-   3 blocks, exactly 10 questions each;
-   30 questions total;
-   4 unique non-empty choices per question;
-   exactly 1 correct choice per question;
-   full-pair single-choice options for source questions 19, 23, and 24;
-   required first and last name;
-   existing Terms/Privacy acceptance;
-   CAPTCHA disabled;
-   `ConfirmAnswerBeforeNext = false`, producing automatic advance only after the answer has been persisted successfully;
-   timer enabled at the existing 2700-second fixture default;
-   `pauseOnBlockIntro = false`;
-   global numbering by default;
-   the normal result screen.

The dedicated source contract also needs stable semantic identities for the dataset, quiz, access link, blocks, questions, and options (for example `datasetId`, `quizKey`, `accessLinkKey`, unique `slug`, `BlockKey`, and stable question/option IDs). These identities are fixture/source identities only; learner-facing runtime DTOs still hide internal keys.

Keep authored option order deterministic and reproducible. Reuse the established Marathon pattern (a versioned hash-based balanced position schedule or an equivalent deterministic contract) so the 30 source questions distribute the correct option 7/8 times across each of the four positions instead of accidentally putting it first everywhere. This source-order policy is separate from delivery: `buildAssessmentAttemptSnapshot()` must continue to securely shuffle/balance option order once per attempt and persist that randomized order so reload/resume is stable.

An extra synthetic class/cohort is not technically required. `AccessLinks.LinkClassId` and attempt class snapshot are optional, and the brief explicitly requires reporting to work without a class association. The recommended fixture is therefore a quiz-only AccessLink unless PLAN identifies a real product need for a cohort.

The global `/l/<slug>` registry is application-owned and depends on the future application ID, so no deployment-global short-link row should be embedded in the metahub fixture.

### 13. Fixture generation must remain generated and contract-driven

Do not edit the multi-megabyte snapshot by hand. Extend the canonical LMS generator/export flow and validation contracts, then regenerate it.

The separate “Sixth Muse” contract should fail closed on at least:

-   not exactly three blocks;
-   duplicate/empty block keys;
-   duplicate/gapped block order;
-   unexpected block titles/order;
-   not exactly 30 questions or not 10 per block;
-   orphan/unknown/missing block membership;
-   questions from different blocks interleaved in global order;
-   duplicate/gapped question `SortOrder`;
-   not exactly four unique options;
-   zero or multiple correct choices;
-   missing/version-drifted deterministic correct-position algorithm or an unbalanced 30-question source distribution (each position must occur 7 or 8 times);
-   duplicate/missing stable dataset/quiz/access-link/block/question/option identities or a colliding access-link slug;
-   incomplete pair choices for Q19/Q23/Q24;
-   policy drift from the accepted fixture defaults;
-   missing quiz/access-link relation;
-   `ConfirmAnswerBeforeNext` drifting away from `false` for “Sixth Muse”;
-   top-level quiz/link ordering drift: preserve the seven existing quizzes at their current order, seed “Sixth Muse” after them (current baseline `SortOrder = 8`), preserve the current two demo + seven Marathon links, and seed the new quiz link after them (current baseline `SortOrder = 10`);
-   regression of any of the seven existing flat quizzes.

For the current canonical generator baseline, the regenerated snapshot should therefore contain exactly eight quizzes and ten AccessLinks. If another dataset is intentionally added later, update the aggregate expectation explicitly rather than weakening this task's contract to an unbounded “at least”. The shared snapshot-envelope contract also needs metadata assertions that `Quizzes.Blocks` and `Questions.BlockKey` exist in the exported configuration.

### 14. Testing must prove server time independently from browser time

The repository pins `@playwright/test ^1.58.2`. Context7 for the matching Playwright 1.58.2 docs confirms that Clock can control `Date`, timers, `pauseAt`, `runFor`, `fastForward`, and resume behavior. This is appropriate for deterministic browser countdown/rendering tests.

It is not proof of server-authoritative deadline arithmetic. The test strategy should be split:

-   backend service/integration tests with controlled server time for freeze/resume/deadline/reconciliation arithmetic;
-   route tests for start/get/continue/answer/finalize and duplicate/retry behavior, including a stale Continue replay from an earlier block that must not advance a later intro;
-   an API-level attempt to answer the next block's first question while still in `block_intro`, which must be rejected; the accepted last answer of a block must atomically produce the next intro state and optional time freeze;
-   resume tests proving that mutable source block/question edits cannot rewrite an already-started attempt's scoring/sequence state;
-   timer-path tests for every current deadline consumer (start/resume, GET, answer, Continue, finalize, expiry reconciliation, reporting) against the same canonical effective-time interpretation, including millisecond-precision repeated pause/resume and timeout `SubmittedAt` semantics;
-   public DTO allowlist/negative leakage tests;
-   frontend tests for explicit phase normalization, countdown pause behavior, focus, retry, reload/resume;
-   Playwright Clock only for browser presentation/time-dependent UI;
-   a Russian seeded “Sixth Muse” journey: intake → running first intro → ten questions → next intro → … → result → authenticated report;
-   a separate pause-enabled journey including reload on intro and one-time resume;
-   browser assertions that global progress/accessibility remain “answered X of N” while block-relative display shows `1.1/2.1`, including the intro boundary;
-   keyboard/single-activation proof for Continue: Enter/Space produces one request, pending state prevents repeated activation, failure retains contextual focus, and retry produces one new request;
-   a real-EN/RU-resource authoring journey covering block create/edit/reorder, multiline introduction, question assignment/move, orphan-delete prevention, and absence of raw `BlockKey`/UUID/JSON/technical sort fields;
-   existing seven-grade English/flat coverage retained as regression proof.

Automated Axe coverage remains useful for general accessibility regressions but is not evidence by itself that the assessment satisfies WCAG SC 2.2.1; the timing accommodation/exception decision needs an explicit product/semantic assertion or documented deployment decision.

### 15. OntoIndex confirms the guest UI path but direct source remains authoritative for this research

OntoIndex semantic search found the guest assessment E2E/public DTO helpers and current timer utility, and `GuestQuizPanel` has a small direct upstream surface through `GuestApp` and package entry points. The graph index reports full symbol/process/impact capabilities but also warns that two oversized files were degraded and sidecar enrichment was unavailable. Several arrow-function symbols are represented ambiguously as both Function and Const.

No graph claim is therefore used to override direct source inspection. PLAN/IMPLEMENT still must run symbol impact before edits and `gn_verify_diff` before commit as required by repository policy.

## “Sixth Muse” Content Review

### Structural result

The source file contains exactly three named blocks with ten questions each:

1. `Прозвища лицеистов`
2. `Достижения и судьбы`
3. `Даты и цифры`

The source supplies one keyed answer per question but no distractors. It is therefore not yet canonical fixture data. Every keyed answer and every generated distractor must pass a reproducible content-review gate before generation.

### Content-QA status summary

The detailed register below supersedes the source file wherever they conflict. Confirmed/material issues already identified before canonical generation include:

-   **Q10** conflates two different formulations associated with Dmitry Maslov and needs a rewrite;
-   **Q19** incorrectly characterizes Modest Korf as known “exclusively” as a statesman and needs a replacement prompt;
-   **Q22** is ambiguous because Maslov is not the only listed lyceum student born in 1796;
-   **Q23** gives Sergey Lomonosov the wrong birth year (`1800` instead of `1799`);
-   **Q24** depends on a disputed Danzas birth year and should be replaced by a deterministic fact pattern;
-   **Q27** equates Alexander Kornilov's lifespan with Dmitry Maslov's `1796–1856`, while reviewed evidence gives Kornilov `1801–1856`;
-   **Q28** says Delvig lived 33 years although institutional evidence gives death at age 32.

Other rows remain editorial/provenance gates rather than confirmed factual defects; the per-question status below is authoritative.

### Promotion rule

The canonical Sixth Muse source should store, per question:

-   stable source ID;
-   approved prompt;
-   approved correct answer;
-   three approved distractors;
-   block key and global order;
-   review status;
-   evidence reference(s) or an explicit review note when a classroom simplification is deliberately retained.

If authoritative evidence is insufficient for a nickname, career characterization, “only/exclusively” claim, exact age, or pair-of-names claim, the item must remain review-blocked instead of converting uncertainty into a scored fact.

### Detailed correction/distractor register: Q16–Q30

The following register is the current canonical research recommendation for the second half of the source. Distractors are candidate approved choices only after the cited review note is retained in the source contract.

-   **Q16 — Correct.** Keep the key **«Дипломат»**, preferably phrased as «Дипломат; служил в российских дипломатических миссиях и был посланником». Candidate distractors: **«Военный инженер»**, **«Композитор»**, **«Мореплаватель и адмирал»**. The Tretyakov Gallery biography describes Sergey Grigoryevich Lomonosov as a successful diplomat and Russian envoy: https://my.tretyakov.ru/app/masterpiece/154380
-   **Q17 — Provisionally correct; strengthen retained provenance before canonical promotion.** Key: **Михаил Лукьянович Яковлев**. Candidate distractors: **Антон Дельвиг**, **Фёдор Матюшкин**, **Александр Горчаков**. The Music Encyclopedia identifies Yakovlev as a Russian composer and singer/baritone, but the final source contract should retain a stronger institutional/primary biographical reference if available rather than relying on this source alone: https://www.musenc.ru/html/8/8kovlev.html
-   **Q18 — Correct with wording cleanup.** Prefer «Чем занимался в литературе Алексей Илличевский?» with key **«Он был поэтом и занимался переводами»**. Candidate distractors: **«Был композитором и певцом»**, **«Стал адмиралом и полярным исследователем»**, **«Сделал карьеру дипломата и посланника»**. The Russian Biographical Dictionary describes him as a poet and records translation work: https://ru.wikisource.org/wiki/РБС/ВТ/Илличевский,_Алексей_Демьянович
-   **Q19 — Incorrect as written; substantive replacement required.** The word **«исключительно»** is false for Modest Korf, who is also documented as a historian/author. Recommended prompt: **«Какая пара лицеистов соответствует этим должностям: директор Императорской Публичной библиотеки и директор Департамента разных податей и сборов Министерства финансов?»** Correct pair: **Модест Корф и Дмитрий Маслов**. Candidate distractor pairs: **Модест Корф и Александр Горчаков**; **Дмитрий Маслов и Александр Корнилов**; **Михаил Яковлев и Сергей Ломоносов**. Institutional evidence for Korf: https://www.prlib.ru/history/619564. Maslov’s exact office still needs a retained primary/biographical citation in the final content source rather than relying only on tertiary summaries.
-   **Q20 — Provisionally correct with wording cleanup; strengthen retained provenance.** Prefer «Какую карьеру сделал Владимир Вольховский после Лицея?» Key: **«Военную; дослужился до генерал-майора»**. Candidate distractors: **«Стал поэтом и издателем»**, **«Стал композитором и певцом»**, **«Стал адмиралом и полярным исследователем»**. The current supporting biography is secondary; retain a stronger institutional/archival source in the canonical fixture contract before promotion if one is available: https://www.hrono.ru/biograf/bio_we/volhovsky.php
-   **Q21 — Correct.** Key: **Александр Михайлович Горчаков**. Candidate distractors: **Модест Корф**, **Иван Малиновский**, **Фёдор Матюшкин**. Presidential Library gives Gorchakov’s dates as 1798–1883: https://www.prlib.ru/history/619314
-   **Q22 — Incorrect/ambiguous as written.** Dmitry Maslov was not the only listed lyceum student born in 1796; Ivan Malinovsky is also dated 1796. Recommended prompt: **«Кто из лицеистов, родившийся в 1796 году, впоследствии стал директором Департамента разных податей и сборов Министерства финансов?»** Key: **Дмитрий Маслов**. Candidate distractors: **Иван Малиновский**, **Александр Горчаков**, **Михаил Яковлев**. The final source contract must retain independent evidence for both birth-year and office claims.
-   **Q23 — Incorrect.** Sergey Lomonosov is dated **1799–1857**, not 1800; Modest Korf is dated 1800. Recommended replacement preserving the required pair-choice interaction: **«Кто из лицеистов родился в 1796 году? Назовите двоих.»** Correct pair: **Иван Малиновский и Дмитрий Маслов**. Candidate distractor pairs: **Сергей Ломоносов и Модест Корф**; **Антон Дельвиг и Александр Горчаков**; **Александр Корнилов и Модест Корф**. Lomonosov: https://my.tretyakov.ru/app/masterpiece/154380; Korf: https://www.prlib.ru/history/619564
-   **Q24 — Review-blocked; replacement recommended.** Alexander Kornilov’s 1801 birth is well supported, but reputable historical sources conflict on Konstantin Danzas’s birth year: the historical Russian Biographical Dictionary and Brockhaus/Efron give **1800**, while some museum material uses 1801. Because this is a scored single-choice item, the disputed birth year should not be used. Recommended replacement preserving pair-choice interaction: **«Какая пара лицеистов соответствует годам смерти 1870 и 1872 соответственно?»** Correct pair: **Константин Данзас и Фёдор Матюшкин**. Candidate distractor pairs: **Владимир Вольховский и Фёдор Матюшкин**; **Константин Данзас и Александр Горчаков**; **Александр Корнилов и Модест Корф**. Historical RBS evidence for Danzas 1800–1870: https://ru.wikisource.org/wiki/РБС/ВТ/Данзас,_Константин_Карлович
-   **Q25 — Correct.** Key: **1837**. Candidate distractors: **1831**, **1841**, **1846**. All-Russian Pushkin Museum materials consistently use Pushkin’s 1799–1837 dates: https://www.museumpushkin.ru/
-   **Q26 — Correct.** Key: **Алексей Демьянович Илличевский**. Candidate distractors: **Антон Дельвиг**, **Владимир Вольховский**, **Константин Данзас**. The Russian Biographical Dictionary records Illichevsky’s death in 1837: https://ru.wikisource.org/wiki/РБС/ВТ/Илличевский,_Алексей_Демьянович
-   **Q27 — Incorrect.** Alexander Kornilov was **1801–1856**, while Dmitry Maslov is given as **1796–1856**; only the death year coincides. Recommended prompt: **«Кто из лицеистов умер в том же 1856 году, что и Дмитрий Маслов?»** Key: **Александр Алексеевич Корнилов**. Candidate distractors: **Сергей Ломоносов**, **Константин Данзас**, **Александр Горчаков**. Kornilov biography: https://www.hrono.ru/biograf/bio_k/kornilov_alal.php
-   **Q28 — Correct key, incorrect age wording.** Replace **33** with **32**. Recommended prompt: **«Антон Дельвиг прожил всего 32 года. Назовите годы его жизни.»** Key: **1798–1831 гг.** Candidate distractors: **1797–1831 гг.**, **1798–1832 гг.**, **1799–1831 гг.** The Russian National Library gives 17 August 1798 – 26 January 1831 and explicitly reports death at age 32: https://nlr.ru/nlr_history/persons/info.php?id=41
-   **Q29 — Correct.** Key: **73 года**. Candidate distractors: **71 год**, **72 года**, **74 года**. The Russian Geographical Society states that Matyushkin died in 1872 at age 73, giving an institutional source for the scored age claim: https://rgo.ru/activity/redaction/articles/voln-i-bur-lyubimoe-ditya-kak-litseist-fedor-matyushkin-stal-moryakom-i-polyarnikom/
-   **Q30 — Correct after QA.** Key: **Константин Карлович Данзас**. Candidate distractors: **Владимир Вольховский**, **Фёдор Матюшкин**, **Александр Корнилов**. The All-Russian Pushkin Museum's Lyceum-sobriquet publication directly lists Danzas as **«Франт, Медведь»**, and historical/official museum material agrees that he died in 1870. The disputed 1800/1801 birth year does not affect this question. Sources: https://www.museumpushkin.ru/assets/files/pushkinsky_museum_2020.pdf and https://www.museumpushkin.ru/posetitelyam/poslednij_god_zhizni_pushkina/fevral_1837/8_fevralya_27_yanvarya_po_st._st.-_sreda.html

Summary for Q16–Q30: **Q16, Q18, Q21, Q25–26 and Q29–30 are usable after the noted cleanup; Q17 and Q20 retain working keys but should gain stronger retained provenance before canonical promotion; Q19, Q22, Q23 and Q27 require substantive correction; Q28 requires the age correction 33 → 32; Q24 should be replaced because the disputed Danzas birth year is unsuitable for a deterministic scored item.**

### Detailed correction/distractor register: Q1–Q15

The nickname-heavy first half was cross-checked against the All-Russian Pushkin Museum’s publication on Lyceum sobriquets, Culture.ru / Presidential Library biographies where applicable, the Russian Geographical Society, historical Pushkin/Lyceum scholarship, and source-bearing biographical notes. Several popular nickname lists merely copy one another, so the canonical source should retain the strongest evidence reference rather than the first search result.

-   **Q1 — Partially verified; narrow the scored fact.** Key: **Александр Пушкин**. Candidate distractors: **Вильгельм Кюхельбекер**, **Антон Дельвиг**, **Александр Горчаков**. The All-Russian Pushkin Museum’s sobriquet study directly documents **«Француз»** from Modest Korf’s memoirs, while **«Егоза»** was found only in weaker institutional/teaching material during the independent review. The canonical scored prompt should therefore ask only about **«Француз»** unless a stronger direct source for **«Егоза»** is retained. Sources: https://www.museumpushkin.ru/assets/files/pushkinsky_museum_2020.pdf and https://www.mgpu.ru/ko-dnyu-tsarskoselskogo-litseya/
-   **Q2 — Wording correction.** Use **«Кого в Лицее называли Тося?»** with key **Антон Дельвиг**; remove the source form **«Тосе»**, while **«Тосенька»** is also attested elsewhere. Candidate distractors: **Александр Пушкин**, **Вильгельм Кюхельбекер**, **Иван Пущин**. The Pushkin Museum sobriquet study explicitly gives **«Антон Дельвиг — Тося»**: https://www.museumpushkin.ru/assets/files/pushkinsky_museum_2020.pdf
-   **Q3 — Correct.** Key: **Фёдор Фёдорович Матюшкин**. Candidate distractors: **Константин Данзас**, **Александр Горчаков**, **Иван Малиновский**. The Russian Geographical Society describes **«Плыть хочется»** as the nickname given to Matyushkin by his school friends and connects it to his passion for the sea: https://rgo.ru/activity/redaction/articles/voln-i-bur-lyubimoe-ditya-kak-litseist-fedor-matyushkin-stal-moryakom-i-polyarnikom/
-   **Q4 — Provisionally correct; provenance review remains open.** Key: **Сергей Григорьевич Ломоносов**. Candidate distractors: **Михаил Яковлев**, **Модест Корф**, **Иван Малиновский**. Pushkin correspondence annotations preserve the attribution **«Крот»** to Lomonosov, but an independent content reviewer did not consider the collected citation chain strong enough for irreversible promotion into a scored canonical fixture. Keep the key as the working answer while requiring a stronger archive/museum/critical-edition citation before promotion: https://ru.wikisource.org/wiki/Переписка_с_В._Л._Пушкиным_(Пушкин)
-   **Q5 — Correct after QA.** Key: **Константин Карлович Данзас**. Candidate distractors: **Иван Малиновский**, **Александр Горчаков**, **Фёдор Матюшкин**. The All-Russian Pushkin Museum's Lyceum-sobriquet publication directly lists **«Константин Данзас — Франт, Медведь»**, so the nickname itself no longer needs a provenance block. His other recorded nickname **«Осада Данцига»** must not be used as a distractor because it also belongs to him: https://www.museumpushkin.ru/assets/files/pushkinsky_museum_2020.pdf
-   **Q6 — Correct.** Key: **Вильгельм Карлович Кюхельбекер**. Candidate distractors: **Антон Дельвиг**, **Иван Пущин**, **Михаил Яковлев**. The Pushkin Museum sobriquet study explicitly gives **«Вильгельм Кюхельбекер — Виля, Кюхля»**: https://www.museumpushkin.ru/assets/files/pushkinsky_museum_2020.pdf
-   **Q7 — Provisionally correct; keep a stronger-source gate.** Key: **Иван Васильевич Малиновский**. Candidate distractors: **Константин Данзас**, **Александр Горчаков**, **Сергей Ломоносов**. Pushkin/Lyceum scholarship and later biographical literature identify Malinovsky as the Lyceum **«Казак»**; Pushkin’s draft address «наш казак» is also associated with him. One independent review accepted the attribution while another requested stronger provenance, so the final canonical source should retain the strongest available scholarly/archival citation rather than treating secondary repetition as sufficient. Source-bearing scholarly text: https://imwerden.de/pdf/eydelman_pushkin_istoriya_i_sovremennost_1984_text.pdf
-   **Q8 — Correct key, but the distractor set must change.** Key: **Александр Михайлович Горчаков**. The scored prompt should explicitly tie **«Франт»** to attention to dress/appearance so the intended attribution is unique. Candidate distractors: **Александр Пушкин**, **Фёдор Матюшкин**, **Модест Корф**. **Do not use Константин Данзас as a distractor**, because independent nickname review found **«Франт»** also associated with Danzas in source material. Saint Petersburg State University biographical material records Gorchakov’s Lyceum nickname **«Франт»** and discusses the appearance/style context: https://pureportal.spbu.ru/files/11363771/EK_2018_Vlad_preview.pdf
-   **Q9 — Wording correction.** Prefer the historically attested nickname **«Паяс»** and key **Михаил Лукьянович Яковлев**; the source prompt’s **«Паяц»** is a modernized spelling and should not be treated as the canonical historical form. Candidate distractors: **Антон Дельвиг**, **Вильгельм Кюхельбекер**, **Иван Пущин**. Yakov Grot’s historical Lyceum study describes Yakovlev as a talented imitator who received the nickname **«паяса»**: https://ru.wikisource.org/wiki/Пушкинский_Лицей_(Грот)
-   **Q10 — Incorrect wording; substantive cleanup required.** The source phrase **«Наш Карамзин Маслависти»** improperly fuses separate attestations. Modest Korf wrote that at the Lyceum Maslov was called **«нашим Карамзиным»** for his pen and gift of expression; a much later 1841 letter by Yakovlev uses the jocular form **«Мусье Маслов Маслависти»**. Recommended prompt: **«Кого в Лицее называли “нашим Карамзиным”?»** Key: **Дмитрий Николаевич Маслов**. Candidate distractors: **Модест Корф**, **Михаил Яковлев**, **Сергей Ломоносов**. Korf text: https://litresp.ru/chitat/ru/К/korf-modest-andreevich/zapiski/25. The later “Маслависти” wording should be kept only in an explanatory note, not merged into the Lyceum nickname.
-   **Q11 — Correct, with a less evaluative prompt preferred.** The source’s **«Кто из лицеистов стал великим русским поэтом?»** clearly keys **Александр Сергеевич Пушкин**, but “great” is evaluative. Prefer **«Кто из этих лицеистов стал автором “Евгения Онегина” и одним из центральных русских поэтов XIX века?»** Key: **Александр Пушкин**. Candidate distractors: **Иван Пущин**, **Александр Горчаков**, **Фёдор Матюшкин**. The Museum-Lyceum overview identifies Pushkin as the first intake’s defining poet and describes his Lyceum literary formation: https://www.museumpushkin.ru/liceum_day/
-   **Q12 — Correct key, but the original prompt needs a unique discriminator.** Key: **Антон Антонович Дельвиг**. Candidate distractors: **Фёдор Матюшкин**, **Иван Пущин**, **Александр Горчаков**. Merely asking for a “poet/critic/journalist” can overlap with other literary figures, so the final single-choice prompt should include a distinctive documented fact such as Delvig’s editorial/publishing role while retaining the same key. Culture.ru records his critical articles/reviews and literary activity: https://www.culture.ru/persons/12746/anton-delvig
-   **Q13 — Correct key, but the original prompt needs a unique discriminator.** Key: **Иван Иванович Пущин**. Candidate distractors: **Александр Горчаков**, **Михаил Яковлев**, **Фёдор Матюшкин**. “Close friend of Pushkin and Decembrist” can be too broad for a deterministic single-choice item; the final prompt should include a Puschin-specific documented fact (for example the well-known Mikhailovskoye visit or his memoir connection) together with the Decembrist context. Presidential Library identifies Puschin as one of Pushkin’s closest Lyceum friends and a Decembrist: https://www.prlib.ru/history/619243
-   **Q14 — Correct key, but the original prompt needs a unique discriminator.** Key: **Вильгельм Карлович Кюхельбекер**. Candidate distractors: **Антон Дельвиг**, **Александр Горчаков**, **Сергей Ломоносов**. “Poet/writer/Decembrist” is not by itself a sufficiently exclusive single-choice description; the final prompt should retain a Küchelbecker-specific documented literary or biographical marker. Culture.ru and Presidential Library document him as a poet/dramatist and Decembrist who continued substantial literary work in imprisonment/exile: https://www.culture.ru/persons/9643/vilgelm-kyukhelbeker and https://www.prlib.ru/history/1338618
-   **Q15 — Correct, but sharpen the category.** Prefer **«Кто из выпускников Лицея стал выдающимся российским дипломатом и государственным деятелем, министром иностранных дел и канцлером?»** Key: **Александр Михайлович Горчаков**. Candidate distractors: **Антон Дельвиг**, **Фёдор Матюшкин**, **Михаил Яковлев**. The Great Russian Encyclopedia and Presidential Library identify Gorchakov as a Russian statesman, diplomat, foreign minister/chancellor: https://bigenc.ru/c/gorchakov-aleksandr-mikhailovich-996022 and https://www.prlib.ru/history/619314

Summary for Q1–Q15: **Q3, Q5 and Q6 are substantively usable as reviewed; Q1 should be narrowed to the strongly sourced «Француз» fact; Q4 and Q7 keep their working keys but require stronger retained provenance before fixture promotion; Q8 keeps the key but must replace Danzas as a distractor and make the “Франт” context explicit; Q2 and Q9 require wording normalization; Q11 and Q15 should be made more objective/specific; Q12–Q14 need unique single-choice discriminators; Q10 requires a substantive correction because the source combines two distinct historical formulations into one supposed Lyceum nickname.**

## Conflicts And Uncertainty

-   The source quiz contains multiple confirmed or material content problems, not only Q27/Q28: Q10 conflates two Maslov formulations; Q19 uses a false “exclusively” characterization; Q22 is ambiguous; Q23 contains a wrong birth year; Q24 relies on a disputed Danzas birth year; Q27 contradicts Kornilov’s biography; Q28 gives the wrong age. In addition, Q1/Q4/Q7/Q17/Q20 carry evidence-strength/editorial gates, Q8 has an invalid Danzas distractor, and Q12–Q14 need more exclusive single-choice wording. Q5/Q30's Danzas nickname is now directly supported by the institutional Pushkin Museum source.
-   1EdTech QTI is used only as a conceptual precedent. Universo’s block contract is repository-native and should not claim QTI import/export or conformance.
-   The exact physical attempt fields for phase, frozen remaining time, and block snapshot are a PLAN decision. The semantic invariants are settled: explicit persisted phase, snapshotted policies/membership, and one server-authoritative effective-time model.
-   A paused timed attempt must be distinguishable from an untimed attempt. Using only `deadlineAt = null` as the discriminator would be ambiguous.
-   The first block introduction should count as an already-started attempt under the user’s acceptance journey: the timer runs as soon as the learner enters the test by default. PLAN should preserve that interpretation.
-   The current fixture count observed by the read-only review is seven quizzes and nine AccessLinks; for this canonical generator baseline, adding exactly one “Sixth Muse” quiz and one ordinary AccessLink makes the expected aggregate exactly eight quizzes and ten AccessLinks. The generator/fixture contract should own that expectation and require an explicit contract update if another dataset is intentionally added later.

## Project Implications

Likely implementation surface for PLAN:

-   LMS template metadata: quiz block TABLE, question membership, timer/numbering policy, attempt persisted phase/time/snapshot components;
-   template/schema validators and fixture-envelope validation, including stable semantic fixture identities and the deterministic balanced correct-position schedule;
-   applications backend attempt snapshot/parser, public DTO projection, start/resume/get/answer/finalize lifecycle, revision-bound Continue transition, centralized effective-time interpretation, timeout reconciliation, persistence/store mapping, and report reconciliation;
-   apps-template-mui guest runtime types, normalization, attempt hook/state machine, block-intro UI, timer rendering, phase-aware focus/keyboard/i18n, and exact progress semantics;
-   metadata-driven quiz authoring for block CRUD/reorder/membership with no raw IDs/JSON/technical order; PLAN must add or compose the currently missing sibling-row selector and keyboard-accessible TABLE reorder capability;
-   separate Sixth Muse source/contract and normal LMS generator/export, with `ConfirmAnswerBeforeNext=false`, stable keys/slug, and exact current-baseline aggregate/order assertions;
-   Jest/Vitest/integration/Playwright tests and EN/RU documentation/screenshots.

No historical data migration or legacy compatibility layer is required for the disposable test database requested by the user. That does not remove the need to define the fresh canonical persistence/metadata fields used by new applications. The user also explicitly requested no database-schema or metahub-template version bump for this work.

## Recommended Decision

Proceed to PLAN using one canonical extension of the existing LMS metadata and guest-attempt state machine:

1. add optional ordered quiz blocks with a declared stable semantic `BlockKey`;
2. keep global question order as the single ordering source;
3. snapshot blocks, membership/order, and timer/numbering policies at attempt start, and ensure resume reconstruction does not depend on mutable source question/block data;
4. keep one `QuizAttempt`, with an explicit persisted active phase;
5. implement Continue as an attempt-locked compare-and-transition mutation bound to an expected public phase revision so duplicate and stale replays cannot skip later intros;
6. make answer submission phase-aware and atomically enter/freeze the next block intro after the previous block's final persisted answer;
7. implement pause-on-intro as a precise server-authoritative effective-time freeze/resume behind one canonical interpretation shared by every lifecycle/reporting path;
8. make the fresh persistence/config mapping fail closed if the required phase/timer fields are incomplete, and record timeout completion at the effective expiry instant;
9. treat block-relative numbering as presentation while keeping global progress/scoring and accessible progress semantics global;
10. provide structured authoring through reusable MUI/runtime primitives, explicitly solving the current sibling-TABLE selector and reorder gaps without raw technical fields or LMS-codename forks;
11. keep the seven existing quizzes flat and unchanged by default;
12. add “Sixth Muse” as a separate validated fixture source with stable semantic identities, deterministic balanced authored option positions, and `ConfirmAnswerBeforeNext=false`, then regenerate the shared LMS snapshot through the supported generator;
13. retain secure per-attempt option randomization and persisted option order for learner delivery;
14. treat WCAG SC 2.2.1 as an explicit deployment/product gate: the repository currently has no evidenced per-participant extra-time override, so PLAN must either design one where required or document the applicable timing exception;
15. block fixture promotion on unresolved historical facts, insufficient evidence, or ambiguous distractors.

## Open Questions Before PLAN

No product-architecture question blocks PLAN. PLAN still needs to choose the exact canonical persistence shape for the attempt snapshot/phase/frozen-time state, the public transition-revision representation, and the reusable authoring mechanism for sibling-row selection/reorder, but the required semantics and quality gates are defined above.

Content promotion is a separate gate: any per-question row in the final correction/distractor register that remains uncertain must be resolved before the generated snapshot is accepted as canonical.

## Sources

-   https://www.w3.org/TR/WCAG22/#timing-adjustable
-   https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable
-   https://www.1edtech.org/standards/qti/index
-   https://playwright.dev/docs/clock
-   https://v3.zod.dev/
-   https://www.museumpushkin.ru/assets/files/pushkinsky_museum_2020.pdf
-   https://www.museumpushkin.ru/
-   https://www.museumpushkin.ru/liceum_day/
-   https://www.museumpushkin.ru/posetitelyam/poslednij_god_zhizni_pushkina/fevral_1837/8_fevralya_27_yanvarya_po_st._st.-_sreda.html
-   https://www.mgpu.ru/ko-dnyu-tsarskoselskogo-litseya/
-   https://rgo.ru/activity/redaction/articles/voln-i-bur-lyubimoe-ditya-kak-litseist-fedor-matyushkin-stal-moryakom-i-polyarnikom/
-   https://www.prlib.ru/history/619564
-   https://www.prlib.ru/history/619243
-   https://www.prlib.ru/history/619314
-   https://www.prlib.ru/history/1338618
-   https://nlr.ru/nlr_history/persons/info.php?id=41
-   https://my.tretyakov.ru/app/masterpiece/154380
-   https://www.culture.ru/persons/12746/anton-delvig
-   https://www.culture.ru/persons/9643/vilgelm-kyukhelbeker
-   https://bigenc.ru/c/gorchakov-aleksandr-mikhailovich-996022
-   https://ru.wikisource.org/wiki/РБС/ВТ/Данзас,_Константин_Карлович
-   https://ru.wikisource.org/wiki/РБС/ВТ/Илличевский,_Алексей_Демьянович
-   https://ru.wikisource.org/wiki/Переписка_с_В._Л._Пушкиным_(Пушкин)
-   https://ru.wikisource.org/wiki/Пушкинский_Лицей_(Грот)
-   https://imwerden.de/pdf/eydelman_pushkin_istoriya_i_sovremennost_1984_text.pdf
-   https://pureportal.spbu.ru/files/11363771/EK_2018_Vlad_preview.pdf
-   https://litresp.ru/chitat/ru/К/korf-modest-andreevich/zapiski/25
-   https://www.musenc.ru/html/8/8kovlev.html
-   https://www.hrono.ru/biograf/bio_we/volhovsky.php
-   https://www.hrono.ru/biograf/bio_k/kornilov_alal.php
