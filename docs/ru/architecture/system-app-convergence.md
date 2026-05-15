---
description: Fixed system-app convergence model for application-like schemas.
---

# Конвергенция системных приложений

Эта страница документирует converged model для фиксированных системных приложений платформы.

## Область действия

Фиксированные системные приложения:
- `admin`
- `profiles`
- `metahubs`
- `applications`

Все четыре схемы теперь bootstrapped как application-like fixed schemas.

## Структурные правила

- Бизнес-таблицы используют канонические префиксы `obj_`, `doc_`, `rel_` и `cfg_`.
- Бизнес-строки fixed system apps используют двойные lifecycle layers `_upl_*` и `_app_*`.
- Ветвевые схемы сохраняют поля `_mhb_*` и не входят в это правило конвергенции.
- Динамические схемы приложений сохраняют поля `_app_*` и тот же naming contract.

## Поток bootstrap

1. Выполнить pre-schema platform migrations, подготавливающие общие database capabilities.
2. Сгенерировать fixed system-app schemas из registered manifest-driven schema plans.
3. Выполнить post-schema platform migrations, зависящие от generated fixed tables.
4. Выполнить bootstrap metadata `_app_objects` и `_app_components` для fixed schemas.
5. Пропускать повторный metadata sync только когда live fingerprint совпадает с compiled target.

## Границы ответственности

- `@universo/migrations-platform` владеет manifest loading, schema plan compilation и fixed-schema bootstrap orchestration.
- `@universo/metahubs-backend` владеет publication runtime sources и publication authoring logic.
- `@universo/applications-backend` владеет application runtime sync и diff routes.
- `@universo/core-backend` композирует publication source seam с application-owned sync routes.

## Контракт приёмки

- Fresh bootstrap должен создавать canonical fixed schemas без rename-style reconciliation в active manifest path.
- Publication-created application bootstrap должен идти через publication runtime source seam в application-owned sync.
- Manifest validation rules не должны разрешать значения длиннее backing PostgreSQL columns.
- Кросс-пакетное регрессионное покрытие должно существовать и для формы фиксированного bootstrap, и для пути синхронизации от публикации к приложению.
