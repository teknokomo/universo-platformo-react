# Universo Core Frontend

✅ **Современный пакет** — `@universo/core-frontend`

## Обзор

Основное React frontend-приложение Universo Platformo. Это точка входа, которая загружает весь веб-интерфейс — соединяет аутентификацию, маршрутизацию, управление состоянием, i18n и все функциональные пакеты в единое одностраничное приложение, обслуживаемое Vite.

## Информация о пакете

- **Пакет**: `@universo/core-frontend`
- **Версия**: `0.1.0`
- **Тип**: React Frontend Application (Современный)
- **Фреймворк**: React 18 + Vite + MUI v7 + TanStack Query v5
- **Язык**: TypeScript (TSX)
- **Паттерн**: Оболочка приложения, компонующая `@universo/*` функциональные пакеты
- **Система сборки**: Vite (продакшн-сборка в `build/`)

## Ключевые особенности

### 🏗️ Оболочка приложения
- **Композиция провайдеров**: Redux store, React Query, Auth, Router, Snackbar, диалоги подтверждения
- **Условный StrictMode**: Включён только при разработке для предотвращения потери контекста Router в продакшне
- **Bootstrap Error Boundary**: Перехватчик всех ошибок с диагностическим логированием
- **Глобальная диагностика**: Слушатели `window.onerror` / `unhandledrejection` для ранних ошибок загрузки

### 🌐 Интернационализация
- **Синхронизация локали в runtime**: HTML `lang` атрибут и `<meta>` теги обновляются при смене языка
- **Альтернативные локали**: `<link rel="alternate" hreflang="...">` теги генерируются автоматически
- **Пространства имён пакетов**: Каждый функциональный пакет регистрирует свой i18n namespace

### 🔌 Интегрированные функциональные пакеты
- **Аутентификация**: `@universo/auth-frontend` — вход, сессия, защищённые маршруты
- **Профиль**: `@universo/profile-frontend` — управление профилем пользователя
- **Приложения**: `@universo/applications-frontend` — CRUD приложений
- **Метахабы**: `@universo/metahubs-frontend` — управление метахабами
- **API клиент**: `@universo/api-client` — централизованный API-слой на базе Axios
- **UI компоненты**: `@universo/template-mui` — общая MUI тема, лейаут, навигация

### 🔧 Разработка
- **Горячая перезагрузка**: Vite dev-сервер с прокси к бэкенду
- **React Query DevTools**: Включён в dev-сборках
- **Service Worker**: Опциональная поддержка PWA (не активирована по умолчанию)

## Архитектура

### Цепочка точки входа

```
index.tsx                     → Загрузка провайдеров и рендер
  ├─ diagnostics/             → Глобальные слушатели ошибок (до React)
  ├─ config/queryClient.ts    → Фабрика клиента TanStack Query v5
  ├─ components/BootstrapErrorBoundary.tsx → Перехватчик всех ошибок
  ├─ App.tsx                  → Тема, i18n мета, маршруты
  └─ api/client.ts            → Экземпляр Axios API клиента
```

### Стек провайдеров (изнутри → наружу)

```
<StrictMode>                  (только dev)
  <BootstrapErrorBoundary>
    <QueryClientProvider>
      <Provider store={store}>
        <BrowserRouter>
          <SnackbarProvider>
            <ConfirmContextProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </ConfirmContextProvider>
          </SnackbarProvider>
        </BrowserRouter>
      </Provider>
    </QueryClientProvider>
  </BootstrapErrorBoundary>
</StrictMode>
```

### Ключевые зависимости

| Зависимость | Назначение |
|---|---|
| `@universo/store` | Redux store + ConfirmContextProvider |
| `@universo/template-mui` | Общая MUI тема, лейаут, SCSS |
| `@universo/auth-frontend` | AuthProvider + хуки сессии |
| `@universo/api-client` | Обёртка Axios с интерцепторами |
| `@universo/i18n` | Синглтон инициализации i18next |
| `@tanstack/react-query` | Управление серверным состоянием |
| `react-router-dom` | Клиентская маршрутизация |
| `notistack` | Snackbar уведомления |

## Файловая структура

```
packages/universo-core-frontend/
└── base/
    ├── public/                # Статические ресурсы и index.html
    ├── scripts/               # Скрипты сборки (sync-supported-langs)
    ├── src/
    │   ├── api/               # Экземпляр API клиента
    │   ├── components/        # BootstrapErrorBoundary
    │   ├── config/            # Фабрика queryClient
    │   ├── diagnostics/       # Глобальные слушатели ошибок
    │   ├── App.tsx            # Корневой компонент (тема, i18n мета, маршруты)
    │   ├── index.tsx          # Точка входа (композиция провайдеров)
    │   └── serviceWorker.ts   # Опциональная регистрация PWA
    ├── vite.config.js         # Конфигурация Vite с алиасами и прокси
    ├── package.json
    ├── README.md
    └── README-RU.md
```

## Конфигурация

### Переменные окружения

| Переменная | Обязательная | Описание |
|---|---|---|
| `VITE_PORT` | Нет | Порт dev-сервера (по умолчанию: из конфигурации Vite) |
| `PUBLIC_URL` | Нет | Базовый URL для загрузки ресурсов |

### Алиасы Vite

Префикс `@/` разрешается в директорию `src/`. Все импорты пакетов workspace используют область видимости `@universo/` через PNPM workspace resolution.

## Разработка

```bash
# Из корня проекта
pnpm install
pnpm build              # Полная сборка workspace
pnpm dev                # Запуск dev-серверов (ресурсоёмко)
```

> **Примечание**: Всегда выполняйте команды из корня проекта. Сборка отдельных пакетов — только для проверки. Используйте `pnpm build` в корне для применения изменений.

## Связанные пакеты

- [universo-core-backend](../../universo-core-backend/base/README.md) — Express бэкенд-сервер
- [universo-template-mui](../../universo-template-mui/base/README.md) — Общие UI компоненты и тема
- [universo-i18n](../../universo-i18n/base/README.md) — Система интернационализации
- [auth-frontend](../../auth-frontend/base/README.md) — UI аутентификации
