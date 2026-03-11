---
description: 'Compression strategies and validation rules for Memory Bank files'
---

# Memory Bank Compression Instructions

## Compression Objectives

**Core Principles:**

1. **Information Density**: Maximize knowledge per line
2. **Zero Loss**: Preserve all critical technical information
3. **DRY Compliance**: Eliminate duplication across files
4. **Structural Integrity**: Maintain file-specific focus per memory-bank.md
5. **Traceability**: Always provide links to detailed sources

**Target Ranges:**

-   `activeContext.md`: 100-150 lines (focus: current work only)
-   `tasks.md`: 500-600 lines (focus: active + recent tasks)
-   `progress.md`: 600-700 lines (focus: version table + 3-month history)
-   `systemPatterns.md`: 600-700 lines (focus: reusable patterns)
-   `techContext.md`: 300-400 lines (usually within range)
-   `productContext.md`: 300-400 lines (usually within range)
-   `projectbrief.md`: 300-400 lines (usually within range)

---

## CRITICAL: Compression Trigger Rules

**IMPORTANT**: Compression is NOT automatic. Apply compression ONLY when needed.

### When to Compress (Trigger Conditions)

**DO Compress**:

-   File exceeds its target range upper bound (see Target Ranges above)
-   User explicitly requests compression

**DO NOT Compress**:

-   File is already WITHIN the target range (at or below the upper bound)
-   If a file does not exceed the maximum values above, do NOT compress it
-   Example: `tasks.md` at 541 lines with 600-line max → NO compression needed

### Minimum Size After Compression

**Rule**: After compression, file size must be at least **80% of the target range upper bound**.

| File                | Target Range | Minimum After Compression |
| ------------------- | ------------ | ------------------------- |
| `activeContext.md`  | 100-150      | ≥120 lines                |
| `tasks.md`          | 500-600      | ≥480 lines                |
| `progress.md`       | 600-700      | ≥560 lines                |
| `systemPatterns.md` | 600-700      | ≥560 lines                |
| `techContext.md`    | 300-400      | ≥320 lines                |
| `productContext.md` | 300-400      | ≥320 lines                |
| `projectbrief.md`   | 300-400      | ≥320 lines                |

**Rationale**: Over-compression loses valuable historical context. Memory Bank should retain enough detail to be useful for future AI sessions.

### Compression Decision Flowchart

```
1. Check file size
   ↓
2. Is file > upper bound?
   ├─ NO → Skip compression (file is healthy)
   └─ YES → Continue to step 3
   ↓
3. Calculate compression target:
   - Upper bound: target range max (e.g., 600)
   - Lower bound: 80% of upper bound (e.g., 480)
   ↓
4. Compress to fit within [lower bound, upper bound]
   - Prioritize keeping recent content (last 3 months)
   - Remove oldest detailed entries first
   - Never go below minimum threshold
```

### Pre-Compression Diagnostic

Before any compression work, run diagnostic:

```bash
wc -l memory-bank/{activeContext,tasks,progress,systemPatterns}.md
```

Report which files need compression:

-   ✅ Within range → "No compression needed"
-   ⚠️ Exceeds max → "Compression required (current: X, max: Y)"

---

## GitHub Releases Table Actualization

**Location**: Top of `progress.md` (before all other content)

**API Endpoint**:

```
GET https://api.github.com/repos/teknokomo/universo-platformo-react/releases
```

**Required Fields**:

-   `tag_name` → Release column
-   `published_at` → Date column (format: YYYY-MM-DD)
-   `name` → Codename column
-   `body` (first paragraph) → Highlights column

**Table Format** (preserve exactly):

```markdown
| Release      | Date       | Codename       | Highlights                     |
| ------------ | ---------- | -------------- | ------------------------------ |
| 0.34.0-alpha | 2025-10-23 | Black Hole ☕️ | Global monorepo refactoring... |
```

**Fallback Strategy**:
If API fails (rate limit, network error, authentication):

1. Keep existing table unchanged
2. Add HTML comment after table:
    ```markdown
    <!-- Last auto-update attempt: YYYY-MM-DD HH:MM, Status: [error message] -->
    ```
3. Continue with compression workflow
4. Report API failure in final summary

---

## File-Specific Compression Strategies

### 1. activeContext.md (Target: 100-150 lines)

**Purpose**: Track ONLY current focus (what AI is working on RIGHT NOW)

**Compression Rules**:

**DELETE Completely**:

-   All "Previous Focus" sections older than 1 week
-   Detailed implementation logs (move summaries to progress.md)
-   Completed work fully documented in progress.md
-   Build verification details (keep outcome only)
-   File modification lists (keep counts only: "Modified N files")

