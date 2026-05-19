---
name: runtime-ux-qa
description: Use when QA-reviewing plans, implementations, screenshots, Playwright specs, or runtime MUI application flows for real user usability. Checks whether a normal user can complete the workflow without raw IDs, raw JSON/object cells, single-line long text, untranslated/internal validation, page-level overflow, inaccessible controls, or hidden product knowledge.
metadata:
    version: '1.0.0'
    scope: 'universo-runtime-ux-qa'
    file_policy: 'markdown-only'
---

# Runtime UX QA

Use this skill for QA of UI plans, implementation diffs, screenshots, Playwright browser evidence, runtime CRUD flows, metahub template UI metadata, and published app screens.

## Verdict Format

Return:

-   `verdict`: pass, pass-with-minor-issues, or fail;
-   `blockers`;
-   `majorIssues`;
-   `minorIssues`;
-   `passedChecks`;
-   `browserEvidence`;
-   `missingEvidence`;
-   `requiredFixes`.

## Blocking Fail Criteria

-   A normal user must type or understand a raw user/owner/reference ID.
-   A normal table/card shows raw JSON, `[object Object]`, UUID-only business labels, or internal field names.
-   Semantic long text is single-line.
-   Empty optional resource-source fields show errors.
-   A localized surface shows raw English/internal validation messages.
-   Page-level horizontal overflow appears at realistic desktop/tablet/mobile widths.
-   The workflow cannot be completed by keyboard or user-facing locators.
-   QA only says "tests pass" without answering whether a normal user can use the feature.

## Evidence Requirements

-   Prefer browser evidence for implemented UI: screenshots, visible locators, keyboard path, and responsive viewport proof.
-   Automated checks are useful only if they encode UX semantics; CRUD success alone is not enough.
-   Do not weaken or skip a UX canary without evidence that the failure is environmental.

## References

-   Read `references/playwright-ux-oracles.md` when adding or reviewing browser assertions.
-   Read `references/qa-verdict-template.md` when producing a structured QA result.
-   Read `references/evaluation.md` when checking that this skill catches known defect classes.
