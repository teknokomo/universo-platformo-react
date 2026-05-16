---
description: 'If the user message starts with VAN'
---

When the user writes **VAN**, you switch to **VAN mode**.
This mode analyses context, estimates task complexity, and recommends the next workflow step.
Continue following your **base prompt**, and augment with the instructions below.

**Steps to Follow:**

1. Start with **"OK VAN"** to acknowledge analysis mode.
2. Thoroughly review Memory Bank context:
    - Read `projectbrief.md` to recall overall project goals.
    - Read `activeContext.md` to see the current focus or feature description.
    - Read `tasks.md` to see any listed tasks or the specific task at hand.
    - Skim other context files (`productContext.md`, `systemPatterns.md`, etc.) if relevant.
3. Determine the **Complexity Level** of the task (on a scale of 1 to 4):
    - **Level 1 (Trivial):** Very small change or fix, minimal impact, can likely skip detailed planning.
    - **Level 2 (Moderate):** A standard feature or bugfix that is self-contained; requires planning but no separate creative design phase.
    - **Level 3 (Significant):** A complex feature affecting multiple components; will require comprehensive planning and possibly a creative/design phase.
    - **Level 4 (Major/Complex):** A large or critical feature (or refactor) requiring thorough planning, a creative phase, and extensive documentation.
4. After analysis, explicitly state the estimated complexity level (e.g., "Estimated Complexity: Level 3 - Significant complexity").
5. Assess whether external research is recommended before PLAN:
    - If the task includes URLs, asks for current/latest/up-to-date information, depends on external APIs/tools/libraries/models/pricing/security/legal guidance, or requires third-party documentation, state that **RESEARCH** or **RPLAN** is recommended before PLAN.
    - If a fresh matching research artifact already exists in `memory-bank/research/`, mention that PLAN can use it directly.
    - This is a recommendation, not a hard block: the user may still proceed to PLAN, and PLAN must handle missing research itself.
6. Based on the complexity and research need, advise the workflow:
    - If Level 1: Suggest skipping directly to implementation (IMPLEMENT mode) due to task simplicity.
    - If Level 2: Suggest proceeding to RESEARCH first when external research is recommended; otherwise suggest proceeding to PLAN mode (and note that likely no creative phase will be needed).
    - If Level 3 or 4: Suggest proceeding to RESEARCH first when external research is recommended; then PLAN, and **mention** that a creative design phase and an archive documentation phase will follow the implementation.
7. Provide a brief rationale for your assessment and mention any key considerations discovered (for example, dependencies that make the task complex, lack thereof if simple, or why research is or is not recommended).
8. Do not do any planning or coding here. Just present your analysis and suggestions. Wait for the user to confirm the next step.
9. **Branch Validation (CRITICAL):** Before finishing your analysis, check the current Git branch state:
    - Run `git branch --show-current` to get the current branch name.
    - Run `git fetch origin main && git rev-list --count HEAD..origin/main` to check if the local branch is behind the remote `main`.
    - **If the current branch is NOT `main`:**
      Display a prominent warning:
        ```
        ⚠️🔴 **WARNING: NOT ON MAIN BRANCH** 🔴⚠️
        Current branch: <branch_name>
        You are not on the `main` branch. Consider switching to `main` before starting new work.
        ```
    - **If the branch is behind the remote (commits behind > 0):**
      Display a prominent warning:
        ```
        ⚠️🔴 **WARNING: BRANCH OUT OF SYNC** 🔴⚠️
        Your local branch is <N> commit(s) behind origin/main.
        Run `git pull origin main` to update before proceeding.
        ```
    - **If both issues are present, display both warnings.**
    - If neither issue is present (on `main` and up-to-date), confirm: "✅ Branch status: On `main`, up-to-date with remote."
