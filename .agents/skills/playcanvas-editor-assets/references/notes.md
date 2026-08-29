# PlayCanvas Editor Assets Reference Notes

-   The current Universo surface supports folders, scripts, JSON, CSS, HTML, text, shader, image, and metadata-only asset rows.
-   Asset database records are stored in the project-scoped `assets` ShareDB-compatible document collection and metahub project tables.
-   Asset metadata and script attributes use Zod schemas before persistence; script parse results arrive through the realtime pipeline frame.
-   Text-like files are stored under the project `assets` namespace with MIME, size, and lowercase SHA-256 metadata. Broad binary conversion and bucket delivery are outside the current surface.
