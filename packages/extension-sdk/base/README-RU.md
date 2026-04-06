# @universo/extension-sdk

Source-only scripting authoring primitives для runtime-модулей Universo.

## Overview

- Пакет потребляется напрямую из `src/index.ts`; `dist/`-выход не публикуется.
- Стабильный root barrel теперь реэкспортирует модульный SDK из `types`, `decorators`, `ExtensionScript`, `registry`, `widget` и `apis/*`.
- Экспортирует `ExtensionScript`, `AtServer`, `AtClient`, `AtServerAndClient` и `OnEvent`.
- Определяет shared runtime context contract для records, metadata, server RPC bridge и зарезервированных seams `http`/`state`/`log`/`i18n`.

## Authoring Rules

- Скрипты экспортируют класс, наследующий `ExtensionScript`.
- `AtClient()` помечает browser-методы, которые компилируются в client bundle.
- `AtServer()` помечает server-методы, которые остаются в server bundle.
- `AtServerAndClient()` оставляет метод доступным и в server bundle, и в client bundle.
- `OnEvent(...)` помечает server lifecycle handlers и не может сочетаться с client-exposed targets.
- `sdkApiVersion` сейчас ограничен значением `1.0.0`.
- Только non-lifecycle server-методы или shared-методы из скриптов с `rpc.client` доступны через `this.ctx.callServerMethod(...)`.
- Embedded-скрипты могут импортировать только `@universo/extension-sdk`; external или relative imports, `require()`, dynamic `import()` и `import.meta` не входят в поддерживаемый authoring contract.
- Декораторы должны оставаться внутри script authoring sources; обычные frontend bundles их не включают.

## Development

`pnpm --filter @universo/extension-sdk build`
`pnpm --filter @universo/extension-sdk lint`

## License

Omsk Open License