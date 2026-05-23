---
description: 'Compression strategies and validation rules for Memory Bank files'
---
# Memory Bank Compression Instructions

## Compression Objectives

**Core Principles:**

1. **Information Density**: Maximize knowledge per line and per token.
2. **Zero Loss**: Preserve all critical technical information.
3. **DRY Compliance**: Eliminate duplication across files.
4. **Structural Integrity**: Maintain file-specific focus per the memory-bank rules.
5. **Traceability**: Always provide links to detailed sources.
6. **Factual Freshness**: Memory bank content must reflect the actual code state. Stale information is a defect on par with missing information.

**Target Ranges:**

- `activeContext.md`: 100-150 lines (focus: current work only)
- `tasks.md`: 500-600 lines (focus: active + recent tasks)
- `progress.md`: 600-700 lines (focus: version table + 3-month history)
- `systemPatterns.md`: 600-700 lines (focus: reusable patterns)
- `techContext.md`: 300-400 lines (canon — touch via the Canon Refresh phase)
- `productContext.md`: 300-400 lines (canon — touch via the Canon Refresh phase)
- `projectbrief.md`: 300-400 lines (canon — touch via the Canon Refresh phase)

> Line counts approximate token cost. When the file uses dense formatting
> (tables, code blocks), a token count can be more accurate; see "Token-Efficient Writing" below.

---

## CRITICAL: Compression Trigger Rules

**IMPORTANT**: Compression is NOT automatic. Apply compression ONLY when needed.

### When to Compress (Trigger Conditions)

**DO Compress**:

- File exceeds its target range upper bound (see Target Ranges above)
- User explicitly requests compression
- Canon Refresh phase reports stale content that needs to be condensed after replacement

**DO NOT Compress**:

- File is already WITHIN the target range (at or below the upper bound)
- If a file does not exceed the maximum values above, do NOT compress it
- Example: `tasks.md` at 541 lines with 600-line max → NO compression needed

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

- ✅ Within range → "No compression needed"
- ⚠️ Exceeds max → "Compression required (current: X, max: Y)"

---

## Canon Refresh Phase (Before Compression)

The three canon files (`projectbrief.md`, `productContext.md`, `techContext.md`)
describe the project at a high level. They drift from reality over time when
packages are added or removed, when architecture changes, and when the product
focus shifts. Compression alone cannot fix that — stale facts compressed into a
shorter file remain stale.

Run the Canon Refresh phase **before** any compression work. It is a separate
diagnostic, not a destructive operation.

### When To Refresh

Trigger Canon Refresh when one or more of these is true:

- The `Last Reviewed` date in any canon file is older than 60 days.
- The project repository version (root `package.json`) does not match the
  version in canon files.
- The active workspace package list (`packages/*`) does not match the package
  list described in `projectbrief.md`.
- An entry in `tasks.md` or `progress.md` mentions a major architectural
  change (rename, removal, new subsystem) not yet reflected in canon.

### Refresh Workflow

1. **Collect ground truth**:
   - Repository version: `node -e "console.log(require('./package.json').version)"`.
   - Workspace packages: `ls packages/`.
   - Built-in registries when applicable (entity type presets, metahub
     templates, etc.).

2. **Diff canon vs. ground truth**:
   - Outdated version strings.
   - Packages listed but no longer present (or present but not listed).
   - Architectural concepts described as "current" that have been
     superseded (check `tasks.md` and `progress.md` for the rename or
     replacement event).
   - Concepts marked "complete" or "production-ready" that have actually
     been removed.

3. **Update canon files**:
   - Replace stale facts with current ones.
   - Move legacy descriptions to a section labeled "Legacy / historical
     context" rather than deleting them outright.
   - Update the `Last Reviewed: YYYY-MM-DD` marker at the top of each file
     with a short note describing what was refreshed.

4. **Then run normal compression** if any file is over its target range.

### Refresh Output Example

