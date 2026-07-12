# @universo-react/types

> 🔧 Основные протоколы и типы ECS домена для Universo Platformo

## Информация о пакете

| Поле           | Значение                             |
| -------------- | ------------------------------------ |
| **Имя пакета** | `@universo-react/types`              |
| **Версия**     | Смотрите `package.json`              |
| **Тип**        | TypeScript-first (Типы и интерфейсы) |
| **Сборка**     | ES модуль с определениями типов      |
| **Назначение** | Основные протоколы и типы ECS домена |

## 🚀 Ключевые возможности

-   🔧 **ECS компоненты** - Система Entity-Component-System типов
-   🌐 **Networking DTO** - Intent/Ack/Snapshot/Delta/Event протоколы
-   ❌ **Коды ошибок** - Стандартизированные коды ошибок
-   📦 **Версионирование протоколов** - Контроль версий протоколов
-   📋 **Строгая типизация** - Полная поддержка TypeScript
-   🔄 **Обратная совместимость** - Сохранение совместимости версий
-   🧾 **Record Behavior Types** - Общие контракты нумерации, lifecycle и posting для Object
-   📊 **Ledger Types** - Общие контракты append-only Ledger configuration, field roles, source policies и projections
-   🧭 **Контракт макета трактовочной сети** - Общие равноправные представления Матрицы, допустимый набор, представление по умолчанию, проверка согласованности и нормализация для метахаба, Панели приложения и опубликованного интерфейса

## Описание

Базовые типы протокола и доменные типы ECS для Universo Platformo.

### Область применения:

-   Компоненты ECS
-   Сетевые DTO (Intent/Ack/Snapshot/Delta/Event)
-   Коды ошибок
-   Версия протокола
-   Metahub entity component manifests
-   Контракты Object `recordBehavior` и Ledger configuration
-   Строгая конфигурация макета `interpretationNetworkWorkspace`, включая `matrixMode`, `allowedMatrixViews` и `defaultMatrixView`

### Вне области применения:

-   Типы UPDL для этапа проектирования
-   Типы публикации (остаются в соответствующих пакетах)

## Правила совместимости

-   **Не переименовывайте** существующие поля и не меняйте их семантику
-   **Добавляйте новые поля** только как опциональные, чтобы сохранять обратную совместимость
-   **Расширяйте** объединения компонентов и событий добавлением новых ключей

## Object и Ledger Contracts

`common/recordBehavior` определяет общий metadata contract, который превращает стандартный Object в reference, transactional или hybrid collection.
Он описывает identity fields, atomic numbering, effective dates, lifecycle states, posting target ledgers и immutability проведённых строк.

`common/ledgers` определяет стандартную Ledger configuration.
Code-facing kind остаётся `ledger`; русская UI-метка: "Регистры".
Ledgers классифицируют обычные field definitions через `fieldRoles` и используют source policies, чтобы различать manual writes и registrar-owned posting writes.

## Контракт представлений Матрицы трактовочной сети

`common/applicationLayouts` является единым межпакетным контрактом виджета `interpretationNetworkWorkspace`:

-   `matrixMode` описывает семантику данных: `hierarchicalCells` или `independentRows`.
-   `allowedMatrixViews` задаёт непустое подмножество равноправных представлений `table`, `horizontalRows` и `verticalTree`.
-   `defaultMatrixView` обязан входить в допустимый набор.
-   `tableProjection` по умолчанию равен `hierarchicalPath`; для вторичной таблицы строк и колонок можно выбрать `independentAxes`.
-   `breadcrumbDepth` по умолчанию показывает полный путь; ограничение `last` допускает только значения из общего списка.
-   `toolbarLayout` по умолчанию равен `horizontal`; `vertical` доступен как явная настройка отображения.
-   `showHierarchicalTableHeaders` по умолчанию равен `false`; иерархическая таблица может показывать заголовки колонок текущего уровня и ячейки только при явном включении.
-   `showHierarchicalTableHeaderCard` по умолчанию равен `true`; выбранная родительская ячейка остаётся отдельной карточкой над таблицей строк до перехода в хлебные крошки.
-   `colorBreadcrumbsByCell` по умолчанию равен `true`; боксы хлебных крошек используют заданный цвет ячейки и сохраняют отдельный эффект наведения и фокуса.
-   `verticalTree` не допускается для `independentRows`; `table` и `horizontalRows` остаются совместимыми.
-   `normalizeInterpretationNetworkMatrixViewSettings()` нормализует неполные или недоверенные значения на границах интерфейса и среды выполнения; сохраняемую конфигурацию виджета проверяет строгая схема Zod.
-   `normalizeInterpretationNetworkTableSettings()` одинаково исправляет табличную проекцию, глубину хлебных крошек, расположение панели, необязательные заголовки, карточку выбранного родителя, счётчик ячеек дерева и окраску хлебных крошек в шаблоне, настройках Приложения и runtime-парсинге.

Контракт меняет только конфигурацию виджета. Он не добавляет миграцию схемы базы данных и не требует увеличения версии шаблона метахаба.

## Установка (workspace)

Пакет расположен по пути `packages/universo-react-types` и подключается другими пакетами монорепозитория через `workspace:*`.

## Тестирование

Запуск тестов регрессии на уровне типов с помощью Vitest:

```bash
pnpm --filter @universo-react/types test
```

## Вклад в разработку

При вкладе в этот пакет:

1. Следуйте лучшим практикам TypeScript и поддерживайте строгую типизацию
2. Документируйте все экспортируемые типы с помощью JSDoc комментариев
3. Убедитесь, что определения типов соответствуют схемам бэкенда
4. Обновляйте документацию EN и RU
5. Следуйте стандартам кодирования проекта
6. Добавляйте тесты для сложных type guards и утилит

## Связанная документация

-   [Индекс пакетов](../../README-RU.md)
-   [Core Backend](../universo-react-core-backend/README-RU.md)
-   [Core Frontend](../universo-react-core-frontend/README-RU.md)
-   [Документация TypeScript](https://www.typescriptlang.org/docs/)

## Лицензия

Omsk Open License

---

_Universo Platformo | Пакет Types_
