# @universo-react/colyseus-server

Пакет рабочей области для `@colyseus/core@0.17.50`.

Wrapper использует Colyseus core package вместо полного `colyseus`, чтобы
workspace оставался совместимым с supply-chain политикой репозитория
`blockExoticSubdeps`.

Пакет намеренно оставляет тонкую entry-точку и реэкспортирует публичный API Colyseus server:

```ts
export * from '@colyseus/core'
```

В реестре пакетов метахаба он сидируется как пакет для server runtime.

## Гарантии рантайма

Продакшен-комната реального времени, построенная на этом wrapper, обеспечивает:

-   Awaited reconnect lifecycle: у сброшенных контроллеров место резервируется на 30-секундное окно и восстанавливается через ожидаемый (awaited) вызов `allowReconnection`; истекшие резервации завершаются по fail-closed через повторную проверку доступа.
-   Явный local presence: рантайм закрепляет `new LocalPresence()` при attach сервера и отклоняет переменную окружения `COLYSEUS_CLOUD`.
-   Phantom-seat guard: обрывы сессий с уже удалённым маппингом корабля очищаются немедленно вместо резервации места, а очистка места выполняется ровно один раз через идемпотентный `removeClientShip`.

Эти контракты покрыты real-server integration suite в `packages/universo-react-applications-backend/src/tests/realtime/realServerReconnect.integration.test.ts`.
