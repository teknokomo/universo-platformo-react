# @universo-react/playcanvas-engine

Workspace wrapper for `playcanvas@2.21.4`.

The package re-exports the public PlayCanvas engine API and adds generic browser runtime helpers for bounded canvas applications, primitive entities, translucent materials, low-poly sphere meshes, scene fog, follow-camera transforms, zoom/rotation controls, and AABB metadata.

```ts
export * from 'playcanvas'
```

It is seeded into the metahub package registry as a client/browser-targeted package.

## Canvas identity & input ownership

`createBasicApplication` takes an options object (`{ canvas, applicationId?, windowKeyboard? }`) and returns `{ app, destroy }`. When `applicationId` is provided it is applied to the canvas element (`canvas.id`), because the engine keys its application registry by canvas id, and it is removed again by `destroy()`. Keyboard input attaches to the canvas unless `windowKeyboard: true` is passed, so concurrent widgets never steal each other's keyboard events. The engine requires WebGL2; when WebGL2 is unavailable the surrounding runtime surface renders a localized terminal state (`playcanvasCanvas.webglUnavailable`).
