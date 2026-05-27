# @universo-react/colyseus-server

Пакет рабочей области для `@colyseus/core@0.17.43`.

Wrapper использует Colyseus core package вместо полного `colyseus`, чтобы
workspace оставался совместимым с supply-chain политикой репозитория
`blockExoticSubdeps`.

Пакет намеренно оставляет тонкую entry-точку и реэкспортирует публичный API Colyseus server:

```ts
export * from '@colyseus/core'
```

В реестре пакетов метахаба он сидируется как пакет для server runtime.
