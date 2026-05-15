---
description: Runtime-руководство по стандартным Ledger entities и append-only операционным фактам.
---

# Руководство по Регистрам

Регистры являются стандартными `ledger` entities для append-only операционных фактов.
Они предназначены для отчётов, projections, posting и script-controlled audit trails.

![Рабочее пространство сущностей для стандартных типов метаданных](../.gitbook/assets/entities/entities-workspace.png)

## Authoring

Создавайте Регистры в том же Entity workspace, что и другие стандартные типы.
В меню метахаба Регистры расположены после Перечислений.
Поля Регистра используют общий UI field definitions, а `config.ledger.fieldRoles` классифицирует каждое поле как dimension, resource, measure, period field, source reference, workspace scope или обычный component.

В metadata и API используется code-facing термин `ledger`.
Русская UI-метка: "Регистры".

## Runtime API

Опубликованные приложения предоставляют операции Регистров через отдельные runtime routes:

- `GET /api/v1/applications/:applicationId/runtime/ledgers`
- `GET /api/v1/applications/:applicationId/runtime/ledgers/:ledgerId/facts`
- `POST /api/v1/applications/:applicationId/runtime/ledgers/:ledgerId/facts`
- `POST /api/v1/applications/:applicationId/runtime/ledgers/:ledgerId/facts/reverse`
- `POST /api/v1/applications/:applicationId/runtime/ledgers/:ledgerId/query`
- `GET /api/v1/applications/:applicationId/runtime/ledgers/:ledgerId/projections/:projectionCodename`

Регистры намеренно исключены из generic runtime row CRUD.
Это хранилища фактов, а не редактируемые списки записей.

## Source Policy

Ledger configuration управляет тем, кто может добавлять или сторнировать факты:

- `manual` разрешает прямые авторизованные API или script calls.
- `registrar` разрешает platform registrar flows, например Object posting.
- `mixed` разрешает оба режима, если у вызывающего есть нужные permission и capability.

Registrar-only Регистры также могут ограничивать разрешённые registrar kinds.
Object posting записывает факты с registrar kind `object`.

## Reversal

Reversal является append-only.
Runtime создаёт компенсирующий факт вместо изменения или удаления исходного факта.
Команды unpost и void у транзакционных Object используют сохранённую posting movement metadata для безопасного сторнирования прежних движений.

## Reporting

Projection queries принимают только объявленные dimensions и resources.
Backend строит schema-qualified, parameterized SQL на основе metadata и отклоняет неизвестные поля.
Dashboard widgets должны читать Ledger facts или projections через generic datasource descriptors, а не через LMS-specific widget code.
