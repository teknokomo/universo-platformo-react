---
description: >-
  Current product documentation for Universo Platformo React, organized as concise product guides, architecture notes, API reference, and contribution guidance.
---

# Welcome

Universo Platformo React is the current public React / Express / Supabase
reference implementation of Universo Platformo.

## What This Documentation Covers

| Area | Purpose |
| --- | --- |
| Getting Started | Install, configure, build, and run the repository safely. |
| Platform | Explain the current platform scope and domain modules. |
| Architecture | Describe the monorepo, backend, frontend, database, and auth patterns. |
| API Reference | Explain the public REST surface and where OpenAPI docs come from. |
| Contributing | Document local workflow, coding rules, and package creation patterns. |

## Current Product Position

Universo Platformo is an ERP-class and CMS-capable platform direction for
organizations, digital services, operational processes, and knowledge spaces.

The repository in this workspace is the most complete public implementation for
platform bootstrap, package boundaries, migrations, authentication, onboarding,
profiles, metahubs, applications, administration, and REST documentation.

## Strategic Priorities

These are the top-level priorities that guide development across the whole Universo ecosystem. Each item is intentionally short; details for each priority live in the per-project documentation and roadmaps.

1. **Universo Platformo general development.** Stabilise Universo Platformo React, move it from alpha to beta and then to a stable release, and start porting platform work to other technology stacks such as Rust and Godot, so the same platform direction becomes available across implementations.
2. **Architecture refactor toward "everything is an Application".** Turn every product surface — including the metahub configurator, admin tools, and similar feature areas — into Applications, while keeping some of them as system Applications. Add a first-run Setup Wizard that lets the operator choose which Applications to install. In parallel, evolve the database and migrations layer — currently built on Knex.js, raw SQL, and a request-scoped `DbExecutor` — toward maximum performance, reliability, and security.
3. **Metahub template expansion.** Significantly increase the number of entity-type presets and grow the entity-type constructor, then assemble those presets into metahub templates that reproduce the architecture of established platforms (including 1C:Enterprise) and into industry templates such as PR, CRM, LMS, ERP, and LDM.
4. **Universo MMOOMM development.** An open-world MMO across parallel universes with different economic systems (capitalist, socialist, and others), where players explore, trade, build empires, fight interstellar wars, and cooperate in real time. MMOOMM blends science fiction, strategy, RPG, and life-simulation elements on top of the same Universo Platformo core.
5. **Universo Kiberplano development.** An integrated planning and execution environment that connects tasks, resources, capacities, people, organizations, software agents, and robots inside one coordinated system. Kiberplano combines ERP-style planning, multi-agent orchestration, robot and digital-twin integration, distributed nodes (personal, organizational, regional), scenario simulation, and a virtual-to-physical bridge for real-world execution.

## How To Read The Docs

Start with Getting Started if you want to run the repository.

Move to Platform if you want the product/domain picture.

Use Architecture when you need repository-level technical facts.

Use API Reference for integration details and Contributing for repository rules.
