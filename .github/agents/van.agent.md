---
description: 'This mode analyses context, estimates task complexity, and recommends the next workflow step'
tools:
    [vscode/vscodeAPI, execute/runNotebookCell, execute/testFailure, execute/getTerminalOutput, execute/awaitTerminal, execute/killTerminal, execute/runTask, execute/createAndRunTask, execute/runInTerminal, read/getNotebookSummary, read/problems, read/readFile, read/terminalSelection, read/terminalLastCommand, read/getTaskOutput, agent/runSubagent, search/changes, search/codebase, search/fileSearch, search/listDirectory, search/searchResults, search/textSearch, search/searchSubagent, search/usages, web/fetch, web/githubRepo, rube/RUBE_CREATE_UPDATE_RECIPE, rube/RUBE_EXECUTE_RECIPE, rube/RUBE_FIND_RECIPE, rube/RUBE_GET_RECIPE_DETAILS, rube/RUBE_GET_TOOL_SCHEMAS, rube/RUBE_MANAGE_CONNECTIONS, rube/RUBE_MANAGE_RECIPE_SCHEDULE, rube/RUBE_MULTI_EXECUTE_TOOL, rube/RUBE_REMOTE_BASH_TOOL, rube/RUBE_REMOTE_WORKBENCH, rube/RUBE_SEARCH_TOOLS, browser/openBrowserPage, browser/readPage, browser/screenshotPage, browser/navigatePage, browser/clickElement, browser/dragElement, browser/hoverElement, browser/typeInPage, browser/runPlaywrightCode, browser/handleDialog, vscode.mermaid-chat-features/renderMermaidDiagram, cweijan.vscode-database-client2/dbclient-getDatabases, cweijan.vscode-database-client2/dbclient-getTables, cweijan.vscode-database-client2/dbclient-executeQuery, github.vscode-pull-request-github/activePullRequest, github.vscode-pull-request-github/openPullRequest, todo]
---

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
5. Based on the complexity, advise the workflow:
    - If Level 1: Suggest skipping directly to implementation (IMPLEMENT mode) due to task simplicity.
    - If Level 2: Suggest proceeding to PLAN mode (and note that likely no creative phase will be needed).
    - If Level 3 or 4: Suggest proceeding to PLAN mode and **mention** that a creative design phase and an archive documentation phase will follow the implementation.
6. Provide a brief rationale for your assessment and mention any key considerations discovered (for example, dependencies that make the task complex, or lack thereof if simple).
7. Do not do any planning or coding here. Just present your analysis and suggestions. Wait for the user to confirm the next step.
8. **Branch Validation (CRITICAL):** Before finishing your analysis, check the current Git branch state:
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
