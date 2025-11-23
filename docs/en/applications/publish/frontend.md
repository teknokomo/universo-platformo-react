# `packages/embed-frt` — Embeddable Publications Client (Chat/Widget) — [Status: Planned]

Purpose: extract embed widget publication (chatbots, etc.) into a separate frontend application, remove localhost dependency, and ensure stable publication and configuration.

Role in the roadmap: Phase 1 (Chatbot Publication → extract embed to a separate application). See `docs/ru/roadmap/implementation-plan/tasks-registry.md`.

Functionality (MVP):

-   Wrapper over FlowiseEmbedReact and configurable UI (theme, locale, data sources).
-   Connection to our publication APIs (preview/release), reading configurations from `publish-srv`.
-   Security: access tokens (JWT) for preview and limits.

Integrations:

-   `publish-srv` — publications registry, versions, and artifacts.
-   `template-engine-srv` — if widget asset pre-generation is required.
-   `auth-srv`/Supabase — issuing preview/access tokens.

See also: `applications/publish/README.md`, `applications/platform-core/template-engine.md`.