```
[MB Refresh] Repository version: upr-0.65.0-alpha
[MB Refresh] projectbrief.md still claims v0.21.0-alpha → updated
[MB Refresh] productContext.md "6 Applications" → packages updl/, publish-*/, analytics-frontend/ no longer present → moved description to "Legacy product surface" section
[MB Refresh] techContext.md ECAE baseline still uses `catalog` terminology → updated to `object` (rename completed in tasks.md 2026-05-14)
[MB Refresh] All canon files updated. Last Reviewed → 2026-05-22.
```

### Last Reviewed Marker

Every canon file MUST start with:

```markdown
> **Last Reviewed**: YYYY-MM-DD (refreshed: short list of what was changed)
```

Examples:

```markdown
> **Last Reviewed**: 2026-05-22 (refreshed: package list, architecture transition added)
> **Last Reviewed**: 2026-05-22 (refreshed: rename Catalog→Object, DB layer status added)
```

Tools may scan this marker to decide whether canon is stale.

---

## GitHub Releases Table Actualization

**Location**: Top of `progress.md` (before all other content)

**API Endpoint**:

```
GET https://api.github.com/repos/<owner>/<repo>/releases
```

The `<owner>` and `<repo>` come from the project's primary GitHub remote, not
hardcoded into these instructions.

**Required Fields**:

- `tag_name` → Release column
- `published_at` → Date column (format: YYYY-MM-DD)
- `name` → Codename column
- `body` (first paragraph) → Highlights column

**Table Format** (preserve exactly):

```markdown
| Release      | Date       | Codename       | Highlights                     |
| ------------ | ---------- | -------------- | ------------------------------ |
| 0.34.0-alpha | 2025-10-23 | Black Hole ☕️ | Global monorepo refactoring... |
```

**Fallback Strategy**:
If the API fails (rate limit, network error, authentication):

1. Keep the existing table unchanged.
2. Add an HTML comment after the table:

   ```markdown
   <!-- Last auto-update attempt: YYYY-MM-DD HH:MM, Status: [error message] -->
   ```

3. Continue with the compression workflow.
4. Report the API failure in the final summary.

---

## File-Specific Compression Strategies

### 1. activeContext.md (Target: 100-150 lines)

**Purpose**: Track ONLY current focus (what the AI is working on RIGHT NOW)

**Compression Rules**:

**DELETE Completely**:

- All "Previous Focus" sections older than 1 week
- Detailed implementation logs (move summaries to progress.md)
- Completed work fully documented in progress.md
- Build verification details (keep outcome only)
- File modification lists (keep counts only: "Modified N files")

**CONDENSE to 3-5 bullets**:

- Current Focus section → key achievements + next step
- Each bullet: 1 line max
- Format:

  ```markdown
  ## Current Focus: [Feature] - [Status]

  - Fixed [issue] via [solution] (YYYY-MM-DD)
  - Completed [task], affected N files
  - Next: [immediate action required]
  ```

**PRESERVE**:

- Current blockers (if any)
- Immediate next steps (if work in progress)
- Critical context for ongoing work

**ARCHIVE to progress.md**:

- Move "Previous Focus" summaries to progress.md if not there
- Keep only completion date + 1-line outcome

---

### 2. tasks.md (Target: 500-600 lines)

**Purpose**: Track active tasks and recent completions (working document)

**Compression Rules**:

**KEEP Unchanged**:

- All `[ ]` unchecked tasks (active work)
- All `[x]` tasks from the last 14 days
- Task hierarchy (sections like "🔥 CRITICAL", "Phase 1", etc.)
- Checklists for ongoing work

**CONDENSE (Last 2 months)**:

- Completed tasks 15-60 days old → summary format:

  ```markdown
  ## [Feature Name] - Complete ✅ (YYYY-MM-DD)

  - Main outcome 1 (1 line)
  - Main outcome 2 (1 line)
  - Details: progress.md#YYYY-MM-DD-feature-name
  ```

- Remove verbose "Files Modified" lists → "Modified N files"
- Remove detailed implementation steps → keep outcomes only
- Remove build logs → "Build: ✅ All packages successful"

**ARCHIVE to progress.md** (>2 months old):

