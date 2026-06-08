# PlayCanvas Editor API and Realtime Sync Reference Notes

- WebSockets serve as the transport layer for realtime document synchronization.
- ShareDB collections:
  - `scenes`
  - `assets`
  - `settings`
- Operational Transformation (OT) uses `ot-text` to coordinate text edits in Monaco and JSON property edits in hierarchy/inspector panels.
- The Editor API exposes programmatic hooks:
  - `editor.call('selection:set', [...])`
  - `editor.call('entities:create', options)`
  - `editor.call('assets:create', options)`
