---
description: Как сущности Catalog используют record behavior для справочников, документов и проведения.
---

# Транзакционные каталоги

Catalog entities являются операционным типом коллекций платформы.
Один и тот же стандартный тип `catalog` может оставаться справочным списком или работать как документоподобная коллекция через `config.recordBehavior`.

![Строки Catalog в опубликованном приложении](../.gitbook/assets/entities/catalog-records.png)

## Record Behavior

`recordBehavior` является метаданными, а не захардкоженной LMS-логикой.
Он настраивается в метахабе, попадает в publication snapshots, синхронизируется в схему приложения и применяется в runtime с учётом рабочего пространства.
UI настройки открывается через общий конструктор Entities: любой тип сущности, у которого в манифесте компонентов включены
`identityFields`, `recordLifecycle` или `posting`, может добавить вкладку `behavior` в `ui.tabs`.
Стандартный тип Catalog включает эти компоненты по умолчанию, поэтому новые и существующие Каталоги используют общую форму
«Поведение», а не отдельный Catalog-only интерфейс.

Блок поведения может включать:

- identity fields для стабильного отображения и проверок дублей
- атомарную нумерацию записей
- effective dates
- lifecycle states, например draft, posted, voided и archived
- posting в объявленные Регистры
- неизменяемость проведённых строк

Справочные каталоги оставляют эти возможности выключенными.
Транзакционные каталоги включают только нужные части.

## Posting Flow

Posting является командой платформы, а не прямой записью в таблицу.
Runtime routes проверяют права, состояние записи, workspace scope и конфигурацию каталога перед изменением строки.

Когда posting включён:

1. Lifecycle-скрипты `beforePost` выполняются внутри активной транзакции.
2. Скрипты могут вернуть declarative posting movements только для Регистров, объявленных в `recordBehavior.posting.targetLedgers`.
3. Платформа добавляет Ledger facts через Ledger service и сохраняет metadata движений на строке Catalog.
4. Catalog row переходит в posted state только если все движения выполнены успешно.

Команды unpost и void не изменяют прежние Ledger facts.
Они добавляют компенсирующие факты из сохранённой metadata движений и затем очищают posting metadata на строке.

## Safety Rules

- Проведённые строки неизменяемы, если включён `recordBehavior.posting.immutableWhenPosted`.
- Прямые Ledger writes отклоняются, если Регистр допускает только registrar-origin writes.
- Posting scripts могут использовать `ctx.ledger` только с объявленными capabilities.
- Runtime SQL остаётся schema-qualified и parameterized через backend service layer.

## LMS Usage

Канонический LMS template использует транзакционные каталоги для enrollments, assignments, quiz attempts, attendance, certificates и связанных операционных событий.
Эти каталоги остаются обычными Catalog entities; LMS-поведение задаётся metadata, scripts, layouts и Регистрами, а не отдельным LMS runtime fork.
