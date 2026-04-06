---
description: Архитектура перехода от design-time к runtime для системы scripting в метахабах.
---

# Scripting System

Система scripting разделена на слои design-time authoring, publication и runtime execution.
Каждый слой нормализует один и тот же shared manifest contract, чтобы роль, source kind и capabilities оставались согласованными.

## Flow

1. В authoring-слое метахаба сохраняются source code, scope привязки, роль модуля, source kind и объявленные capabilities.
2. Scripting engine компилирует исходник в server и client bundles и формирует нормализованный manifest.
3. Publication sync копирует активные скрипты в runtime-таблицы приложения с уникальностью codename в рамках scope.
4. Runtime list endpoints отдают только metadata, а client bundle загружается через отдельный endpoint с ETag.
5. Server execution использует isolated-vm с пулом isolate-ов, health monitoring и capability-gated context bridge.

## Safety Boundaries

- Во v1 поддерживается только embedded-authoring.
- Embedded-скрипты могут импортировать только `@universo/extension-sdk`; неподдерживаемые static imports, `require()`, dynamic `import()` и `import.meta` завершают compilation с ошибкой.
- Capabilities работают по deny-by-default модели, а недоступные API выбрасывают явные runtime errors.
- Клиентское выполнение требует browser runtime с Worker вместо fallback на main thread.
- Browser worker runtime отключает ambient network, nested-worker и dynamic-code globals до загрузки client bundle.
- Lifecycle dispatch пропускает скрипты, которые не объявляют capability lifecycle.

## Related Surfaces

- `@universo/extension-sdk` задаёт author-facing base class и decorators.
- `@universo/scripting-engine` отвечает за compilation, bundle splitting, isolate pooling и health monitoring.
- Runtime routes applications expose list, client bundle и server call endpoints для опубликованных скриптов.