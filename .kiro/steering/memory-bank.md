# Rules for Memory Bank

* **Always Use All Core Files:** Update and utilize all memory bank files appropriately (e.g. `projectbrief.md`, `productContext.md`, `activeContext.md`, `systemPatterns.md`, `techContext.md`, `progress.md`, `tasks.md`, `currentResearch.md`). Do not ignore any core file.

* **English-Only Content:** Write all memory bank content in **English**, regardless of the language of user prompts. This ensures consistency and clarity across the project documentation. (Exception: if a file is specifically meant to hold localized content or translations, but by default use English.)

* **File-Specific Focus:** Maintain each file’s intended purpose and avoid mixing contexts:

  * **`projectbrief.md`:** High-level overview of the project’s mission, scope, and strategic goals. It’s the foundation and source of truth for requirements. *(Stable content; update only when core goals change.)*
  * **`productContext.md`:** Explanation of **why** the project exists, problems it solves, target use cases, and desired user experience. *(Background and rationale; update if product direction changes.)*
  * **`activeContext.md`:** The **current focus** of development. Include recent changes, current objectives, and immediate next steps. Update this frequently (each session or iteration) to reflect what the AI/dev is currently working on. Keep it concise and relevant to “now”. Do not dump extensive history here – focus on active information.
  * **`systemPatterns.md`:** Key architecture and design patterns, system structure, and important technical decisions. Document recurring patterns or templates, component relationships, and coding guidelines used in the project. *(Update when significant design decisions or patterns emerge.)*
  * **`techContext.md`:** Technical stack and context – frameworks, libraries, environment setup, constraints, integration points, and any critical technical details or custom modifications that must be preserved. *(Update when tech stack changes or new important technical considerations arise.)*
  * **`progress.md`:** Project progress and status log. Summarize **what is completed, what remains, and known issues**. Use this to track feature completion status, known bugs/limitations, and the evolution of the project over time (e.g. by version or date). This is not a task checklist, but a narrative or list of the project state. Update as features are completed or milestones reached. Include dates or version numbers for context, and ensure the “As of \[date]” (if present) is correct using the current date.
  * **`tasks.md`:** The **central task tracking list**. Use a *Task List + Notes* format:

    * List all ongoing or planned tasks as checklist items using `- [ ]` for open tasks and `- [x]` for completed tasks.
    * Each task item should be concise (one line if possible). If additional explanation is needed for a task, include a short indented note below that task.
    * Group related tasks under headings or logically cluster them (for example, by feature, milestone, or issue number). Clearly separate tasks for different scopes or stages.
    * **Before starting work**, ensure `tasks.md` is updated with new tasks or changes. **After completing a task**, mark it `- [x]` (done) and add any brief note if a noteworthy outcome or discovery occurred.
    * Keep the task list **minimal and relevant**: avoid duplicating long details here (those should go into `progress.md` or other docs). Only include enough detail to identify the task. Use references if needed (e.g., “fix camera jitter (see progress.md issue #3)”).
  * **`currentResearch.md`:** A scratchpad for ongoing deep research findings from external analyses (other AI agents or sources). Use it to store detailed information or references that are currently being investigated, so as not to clutter the main context files. Keep it summarized and relevant. This file can be more free-form, but should still be in English and cleaned up when research is concluded (important findings can be moved into the relevant permanent files, and outdated info removed).

* **Maintain Structure & Clarity:** When updating a memory file, follow its existing Markdown structure (headings, tables, lists) rather than appending text arbitrarily at the top or bottom. Insert new information under appropriate sections or add new sections if necessary. Preserve logical flow:

  * Do **not** prepend disorganized content at the file start or append random notes at the end without context.
  * Use headings and subheadings consistently to organize content. If adding a new section, ensure it fits the hierarchy and add a heading for it.
  * Keep paragraphs short (3-5 sentences) and use bullet lists or tables for clarity where appropriate (especially in `progress.md` or other status summaries).

* **Avoid Redundancy:** Minimize duplication of information across files. If information is already documented in one memory file, **reference it** in another file rather than duplicating it verbatim. For example, if `projectbrief.md` or `systemPatterns.md` contains a detailed table of core components, other files can briefly mention the fact or just highlight changes, and link or refer to the detailed source:

  * *Allowed:* Briefly restating a crucial point for context or linking to another file (e.g., “All 7 core UPDL nodes are implemented (see **projectbrief.md** for list).”).
  * *Not allowed:* Copy-pasting large sections of text from one memory file into another.
  * Each file should contribute new or contextual information. Use cross-references (Markdown links to the other `.md` files or relevant documentation) instead of repeating content.

* **Temporal Accuracy (Dates & Versions):** Whenever recording dates (for progress updates, changelogs, milestones, etc.), use the actual current date or correct version numbers. Do **not** hallucinate or hard-code incorrect dates. Use tools or environment to fetch today’s date if needed, ensuring logs like “As of YYYY-MM-DD” or version timestamps are accurate. Example: if marking a milestone completed, include the real completion date.

* **Consistent Format for Task Lists:** In `tasks.md`, use the checklist format strictly:

  * Open tasks: `- [ ] Task description`
  * Completed tasks: `- [x] Task description (optional brief outcome)`
  * Do not write long prose in tasks.md; if more detail is needed for context, put it in `progress.md` or as a note indented below the task. For instance:
    `- [ ] Implement new camera rotation logic`
        `- Note: camera jitter happens when combining Q+E keys, need to address quaternions conversion.`
  * Keep tasks.md focused on actionable items rather than general status or discussion.

* **Update Frequency:** Treat the memory bank as the AI’s persistent memory. Always review and update `activeContext.md` and `tasks.md` at the start and end of each significant development session. Update `progress.md` whenever a milestone is reached or a set of tasks is completed (ensuring alignment with what was in `tasks.md`). Update other files (`systemPatterns.md`, `techContext.md`, etc.) when relevant changes occur (new patterns, new technologies, etc.). Consistently maintaining these ensures the next AI session starts with accurate context.

* **No Unprompted New Files:** Do not create new files in the memory bank (or elsewhere) unless the user explicitly asks. Use the existing files to record information. If you think a new document is needed for a large amount of information, discuss with the user first. Stick to the defined memory bank structure.

* **Conciseness and Relevance:** Keep the content of each memory file as compact as possible while preserving important details. The memory bank should be comprehensive but not bloated:

  * Remove or archive obsolete information that is no longer relevant to current or future work (or move it to an external changelog if needed).
  * If a detail is only historically relevant and not needed for ongoing context, consider moving it from a frequently-used file (like `activeContext.md`) to a less frequently read archive or into `progress.md` under a past date.
  * Focus on information that the AI or developer needs to recall to continue the project effectively.

* **Cross-Reference External Docs:** When applicable, reference external documentation (README files in the repository, wiki pages, etc.) instead of copying their content into the memory bank. For example, if detailed API specifications or user guides exist in the repository (e.g., `packages/<app>/README.md`), link to those in the memory files rather than duplicating the full text. This keeps the memory bank slim and avoids inconsistencies. Ensure any such links are clearly labeled.

By following these rules, the AI agents will maintain a well-structured, up-to-date memory bank, reducing confusion and duplication. This ensures consistent context and smoother progress in development.  