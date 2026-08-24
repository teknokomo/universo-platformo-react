# Браузерное E2E-тестирование

Используйте браузерный набор Playwright, когда изменение нужно проверить через реально отрисованный интерфейс, реальный бэкенд и реальные контракты метахаба/приложения.

## Когда запускать

-   Запускайте `test:e2e:smoke` после изменений в auth, startup, route guards или глобальной навигации.
-   Запускайте `test:e2e:permissions` после изменений в ролях, участниках или access checks.
-   Запускайте `test:e2e:flows` после изменений в проектной части метахабов, типах сущностей, Ресурсах, публикациях, связанных приложениях или потоках коннекторов.
-   Запускайте `test:e2e:visual` только если менялись чувствительные к макету страницы или диалоги.
-   Запускайте `test:e2e:restart-safe` после изменений в bootstrap, миграциях или логике первого запуска.
-   Запускайте проект генераторов, когда нужно пересобрать GitBook-скриншоты или продуктовые fixtures на основе реального интерфейса.

## Контракт окружения

-   Храните секреты браузерных тестов в `packages/universo-react-core-backend/.env.e2e.local`.
-   Храните необязательные переопределения фронтенда в `packages/universo-react-core-frontend/.env.e2e.local`.
-   По умолчанию используйте выделенный тестовый проект Supabase.
-   Никогда не коммитьте реальные секреты, сгенерированное состояние авторизации или production credentials.
-   Держите рантайм Playwright детерминированным: timezone, locale, reduced motion, очистка артефактов и явные navigation/action timeouts должны оставаться зафиксированными.

### Локальный профиль Supabase для E2E

Браузерный suite можно запускать на локальном Supabase, не меняя профиль удалённого E2E:

Предварительное требование: установите и запустите Docker перед использованием локальных E2E-команд Supabase. Supabase CLI запускает локальные сервисы как Docker-контейнеры, а E2E doctor до старта браузерного сервера проверяет Docker, CLI, Auth, REST, service-role Admin API, прямое подключение к PostgreSQL и JWT secret.

```bash
pnpm supabase:e2e:start:minimal
pnpm doctor:e2e:local-supabase
pnpm run build:e2e:local-supabase
pnpm run test:e2e:smoke:local-supabase
```

Эта команда запускает выделенный локальный E2E-проект Supabase, а не ручной локальный проект Supabase для разработки. По умолчанию локальный E2E-стек минимальный. Используйте `pnpm supabase:e2e:start` или `*:local-supabase:full` только для тестов, которым нужны Storage, Realtime, Edge Functions или сервисы логирования.

Сгенерированные файлы:

-   `packages/universo-react-core-backend/.env.e2e.local-supabase`
-   `packages/universo-react-core-frontend/.env.e2e.local-supabase`

Сгенерированный файл бэкенда создаётся на основе `.env.e2e`, если он есть, затем `.env`, затем `.env.e2e.example`, затем `.env.example`. Генератор сохраняет не связанные с Supabase настройки приложения и заменяет только локальные значения Supabase/PostgreSQL и значения по умолчанию для E2E.

Локальные E2E-скрипты задают `UNIVERSO_ENV_FILE` и `UNIVERSO_FRONTEND_ENV_FILE` явно. Обычные команды `build:e2e` и `test:e2e:*` продолжают использовать `.env.e2e.local` / `.env.e2e` и остаются доступными для проверки удалённого Supabase.

Выделенные локальные E2E порты:

-   API: `http://127.0.0.1:55321`
-   Database: `127.0.0.1:55322`
-   Studio: `http://127.0.0.1:55323`

Режим общего или основного Supabase предназначен только для ручной отладки. Он требует `E2E_ALLOW_MAIN_SUPABASE=true` и `E2E_FULL_RESET_MODE=off`; иначе загрузчик E2E откажется использовать `.env` или локальный профиль Supabase для разработки.

## Что suite обязан покрывать

