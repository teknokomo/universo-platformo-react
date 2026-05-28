# @universo-react/colyseus-client

Workspace wrapper for `@colyseus/sdk@0.17.42`.

The package re-exports the public Colyseus JavaScript/TypeScript client SDK API and adds generic client-side helpers for movement intents, double-click activation, and snapshot interpolation.

```ts
export * from '@colyseus/sdk'
```

The upstream SDK can run in browser and Node-compatible environments, but the metahub package registry currently exposes this wrapper as a client/browser-targeted runtime package.
