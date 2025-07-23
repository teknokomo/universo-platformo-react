---
type: 'agent_requested'
description: 'If user message starts with REFLECT or ARCHIVE'
---

When the user writes **REFLECT** (or **ARCHIVE**), you switch to **REFLECT/ARCHIVE mode**. This mode encompasses both reflection and archiving stages. Continue following your base prompt, and augment with these enhanced instructions:

1. If triggered by "REFLECT": start with **"OK REFLECT"**. (If directly triggered by "ARCHIVE", start with **"OK ARCHIVE"** and attempt to proceed to archiving, but note that reflection should ideally be done first.)
2. **Reflection Stage:**
    1. Confirm implementation and QA are finished:
        - Ensure `tasks.md` shows all tasks completed (`[x]`) and any QA issues were resolved.
        - If some tasks are incomplete or there are unresolved issues, inform the user that reflection is premature and stop.
    2. Gather information for reflection:
        - Recall the original goals from `projectbrief.md`.
        - Summarize the final implementation: what features or changes were made, referencing key components.
        - Note any **challenges** faced and how they were overcome.
        - Note any **successes** or particularly well-implemented aspects.
        - Capture **lessons learned** (insights for future projects or improvements in process).
    3. Create or update the `reflection.md` document for this feature:
        - If a specific reflection file for this feature exists (e.g., `reflect-<feature>.md`), use that; otherwise, you can create `reflection.md` (or a new file with the feature name).
        - Include sections in the reflection doc: _Overview of Implementation_, _Challenges & Solutions_, _Successes_, _Lessons Learned_, etc.
        - Write the content based on the notes above.
    4. Update `progress.md` with an entry that reflection is done for this feature (and maybe link the reflection doc).
    5. Share a concise summary of the reflection with the user in the chat, highlighting key points.
    6. Prompt the user: _"Reflection completed. To finalize documentation and archive this feature, please enter 'ARCHIVE NOW'."_
    7. Wait for user confirmation to proceed to archiving.
3. **Archiving Stage:**
    1. Once the user triggers **ARCHIVE** (or "ARCHIVE NOW"): respond with **"OK ARCHIVE"** if not already said.
    2. Double-check that the reflection stage was completed:
        - The `reflection.md` should be present and filled out.
        - If it's not done, politely explain that reflection should be completed before archiving, then stop.
    3. Compile all documentation needed for final archive:
        - Feature description and usage instructions (what was implemented and how to use it).
        - Technical details: architecture or design decisions (you can pull from design docs or reflection).
        - Any deployment or configuration notes if relevant.
        - Basically, ensure someone reading later understands the feature and its implementation.
    4. Create an archive document in `docs/archive/`:
        - Name it appropriately (e.g., `<FeatureName>-archive.md` or similar).
        - In that file, write a comprehensive document including the above information.
        - Link to `reflection.md` or include key points from it, and note any creative/design docs that were produced.
    5. Organize the archive document with clear headings (Overview, Implementation Details, Outcomes, etc.).
    6. Update `progress.md` to mark the feature as archived (and perhaps include a link to the archive doc).
    7. Update `activeContext.md`: clear or reset it since there is no active task now (the feature is complete).
    8. Inform the user that archiving is complete:
        - e.g., "Archive complete. Documentation for this feature is finalized in docs/archive/<filename>.md."
        - Confirm that the Memory Bank and project docs are fully updated.
    9. Suggest that this feature is now fully closed out, and the system is ready to move on to new tasks (if any).
