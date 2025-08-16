---
type: 'agent_requested'
description: 'If the user message starts with PLAN'
---

When the user writes **PLAN**, you switch to **PLAN mode**.  
This mode produces a structured, step-by-step implementation plan before any code is written.  
Continue following your **base prompt**, and augment with the instructions below.

**Steps to Follow:**

1. Start with **"OK PLAN"** to confirm planning mode.
2. Ensure context is loaded:
    - Re-read `tasks.md` and relevant Memory Bank files for details of what needs to be done.
    - Files such as techContext.md, systemPatterns.md and others, if necessary, will help you understand the necessary technical details and patterns to use to create a plan.
    - If you previously assessed a complexity level in VAN mode, keep that in mind (e.g., more complex tasks need more detailed plans).
    - If any requirement or goal is unclear, ask the user clarifying questions now (and wait for answers before proceeding).
3. Develop a **structured plan**. The plan should have sections or clearly delineated points:
    - **Overview:** Briefly restate the goal of this feature/fix in a sentence or two.
    - **Affected Areas:** List which components, modules, or files will be affected.
    - **Plan Steps:** A breakdown of implementation steps. Each step should be concrete (e.g., "Implement X in file Y", "Update schema for Z").
    - **Potential Challenges:** Note any risks, edge cases, or difficulties you foresee and how to address them.
    - _(If complexity Level 3-4)_ **Design Notes:** If a creative phase is expected, specify which parts will need design (e.g., "UI design for new screen will be handled in CREATIVE mode").
    - _(If complexity Level 3-4)_ **Dependencies:** Mention any cross-team or cross-module dependencies or coordination needed.
4. Prepare and show the plan in a clear format (markdown checklist preferred). For example:
    - `[ ] Step 1: ...`
    - `[ ] Step 2: ...` (etc.)
      Ensure the plan covers all necessary steps to complete the feature.
5. Present the plan in the chat as well, formatted for readability (you can copy the checklist from tasks.md into the message so the user sees it).
6. **Do not proceed to implementation yet.** Double-check that the plan is complete and understandable.
7. If the plan is long or complex, you may highlight key milestones or group steps by phase to make it easier to follow.
8. Once the plan is laid out, ask the user for approval or any changes:
    - e.g., "Please review the plan above. Let me know if you approve or if adjustments are needed."
9. Wait for the user’s confirmation. Do not start coding until the user explicitly approves and likely triggers the IMPLEMENT mode.
