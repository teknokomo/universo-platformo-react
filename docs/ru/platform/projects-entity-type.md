---
description: Полноценная секция типа сущности метахаба для управления внешними проектами авторинга, такими как PlayCanvas Editor.
---

# Тип сущности «Проекты»

`Проекты` — это платформенный пресет типа сущности, который превращает внешнюю систему авторинга в обычную секцию типа сущности метахаба. Первая поддерживаемая система — PlayCanvas Editor; будущие системы смогут переиспользовать ту же capability `projectBinding`.

Экземпляр `Проекты` хранит 1:1-ссылку на проект в собственном хранилище авторинга метахаба. Секция отображается над `Хабами` в левом меню и рендерится через те же общие UI-компоненты сущностей, что `Объекты`, `Страницы`, `Наборы` и `Перечисления`.

## Как устроен пресет

Пресет зарегистрирован в `builtinEntityTypePresets` по образцу пресетов one-c-compatible. Каждое поле настраивается через конфигуратор Сущностей:

-   Имя и codename (локализованные)
-   `kindKey` (по умолчанию `project`)
-   Capabilities (object-like-minimal: `dataSchema` + `records` + `physicalTable`, плюс `modules`, `layoutConfig`, `runtimeBehavior` и новая `projectBinding`)
-   `sidebarSection: 'objects'`, `sidebarOrder: 5` (над `Хабами`)
-   `resourceSurfaces` (вкладка `projectBinding`)

PlayCanvas-специфичного кода в общих виджетах нет — binding — это generic-capability, которую экспонирует конструктор.

## Связывание с проектом авторинга

Каждый экземпляр `Проекты` несёт в `config.projectBinding` ссылку:

```json
{
    "projectBinding": {
        "provider": "playcanvasEditor",
        "projectCodename": "mmoomm_world",
        "projectId": "0190aaaa-..."
    }
}
```

`projectCodename` — стабильный якорь (уникально-активный codename в `_mhb_playcanvas_projects` метахаба). `projectId` — convenience-кеш. Хранилище остаётся источником истины — branches, checkpoints и version control живут внутри PlayCanvas-проекта и никогда не дублируются в метахаб.

UI секции `Проекты` показывает три действия над связанным проектом: **Открыть редактор**, **Опубликовать runtime**, **Отвязать**. Создание и связывание — одно действие (`Создать и связать проект`), которое создаёт запись в `_mhb_playcanvas_projects` и сохраняет связь в `config` экземпляра.

## Валидация и жизненный цикл

-   `config.projectBinding` валидируется на сервере при каждом create и update: provider должен поддерживаться, `projectCodename` должен ссылаться на существующий проект в том же бранче метахаба.
-   Удаление экземпляра `Проекты` каскадно soft-удаляет связанный PlayCanvas-проект, поэтому 1:1-инвариант никогда не нарушается.
-   Версия структуры метахаба **не** повышается — хранилище проектов уже входит в текущий baseline (`_mhb_playcanvas_*` system tables).

## Связанные материалы

-   [Шаблон метахаба «PlayCanvas»](./playcanvas-template.md)
-   [PlayCanvas-проекты](./playcanvas-projects.md)
-   [PlayCanvas Editor](./playcanvas-editor.md)
