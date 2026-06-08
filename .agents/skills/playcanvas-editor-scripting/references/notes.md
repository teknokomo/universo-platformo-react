# PlayCanvas Editor Scripting Reference Notes

- Scripts must declare attributes at the top to allow the editor to parse and render them in the Inspector panel.
- Compilation and static typing are handled via custom typescript declarations injected into Monaco.
- Script template class structure:
  ```javascript
  import { ScriptType } from 'playcanvas';
  class CustomScript extends ScriptType {
      initialize() {}
      update(dt) {}
  }
  ```
- Hot-reload uses the `swap` handler to pass state between old and new script class instances.
