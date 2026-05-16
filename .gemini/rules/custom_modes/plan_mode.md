---
description: 'If the user message starts with PLAN'
---

When the user writes **PLAN**, you switch to **PLAN mode**.  
This mode produces a structured, step-by-step implementation plan before any code is written.  
Continue following your **base prompt**, and augment with the instructions below.

**Steps to Follow:**

1. Start with **"OK PLAN"** to confirm planning mode.
2. Handle research context before planning:
    - If the user provided URLs as decision inputs, asked to research/search/look up/verify, or requested current/latest/up-to-date external information, look for a fresh matching research artifact in `memory-bank/research/` first.
    - If a matching artifact exists, read it before creating the plan and treat it as required planning context.
    - If no fresh matching artifact exists, do **not** stop PLAN mode. Perform the needed research before finalizing the plan:
        - If the environment supports subagents or dedicated research agents, delegate the research task to a RESEARCH-capable subagent.
        - The research result must include either a saved artifact path under `memory-bank/research/` or enough structured findings to create that artifact: research question, source inventory, key findings, conflicts/uncertainty, project implications, recommended decision, and open questions.
        - If the delegated result is incomplete, complete the missing research inline using available web/search/fetch tools before finalizing the plan.
        - Save the final research findings to `memory-bank/research/<topic-slug>-research-YYYY-MM-DD.md` unless the user explicitly requested chat-only output.
    - If the task is purely local, contains no URLs, and does not depend on current external facts, proceed without a research artifact.
    - Freshness default: same-day for unstable topics (APIs, AI models, package versions, pricing, legal/security guidance, current product capabilities); up to 30 days for stable architecture topics if the artifact notes no freshness concerns.
3. Ensure context is loaded:
    - Re-read `tasks.md` and relevant Memory Bank files for details of what needs to be done.
    - Files such as techContext.md, systemPatterns.md and others, if necessary, will help you understand the necessary technical details and patterns to use to create a plan.
    - If you previously assessed a complexity level in VAN mode, keep that in mind (e.g., more complex tasks need more detailed plans).
    - If any requirement or goal is unclear, ask the user clarifying questions now (and wait for answers before proceeding).
4. Develop a **structured plan**. The plan should have sections or clearly delineated points:
    - **Overview:** Briefly restate the goal of this feature/fix in a sentence or two.
    - **Affected Areas:** List which components, modules, or files will be affected.
    - **Plan Steps:** A breakdown of implementation steps. Each step should be concrete (e.g., "Implement X in file Y", "Update schema for Z").
    - **Potential Challenges:** Note any risks, edge cases, or difficulties you foresee and how to address them.
    - _(If complexity Level 3-4)_ **Design Notes:** If a creative phase is expected, specify which parts will need design (e.g., "UI design for new screen will be handled in CREATIVE mode").
    - _(If complexity Level 3-4)_ **Dependencies:** Mention any cross-team or cross-module dependencies or coordination needed.
5. Prepare and show the plan in a clear format (markdown checklist preferred). For example:
    - `[ ] Step 1: ...`
    - `[ ] Step 2: ...` (etc.)
      Ensure the plan covers all necessary steps to complete the feature.
6. Save the plan document by default:
    - Unless the user explicitly requests chat-only output or a different destination, create or update a Markdown plan in `memory-bank/plan/`.
    - Use the naming pattern `<topic-slug>-plan-YYYY-MM-DD.md`; if revising the same topic on the same day, use `<topic-slug>-plan-YYYY-MM-DD-v2.md`.
    - The saved plan must include Overview, Affected Areas, Plan Steps, Potential Challenges, and links to any research artifact used from `memory-bank/research/`.
    - Write Memory Bank plan content in English, following the repository Memory Bank rules.
7. Present the plan in the chat as well, formatted for readability (you can copy the checklist from the saved plan so the user sees it). Include the saved file path.
8. **Do not proceed to implementation yet.** Double-check that the plan is complete and understandable.
9. If the plan is long or complex, you may highlight key milestones or group steps by phase to make it easier to follow.
10. Once the plan is laid out, ask the user for approval or any changes:
    - e.g., "Please review the plan above. Let me know if you approve or if adjustments are needed."
11. Wait for the user’s confirmation. Do not start coding until the user explicitly approves and likely triggers the IMPLEMENT mode.
