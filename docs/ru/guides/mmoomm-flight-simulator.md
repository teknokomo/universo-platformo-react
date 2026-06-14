# MMOOMM Flight Simulator

Fixture MMOOMM flight simulator является продуктовой конфигурацией метахаба, а
не новым MMOOMM-специфичным пакетом. Он создаётся Playwright-генератором
`metahubs-mmoomm-flight-app-export`; результат записывается в
`tools/fixtures/metahubs-mmoomm-flight-app-snapshot.json`.

![Рантайм Space в симуляторе полёта MMOOMM](../.gitbook/assets/mmoomm-flight/runtime-space.png)

Сгенерированный метахаб подключает три generic wrapper-пакета:
`@universo-react/playcanvas-engine`, `@universo-react/colyseus-client` и
`@universo-react/colyseus-server`. Мир, корабль, станция, runtime движения и
canvas-виджет представлены через Objects, Modules и generic widget
`playcanvasCanvas` в layout приложения.

После импорта snapshot опубликуйте метахаб как приложение и откройте runtime
двумя аутентифицированными пользователями с правом редактирования контента.
Оба пользователя подключаются к одной Colyseus-комнате опубликованного приложения.
Сервер владеет позициями кораблей, выдаёт по одному стабильному кораблю на пользователя,
принимает только намерения движения (`move_to_point`, `move_to_object`, `stop`)
и ищет свободную spawn-позицию, если точка по умолчанию заблокирована.

В центральной зоне dashboard появится ограниченный PlayCanvas canvas с простыми
белыми primitive-кораблями и белой станцией, а также видимые команды движения,
остановки, приближения и поворота камеры. Локальный корабль использует
sequenced prediction с подтверждением сервера; remote ships интерполируются из
authoritative room state. Короткие сетевые разрывы используют Colyseus
reconnection и не должны создавать дубли кораблей.

## Snapshot, созданный через PlayCanvas Editor

Канонический MMOOMM snapshot приложения, созданный через PlayCanvas Editor,
находится в `tools/fixtures/metahubs-mmoomm-app-snapshot.json`. Он создаётся
Playwright-генератором `metahubs-mmoomm-app-export`, который проходит браузерный
продуктовый сценарий вместо прямой записи snapshot.

Генератор создаёт метахаб из шаблона `basic`, подключает пакеты Colyseus и
PlayCanvas, создаёт MMOOMM Object/Set/Enumeration модель и runtime-модули через
UI метахаба, открывает hosted PlayCanvas Editor, применяет базовую сцену с
кораблём и станцией через видимый iframe-local MMOOMM authoring control,
публикует PlayCanvas project, настраивает runtime dashboard widgets и экспортирует
snapshot.

Runtime replay test импортирует этот snapshot, создаёт и синхронизирует
опубликованное приложение, открывает раздел `Space` и проверяет, что PlayCanvas
canvas использует опубликованный runtime manifest, созданный через Editor, а не
fallback scene data.
