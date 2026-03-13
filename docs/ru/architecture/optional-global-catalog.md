---
description: Режимы optional global migration catalog и workflow application release bundle.
---

# Optional Global Catalog

Эта страница описывает модель global migration catalog, отключённую по умолчанию,
и работу application release bundles, когда registry отключён.

## Режимы

- Режим по умолчанию оставляет global migration catalog отключённым.
- Включённый режим активирует lifecycle, audit и registry-потоки в upl_migrations.
- Корректность runtime schema всегда остаётся привязанной к локальным таблицам _app_migrations и _mhb_migrations.

## Флаг

Используйте общий флаг ниже для переключения режимов:

```env
UPL_GLOBAL_MIGRATION_CATALOG_ENABLED=false
```

- false или unset: пропустить bootstrap definition registry и mirror writes.
- true: требовать healthy catalog и fail closed при registry или audit ошибках.

## Release Bundles

- Publications теперь можно экспортировать как application_release_bundle artifacts из application sync API.
- Bundle apply переиспользует applications.cat_applications.installed_release_metadata вместо отдельного release state в runtime schema.
- Пустые targets используют baseline/bootstrap path; существующие targets используют incremental migration path с проверками release version.

## Operator Guidance

1. Оставляйте флаг выключенным для local development, fresh bootstrap и установок без registry observability.
2. Включайте флаг только тогда, когда операторам нужны catalog-backed doctor, export/import lifecycle tracking или audit history.
3. Если bundle apply сообщает о release-version mismatch, экспортируйте bundle из текущего установленного release или согласуйте installed_release_metadata перед повтором.

## Recovery Notes

- Отключённый режим не должен создавать полный definition registry в upl_migrations на cold start.
- Включённый режим нужно восстанавливать исправлением catalog health issue, а не тихим downgrade к local-only writes.
- Состояние application sync и bundle install всегда нужно сначала проверять в applications.cat_applications.
