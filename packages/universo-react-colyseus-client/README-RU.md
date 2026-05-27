# @universo-react/colyseus-client

Workspace-обертка для `@colyseus/sdk@0.17.42`.

Пакет намеренно оставляет тонкую entry-точку и реэкспортирует публичный API Colyseus JavaScript/TypeScript client SDK:

```ts
export * from '@colyseus/sdk'
```

В реестре пакетов метахаба он сидируется как пакет, совместимый с client/browser и Node runtime.
