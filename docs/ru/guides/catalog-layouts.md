---
description: Как catalog-specific layout наследуются от global layout, хранят sparse overrides для visibility и placement и управляют catalog runtime behavior из раздела Common.
---

# Catalog Layouts

Layout catalog являются overlay-layout, а не fork-копиями.
Каждый layout catalog указывает на global base layout и затем добавляет только catalog-specific отличия.

## Overlay Model

- inherited widgets остаются связаны с base global layout;
- widgets, принадлежащие catalog, живут только внутри layout catalog;
- sparse overrides хранят изменения visibility и placement для inherited widgets;
- config inherited widgets по-прежнему берётся из base layout.

## Creating The First Catalog Layout

1. Откройте целевой metahub.
2. Перейдите в Common -> Layouts для глобального контекста или откройте route catalog, который ведёт в его список layout.
3. Создайте layout catalog и выберите base global layout.
4. При необходимости переставьте inherited widgets, переключите их активность или добавьте widgets только для catalog.

## Runtime Behavior Ownership

Выбранный layout catalog владеет catalog runtime behavior, таким как:
- видимость create button;
- search mode;
- тип surface для create, edit и copy.
Пока первый layout catalog не создан, runtime продолжает использовать поведение выбранного global layout как baseline по умолчанию.

## Publication And Runtime

Publication уплощает эффективный layout catalog в обычные runtime rows layout и widget.
Applications не вычисляют overlay logic на лету, а используют уже материализованное runtime state.
Во время materialization inherited widgets сохраняют config из base layout; overlay rows меняют только placement и active state.

## Related Reading

- [Рабочая область Resources](general-section.md)
- [Метахабы](../platform/metahubs.md)
- [Приложения](../platform/applications.md)