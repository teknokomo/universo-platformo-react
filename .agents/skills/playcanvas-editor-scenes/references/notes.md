# PlayCanvas Editor Scenes Reference Notes

- Scenes are stored as hierarchical JSON structures in the `scenes` ShareDB collection.
- Standard component definitions (camera, light, render, collision, rigidBody, particlesystem) map directly to PlayCanvas Engine classes.
- Entity structure:
  - `resource_id` (unique string key)
  - `name` (string)
  - `parent` (resource_id or null)
  - `components` (component map object)
  - `children` (ordered array of resource_ids)
