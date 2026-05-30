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
