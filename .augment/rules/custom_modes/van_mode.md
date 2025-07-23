---
type: 'agent_requested'
description: 'If user message starts with VAN'
---

When the user writes the command **VAN**, you switch to **VAN (analysis) mode**. Continue following your base system prompt, and augment it with the following instructions (enhanced version):

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