**CONDENSE to 3-5 bullets**:

-   Current Focus section → key achievements + next step
-   Each bullet: 1 line max
-   Format:
    ```markdown
    ## Current Focus: [Feature] - [Status]

    -   Fixed [issue] via [solution] (YYYY-MM-DD)
    -   Completed [task], affected N files
    -   Next: [immediate action required]
    ```

**PRESERVE**:

-   Current blockers (if any)
-   Immediate next steps (if work in progress)
-   Critical context for ongoing work

**ARCHIVE to progress.md**:

-   Move "Previous Focus" summaries to progress.md if not there
-   Keep only completion date + 1-line outcome

---

### 2. tasks.md (Target: 500-600 lines)

**Purpose**: Track active tasks and recent completions (working document)

**Compression Rules**:

**KEEP Unchanged**:

-   All `[ ]` unchecked tasks (active work)
-   All `[x]` tasks from last 14 days
-   Task hierarchy (sections like "🔥 CRITICAL", "Phase 1", etc.)
-   Checklists for ongoing work

**CONDENSE (Last 2 months)**:

-   Completed tasks 15-60 days old → summary format:
    ```markdown
    ## [Feature Name] - Complete ✅ (YYYY-MM-DD)

    -   Main outcome 1 (1 line)
    -   Main outcome 2 (1 line)
    -   Details: progress.md#YYYY-MM-DD-feature-name
    ```
-   Remove verbose "Files Modified" lists → "Modified N files"
-   Remove detailed implementation steps → keep outcomes only
-   Remove build logs → "Build: ✅ All packages successful"

**ARCHIVE to progress.md** (>2 months old):

-   Move entire completed task sections to progress.md
-   Replace with single reference line:
    ```markdown
    ## [2025-08] Historical Tasks ✅

    -   See progress.md for completed tasks before 2025-09
    ```

**REMOVE Completely**:

-   Duplicate pattern descriptions (link to systemPatterns.md instead)
-   Obsolete/cancelled tasks marked as deprecated
-   Temporary debugging tasks (if issue resolved)

---

### 3. progress.md (Target: 600-700 lines)

**Purpose**: Chronological log of completed work (permanent record)

**CRITICAL**: Version history table MUST remain at top, unchanged

**Compression Rules**:

**PRESERVE Unchanged**:

-   Version history table (all releases)
-   Section: "## ⚠️ IMPORTANT: Version History Table"
-   Last 3 months of entries (full detail)

**CONDENSE 50%** (3-6 months old):

-   Remove "Files Modified" detailed lists → "Modified N files (X backend, Y frontend)"
-   Remove verbose "What was completed" paragraphs → bullet list
-   Remove duplicate pattern descriptions → "Pattern: systemPatterns.md#link"
-   Remove build verification details → "Build: ✅ Success (Xm Ys)"
-   Keep dates, outcomes, critical metrics

**ARCHIVE 90%** (>6 months old):

-   Major features → 1-2 lines summary:
    ```markdown
    ### 2025-MM-DD: [Feature Name] ✅

    -   [Main outcome]. Files: N. Pattern: systemPatterns.md#link
    ```
-   Group by month if multiple small features:
    ```markdown
    ### 2025-MM: [Month Name] Summary ✅

    -   Feature A (outcome)
    -   Feature B (outcome)
    ```

**REMOVE Completely**:

-   Duplicate sections (merge if content overlaps)
-   Temporary notes marked as "TODO" (if already done)
-   Broken reference links (fix or remove)

**Chronological Order**: Newest first, oldest last

---

### 4. systemPatterns.md (Target: 600-700 lines)

**Purpose**: Reusable architectural patterns and best practices

**Compression Rules**:

**KEEP Full**:

-   Pattern titles (all)
-   Core rule descriptions (what, why, when)
-   CRITICAL patterns (preserve in detail):
    -   Source-Only Package PeerDependencies
    -   RLS Integration Pattern
    -   i18n Architecture
    -   Universal List Pattern
    -   React StrictMode Pattern

**CONDENSE**:

-   Code examples → 1 representative snippet (remove variations)
-   Remove "Before/After" duplicate examples → keep 1 illustrative pair
-   "Why This Matters" → 1-2 sentences if not self-evident
-   Detection checklists → command examples only
-   Common symptoms → bullet list (remove paragraphs)

**MERGE**:

-   Similar sub-patterns into parent pattern
-   Example: Pagination sub-patterns → single "Pagination Patterns" section

**SHORTEN**:

-   Historical bug examples → git reference:
    ```markdown
    **Example**: See git commit abc123 (YYYY-MM-DD) for [bug name] fix
    ```
