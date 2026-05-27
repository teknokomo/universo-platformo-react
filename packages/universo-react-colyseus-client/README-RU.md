# @universo-react/colyseus-client

Workspace-обертка для `@colyseus/sdk@0.17.42`.

Пакет намеренно оставляет тонкую entry-точку и реэкспортирует публичный API Colyseus JavaScript/TypeScript client SDK:

```ts
export * from '@colyseus/sdk'
```

Upstream SDK совместим с browser и Node-окружениями, но реестр пакетов метахаба сейчас предоставляет эту обёртку как client/browser-targeted runtime package.
