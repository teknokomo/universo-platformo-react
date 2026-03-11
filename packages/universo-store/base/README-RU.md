# @universo/store

Общий пакет Redux и ability-helper, используемый текущей React-оболочкой Universo Platformo.

## Обзор

Этот пакет реэкспортирует общий экземпляр store, legacy action и constant модули, а также CASL/global-access React-хелперы, которые до сих пор потребляются `@universo/core-frontend`.

Его следует воспринимать как общий UI-пакет совместимости, а не как место для нового feature-специфичного бизнес-состояния, если лучше подходит выделенный frontend-пакет.

## Публичная поверхность

-   `store` и `persister` из общей конфигурации Redux.
-   Реэкспорты action и constant модулей.
-   `AbilityContext`, `AbilityContextProvider` и `useAbility`.
-   Экспорты хелперов `Can`, `Cannot` и `useHasGlobalAccess`.

## Структура исходников

-   `src/actions.js` и `src/constant.js` определяют общие action names и constants.
-   `src/index.jsx` и `src/reducer.jsx` собирают Redux store.
-   `src/context/` содержит CASL-related и global-access React-хелперы.

## Разработка

```bash
pnpm --filter @universo/store build
```

## Связанные пакеты

-   `@universo/core-frontend` напрямую использует этот пакет.
-   Другие frontend-пакеты могут переиспользовать экспортируемые хелперы при интеграции с общей оболочкой.