-   Verification checklists → essential steps only

**EXTERNAL LINKS**:

-   Replace long React/TypeScript explanations → official docs links
-   Example: "See [React docs](https://react.dev/...)" instead of long explanation

**Standard Pattern Structure**:

```markdown
## [Pattern Name] [(CRITICAL)]

**Rule**: [One sentence core rule]
**Required**: [List of required components/configs]
**Detection**: `[command to find violations]`
**Symptoms**: [Bullet list of common errors]
**Fix**: [One code example or git reference]
**Why**: [1-2 sentences if not obvious]
```

---

## Validation Rubric (10-Point Scale)

**Scoring System** (2 points each criterion):

### 1. Size Compliance (2 pts)

✅ **2 points**: All criteria met:

-   Files within target ranges (at or below upper bound)
-   Compressed files ≥80% of upper bound (lower bound) — no over-compression
-   Files already within range were NOT unnecessarily compressed

⚠️ **1 point**:

-   1 file slightly over upper bound (<20% over) OR
-   1 file over-compressed (<80% of upper bound but >60%)

❌ **0 points**:

-   2+ files over upper bound OR any file >20% over OR
-   Any file over-compressed to <60% of upper bound OR
-   Unnecessary compression of files already within ranges

---

### 2. Information Preservation (2 pts)

✅ **2 points**: All criteria met:

-   All CRITICAL patterns preserved (see checklist below)
-   Recent work (last 3 months) fully documented
-   Version history table intact and updated
-   No critical technical data lost vs backups

⚠️ **1 point**: Missing 1-2 non-critical items
❌ **0 points**: Missing 3+ items OR any CRITICAL pattern lost

**CRITICAL Patterns Checklist**:

-   [ ] Source-Only Package PeerDependencies
-   [ ] RLS Integration Pattern
-   [ ] i18n Architecture
-   [ ] Universal List Pattern
-   [ ] React StrictMode Pattern
-   [ ] Store Pattern with Raw SQL
-   [ ] Rate Limiting Pattern

---

### 3. Structure Compliance (2 pts)

✅ **2 points**: All files follow memory-bank.md:

-   activeContext.md = current focus only (no completed work)
-   tasks.md = task checklist format with `[ ]`/`[x]`
-   progress.md = chronological log (newest first)
-   systemPatterns.md = reusable patterns (no project history)

⚠️ **1 point**: 1-2 minor violations
❌ **0 points**: Major structural errors (wrong content in wrong file)

---

### 4. DRY Compliance (2 pts)

✅ **2 points**: Zero duplication across files:

-   No repeated pattern descriptions (use cross-refs)
-   No duplicate implementation details
-   Proper use of "Details: filename#anchor" links

⚠️ **1 point**: 1-2 minor duplications
❌ **0 points**: Extensive duplication (same content in 2+ files)

---

### 5. Markdown Quality (2 pts)

✅ **2 points**: All checks pass:

-   Valid heading hierarchy (no skipped levels: # → ## → ###)
-   Properly formatted tables (aligned columns, no broken rows)
-   Correct list syntax (consistent `- ` or `1. `)
-   All internal links work (`[text](file.md#anchor)`)
-   Code blocks have language tags (\`\`\`bash, \`\`\`typescript, etc.)

⚠️ **1 point**: 1-2 formatting issues
❌ **0 points**: Multiple issues (3+ broken links, malformed tables)

---

## Safety Mechanisms

### Backup Strategy

**Naming Convention**: `filename.md.backup-YYYYMMDD`
**Location**: Same directory as original file (`memory-bank/`)
**Retention**: Delete ONLY if final score = 10/10
**Restoration**: If compression fails, restore from backups

### Exclusions (Do NOT Compress)

❌ Files in `memory-bank/reflection/` directory
❌ `implementation-plan.md` (keep as-is)
❌ `rls-integration-pattern.md` (specific documentation)
❌ Any file with `<!-- DO NOT COMPRESS -->` comment at top

### User Escalation Triggers

-   Final score < 10 after 3 iterations
-   GitHub API fails AND fallback strategy unclear
-   Critical information identified but unclear if safe to remove
-   Structural ambiguity in file purpose

---

## English Language Requirement

**CRITICAL**: All Memory Bank content MUST be in English

**Rationale**:

-   Consistency across project documentation
-   AI agents trained primarily on English technical content
-   International collaboration (English as lingua franca)

**Exception**:

-   Localized documentation in `docs/ru/`, `docs/es/` (not Memory Bank)

**Enforcement**:

-   Validate no Russian/other language text in compressed files
-   If found, translate to English before finalizing
