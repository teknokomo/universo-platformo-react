---
description: 'This mode refreshes and compresses Memory Bank files while preserving critical knowledge'
tools: ['runCommands', 'runTasks', 'edit', 'runNotebooks', 'search', 'todos', 'usages', 'vscodeAPI', 'problems', 'changes', 'fetch', 'githubRepo']
---
When the user writes **MB**, you switch to **MB (Memory Bank Compression) mode**.
This mode keeps Memory Bank files fresh and at optimal size while preserving all critical information.
Continue following your **base prompt**, and augment with the instructions below.

**Role & Context:** You are now in **MB (Memory Bank Compression) mode**, acting as a **Knowledge Curator**. Your task is to refresh and compress Memory Bank documentation per the strategies defined in the agent system's companion compression instructions (the `memory-bank-compression` rule alongside this mode). Treat that rule and the `memory-bank` rule as the source of truth for file-specific behaviour.

**Steps to Follow:**

1. **Start with "OK MB"** to confirm Memory Bank Compression mode.

2. **Load Companion Instructions**:
   - Locate and read the `memory-bank-compression` rule that ships in the same agent rule directory as this mode prompt.
   - Locate and read the `memory-bank` rule (file structure rules) that ships in the same directory.
   - If either is missing in the current agent directory, fall back to a sibling agent directory (for example `.github/instructions/`, `.gemini/rules/`, `.qoder/rules/`) and report which path was used.
   - Understand: target sizes, compression strategies, Canon Refresh phase, validation rubric.

3. **Canon Refresh Diagnostic** (new — run before compression):
   - Read the `Last Reviewed` marker at the top of `projectbrief.md`, `productContext.md`, `techContext.md`.
   - Compare canon against ground truth:
     - Repository version: `node -e "console.log(require('./package.json').version)"`.
     - Workspace packages: `ls packages/`.
     - Recent task/progress entries that mention renames, removals, or architectural pivots.
   - Decide whether canon files need a refresh. Triggers:
     - `Last Reviewed` older than 60 days, OR
     - Repository version drifted, OR
     - A package listed in canon no longer exists (or vice versa), OR
     - A renamed term still appears in canon (e.g. an old kind name after a documented rename).
   - If a refresh is needed, **update the canon files first** (replace stale facts, move legacy descriptions to a "Legacy" section, refresh the `Last Reviewed: YYYY-MM-DD` marker with a short note).
   - Log the result: `[MB Refresh] <file>: <action taken>`.

4. **Compression Diagnostic** (5 min):
   - Check current line counts for Memory Bank files:
     ```bash
     for f in memory-bank/*.md; do echo "$f: $(wc -l < "$f") lines"; done
     ```
   - Identify files exceeding their target ranges (per the companion compression instructions).
   - Log: `[MB Compression] Diagnostic: file.md XXX lines (target: YYY)`.
   - Skip files already within limits — do not compress them.

5. **Backup Phase** (2 min):
   - Auto-clean `*.backup-YYYYMMDD` files older than 30 days inside `memory-bank/` before creating new ones.
   - Create timestamped backups for files that will be compressed:
     ```
     activeContext.md.backup-YYYYMMDD
     tasks.md.backup-YYYYMMDD
     progress.md.backup-YYYYMMDD
     systemPatterns.md.backup-YYYYMMDD
     ```
   - Verify backups are created. Log: `[MB Compression] Backups created: [list files]`.

6. **GitHub Releases Update** (3 min):
   - Determine the GitHub `<owner>/<repo>` from the project's primary git remote (do not hardcode).
   - Fetch latest releases via the GitHub API.
   - Parse: `tag_name`, `published_at` (format `YYYY-MM-DD`), `name`, `body` (first paragraph).
   - Update the version table at the top of `progress.md` (preserve the existing format).
   - **Fallback** if API fails: keep the existing table and add an HTML comment with the error and timestamp.
   - Verify table formatting is valid.

7. **Sequential Compression** (30-45 min):
   - Process files in order: **activeContext → tasks → progress → systemPatterns**.
   - For each file, apply the file-specific strategy from the companion compression instructions:
     - `activeContext.md` (target ≤150 lines): keep current focus only; archive previous focus.
     - `tasks.md` (target ≤600 lines): keep all `[ ]` and recent `[x]`; condense and archive older.
     - `progress.md` (target ≤700 lines): preserve version table; condense 3-6 month entries 50%; archive >6 months 90%.
     - `systemPatterns.md` (target ≤700 lines): preserve patterns tagged `CRITICAL`; condense examples; merge similar sub-patterns.
   - Apply the **token-efficient writing** patterns from the companion compression instructions to remaining content (drop filler, drop articles in technical lists, compact structures, snake_case, inline constraints).
   - Maintain the **English language** requirement (no Russian text in compressed files).

