# PlayCanvas Editor Skills

PlayCanvas Editor Skills are specialized guidelines and prompt systems designed for AI coding assistants (like Codex, Gemini, Claude, and others) to ensure safe, compliant, and highly structured integration with the PlayCanvas Editor within the Universo Platform.

These skills represent best practices compiled from the official PlayCanvas manual and repository constraints.

## The 9 PlayCanvas Editor Skills

AI assistants automatically load or refer to these skills during development:

1. **`playcanvas-editor-interface`**
   - **Purpose:** Guides navigation and workspace manipulation in the PlayCanvas Editor interface, preventing agents from breaking layout settings or editor UI bounds.

2. **`playcanvas-editor-api-realtime`**
   - **Purpose:** Handles REST API calls and ShareDB realtime synchronization protocol, ensuring schema conformance and authentication handling.

3. **`playcanvas-editor-scenes`**
   - **Purpose:** Manages transitions, loading, unloading, and hierarchy parsing of PlayCanvas scenes without memory leaks.

4. **`playcanvas-editor-assets`**
   - **Purpose:** Handles registry creation, asynchronous assets loading, mapping, and GPU/RAM memory cleanup when destroying assets.

5. **`playcanvas-editor-scripting`**
   - **Purpose:** Defines the structure of entity scripts, correct lifecycle hook declarations (`initialize`, `update`, `postUpdate`, `destroy`), and safe hot-reloading.

6. **`playcanvas-editor-version-control`**
   - **Purpose:** Operates checkout, commits, branching, and conflict-resolution procedures within the PlayCanvas VCS pipeline.

7. **`playcanvas-editor-settings`**
   - **Purpose:** Validates physics, layers, viewport rendering options, and launch parameters.

8. **`playcanvas-editor-authoring`**
   - **Purpose:** Automates component mapping, entity hierarchy construction, and template instantiation.

9. **`playcanvas-editor-universo-compat`**
   - **Purpose:** Restricts agents to local ports and token management, preventing security leaks during PlayCanvas operations on the Universo Platform.

## Usage for Developers

When prompting AI assistants to modify any PlayCanvas Editor code:
- Ensure the agent reads the corresponding skill file under `.agents/skills/playcanvas-editor-*`.
- Verify code output against these criteria before committing changes.
