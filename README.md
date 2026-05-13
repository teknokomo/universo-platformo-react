# Important! Grave! Important!

-   Workers of the world, unite!
-   Proletoj el ĉiuj landoj, unuiĝu!
-   Пролетарии всех стран, соединяйтесь!

# Universo Platformo React

[![Version](https://img.shields.io/badge/version-0.63.0--alpha-blue)](https://github.com/teknokomo/universo-platformo-react)
[![License: Omsk Open License](https://img.shields.io/badge/license-Omsk%20Open%20License-green)](LICENSE.md)

**Attention, please read this carefully.**

1. Universo Platformo React is currently in alpha development and is just beginning to reach beta. We strongly advise against using Universo Platformo React for production projects.

2. Compatibility between versions is not guaranteed yet. Updating without preparation can require manual migration work and may lead to data loss.

3. This repository still contains a lot of "one-time" code created by AI agents. We perform basic code security checks, but you should be aware that the code may be unsafe and may change significantly even with the implementation of small features.

4. The current priority is to reach a stable release, so technical support for alpha installations is limited.

5. If you want earlier access to future Universo Platformo functionality, including Universo Kiberplano and Universo MMOOMM, register at [https://universo.pro](https://universo.pro). Early participants receive priority testing access and additional opportunities.

6. We need your support to develop the project. You can help with both work and funding through [Boosty](https://boosty.to/universo).

## Basic Information

![image](https://github.com/user-attachments/assets/0be3687e-afe2-46be-a0f6-487ff03d9c80)

**In this repository, a public initiative is currently underway to create a Universo Platformo implementation, with the goal of launching global teknokomization and saving humanity from ultimate enslavement and total annihilation.**

Teknokomization entails the creation of the Teknokomo Era, characterized by humanity's transition from the current fifth technological paradigm to the sixth technological paradigm, with a socio-economic structure in which the means of production will be maximally roboticized and owned by all working people. Human labor will thus consist of acquiring new knowledge, improving the social order, exploring the infinite universe, caring for their families, and so on.

Teknokomization is a long-term, yet inevitable, and literally vitally necessary process of human development. This process is gradual and involves the need to create the necessary systems now, improve coordination, reduce waste, and gradually expand the scope of labor that can be planned, modeled, automated, and collectively regulated.

Universo Platformo is being shaped as an ERP-class and CMS-capable platform for designing, operating, and evolving organizations, digital services, operational processes, knowledge spaces, and eventually robot-assisted production flows. In software-market terms, it belongs to the same broad category as platforms such as 1C:Enterprise, SAP, and similar enterprise systems, while also aiming to remain open, modular, and exportable across technology stacks.

On top of Universo Platformo, the project is preparing **Universo Kiberplano**: a planning and execution environment that connects plans, tasks, resources, people, organizations, software agents, and robots inside one coordinated system. It is intended to combine ERP-style planning, CMS-style knowledge handling, and agent-orchestration mechanisms for complex distributed work.

Also, on the basis of Universo Platformo, various special large-scale virtual worlds (metaverses) are created, such as **Universo MMOOMM**, in which different economic systems can be used in various parallel worlds, virtual organizations and industries can be created, entire virtual cities as digital twins, and then these developments can be transferred to the real world.

Universo Platformo React is the current React / Express / Supabase (PostgreSQL) reference implementation. It is the most advanced public implementation for the platform's business flows, package boundaries, migration runtime, onboarding, administration, and domain modules, and it serves as a practical baseline for parallel implementations in other stacks.

More detailed materials already exist, including the "Book of the Future" and internal planning notes, but most of that material is still being reorganized. The repository is therefore being accompanied by a new multilingual documentation set that will gradually describe the platform in a more structured and implementation-oriented way.

## Inspiration

![image](https://github.com/user-attachments/assets/887794d6-57a3-4898-a101-1a2e6e8f213e)

The visible state of the project is still far from the scale of the long-term vision, but the repository already contains the real runtime kernel, package layout, migrations, feature modules, and operational tooling that future implementations will build on.

## Contact Information

Various ways to financially support the project are available at [https://boosty.to/universo](https://boosty.to/universo). If you want to support the project, please consider subscribing on Boosty, which will help accelerate development and ensure more stable releases.

To join our work, you can write to Vladimir Levadnij without any hesitation:

-   Telegram: [https://t.me/Vladimir_Levadnij](https://t.me/Vladimir_Levadnij)
-   VK: [https://vk.com/vladimirlevadnij](https://vk.com/vladimirlevadnij)
-   Email: [universo.pro@yandex.com](mailto:universo.pro@yandex.com)

Website: [https://universo.pro](https://universo.pro)

## Current Status

**Current version**: 0.63.0-alpha (May 2026). The project remains in alpha and is being prepared for a more stable beta phase.

## Tech Stack

-   Node.js (>=22.6.0)
-   PNPM (>=9)
-   React
-   Express.js
-   Supabase (PostgreSQL)
-   Turborepo workspace tooling

## Project Structure

-   The repository is a PNPM + Turborepo monorepo with root-level documentation, planning records in `memory-bank`, engineering tools, and package workspaces.
-   Most runtime workspaces follow the `packages/<name>/base` convention, while package roots such as `packages/apps-template-mui` and `packages/universo-rest-docs` provide shared UI scaffolding and documentation services.
-   The backend side is organized around a SQL-first PostgreSQL/Supabase runtime, modular migration tooling, schema-definition utilities, and feature packages for authentication, onboarding, profile, metahubs, applications, and administration.
-   The frontend side is organized around a React shell, shared UI/state/i18n packages, and feature packages for onboarding, authentication, profile, metahubs, applications, and administration.
-   In the metahubs and admin domains, fixed schemas, runtime metadata, and authoring flows converge on one persisted `codename JSONB` contract built on versioned localized content (VLC), and platform migrations upgrade legacy dual-field codename storage into the same shape.
-   The repository also contains cross-cutting documentation and architecture notes that track active plans, verified progress, and stable system patterns for ongoing platform development.

## Universo Platformo Functionality (in development)

-   **Modular business applications**: the platform is being assembled as a package-based environment where separate domains can be developed, migrated, and evolved without collapsing into one monolith.
-   **ERP-class process kernel**: current work already covers identities, memberships, roles, metahubs, applications, admin flows, migrations, and request-scoped data access, with future expansion toward broader planning, accounting, logistics, and operational domains.
-   **CMS-style information management**: the architecture is moving toward structured content, schema evolution, publication flows, versioned definitions, and reusable templates that can serve both websites and internal operational knowledge.
-   **LMS MVP foundation**: the repository now includes an LMS metahub template, workspace-aware application collaboration, public guest-runtime links, QR-code distribution widgets, and learning-focused runtime components built on top of the generic application shell.
-   **Cross-stack application descriptions**: applications created in the platform are intended to remain exportable between implementations, so business logic, structure, and data definitions are being separated from any single UI or engine.
-   **Shared migration and schema runtime**: the monorepo already contains dedicated packages for migration orchestration, runtime schema DDL, catalog storage, and platform-wide definition export or diff workflows.
-   **Operational shell for real deployments**: onboarding, authentication, profile management, admin tooling, API documentation, and package-based frontend modules are being developed as the practical shell for real installations.

## Universo Kiberplano Functionality (planned)

-   **Integrated planning of tasks, resources, and capacities**: Kiberplano is intended to unify operational plans, production plans, staffing, inventory, and execution feedback inside one coordinated system.
-   **Multi-agent orchestration**: software agents will eventually help decompose goals, negotiate subtasks, monitor execution, and coordinate with human operators and organizational rules instead of acting as isolated assistants.
-   **Robot and digital-twin integration**: the planning layer is expected to connect to equipment, sensors, and robotized execution environments through explicit schemas, events, and control workflows.
-   **Distributed node coordination**: separate personal, organizational, and larger regional nodes should be able to exchange plans, constraints, and results without requiring one fragile centralized deployment.
-   **Scenario modeling and simulation**: the platform is intended to support simulation of plans, bottlenecks, and resource conflicts before those plans are executed in the physical world.
-   **Governance and auditability**: role separation, approval flows, version history, and transparent change tracking are expected to be first-class requirements rather than optional afterthoughts.

## Universo MMOOMM Functionality (planned)

Universo MMOOMM is planned as a massive multiplayer online environment built on top of Universo Platformo. It is closer to a combined game, economic simulator, organizational laboratory, and production-planning sandbox than to a conventional entertainment-only MMO.

Key capabilities are expected to include:

-   **Parallel worlds** with different institutional and economic rules.
-   **Character and role systems** that support specialization, cooperation, and long-term progression.
-   **Vehicles, ships, and infrastructure** with maintenance, customization, and coordinated operation.
-   **Careers and professions** connected to production chains, logistics, research, and defense.
-   **Dynamic economy and contracts** that connect planning, exchange, and manufacturing.
-   **Organizations and governance** for cooperatives, scientific groups, crews, and larger federations.
-   **Exploration and research** across large virtual spaces and experimental scenarios.
-   **Construction and territorial development** for bases, stations, settlements, and industrial facilities.
-   **Technology trees and scientific progress** that connect simulation outcomes with real-world planning experiments.

## Cross-Platform Implementation

Universo Platformo is being developed across multiple technology stacks.

The primary goal is not to replicate every interface or feature line by line, although we ultimately strive for consistency in functionality and implementation, while also following best practices for each technology stack. To begin with, the goal is to maintain a common conceptual layer: domain definitions, scheduling semantics, access control rules, migration logic, publishing structures, and portable application definitions. Therefore, applications built within Universo Platformo should be able to transition between stacks through controlled adaptation, rather than a complete rewrite.

Currently, the React implementation in this repository is the most complete public reference implementation for business flows, administration, onboarding, migrations, and package boundaries. Other implementations may not initially replicate all the functionality of this implementation, but rather specialize in game engines, simulation environments, robotics runtimes, or device-specific interfaces, while still following the same platform direction.

In our accounts, you can find repositories with Universo Platformo implementations on other technology stacks, and you can propose creating a new repository for your proposed technology stack:

-   GitHub account: https://github.com/teknokomo

-   GitVerse account: https://gitverse.ru/teknokomo

Each implementation shares the same strategic direction, and the high-level abstraction layer should ensure the portability of applications and platform definitions between them.

## Getting Started

### Prerequisites

-   Node.js (>=18.15.0 <19.0.0 || ^20)
-   PNPM (>=9)
-   A Supabase/PostgreSQL environment. You can use either a hosted Supabase project or the local Supabase profile described below.
-   Docker, when you use local Supabase. Install Docker Desktop or Docker Engine, start the Docker daemon, and verify `docker ps` works from your terminal before running local Supabase commands.

### Installation

1. Clone the repository.

    ```bash
    git clone https://github.com/teknokomo/universo-platformo-react.git
    cd universo-platformo-react
    ```

2. Install dependencies.

    ```bash
    pnpm install
    ```

3. Configure environment variables.

    - Create `.env` in `packages/universo-core-backend/base`.
    - Add the required Supabase/PostgreSQL settings:
        ```
        SUPABASE_URL=your_supabase_url
        SUPABASE_ANON_KEY=your_supabase_anon_key
        SERVICE_ROLE_KEY=your_server_only_service_role_key
        SUPABASE_JWT_SECRET=your_supabase_jwt_secret
        BOOTSTRAP_SUPERUSER_ENABLED=true
        BOOTSTRAP_SUPERUSER_EMAIL=demo-admin@example.com
        BOOTSTRAP_SUPERUSER_PASSWORD=ChangeMe_123456!
        NODE_ENV=development
        ```
    - `SERVICE_ROLE_KEY` is required for server-side provisioning tasks such as startup superuser bootstrap and admin-side user creation.
    - `BOOTSTRAP_SUPERUSER_EMAIL` and `BOOTSTRAP_SUPERUSER_PASSWORD` are demo credentials for first local bootstrap only. Change both before any real deployment.
    - `NODE_ENV=development` enables development features like database reset. Never use in production.
    - Optionally create `.env` in `packages/universo-core-frontend/base` for UI-specific settings such as `VITE_PORT`.

4. Build the workspace.

    ```bash
    pnpm build
    ```

5. Start the application.

    ```bash
    pnpm start
    ```

    For a complete reset (clean build + full database reset), use:

    ```bash
    pnpm start:allclean
    ```

    > **Warning**: `start:allclean` performs a complete database reset, deleting all data. Only use in development environments.

6. Open [http://localhost:3000](http://localhost:3000).

### Supabase Options

The default `pnpm start` and `pnpm start:allclean` commands use the normal `.env` files. They can point to a hosted Supabase project or to a local Supabase instance if you write local Supabase values directly into `packages/universo-core-backend/base/.env`.

For routine local work, the recommended Docker-based flow keeps hosted and local settings separate by generating gitignored local profiles:

```bash
pnpm start:local-supabase:minimal
```

Use the full stack when you need Supabase Storage, Realtime, Edge Functions, or logging services:

```bash
pnpm start:local-supabase
```

For a clean rebuild and database reset against local Supabase only:

```bash
pnpm start:allclean:local-supabase:minimal
```

For manual local development, Supabase Studio is available at [http://127.0.0.1:54323](http://127.0.0.1:54323). E2E tests do not reuse that development instance: they can start a separate local Supabase profile with API `55321`, Postgres `55322`, and Studio `55323` through:

```bash
pnpm run test:e2e:smoke:local-supabase
```

Useful lifecycle commands:

```bash
pnpm supabase:local:stop
pnpm supabase:local:nuke
pnpm supabase:e2e:stop
pnpm supabase:e2e:nuke
```

`nuke` deletes the corresponding local Docker volumes/data. Use it only when you intentionally want a fresh local Supabase instance.

### Development Mode

For local development, the repository also provides:

```bash
pnpm dev
```

This mode is resource-intensive in the current monorepo, so routine validation is usually better done with `pnpm build` and targeted package commands.

### Turborepo Build Contract

-   Root builds run on Turbo 2 task contracts with strict environment mode and local caching enabled for build artifacts.
-   Routine validation should continue to use `pnpm build` from the repository root so Turbo can reuse and repopulate the shared workspace cache correctly.
-   CI can opt into Turbo remote cache by defining `TURBO_TEAM` and `TURBO_TOKEN` secrets; local contributors do not need those variables for normal development.
-   The root task contract intentionally excludes generated `dist/`, `build/`, `coverage/`, and `.turbo/` artifacts from task inputs so repeated builds can produce real cache hits instead of self-invalidating.

## Contributing

We welcome contributions to Universo Platformo React and Universo Platformo implementations on other tech stacks, which are located in our other repositories. However, we will not be able to accept poorly prepared PRs from contributors who do not fully understand our project's goals and are not familiar with the development environment of our project. Our project is rapidly evolving, and because it is still in the alpha stage, it may undergo significant architectural changes and adjustments to development priorities. To ensure your contribution is accepted and relevant to the project, please first contact Vladimir Levadnij using the contact information provided above.

## License

The project is distributed under the Omsk Open License (Basic modification with indication of authorship). Individual packages in `packages/` may have a different license, please check the license in each individual package.

The Omsk Open License is similar to the MIT license, but includes additional "Basic Provisions" aimed at creating a meaningful and secure public domain while protecting traditional values.

AI agents are actively used in the development of this project, which are trained on many other projects / code of various free source projects, as well as many libraries and large projects are used at the heart of Universo Platformo React.

If you think that some code in this repository violates your copyrights, please [create an Issue](https://github.com/teknokomo/universo-platformo-react/issues) in which describe this problem, specify which code violates your rights, show the original author's code and evidence that this code itself is not a copy of another code, describe your suggestions for problem resolution (attribution, code replacement, etc.).

In any case, thank you for your participation and contribution to the development of free software code, which directly or indirectly influenced the possibility of creating Universo Platformo / Universo Platformo React!
