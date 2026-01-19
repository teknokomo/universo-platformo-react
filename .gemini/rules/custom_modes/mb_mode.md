---
description: 'If the user message starts with MB'
---

When the user writes **MB**, you switch to **MB (Memory Bank Compression) mode**.
This mode compresses Memory Bank files to optimal size while preserving all critical information.
Continue following your **base prompt**, and augment with the instructions below.

**Role & Context:** You are now in **MB (Memory Bank Compression) mode**, acting as a **Knowledge Curator**. Your task is to compress Memory Bank documentation per the strategies defined in `.gemini/rules/memory-bank-compression.md`.

**Steps to Follow:**

1. **Start with "OK MB"** to confirm Memory Bank Compression mode.

2. **Load Compression Instructions**:
   - Read `.gemini/rules/memory-bank-compression.md`
   - Read `.gemini/rules/memory-bank.md` (file structure rules)
   - Understand target sizes, compression strategies, validation rubric

3. **Diagnostic Phase** (5 min):
   - Check current line counts for Memory Bank files
   - Linux/Mac command:
     ```bash
     wc -l memory-bank/{activeContext,tasks,progress,systemPatterns}.md
     ```
   - Windows PowerShell command:
     ```powershell
     Get-ChildItem memory-bank\*.md | ForEach-Object {
       [PSCustomObject]@{File=$_.Name; Lines=(Get-Content $_.FullName | Measure-Object -Line).Lines}
     } | Format-Table -AutoSize
     ```
   - Identify files exceeding targets (per compression instructions)
   - Log diagnostic results: `[MB Compression] Diagnostic: file.md XXX lines (target: YYY)`
   - Skip files already within limits

4. **Backup Phase** (2 min):
   - Create timestamped backups for files needing compression:
     ```
     activeContext.md.backup-20251104
     tasks.md.backup-20251104
     progress.md.backup-20251104
     systemPatterns.md.backup-20251104
     ```
   - Verify backups created successfully
   - Log: `[MB Compression] Backups created: [list files]`

5. **GitHub Releases Update** (3 min):
   - Fetch latest releases via GitHub API:
     ```
     GET https://api.github.com/repos/teknokomo/universo-platformo-react/releases
     ```
   - Parse: tag_name, published_at (format YYYY-MM-DD), name, body (first paragraph)
   - Update version table at top of progress.md (preserve existing format)
   - **Fallback** if API fails: Keep existing table + add HTML comment with error
   - Verify table formatting valid

6. **Sequential Compression** (30-45 min):
   - Process files in order: **activeContext → tasks → progress → systemPatterns**
   - Apply file-specific strategies from compression instructions:
     * **activeContext.md** (target ≤100 lines):
       - Current focus only (3-5 bullets)
       - Archive "Previous Focus" to progress.md
       - Remove implementation details
     * **tasks.md** (target ≤500 lines):
       - Keep all `[ ]` unchecked tasks
       - Condense completed tasks (last 2 months)
       - Archive older tasks to progress.md
     * **progress.md** (target ≤500 lines):
       - PRESERVE version table at top
       - Keep last 3 months full
       - Condense 3-6 months (50% reduction)
       - Archive >6 months (90% reduction)
     * **systemPatterns.md** (target ≤500 lines):
       - Keep CRITICAL patterns in full
       - Condense code examples (1 per pattern)
       - Merge similar sub-patterns
   - Follow deletion/condensation/preservation rules from compression instructions
   - Maintain **English language** requirement (no Russian text)

7. **Cross-Reference Validation** (5 min):
   - Verify all internal links work: `[text](file.md#anchor)`
   - Common patterns:
     * `Details: progress.md#YYYY-MM-DD-feature-name`
     * `Pattern: systemPatterns.md#pattern-name`
   - Fix broken anchors (update section names if changed)
   - Ensure all cross-file references valid

8. **Self-Validation & Iteration** (10-15 min):
   - Apply 10-point validation rubric from compression instructions:
     1. **Size Compliance** (2 pts): All files within target limits
     2. **Information Preservation** (2 pts): CRITICAL patterns preserved, no data loss
     3. **Structure Compliance** (2 pts): Follows memory-bank.md rules
     4. **DRY Compliance** (2 pts): No duplication across files
     5. **Markdown Quality** (2 pts): Valid formatting, working links
   - Log initial score: `[MB Compression] Initial score: X/10`
   - **If score < 10**:
     * Identify failing criteria (which of 5 categories)
     * Compare with backups (check for lost critical info)
     * Fix issues by priority: preservation → structure → size → DRY → markdown
     * Re-assess score
   - **Loop max 3 iterations**
   - **If stuck at <10 after 3 cycles**: Escalate to user for guidance

9. **Backup Cleanup** (1 min):
   - **ONLY IF final score = 10/10**:
     * Delete all `.backup-YYYYMMDD` files
     * Log: `[MB Compression] Backups removed (compression successful)`
   - **IF score < 10**:
     * Keep backups for user review
     * Report issues and await user decision

10. **Final Report** (2 min):
    - Present compression summary (use format from compression instructions):
      ```markdown
      ## Memory Bank Compression Report

      **Files Compressed**:
      - activeContext.md: XXX → YYY lines (-ZZ.Z%)
      - tasks.md: XXX → YYY lines (-ZZ.Z%)
      - progress.md: XXX → YYY lines (-ZZ.Z%)
      - systemPatterns.md: XXX → YYY lines (-ZZ.Z%)

      **GitHub Releases**: [Updated/Failed/Kept existing]

      **Final Validation Score**: X/10
      - Size Compliance: X/2
      - Information Preservation: X/2
      - Structure Compliance: X/2
      - DRY Compliance: X/2
      - Markdown Quality: X/2

      **Backup Files**: [Removed/Kept for review]
      ```
    - State next steps: "Memory Bank optimized. Ready for continued development."

**Important Notes:**
- Follow compression strategies from `.gemini/rules/memory-bank-compression.md` **exactly**
- Follow file structure rules from `.gemini/rules/memory-bank.md`
- Write all content in **English** (Memory Bank language requirement)
- **DO NOT compress** files in `memory-bank/reflection/` directory
- **DO NOT modify** `implementation-plan.md` or `rls-integration-pattern.md`
- Default: Compress only 7 core files unless user specifies others
- Safety: Max 3 iteration cycles, then user escalation if needed

**Quality Check Before Finalizing:**
- [ ] All files within target line counts
- [ ] All CRITICAL patterns preserved (7 patterns from compression instructions)
- [ ] GitHub Releases table updated and at top of progress.md
- [ ] All internal links valid (`[text](file.md#anchor)` working)
- [ ] No Russian/non-English text introduced
- [ ] Validation score = 10/10
- [ ] Backups cleaned up (if successful)
