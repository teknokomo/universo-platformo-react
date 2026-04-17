---
description: Архитектура перехода от design-time к runtime для системы scripting в метахабах.
---

# Система скриптов

Система скриптов разделена на слои design-time authoring, publication и runtime execution.
Каждый слой нормализует один и тот же shared manifest contract, чтобы роль, source kind и capabilities оставались согласованными.

## Поток

1. В authoring-слое metahub сохраняются source code, scope привязки, роль модуля, source kind, объявленные capabilities и метаданные привязки Common/library.
2. Scripting engine валидирует чистые shared libraries, разрешает импорты `@shared/<codename>`, компилирует исходник в server и client bundles и формирует нормализованный manifest.
3. Publication sync копирует активные consumer scripts в runtime-таблицы приложения с уникальностью codename в рамках scope, а shared-library logic остаётся доступной через скомпилированные consumer-ы.
4. Runtime list endpoints отдают только metadata, а client bundle загружается через отдельный endpoint с ETag.
5. Server execution использует isolated-vm с пулом isolate-ов, health monitoring и capability-gated context bridge.

## Границы безопасности

- Во v1 поддерживается только embedded-authoring.
- Embedded-скрипты могут импортировать `@universo/extension-sdk`, а consumer scripts могут дополнительно импортировать Common libraries через `@shared/<codename>`; остальные static imports, `require()`, dynamic `import()` и `import.meta` завершают compilation с ошибкой.
- Scope привязки `general` зарезервирован для `library`, а новый authoring `library` вне рабочей области Resources отклоняется до сохранения bundles.
- Shared libraries должны оставаться чистыми: decorators, runtime ctx access и исполняемые runtime entrypoints отклоняются на этапе validation.
- Dependency-sensitive удаление shared-library, смена codename и циклы `@shared/*` завершаются fail-closed до того, как publication sync сможет произвести runtime state.
- Capabilities работают по deny-by-default модели, а недоступные API выбрасывают явные runtime errors.
- Клиентское выполнение требует browser runtime с Worker вместо fallback на main thread.
- Browser worker runtime отключает ambient network, nested-worker и dynamic-code globals до загрузки client bundle.
- Lifecycle dispatch пропускает скрипты, которые не объявляют capability lifecycle.

## Связанные поверхности

- `@universo/extension-sdk` задаёт author-facing base class и decorators.
- `@universo/scripting-engine` отвечает за compilation, bundle splitting, isolate pooling и health monitoring.
- Runtime routes applications отдают list, client bundle и server call endpoints для опубликованных скриптов.