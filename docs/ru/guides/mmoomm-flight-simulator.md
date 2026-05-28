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

После импорта snapshot опубликуйте метахаб как приложение и откройте runtime.
В центральной зоне dashboard появится ограниченный PlayCanvas canvas с белым
кораблём и белой станцией, а также видимые команды движения, остановки,
приближения и поворота камеры.