- Move entire completed task sections to progress.md
- Replace with single reference line:

  ```markdown
  ## [2025-08] Historical Tasks ✅

  - See progress.md for completed tasks before 2025-09
  ```

**REMOVE Completely**:

- Duplicate pattern descriptions (link to systemPatterns.md instead)
- Obsolete or cancelled tasks marked as deprecated
- Temporary debugging tasks (if the issue is resolved)

---

### 3. progress.md (Target: 600-700 lines)

**Purpose**: Chronological log of completed work (permanent record)

**CRITICAL**: The version history table MUST remain at the top, unchanged.

**Compression Rules**:

**PRESERVE Unchanged**:

- Version history table (all releases)
- Section: "## ⚠️ IMPORTANT: Version History Table"
- Last 3 months of entries (full detail)

**CONDENSE 50%** (3-6 months old):

- Remove "Files Modified" detailed lists → "Modified N files (X backend, Y frontend)"
- Remove verbose "What was completed" paragraphs → bullet list
- Remove duplicate pattern descriptions → "Pattern: systemPatterns.md#link"
- Remove build verification details → "Build: ✅ Success (Xm Ys)"
- Keep dates, outcomes, and critical metrics

**ARCHIVE 90%** (>6 months old):

- Major features → 1-2 line summary:

  ```markdown
  ### YYYY-MM-DD: [Feature Name] ✅

  - [Main outcome]. Files: N. Pattern: systemPatterns.md#link
  ```

- Group by month if multiple small features:

  ```markdown
  ### YYYY-MM: [Month Name] Summary ✅

  - Feature A (outcome)
  - Feature B (outcome)
  ```

**REMOVE Completely**:

- Duplicate sections (merge if content overlaps)
- Temporary notes marked as "TODO" (if already done)
- Broken reference links (fix or remove)

**Chronological Order**: Newest first, oldest last.

---

### 4. systemPatterns.md (Target: 600-700 lines)

**Purpose**: Reusable architectural patterns and best practices

**Compression Rules**:

**KEEP Full**:

- Pattern titles (all)
- Core rule descriptions (what, why, when)
- Patterns marked CRITICAL — see "Dynamic CRITICAL Patterns" below.

**CONDENSE**:

- Code examples → 1 representative snippet (remove variations)
- Remove "Before/After" duplicate examples → keep 1 illustrative pair
- "Why This Matters" → 1-2 sentences if not self-evident
- Detection checklists → command examples only
- Common symptoms → bullet list (remove paragraphs)

**MERGE**:

- Similar sub-patterns into a parent pattern
- Example: pagination sub-patterns → single "Pagination Patterns" section

**SHORTEN**:

- Historical bug examples → git reference:

  ```markdown
  **Example**: see git commit abc123 (YYYY-MM-DD) for the [bug name] fix
  ```

- Verification checklists → essential steps only

**EXTERNAL LINKS**:

- Replace long React/TypeScript explanations → official docs links.
- Example: "see [React docs](https://react.dev/...)" instead of a long inline explanation.

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

### 5. Canon Files: projectbrief.md / productContext.md / techContext.md

**Purpose**: Stable, high-level descriptions of the project (mission, product
context, technical baseline). They are not compressed by removing recent
content — they are **refreshed** through the Canon Refresh phase first, then
compressed only if the refreshed file still exceeds the target range.

**KEEP Full**:

- Mission, vision, strategic goals
- Currently active architecture description
- Workspace package list as it actually is today
- Cross-references to skills, steering files, and other memory-bank files
- The `Last Reviewed` marker at the top

**CONDENSE**:

- Historical architecture sections (e.g. legacy product surfaces) →
  one paragraph + a link to a deeper reference if needed.
- Long prose paragraphs → bullet lists when bullets carry the same
  information.
- Repeated explanations of the same architectural concept → one canonical
  paragraph plus cross-references.

**REPLACE (during Canon Refresh, not pure compression)**:

- Stale version numbers, package names, terminology.
- Sections that describe a removed package as "active".
- Status claims that contradict the current code state.