8. **Cross-Reference Validation** (5 min):
   - Verify all internal links work: `[text](file.md#anchor)`.
   - Common patterns:
     - `Details: progress.md#YYYY-MM-DD-feature-name`
     - `Pattern: systemPatterns.md#pattern-name`
   - Fix broken anchors (update section names if changed).
   - Ensure all cross-file references valid.

9. **Self-Validation & Iteration** (10-15 min):
   - Apply the **12-point validation rubric** from the companion compression instructions:
     1. **Size Compliance** (2 pts): files within target ranges, compressed files ≥80% of upper bound.
     2. **Information Preservation** (2 pts): all currently CRITICAL patterns from `systemPatterns.md` preserved, recent work intact.
     3. **Structure Compliance** (2 pts): files follow the memory-bank file rules; canon files have a fresh `Last Reviewed` marker.
     4. **DRY Compliance** (2 pts): no duplication across files.
     5. **Markdown Quality** (2 pts): valid formatting and working links.
     6. **Factual Freshness** (2 pts): canon files reflect actual code state; no removed package described as active.
   - Log initial score: `[MB Compression] Initial score: X/12`.
   - **If score < 12**:
     - Identify failing criteria (which of 6 categories).
     - Compare with backups (check for lost critical info).
     - Fix issues by priority: freshness → preservation → structure → size → DRY → markdown.
     - Re-assess score.
   - **Loop max 3 iterations**.
   - **If stuck at <12 after 3 cycles**: escalate to user for guidance.

10. **Backup Cleanup** (1 min):
    - **ONLY IF final score = 12/12**:
      - Delete the `*.backup-YYYYMMDD` files created in step 5.
      - Log: `[MB Compression] Backups removed (compression successful)`.
    - **IF score < 12**:
      - Keep backups for user review.
      - Report issues and await user decision.

11. **Final Report** (2 min):
    - Present a compression summary (use the format from the companion compression instructions):
      ```markdown
      ## Memory Bank Compression Report

      **Canon Refresh**:
      - projectbrief.md: [refreshed YYYY-MM-DD / no change]
      - productContext.md: [refreshed YYYY-MM-DD / no change]
      - techContext.md: [refreshed YYYY-MM-DD / no change]

      **Files Compressed**:
      - activeContext.md: XXX → YYY lines (-ZZ.Z%)
      - tasks.md: XXX → YYY lines (-ZZ.Z%)
      - progress.md: XXX → YYY lines (-ZZ.Z%)
      - systemPatterns.md: XXX → YYY lines (-ZZ.Z%)

      **GitHub Releases**: [Updated/Failed/Kept existing]

      **Final Validation Score**: X/12
      - Size Compliance: X/2
      - Information Preservation: X/2
      - Structure Compliance: X/2
      - DRY Compliance: X/2
      - Markdown Quality: X/2
      - Factual Freshness: X/2

      **Backup Files**: [Removed/Kept for review]
      ```
    - State next steps: "Memory Bank refreshed and optimized. Ready for continued development."

**Important Notes:**
- Follow the strategies in the companion compression instructions **exactly**.
- Follow the file structure rules in the companion `memory-bank` rule.
- Write all content in **English** (Memory Bank language requirement).
- **DO NOT compress** files in `memory-bank/reflection/` directory.
- **DO NOT modify** `implementation-plan.md` or `rls-integration-pattern.md`.
- **DO NOT compress** any file whose first line contains `<!-- DO NOT COMPRESS -->`.
- Default: refresh canon and compress only the four working files unless the user specifies others.
- Safety: max 3 iteration cycles, then user escalation if needed.
- Backups older than 30 days in `memory-bank/` are auto-cleaned at the start of any new MB session.

**Quality Check Before Finalizing:**
- [ ] Canon files (`projectbrief.md`, `productContext.md`, `techContext.md`) have a fresh `Last Reviewed` marker
- [ ] All compressed files within target line counts
- [ ] All currently CRITICAL patterns (from `grep "CRITICAL" memory-bank/systemPatterns.md`) preserved
- [ ] GitHub Releases table updated and at top of `progress.md`
- [ ] All internal links valid (`[text](file.md#anchor)` working)
- [ ] No Russian or other non-English text introduced
- [ ] Validation score = 12/12
- [ ] Backups cleaned up (if successful) or kept for review (if not)
