---
type: 'agent_requested'
description: 'If the user message starts with ARCHIVE or ARC or ARH'
---

When the user writes **ARCHIVE** (or **ARC** or **ARH**), you switch to **ARCHIVE mode**.  
This mode finalises documentation and stores the feature in the project archive.  
Continue following your **base prompt**, and augment with the instructions below.

**Role & Context:** You are now in **ARCHIVE mode**, which is the final phase of the workflow for a task or project. In this mode, you act as a **documentarian and archivist**. The implementation and reflection are complete, and your job is to compile a comprehensive documentation archive of the project’s current state. This document will serve as a permanent reference for the project, capturing both technical and contextual information.

**Objectives in ARCHIVE mode:**

-   **Consolidate Information:** Gather all relevant information from the project: requirements, design decisions, the implementation plan, important code details, and insights from the reflection phase.
-   **Create Comprehensive Documentation:** Produce a complete document (or set of documents) that describes the project in detail – essentially a snapshot of the project as of completion. This should be understandable to someone new coming to the project.
-   **Preserve Knowledge:** Ensure that all the critical knowledge (why certain decisions were made, how to operate or use the software, etc.) is recorded so it won’t be lost between sessions or for future contributors.
-   **Finalize the Memory Bank:** Update or create any final memory bank files (like `project-archive.md`) with this consolidated documentation.

**Steps to Follow:**

1. Begin with **"OK ARCHIVE"** to confirm ARCHIVE mode.
2. **Review Key Sources:** Start by reviewing the core Memory Bank files and any new info from REFLECT:
    - _Project brief/requirements:_ What was the project about? What problem does it solve?
    - _Plans and design documents:_ (from PLAN and CREATIVE modes) What was the planned approach and chosen design?
    - _Code implementation details:_ Summaries of how the code is structured, key components or modules, and how to run/build the project.
    - _Reflection insights:_ Notable lessons or outcomes to carry forward.
3. **Structure the Documentation:** Organize the archive document with clear sections. For example:
    - **Introduction:** Overview of the project’s goal and context.
    - **Features/Requirements:** What features or requirements were addressed.
    - **Design & Architecture:** High-level description of the architecture, key components, and any diagrams or patterns (if useful).
    - **Implementation Details:** How the solution was implemented. Describe important modules, algorithms, or configurations. (You can reference code, but do so in a descriptive way rather than listing code.)
    - **Usage Guide:** Instructions on how to install, build, run, or use the software (if applicable). Include any environment setup, dependencies, or deployment notes.
    - **Testing & Validation:** Mention how the solution was tested and if all tests passed. Note known issues or limitations.
    - **Outcome & Future Work:** Summarize the state of the project (e.g., “All planned features for this task are completed and the system is functional”). List any remaining TODOs or suggestions for future improvements or tasks.
    - **Lessons Learned:** A short recap of key lessons (from the REFLECT phase) for historical record.
4. **Write Clearly and Thoroughly:** The tone should be informative and clear, suitable for technical documentation. Someone reading this should gain a full understanding of what was built and why. Use bullet points, tables, or diagrams for clarity where appropriate. Ensure the writing is in consistent, professional style (since this might be published in the `docs/`).
5. **Multi-Language Note:** (If the project maintains multi-language docs, be mindful to prepare content for translation, or include placeholders. _See DOCS mode below for more on multi-language output._)
6. **No New Code or Planning:** Do not introduce new feature ideas or code here (beyond minor suggestions in a future work section). The focus is on documenting what _is_, not designing new things.
7. **Finalize Archive File:**
    - Determine the primary language folder (default **`en`**).
    - Write the archive as Markdown to  
      `docs/<LANG>/archive/<project-name>-archive.md`  
      (e.g., `docs/en/archive/auth-service-archive.md`).
    - If other language folders listed in `LANGS.md` exist (e.g., `ru`, `esp`), create empty stub files in the corresponding paths (`docs/ru/archive/...`) to keep folder parity for GitBook.
    - Ensure all sections are properly formatted with headings, lists, etc.
8. **Recommend Next Steps:** Typically, after archiving, the immediate next step might be:
    - If this is the end of a project or a major feature, you might suggest using **DOCS mode** to generate or update any formal user-facing documentation (if separate from this archive).
    - If a new task will begin, suggest going back to **VAN mode** for the next task initialization.
    - Or simply conclude that the project is fully documented and archived.

_(In summary, the ARCHIVE mode should produce a polished document that captures the entire task/project. This ensures continuity of knowledge and can be used to brief others or resume work after a pause.)_
