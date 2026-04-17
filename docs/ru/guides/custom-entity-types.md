---
description: Практическое руководство по созданию и публикации пользовательских типов сущностей.
---

# Custom Entity Types

Пользовательские типы сущностей позволяют metahub определять новые authoring и runtime sections поверх общего entity pipeline вместо добавления очередного one-off built-in object.

## When To Use Them

- Используйте custom entity type, когда объект специфичен для metahub и не должен становиться новым фиксированным модулем платформы.
- Используйте reusable preset, когда форма должна оставаться одинаковой между разными metahubs.
- Используйте прямые standard presets для Linked Collections, Tree Entities, Value Groups и Option Lists вместо legacy V2 aliases.

## Typical Flow

1. Откройте workspace Entities ниже Common.
2. Начните с preset вроде Hubs, Catalogs, Sets, Enumerations или с пустого типа.
3. Заполните kind key, codename, name и конфигурацию tabs.
4. Включите только те components, которые соответствуют требуемому поведению.
5. Сохраните тип, откройте страницу его instances и создайте первый экземпляр до перехода к automation tabs.
6. В edit dialog последовательно настройте Scripts, затем Actions, затем Events для сохранённого экземпляра.
7. Отмечайте тип как published только тогда, когда он должен стать runtime section.

## Standard Presets

- Tree Entities переиспользуют делегированную поверхность tree entities, ownership вложенных entity routes и save-first automation tabs.
- Linked Collections переиспользуют общую authoring-поверхность связанных коллекций и остаются runtime-visible контрольным случаем после publication sync.
- Value Groups сохраняют authoring фиксированных значений и automation на общих entity-owned routes.
- Option Lists сохраняют authoring значений опций и action/event automation на общих entity-owned routes.

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
- Automation authoring на generic custom entity routes следует контракту manageMetahub; standard metadata presets переиспользуют соответствующую list/detail surface вместо второго generic CRUD shell.
- Публикация влияет на dynamic menu и runtime только после publication sync или application sync.
- Standard metadata presets остаются на прямых kind keys и публикуются через entity-owned route tree.
- Runtime sections материализуются из published entity metadata и текущих runtime adapters после publication sync.
- Generic instance routes теперь владеют всеми entity kinds, а standard metadata presets по-прежнему рендерятся через свои dedicated authoring surfaces внутри общего entity-owned route tree.
- Advanced visual composition остаётся вне текущей parity wave.

## Visual References

![Create Entity Type dialog](../.gitbook/assets/entities/metahub-entities-create-dialog.png)
Текущий browser proof и генерируемые screenshots используют общий entity workspace и dialog создания, показанный выше.

## Related References

- Смотрите guide REST API для generic entity и automation endpoints.
- Смотрите guide Metahub scripting для @OnEvent(...) handlers и script capabilities.

## Validation Checklist

- Подтвердите, что тип сохраняется с ожидаемым component manifest.
- Подтвердите, что страница custom instances открывается из dynamic menu.
- Подтвердите, что publication sync материализует ожидаемые runtime sections из published entity metadata.
- Подтвердите, что shipped path покрыт focused tests или browser flows до более широкого rollout.
