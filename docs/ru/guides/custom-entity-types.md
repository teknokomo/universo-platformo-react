---
description: Практическое руководство по созданию и публикации пользовательских типов сущностей.
---

# Custom Entity Types

Пользовательские типы сущностей позволяют metahub определять новые authoring и runtime sections поверх общего entity pipeline вместо добавления очередного one-off built-in object.

## When To Use Them

- Используйте custom entity type, когда объект специфичен для metahub и не должен становиться новым фиксированным модулем платформы.
- Используйте reusable preset, когда форма должна оставаться одинаковой между разными metahubs.
- Сохраняйте built-in Catalogs, Sets и Enumerations для legacy-поверхностей, которые ещё остаются authoritative во время coexistence.

## Typical Flow

1. Откройте workspace Entities ниже Common.
2. Начните с preset вроде Hubs V2, Catalogs V2, Sets V2, Enumerations V2 или с пустого типа.
3. Заполните kind key, codename, name и конфигурацию tabs.
4. Включите только те components, которые соответствуют требуемому поведению.
5. Сохраните тип, откройте страницу его instances и создайте первый экземпляр до перехода к automation tabs.
6. В edit dialog последовательно настройте Scripts, затем Actions, затем Events для сохранённого экземпляра.
7. Отмечайте тип как published только тогда, когда он должен стать runtime section.

## Legacy-Compatible V2 Presets

- Hubs V2 переиспользует делегированную поверхность HubList, ownership вложенных entity routes и save-first automation tabs.
- Catalogs V2 переиспользует CatalogList и остаётся runtime-visible контрольным случаем после publication sync.
- Sets V2 переиспользует SetList и сохраняет authoring констант и automation на общих legacy routes.
- Enumerations V2 переиспользует EnumerationList и сохраняет authoring значений и action/event automation на общих legacy routes.

## Current Component Set

- Data schema, predefined elements, hub assignment, constants и enumeration values покрывают текущую metadata surface.
- Actions и event bindings добавляют object-owned automation hooks.
- Layout, scripting, runtime behavior и physical table settings расширяют publication и runtime behavior.
- Зависимости компонентов валидируются в builder, поэтому unsupported combinations должны оставаться выключенными.

## Automation Authoring

1. Откройте сохранённый экземпляр в edit mode; до первого сохранения вкладки Actions и Events остаются недоступными.
2. Во вкладке Scripts создайте или привяжите скрипт, который должен обрабатывать lifecycle behavior.
3. Во вкладке Actions создайте object-owned action, выберите script action type и свяжите сохранённый скрипт.
4. Во вкладке Events привяжите lifecycle event вроде beforeCreate, afterCreate, beforeUpdate или afterUpdate к action.
5. Используйте priority и config только там, где потоку нужны порядок выполнения или дополнительные подсказки payload.
6. Перед более широким rollout повторно прогоняйте focused browser proof или прямые тесты EntityAutomationTab.

## Guardrails

- Для parity-heavy flows предпочитайте presets вместо ручной сборки того же manifest.
- Automation authoring на generic custom entity routes следует контракту manageMetahub; legacy-compatible presets переиспользуют соответствующую legacy list/detail surface вместо второго generic CRUD shell.
- Публикация влияет на dynamic menu и runtime только после publication sync или application sync.
- Catalog-compatible presets могут появляться как runtime sections после publication sync, тогда как hub-compatible, set-compatible и enumeration-compatible presets остаются отфильтрованными из runtime navigation.
- Legacy `/hubs`, `/sets` и `/enumerations` routes продолжают показывать compatible custom rows во время coexistence, тогда как каждый V2 entity route остаётся отфильтрованным до своего custom kind.
- Generic instance routes предназначены для custom kinds; built-in kinds остаются на legacy routes.
- Advanced visual composition остаётся вне текущей parity wave.

## Visual References

![Create Entity Type dialog](../.gitbook/assets/entities/metahub-entities-create-dialog.png)
![Catalog-compatible general panel](../.gitbook/assets/entities/catalog-compatible-edit-general-panel.png)

## Related References

- Смотрите guide REST API для generic entity и automation endpoints.
- Смотрите guide Metahub scripting для @OnEvent(...) handlers и script capabilities.

## Validation Checklist

- Подтвердите, что тип сохраняется с ожидаемым component manifest.
- Подтвердите, что страница custom instances открывается из dynamic menu.
- Подтвердите, что publication sync материализует catalog-compatible sections в runtime и не выводит hub/set/enumeration-compatible sections в runtime navigation.
- Подтвердите, что shipped path покрыт focused tests или browser flows до более широкого rollout.