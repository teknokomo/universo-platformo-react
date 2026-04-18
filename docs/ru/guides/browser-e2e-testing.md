# Browser E2E Testing

Используйте Playwright browser suite, когда изменение нужно проверить через реально отрисованный UI, реальный backend и реальные контракты metahub/application.

## Когда запускать

- Запускайте `test:e2e:smoke` после изменений в auth, startup, route guards или глобальной навигации.
- Запускайте `test:e2e:permissions` после изменений в ролях, участниках или access checks.
- Запускайте `test:e2e:flows` после изменений в authoring-части метахабов, entity types, Resources, publications, linked applications или connector flows.
- Запускайте `test:e2e:visual` только если менялись layout-sensitive страницы или dialogs.
- Запускайте `test:e2e:restart-safe` после изменений в bootstrap, migrations или логике первого запуска.
- Запускайте generator project, когда нужно пересобрать GitBook-скриншоты или продуктовые fixtures на основе реального UI.

## Контракт окружения

- Храните browser-test secrets в `packages/universo-core-backend/base/.env.e2e.local`.
- Храните optional frontend overrides в `packages/universo-core-frontend/base/.env.e2e.local`.
- Используйте только выделенный Supabase test project.
- Никогда не коммитьте реальные secrets, generated auth state или production credentials.
- Держите Playwright runtime детерминированным: timezone, locale, reduced motion, очистка артефактов и явные navigation/action timeouts должны оставаться зафиксированными.

## Что suite обязан покрывать

- Реальный login и границы least-privilege navigation.
- Flows создания, копирования, удаления, настройки, members и publication для метахабов.
- Authoring типов сущностей через реальное рабочее пространство Entities, включая preset-backed create и ручное создание из шаблона `empty`.
- Shared Resources flows для layouts, attributes, constants, values и shared scripts.
- Runtime-сценарии publication и linked application.
- Snapshot export/import fixtures, соответствующие текущей entity-first схеме.
- GitBook screenshot generators, которые открывают реальный UI и снимают реальное состояние продукта.

## Инженерные правила

1. Предпочитайте user-facing locators: roles, labels и стабильные test ids.
2. Переиспользуйте существующие dialogs, cards и list surfaces вместо test-only UI веток.
3. Используйте API-assisted setup только там, где он убирает нерелевантную рутину и не скрывает само продуктовое поведение.
4. Fail closed, если обязательное backend-состояние так и не появилось; не маскируйте product defects широкими retry.
5. Держите browser-assertions сфокусированными на видимом поведении и persisted backend state, а не на деталях реализации.
6. Когда flow покрывает Resources, проверяйте реальные названия вкладок в UI, а не только API payload.
7. Когда flow покрывает templates, обязательно включайте сценарий `empty`, чтобы ручной authoring типов сущностей оставался защищённым от регрессий.

## Рекомендуемый workflow

1. Запустите `pnpm run build:e2e`.
2. Сначала запускайте минимальный релевантный Playwright slice.
3. HTML report, trace, screenshots и video смотрите только на падениях.
4. Скриншоты и fixtures пересобирайте только после того, как сам продуктовый flow уже зелёный.
5. Дайте cleanup завершиться, чтобы manifest безопасно удалил test users и metahubs.

## Ссылки

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Locators](https://playwright.dev/docs/locators)
- [Playwright Browser Contexts](https://playwright.dev/docs/browser-contexts)
