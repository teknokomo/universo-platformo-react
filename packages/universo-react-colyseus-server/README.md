# @universo-react/colyseus-server

Workspace wrapper for `@colyseus/core@0.17.43`.

The wrapper uses the Colyseus core package instead of the full `colyseus`
package so the workspace stays compatible with the repository
`blockExoticSubdeps` supply-chain policy.

The package intentionally keeps a thin entry point and re-exports the public Colyseus server API:

```ts
export * from '@colyseus/core'
```

It is seeded into the metahub package registry as a server-targeted package.
