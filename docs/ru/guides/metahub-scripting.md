---
description: Подробное v1-руководство по созданию, публикации и выполнению metahub-скриптов.
---

# Скрипты Metahub

Система скриптов Metahub — это текущий v1-путь расширения для настраиваемого поведения во время выполнения.
Один и тот же контракт покрывает создание в интерфейсе metahub, упаковку в publication, sync в application и выполнение runtime.

## Что умеют скрипты

Сейчас скрипты покрывают четыре продуктовые задачи:

- добавлять серверную логику, которая реагирует на runtime-события;
- отдавать клиентский код для widget и интерактивного UI;
- разделять переиспользуемые helper-ы раздела Common через модули `general/library` и импорты `@shared/<codename>`;
- прикреплять настраиваемую логику к Common, уровню metahub и entity-level поверхностям проектирования.

## Поддерживаемый контракт

| Ось | Текущий контракт |
| --- | --- |
| Source kind | В интерфейсе включено только встроенное редактирование `embedded`. |
| SDK compatibility | Поддерживается только `sdkApiVersion = 1.0.0`. |
| Imports | `@universo/extension-sdk` разрешён всегда; consumer scripts также могут импортировать Common libraries через `@shared/<codename>`. |
| Roles | `module`, `lifecycle`, `widget` и `library`. |
| Attachment scopes | `general` в Common только для `library`, плюс metahub, hub, catalog, set, enumeration и attribute для исполняемых consumer-ов. |
| Client runtime | Browser Worker runtime с fail-closed fallback, если Worker недоступен или выполнение вышло за лимит времени. |
| Server runtime | Выполнение в пуле `isolated-vm` на стороне applications backend. |

## Порядок создания

1. Откройте вкладку Scripts в Common для shared libraries или у metahub / конкретной attached entity для consumer-ов.
2. Создайте новый script и выберите module role до редактирования кода.
3. Оставьте source kind как Embedded и объявляйте только те capability, которые реально нужны script-у.
4. Экспортируйте класс, который наследует `ExtensionScript`.
5. Помечайте callable methods через `@AtClient()`, `@AtServer()`, `@AtServerAndClient()` или `@OnEvent(...)`.
6. Сохраните draft и исправьте любую fail-closed validation error до публикации.

## Роли и capability

Выбор роли — не косметика. Он управляет разрешёнными capability, значениями по умолчанию и правилами раскрытия runtime.

| Роль | Типичное использование | Важные примечания |
| --- | --- | --- |
| `widget` | Интерактивные виджеты, например виджет квиза. | Черновики widget по умолчанию получают client RPC capability, необходимый runtime bridge. |
| `module` | Общие модули бизнес-логики. | Используйте для runtime-хелперов, не связанных с widget. |
| `lifecycle` | Серверные хуки, реагирующие на события. | Lifecycle-handlers никогда не вызываются через публичный runtime RPC. |
| `library` | Общие helper-ы раздела Common. | Libraries работают только на импорт, должны оставаться чистыми и не могут объявлять decorators или runtime ctx access. |

## Shared Library Contract

- Скрипты library создаются только из Common -> Scripts со scope привязки `general`.
- `general` и `library` неразделимы: Common отклоняет любую другую роль для `general`, а новый authoring `library` отклоняется вне Common/general.
- Libraries компилируются для dependency resolution и validation до сборки consumer scripts.
- Consumer scripts импортируют их через `@shared/<codename>` и сохраняют обычные scope-specific правила привязки.
- Libraries не раскрываются как прямые runtime entrypoints, RPC targets или lifecycle-handlers.
- Удаление, смена codename и циклы `@shared/*` завершаются fail-closed до того, как publication сможет отгрузить сломанный dependency graph.

## Поток publication и выполнения

1. Design-time scripts живут в metahub storage и редактируются из вкладки Scripts.
2. Генерация publication валидирует и компилирует shared libraries в topological dependency order, а затем сериализует метаданные script, исходный код и скомпилированные runtime bundles в snapshot publication.
3. Синхронизация application копирует опубликованный контракт consumer scripts в `_app_scripts`, а shared-library material остаётся доступным только через скомпилированные consumer-ы.
4. List-endpoints runtime возвращают только metadata опубликованных consumer scripts и никогда не встраивают исполняемые bundles.
5. Клиентский код загружается из отдельного endpoint-а client bundle.
6. Серверные вызовы идут через route вызова runtime-script и остаются под проверками capability.

## Семантика декораторов

- `@AtClient()` помечает метод, который выполняется в браузере.
- `@AtServer()` помечает метод, который выполняется на сервере.
- `@AtServerAndClient()` оставляет один метод доступным в обоих бандлах.
- `@OnEvent(...)` объявляет lifecycle-handler, который вызывается событиями, а не через public RPC.
- Вспомогательные методы без декораторов остаются private для класса.

## Контракт виджета квиза

В текущем сценарии квиза используется скрипт с ролью `widget`, который питает `quizWidget` на dashboard приложения.

```json
{
	"type": "quizWidget",
	"scriptCodename": "quiz-widget"
}
```

Стандартный runtime bridge ожидает клиентский метод `mount()` и серверный метод `submit()`.
Необязательная конфигурация widget может переопределить эти имена, но встроенный стартовый шаблон квиза использует значения по умолчанию.

## Правила fail-closed

- Неподдерживаемые версии SDK отклоняются на этапах редактирования, нормализации publication и загрузки runtime.
- Неподдерживаемые imports, `require()`, dynamic `import()` и `import.meta` отклоняются до bundling.
- Public runtime RPC может вызывать только non-lifecycle server methods у scripts, которые объявляют `rpc.client`.
- Если `_app_scripts` нельзя подготовить во время sync, application sync падает вместо тихого пропуска scripts.
- Если браузер не может дать Worker runtime или выполнение зависает дольше допустимого бюджета, выполнение завершается по fail-closed-сценарию.

## Рекомендуемая последовательность поставки

1. Создайте script в metahub.
2. Прикрепите widget или другой consumer к layout.
3. Опубликуйте version, которая содержит обновлённый script.
4. Синхронизируйте или создайте linked application.
5. Проверьте runtime-поведение на `/a/:applicationId`.

Для конкретного примера, созданного через браузер, переходите к [туториалу по приложению-квизу](quiz-application-tutorial.md).