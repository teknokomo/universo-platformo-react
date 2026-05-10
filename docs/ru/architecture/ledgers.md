---
description: Стандартный тип сущности Ledger и его границы в платформе.
---

# Регистры

`ledger` является стандартным типом сущности метахаба для append-oriented операционных фактов.
Это платформенный термин для универсальных регистров: поведение регистров сведений, накопления, оценок, прогресса, бухгалтерских и расчётных сценариев моделируется через один типизированный блок настроек, а не через отдельные семейства сущностей.

## Модель настройки

Регистры настраиваются в том же рабочем пространстве Entity, что и другие стандартные типы.
В меню метахаба Регистры расположены после Перечислений, а для списка, диалогов, поиска, пагинации и настроек используется общий generic Entity UI.

Поля регистра являются обычными field definitions.
Блок `config.ledger.fieldRoles` классифицирует эти поля как dimensions, resources, measures, attributes, period fields, source references или workspace scope.
Так настройка регистров остаётся совместимой с существующим редактором полей и не создаёт отдельный Ledger-only schema designer.

## Snapshot-модель

Определения регистров являются метаданными, поэтому экспортируются в publication snapshots вместе с entity definition, fields, presentation и `config.ledger`.
Операционные факты регистров не являются обычными записями Catalog и по умолчанию не экспортируются как seeded runtime rows.

Каталоги также могут хранить `config.recordBehavior`.
Этот блок описывает reference, transactional или hybrid поведение, включая identity fields, numbering, effective dates, lifecycle states и posting policy.

## Runtime-граница

Регистры исключены из generic runtime row CRUD.
Runtime Catalog rows остаются пользовательской операционной поверхностью, а Регистры предназначены для posting, reporting, projections и script-controlled fact append flows.

Транзакционное поведение Каталогов принадлежит платформе.
Генерация runtime-схемы добавляет колонки `_app_record_*` и `_app_post*` для Каталогов с включенным `recordBehavior`, а также `_app_record_counters` для атомарной нумерации.
API команд записей:

- `POST /api/v1/applications/:applicationId/runtime/rows/:rowId/post`
- `POST /api/v1/applications/:applicationId/runtime/rows/:rowId/unpost`
- `POST /api/v1/applications/:applicationId/runtime/rows/:rowId/void`

Эти команды используют блокировку строки, optimistic version check при переданной версии, lifecycle hooks, атомарную нумерацию через один upsert-запрос и fail-closed проверки недопустимых переходов.
Опубликованные или аннулированные записи становятся неизменяемыми для обычных row и tabular mutations, если это требует `recordBehavior.immutability`.

Универсальный runtime API Регистров монтируется под маршрутами:

- `GET /api/v1/applications/:applicationId/runtime/ledgers`
- `GET /api/v1/applications/:applicationId/runtime/ledgers/:ledgerId/facts`
- `POST /api/v1/applications/:applicationId/runtime/ledgers/:ledgerId/facts`
- `POST /api/v1/applications/:applicationId/runtime/ledgers/:ledgerId/facts/reverse`
- `POST /api/v1/applications/:applicationId/runtime/ledgers/:ledgerId/query`
- `GET /api/v1/applications/:applicationId/runtime/ledgers/:ledgerId/projections/:projectionCodename`

Маршруты добавления и сторнирования фактов проверяют, что целевой объект является `ledger`, валидируют имена таблицы и колонок, отклоняют неизвестные поля, соблюдают обязательные роли полей и только добавляют новые факты.
Сторнирование создаёт компенсирующие факты и никогда не изменяет исходные факты.
Они не экспортируют универсальные операции обновления или удаления для фактов Регистра.

Скрипты могут запрашивать capabilities `posting`, `ledger.read` и `ledger.write`.
Проверки capabilities остаются fail-closed: скрипт без нужного capability не должен читать или записывать факты регистра.
Runtime-скрипты получают `this.ctx.ledger` с методами `list`, `facts`, `query`, `append` и `reverse` только через эти проверки capabilities.

Lifecycle handlers `beforePost` также могут вернуть declarative movement result:

```ts
return {
  movements: [
    {
      ledgerCodename: 'ProgressLedger',
      facts: [{ data: { Learner: learnerId, ProgressDelta: 1 } }]
    }
  ]
}
```

Runtime принимает этот контракт только для регистров, объявленных в `config.recordBehavior.posting.targetLedgers`.
Движения добавляются через generic Ledger service внутри той же posting transaction.
Неверная структура movement, необъявленный регистр, неизвестные поля регистра или ошибка добавления фактов прерывают posting и не запускают `afterPost`.

## Использование в LMS

Канонический LMS template определяет `ProgressLedger` и `ScoreLedger`.
Они моделируют факты прогресса и результатов, сохраняя LMS как конфигурацию, а не runtime fork.
Generic dashboard widgets и reports должны читать ledger projections через общие datasource contracts, а не через LMS-specific widgets.
