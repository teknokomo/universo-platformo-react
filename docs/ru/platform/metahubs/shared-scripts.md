---
description: Справочная страница о Common shared library scripts и их fail-closed правилах поставки.
---

# Shared Scripts

Shared scripts — это library modules из рабочей области Resources, которые публикуют reusable helper-ы для других metahub scripts.
Они являются import-only design assets и не раскрываются как прямые runtime entrypoints.

## Правила authoring

- Создавайте shared scripts только из Common -> Scripts.
- Всегда связывайте `attachedToKind=general` с `moduleRole=library`.
- Держите library code чистым, а исполняемое поведение выносите в consumer scripts.
- Импортируйте shared helper-ы из consumer-ов через `@shared/<codename>`.

## Правила fail-closed

- General scripts отклоняют роли, отличные от library.
- Новые library scripts отклоняют scope привязки, отличные от general.
- Delete и codename rename завершаются ошибкой, пока зависимые consumer-ы ещё импортируют library.
- Циклические `@shared/*` graphs падают до того, как publication сможет отгрузить runtime state.

## Publication и runtime

Publication валидирует shared libraries в dependency order до compilation consumer scripts.
Runtime оставляет shared-library logic доступной только через compiled consumers вместо показа library rows как executable runtime scripts.

## Что читать дальше

- [Metahub Scripts](scripts.md)
- [Script Scopes](script-scopes.md)
- [Metahub Scripting Guide](../../guides/metahub-scripting.md)
- [Scripting System](../../architecture/scripting-system.md)