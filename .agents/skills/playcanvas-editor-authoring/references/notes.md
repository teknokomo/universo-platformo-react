# PlayCanvas Editor Authoring Reference Notes

-   Pinned version of the editor frontend is `v2.30.4`.
-   The vendored editor's embedded engine dependency is `playcanvas@2.21.3`; the published runtime engine remains a separate `playcanvas@2.21.4` package.
-   Upstream editor builds are placed in the `vendor/` directory and served as static assets through the frontend packages.
-   The editor boot process follows:
    1. Iframe is mounted by the host page.
    2. The host page injects the configuration options via the `window.config` object.
    3. The editor initializes its modules, checks the token origin, and establishes WebSocket connections.
-   Ensure strict division between editor-facing static assets and runtime dependencies.
