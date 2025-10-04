# API Reference

Using Flowise public API, you can programmatically execute many of the same tasks as you can in the GUI. This section introduces Flowise REST API.

## Unik Routing Model (Universo Platformo Extension)

Universo Platformo introduces a two‑layer routing pattern for Unik entities while keeping backward compatibility with existing Flowise style nested resource paths:

* Collection endpoints (list & create) live under: `GET /api/v1/uniks`, `POST /api/v1/uniks`
* Singular (one entity) endpoints use a singular base path: `GET /api/v1/unik/:unikId`, `PUT /api/v1/unik/:unikId`, `DELETE /api/v1/unik/:unikId`
* Nested resources (canvases, credentials, variables, apikeys, spaces, etc.) are mounted under the singular pattern: `/api/v1/unik/:unikId/<resource>`
* Legacy form `/api/v1/uniks/:unikId/<resource>` continues to function for backward compatibility but is considered deprecated for UI navigation.

### Unified Parameter Naming

All controllers now consistently use `req.params.unikId` for unik identification. The backend routes have been updated to use `:unikId` parameter naming throughout the nested resource endpoints, providing consistency with frontend expectations and eliminating parameter transformation middleware.

### Migration Guidance

* Prefer the singular base (`/unik/:unikId`) for all new integrations.
* Keep using `/uniks` only for collection level operations.
* Audit any hardcoded `/uniks/:unikId` singular usages and migrate to `/unik/:unikId`.

### Error Changes

If the unik identifier is missing, controllers now reliably respond with a validation or access error instead of an unexpected `412 Precondition Failed` caused by absent `unikId`.

---

* [Assistants](assistants.md)
* [Attachments](attachments.md)
* [Chat Message](chat-message.md)
* [Canvases](canvases.md)
* [Document Store](document-store.md)
* [Feedback](feedback.md)
* [Leads](leads.md)
* [Ping](ping.md)
* [Prediction](prediction.md)
* [Tools](tools.md)
* [Upsert History](upsert-history.md)
* [Variables](variables.md)
* [Vector Upsert](vector-upsert.md)
