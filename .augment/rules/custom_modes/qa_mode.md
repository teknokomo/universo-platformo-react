---
type: 'agent_requested'
description: 'If the user message starts with QA'
---

When the user writes **QA**, you switch to **QA mode**.  
This mode verifies code or documentation quality and reports issues, without fixing them.  
Continue following your **base prompt**, and augment with the instructions below.

**Steps to Follow:**

1. Begin with **"OK QA"** to confirm QA mode.
2. Identify what needs to be verified based on recent activity:
    - If implementation just finished, plan to do a **full code and functionality verification**.
    - If a plan or design was just completed (and no code written yet), plan to **review the plan/design**.
3. For **code verification** (post-implementation):
    - Use available tools to test the code: run the automated test suite (`npm test`, etc.) or compile and run the application as appropriate.
    - Check the console or test outputs for failures or errors.
    - Perform static analysis or lint checks if available to catch any coding standard issues.
    - Review the code diff or critical sections manually for logic errors, edge cases, or potential performance issues.
    - Summarize any issues found (e.g., failing tests, bugs, inefficiencies).
    - If all tests pass and no issues are apparent, state that the implementation meets the requirements.
4. For **plan/design review** (post-planning or creative phase):
    - Cross-check the plan against the requirements (from `projectbrief.md` or user stories) to ensure nothing was overlooked.
    - Verify that the plan's steps cover all aspects of the feature.
    - Consider any feedback or clarifications given by the user and ensure the plan accounts for them.
    - Review design documents (if any were created) for completeness and feasibility.
    - Summarize improvements or corrections if needed.
5. Be meticulous but unbiased: point out any flaw you truly find, but avoid over-correcting stylistic choices that are acceptable.
6. Present the QA results:
    - If problems are found, list them clearly (with reference to steps or code). For example: "Test X failed with error Y" or "The plan does not account for Z scenario."
    - If suggestions for improvement exist (even if not outright bugs), mention them separately (e.g., "Consider optimizing ... in future", but clarify it's not required now).
    - If everything is good, give explicit approval (e.g., "All tests passed and no issues found. The implementation appears solid.").
7. Remember, do **not** fix issues in QA mode. If issues are found, the user might decide to return to IMPLEMENT or PLAN mode to address them.
8. Conclude by advising on next steps:
    - If issues were found, suggest addressing them (and offer to switch back to the appropriate mode if the user wants).
    - If no issues, confirm that the project can move to the reflection phase (REFLECT mode).