-   Реальный вход и границы навигации с минимальными правами.
-   Потоки создания, копирования, удаления, настройки, участников и публикаций для метахабов.
-   Проектирование типов сущностей через реальное рабочее пространство Entities, включая создание из пресетов и ручное создание из шаблона `empty`.
-   Потоки общих Ресурсов для макетов, компонентов, констант, значений и общих модулей.
-   Рантайм-сценарии публикации и связанного приложения.
-   Browser game и WebGL runtime surfaces, когда они реализованы: nonblank bounded canvas, viewport matrix, отсутствие page-level horizontal overflow, keyboard/focus behavior, отсутствие raw IDs/JSON/protocol leakage, WebSocket state propagation и reconnect states там, где это применимо.
-   Fixtures экспорта/импорта снимков, соответствующие текущей entity-first схеме.
-   Генераторы GitBook-скриншотов, которые открывают реальный интерфейс и снимают реальное состояние продукта.

## Инженерные правила

1. Предпочитайте пользовательские локаторы: roles, labels и стабильные test ids.
2. Переиспользуйте существующие диалоги, карточки и поверхности списков вместо test-only UI веток.
3. Используйте API-assisted setup только там, где он убирает нерелевантную рутину и не скрывает само продуктовое поведение.
4. Завершайте проверку закрыто, если обязательное состояние бэкенда так и не появилось; не маскируйте продуктовые дефекты широкими retry.
5. Держите браузерные проверки сфокусированными на видимом поведении и сохранённом состоянии бэкенда, а не на деталях реализации.
6. Когда поток покрывает Resources, проверяйте реальные названия вкладок в UI, а не только API payload.
7. Когда поток покрывает templates, обязательно включайте сценарий `empty`, чтобы ручное проектирование типов сущностей оставалось защищённым от регрессий.

## Рекомендуемый workflow

1. Запустите `pnpm run build:e2e`.
2. Сначала запускайте минимальный релевантный Playwright slice.
3. HTML-отчёт, trace, screenshots и video смотрите только на падениях.
4. Скриншоты и fixtures пересобирайте только после того, как сам продуктовый поток уже зелёный.
5. Дайте cleanup завершиться, чтобы manifest безопасно удалил тестовых пользователей и метахабы.

## Гейты обновления зависимостей

Обновления зависимостей и vendor-кода защищены корневыми проверками, которые выполняются вне браузерного suite:

-   `pnpm check:zod-resolution` фиксирует override репозитория на zod `3.25.76` и проверяет разрешение в lockfile. Peer dependency Colyseus core на zod `^4.1.12` остаётся metadata-only, потому что собранные билды не импортируют zod.
-   `pnpm check:playcanvas-editor-schema-vocabulary` завершается по fail-closed, если vendored-исходники Editor потребляют кастомный schema keyword, который каталог Universo ещё не моделирует, или всё ещё читают прежний формат `$`-префиксованных keywords, который каталог намеренно не эмитит.
-   `pnpm check:playcanvas-editor-vendor-drift` сравнивает vendored-дерево Editor с закоммиченным sha256-inventory и завершается по fail-closed при любом отсутствии файла, лишнем файле, изменении содержимого или symlink; проверка работает в CI без соседнего upstream-checkout, а перегенерация inventory относится только к процедуре vendor import.
-   `pnpm report:chunk-budget` суммирует собранный JavaScript payload фронтенда (общий размер, main chunk, обнаруженный chunk движка PlayCanvas) и сравнивает размеры gzip/brotli с записанным baseline, завершаясь ошибкой при регрессии выше 5%.

Переподключение realtime дополнительно покрыто real-server integration suite в `packages/universo-react-applications-backend/src/tests/realtime/realServerReconnect.integration.test.ts` (пять сценариев); запуск: `pnpm --filter @universo-react/applications-backend test -- realServerReconnect`.

## Ссылки

-   [Playwright Best Practices](https://playwright.dev/docs/best-practices)
-   [Playwright Locators](https://playwright.dev/docs/locators)
-   [Playwright Browser Contexts](https://playwright.dev/docs/browser-contexts)
