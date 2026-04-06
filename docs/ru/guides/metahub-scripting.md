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
- разделять read-only metadata helpers между сценариями редактирования и выполнения;
- прикреплять настраиваемую логику к поверхностям проектирования metahub и entity.

## Поддерживаемый контракт

| Ось | Текущий контракт |
| --- | --- |
| Source kind | В интерфейсе включено только встроенное редактирование `embedded`. |
| SDK compatibility | Поддерживается только `sdkApiVersion = 1.0.0`. |
| Imports | Разрешены только импорты из `@universo/extension-sdk`. |
| Roles | `module`, `lifecycle`, `widget` и `global`. |
| Attachment scopes | Metahub, hub, catalog, set, enumeration и attribute. |
| Client runtime | Browser Worker runtime с fail-closed fallback, если Worker недоступен или выполнение вышло за лимит времени. |
| Server runtime | Выполнение в пуле `isolated-vm` на стороне applications backend. |

## Порядок создания

1. Откройте вкладку Scripts у metahub или у конкретной attached entity.
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
| `global` | Вспомогательная логика между разными областями. | Держите capability минимальными и явными. |

## Поток publication и выполнения

1. Design-time-скрипты живут в metahub storage и редактируются из вкладки Scripts.
2. Генерация publication сериализует метаданные скрипта, исходный код и скомпилированные runtime-бандлы в snapshot publication.
3. Синхронизация application копирует опубликованный контракт в `_app_scripts`.
4. List-endpoints runtime возвращают только метаданные и никогда не встраивают исполняемые бандлы.
5. Клиентский код загружается из отдельного endpoint-а client bundle.
6. Серверные вызовы идут через route вызова runtime-скрипта и остаются под проверками capability.

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