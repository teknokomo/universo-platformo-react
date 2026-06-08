# PlayCanvas Editor Universo Compatibility Reference Notes

- Security boundary rules:
  - Sandbox options must include `allow-scripts` and `allow-same-origin` to allow WebGL rendering and local token communication.
  - The iframe must NOT have `allow-top-navigation` or access to the host DOM.
- Token service generates short-lived compatibility tokens signed via HMAC-SHA256, binding the token to the client's HTTP origin.
- Storage adapters map editor documents to metahub-scoped database tables (e.g. `playcanvas_projects`, `playcanvas_project_snapshots`).