**REMOVE**:

- Sections that document a removed feature without any historical value.
- Duplicate cross-references that point to nothing.

A canon file should not contain task-level detail or chronological
history; that belongs to `tasks.md` and `progress.md`.

---

## Token-Efficient Writing

Compression is not just about cutting sections — it is also about writing
remaining content efficiently. Apply these patterns when revising condensed
sections or canon paragraphs.

### High-Impact Patterns

- **Remove filler phrases**: "This tool is used to", "You should use this
  when", "It is important to note that". They add no information.

  ```diff
  - This tool is used to create a new order for a customer.
  + Create customer order.
  ```

- **Drop articles in technical bullet lists**: `a`, `an`, `the` are tokens
  with little value in dense documentation.

  ```diff
  - Create a new order for the customer with the specified items.
  + Create order for customer with specified items.
  ```

- **Compact structures inside braces and brackets**:

  ```diff
  - { id, name, status }
  + {id,name,status}
  ```

- **Prefer `snake_case` over `camelCase`** for identifiers in context files;
  most tokenizers split `customer_id` into 2 tokens versus 3 for
  `customerId`.

- **Inline constraints next to fields** instead of describing them in
  prose:

  ```diff
  - quantity: integer, must be greater than 0, this field is required.
  + quantity:int!>0
  ```

  Define a legend at the top of the file for symbols (`!` = required,
  `?` = optional, `→` = returns, `|` = or).

### Medium-Impact Patterns

- Use terse labels (`IN`, `OUT`, `ERR`, `WHEN`, `NOT`) consistently across
  similar sections.
- Replace repeated explanations of the same pattern with cross-references.
- Replace long external explanations with a link to the upstream docs.

### Sanity Checks Before Saving

- Did you remove any "filler" sentence that started with "This is", "It is",
  "The purpose of this is to"?
- Could a bulleted list replace a paragraph?
- Are there spaces inside `{ ... }` or `[ ... ]` that can be removed?
- Are constraints embedded next to fields or floating in prose?

Keep readability for humans by defining a legend once; the goal is fewer
tokens with the same or better clarity.

---

## Dynamic CRITICAL Patterns

The "CRITICAL" tag in `systemPatterns.md` is the source of truth. Do not
hardcode a fixed list of CRITICAL patterns inside this instruction file.

### Discovery Command

```bash
grep -n "CRITICAL" memory-bank/systemPatterns.md
```

The Information Preservation rubric (below) checks that every pattern
currently tagged `CRITICAL` in `systemPatterns.md` survives compression.
When a new pattern is added with the CRITICAL tag, no edit to this
instruction file is required.

### Examples Today

These are typically present, but the canonical list is whatever
`systemPatterns.md` says today:

- Source-Only Package PeerDependencies
- RLS Integration Pattern
- i18n Architecture
- Universal List Pattern
- React StrictMode Pattern
- Store Pattern with Raw SQL
- Rate Limiting Pattern

### Custom CRITICAL Marker

Optionally, individual sections in any compressed file may opt out via:

```markdown
<!-- DO NOT COMPRESS -->
```

at the top of the file. Files marked this way are skipped entirely.

---

## Validation Rubric (12-Point Scale)

**Scoring System** (2 points each criterion, 6 criteria):

### 1. Size Compliance (2 pts)

✅ **2 points**: All criteria met:

- Files within target ranges (at or below upper bound)
- Compressed files ≥80% of upper bound (no over-compression)
- Files already within range were NOT unnecessarily compressed

⚠️ **1 point**:

- 1 file slightly over upper bound (<20% over) OR
- 1 file over-compressed (<80% of upper bound but >60%)

❌ **0 points**:

- 2+ files over upper bound OR any file >20% over OR
- Any file over-compressed to <60% of upper bound OR
- Unnecessary compression of files already within ranges

---

### 2. Information Preservation (2 pts)

✅ **2 points**: All criteria met:

- All currently CRITICAL patterns (from `systemPatterns.md`) preserved
- Recent work (last 3 months) fully documented
- Version history table intact and updated
- No critical technical data lost vs backups

