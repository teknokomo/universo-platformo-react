# PlayCanvas Editor Assets Reference Notes

- Supported assets: textures, materials, models, animations, script files, audio, templates.
- Asset database records are stored in the `assets` ShareDB collection.
- Asset loading uses Zod schemas to ensure attributes are correct before saving.
- Binary assets are kept in the storage bucket. The editor config contains URLs pointing to their resolved addresses.
