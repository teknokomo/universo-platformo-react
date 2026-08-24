# @universo-react/playcanvas-engine

Пакет рабочей области для `playcanvas@2.21.4`.

Пакет намеренно оставляет тонкую entry-точку и реэкспортирует публичный API PlayCanvas Engine:

```ts
export * from 'playcanvas'
```

В реестре пакетов метахаба он сидируется как пакет для client/browser runtime.

## Идентичность canvas и владение вводом

`createBasicApplication` принимает объект опций (`{ canvas, applicationId?, windowKeyboard? }`) и возвращает `{ app, destroy }`. Если передан `applicationId`, он проставляется в элемент canvas (`canvas.id`), так как движок ключует реестр приложений по id canvas, а `destroy()` удаляет его обратно. Ввод с клавиатуры подключается к canvas, если не передан `windowKeyboard: true`, поэтому параллельные виджеты не перехватывают клавиатурные события друг друга. Движок требует WebGL2; когда WebGL2 недоступен, окружающий runtime-интерфейс показывает локализованное терминальное состояние (`playcanvasCanvas.webglUnavailable`).
