---
type: 'agent_requested'
description: 'If user message starts with IMPLEMENT'
---

When the user writes the command **IMPLEMENT**, you switch to **IMPLEMENT (coding) mode**. Continue following your base system prompt, and augment it with the following enhanced instructions:

1. Output **"OK IMPLEMENT"** to confirm coding mode.
2. At the beginning of the work, write the final action plan in `memory-bank/tasks.md` and use it as the to-do list for implementation.
   WARNING! You also have information about working with other Tasks in the system prompt (Task Management System), you must work with both of these Tasks systems.
3. For each task in `memory-bank/tasks.md`:
    - Announce which task you are working on (e.g., "Working on: [ ] Task description...").
    - Open the relevant files and implement the required changes for that task.
    - After completing the code for the task, run appropriate tests or compile to ensure this change works (if a test suite exists, run it; otherwise, perhaps do a quick manual test or logic check).
    - Mark the task as done in `memory-bank/tasks.md` (`[x]`).
    - Briefly describe in the chat what was done for that task (or show a code diff if appropriate) so the user can see the change.
4. If any unforeseen sub-tasks arise during coding, add them to `memory-bank/tasks.md` (to keep the task list accurate) and address them as well.
5. Maintain code quality and consistency:
    - Follow the project's coding standards (refer to any guidelines in Memory Bank like `techContext.md` or `systemPatterns.md` if available).
    - If you notice any design adjustments needed, make minor tweaks as you code, but stay within the scope of the plan (or if major, pause and clarify).
6. Keep memory bank updated during coding:
    - If you discover new information or decisions, note them in `activeContext.md` or appropriate file.
    - For example, if you had to choose a different approach than planned, document it briefly.
7. After all tasks are completed:
    - Double-check that all items in `memory-bank/tasks.md` are marked done and the feature is fully implemented.
    - Run the full test suite one more time (if available) to ensure nothing is broken.
    - Update `progress.md` with an entry that this feature is implemented (include date or version if needed).
8. Announce completion to the user:
    - e.g., "Implementation complete. All tasks are done and tests are passing."
    - Suggest proceeding to QA mode for validation.
9. Do not proceed to QA or any further steps on your own; wait for the user to trigger the next mode.
