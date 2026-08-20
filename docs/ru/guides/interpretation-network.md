---
description: Концептуальный обзор и точка входа в документацию трактовочной сети.
---

# Трактовочная сеть

Шаблон **Трактовочная сеть** добавляет рабочее пространство опубликованного приложения для иерархических матриц понятий, типизированных трактовок, связей, материалов и переиспользуемых шаблонов Матрицы.

Полный пользовательский сценарий описан в отдельном GitBook-разделе:

-   [Руководство пользователя трактовочной сети](../interpretation-network/README.md)
-   [Начало работы](../interpretation-network/getting-started.md)
-   [Создание и публикация](../interpretation-network/create-and-publish.md)
-   [Настройки приложения](../interpretation-network/application-settings.md)
-   [Рабочее пространство и Матрица](../interpretation-network/workspace-and-matrix.md)
-   [Ячейки и Материалы](../interpretation-network/cells-and-materials.md)
-   [Шаблоны](../interpretation-network/templates.md)
-   [Решение проблем](../interpretation-network/troubleshooting.md)

## Что входит

-   Предзаданная модель приложения **Structure / Interpretation / Relation / Material**.
-   Рабочее пространство Матрицы с режимом одной системы и режимом нескольких Структур.
-   Равноправные представления Матрицы: таблица, горизонтальная иерархия и вертикальная иерархия.
-   Материалы, прикреплённые к выбранным ячейкам.
-   Шаблоны рабочего пространства для повторного использования структур Матрицы.
-   Настройки приложения для поведения Матрицы в конкретном развёртывании.

## Рабочий контракт

Фикстуры обновляются через Playwright и проверяются контрактными скриптами. Канонический снимок поставляет модель приложения и стартовое рабочее пространство; пользователи создают собственные Структуры, ячейки Матрицы, Материалы и шаблоны в опубликованном приложении.

Используйте эти проверки при работе с функционалом:

```bash
pnpm run check:interpretation-network-fixture-contract
pnpm run docs:interpretation-network:check
pnpm run test:e2e:interpretation-network:verify:local-supabase
```

## Связанная документация

-   [Модель данных трактовочной сети](../architecture/interpretation-network-data-model.md)
-   [Макеты приложения](application-layouts.md)
-   [Экспорт и импорт снимков](snapshot-export-import.md)
-   [Контроль качества Runtime UI UX](../contributing/runtime-ui-ux-quality-gate.md)
