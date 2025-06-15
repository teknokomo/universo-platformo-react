# Agent Instructions

Welcome to the repository! This project Universo Platformo React extends **Flowise AI** with Supabase-powered multi-user features and integrates **UPDL** (Universal Platform Description Language) to build cross-platform 3D/AR/VR applications. See [README.md](README.md) for a full overview.

Please review the **memory-bank/** folder (`productContext`, `techContext`, `progress`, `tasks`, etc.) for background information and past work.

Common commands:

- `pnpm install`
- `pnpm lint`
- `pnpm build`
- `pnpm dev`
- `pnpm start`

Coding style:

- Keep changes to the original Flowise code minimal.
- Write comments in English and prefix them with `Universo Platformo |`.

Refer to [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

## Guidelines for New Functionality

- By default place new features under the `apps/` folder. If none of the existing apps fit, create a new one and wire it into the project. For instance, `apps/publish-frt` implements the React front end and `apps/publish-srv` implements the Node.js/Express back end for the publishing/export feature.
- Each app must contain a root `base` directory. The project's architecture allows for alternative implementations in the future, so the default code lives under `base`.
- Front-end apps include internationalization. Create an `i18n` folder with default localization files for English and Russian.
- If a feature is not split into front end and back end, name the app without the `-frt` or `-srv` suffix. Example: `apps/updl`.
