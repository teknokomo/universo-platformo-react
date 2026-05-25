# @universo-react/modules-engine

Compiler и isolated runtime host для опубликованных модулей Universo.

## Overview

-   Компилирует TypeScript module sources в нормализованные server и client bundles.
-   Извлекает metadata методов из декораторов `AtServer`, `AtClient` и `OnEvent`.
-   Предоставляет pooled isolated-vm execution с health monitoring и lifecycle dispatch helpers.

## Runtime Notes

-   Server execution использует `isolated-vm` с LRU-переиспользованием isolate-ов.
-   Повторные failures открывают per-bundle circuit breaker на время cooldown window.
-   Embedded-модули могут импортировать только `@universo-react/extension-sdk`; неподдерживаемые static imports, `require()`, dynamic `import()` и `import.meta` завершают compilation с ошибкой.
-   Client bundles предназначены для отдельного runtime endpoint client bundle.
-   Browser execution на стороне приложения должен использовать runtime с поддержкой Worker.
-   Browser worker runtime отключает ambient network, nested-worker и dynamic-code globals до загрузки client bundle.

## Development

`pnpm --filter @universo-react/modules-engine build`
`pnpm --filter @universo-react/modules-engine test`
`pnpm --filter @universo-react/modules-engine lint`

## License

Omsk Open License