⚠️ **1 point**: Missing 1-2 non-critical items
❌ **0 points**: Missing 3+ items OR any CRITICAL pattern lost

Discovery command for the active CRITICAL list:

```bash
grep -n "CRITICAL" memory-bank/systemPatterns.md
```

---

### 3. Structure Compliance (2 pts)

✅ **2 points**: All files follow the memory-bank rules:

- `activeContext.md` = current focus only (no completed work)
- `tasks.md` = task checklist format with `[ ]`/`[x]`
- `progress.md` = chronological log (newest first)
- `systemPatterns.md` = reusable patterns (no project history)
- Canon files have a fresh `Last Reviewed` marker

⚠️ **1 point**: 1-2 minor violations
❌ **0 points**: Major structural errors (wrong content in wrong file)

---

### 4. DRY Compliance (2 pts)

✅ **2 points**: Zero duplication across files:

- No repeated pattern descriptions (use cross-refs)
- No duplicate implementation details
- Proper use of `Details: filename#anchor` links

⚠️ **1 point**: 1-2 minor duplications
❌ **0 points**: Extensive duplication (same content in 2+ files)

---

### 5. Markdown Quality (2 pts)

✅ **2 points**: All checks pass:

- Valid heading hierarchy (no skipped levels: # → ## → ###)
- Properly formatted tables (aligned columns, no broken rows)
- Correct list syntax (consistent `- ` or `1. `)
- All internal links work (`[text](file.md#anchor)`)
- Code blocks have language tags (`bash`, `typescript`, etc.)

⚠️ **1 point**: 1-2 formatting issues
❌ **0 points**: Multiple issues (3+ broken links, malformed tables)

---

### 6. Factual Freshness (2 pts)

✅ **2 points**: All checks pass:

- Canon files (`projectbrief.md`, `productContext.md`, `techContext.md`)
  have a `Last Reviewed` marker no older than 60 days, OR they were
  refreshed in this session.
- Repository version in canon matches the actual `package.json` version.
- Workspace package list in canon matches `ls packages/`.
- No section describes a removed package as "active".

⚠️ **1 point**: 1-2 minor stale references that have not been corrected.
❌ **0 points**: A canon file still claims a removed package or feature
   is active, OR `Last Reviewed` is older than 90 days with no refresh
   note explaining why.

---

## Safety Mechanisms

### Backup Strategy

- **Naming convention**: `filename.md.backup-YYYYMMDD`.
- **Location**: same directory as the original file (`memory-bank/`).
- **Retention**:
  - Delete on the spot when the final score is `12/12`.
  - Keep when the score is below `12/12` and the user has not yet
    reviewed the result.
  - Auto-delete backups older than **30 days** at the start of any new
    MB session, regardless of score. The author can override this by
    moving the backup outside `memory-bank/`.
- **Restoration**: if compression failed, restore from backups before
  trying again.

### Exclusions (Do NOT Compress)

- Files in `memory-bank/reflection/` directory.
- `implementation-plan.md` (keep as-is).
- `rls-integration-pattern.md` (specific documentation).
- Any file whose first line contains `<!-- DO NOT COMPRESS -->`.

### User Escalation Triggers

- Final score < 12 after 3 iterations.
- GitHub API fails AND the fallback strategy is unclear.
- Critical information identified but unclear whether it is safe to remove.
- Structural ambiguity in file purpose.
- Canon Refresh detected a contradiction it cannot resolve mechanically
  (for example, two `tasks.md` entries claim mutually exclusive
  architecture states).

---

## English Language Requirement

**CRITICAL**: All Memory Bank content MUST be in English.

**Rationale**:

- Consistency across project documentation.
- AI agents trained primarily on English technical content.
- International collaboration (English as lingua franca).

**Exception**:

- Localized documentation in `docs/ru/`, `docs/es/` (not Memory Bank).

**Enforcement**:

- Validate that no Russian or other-language text appears in compressed files.
- If found, translate to English before finalizing.
