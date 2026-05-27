# @universo-react/colyseus-client

Workspace wrapper for `@colyseus/sdk@0.17.42`.

The package intentionally keeps a thin entry point and re-exports the public Colyseus JavaScript/TypeScript client SDK API:

```ts
export * from '@colyseus/sdk'
```

It is seeded into the metahub package registry as a client/browser and Node-compatible package.
