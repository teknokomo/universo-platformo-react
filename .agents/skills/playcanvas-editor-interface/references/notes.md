# PlayCanvas Editor Interface Reference Notes

- PCUI is the framework used for building the interface elements.
- The editor consists of:
  - **Hierarchy Panel:** represents the scene tree graph and entity groupings.
  - **Assets Panel:** lists import folder trees and metadata filters.
  - **Inspector Panel:** dynamically renders component fields based on selected entity.
  - **Viewport Canvas:** WebGL rendering container with procedural grid and gizmos.
- Custom panel styling must inherit CSS variables from the theme manager.
