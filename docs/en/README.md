---
description: Welcome to the Universo Platformo documentation based on Flowise
---

# Introduction

> **📋 Notice**: This documentation is based on the original Flowise documentation and is currently being adapted for Universo Platformo React. Some sections may still reference Flowise functionality that has not yet been fully updated for Universo Platformo-specific features.

<figure><img src=".gitbook/assets/FlowiseIntro (1).gif" alt=""><figcaption></figcaption></figure>

Universo Platformo React is an advanced open source platform built upon Flowise, extending it for building AI Agents, LLM workflows, and immersive 3D/AR/VR experiences.

It offers a complete solution that includes:

* [x] Visual Builder (inherited from Flowise)
* [x] Tracing & Analytics
* [x] Evaluations
* [x] Human in the Loop
* [x] API, CLI, SDK, Embedded Chatbot
* [x] Teams & Workspaces
* [x] **UPDL Node System** - Universal Platform Description Language
* [x] **MMOOMM Templates** - Massive Multiplayer Online Open Metaverse
* [x] **Multi-Platform Export** - AR.js, PlayCanvas, A-Frame support
* [x] **Enhanced Resource Systems** - Advanced resource management

## Spaces + Canvases Refactor (2025‑09)

We began decoupling Spaces from legacy Flowise UI into a dedicated pair of applications:

- `apps/spaces-srv` — backend for Spaces/Canvases (TypeORM entities, reorder endpoints)
- `apps/spaces-frt` — frontend with multi‑canvas tabs, drag & drop, and an isolated HTTP client

Key changes:
- The UI now loads the Spaces list from `apps/spaces-frt`.
- Canvas routes are handled under MinimalLayout via `apps/spaces-frt/base/src/entry/CanvasRoutes.jsx`, so the canvas page does not show the main left menu.
- Local hooks (`useApi`, `useCanvases`) and a local Axios client remove tight coupling to Flowise UI.
- Unused Flowise UI files were removed to reduce noise and alias conflicts.

There are 3 main visual builders namely:

* Assistant
* Chatflow
* Agentflow

## Assistant

Assistant is the most begineer-friendly way of creating an AI Agent. Users can create chat assistant that is able to follow instructions, use tools when neccessary, and retrieve knowledge base from uploaded files ([RAG](https://en.wikipedia.org/wiki/Retrieval-augmented_generation)) to respond to user queries.

<figure><picture><source srcset=".gitbook/assets/Screenshot 2025-06-10 232758.png" media="(prefers-color-scheme: dark)"><img src=".gitbook/assets/image (303).png" alt=""></picture><figcaption></figcaption></figure>

## Chatflow

Chatflow is designed to build single-agent systems, chatbots and simple LLM flows. It is more flexible than Assistant. Users can use advance techniques like Graph RAG, Reranker, Retriever, etc.

<figure><picture><source srcset=".gitbook/assets/screely-1749594035877.png" media="(prefers-color-scheme: dark)"><img src=".gitbook/assets/screely-1749593961545.png" alt=""></picture><figcaption></figcaption></figure>

## Agentflow

Agentflow is the superset of Chatflow & Assistant. It can be used to create chat assistant, single-agent system, multi-agent systems, and complex workflow orchestration. Learn more [Agentflow V2](using-flowise/agentflowv2.md)

<figure><picture><source srcset=".gitbook/assets/screely-1749594631028.png" media="(prefers-color-scheme: dark)"><img src=".gitbook/assets/screely-1749594614881.png" alt=""></picture><figcaption></figcaption></figure>

## Flowise Capabilities

| Feature Area                 | Flowise Capabilities                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Orchestration                | Visual editor, supports open-source & proprietary models, expressions, custom code, branching/looping/routing logic |
| Data Ingestion & Integration | Connects to 100+ sources, tools, vector databases, memories                                                         |
| Monitoring                   | Execution logs, visual debugging, external log streaming                                                            |
| Deployment                   | Self-hosted options, air-gapped deploy                                                                              |
| Data Processing              | Data transforms, filters, aggregates, custom code, RAG indexing pipelines                                           |
| Memory & Planning            | Various memory optimization technique and integrations                                                              |
| MCP Integration              | MCP client/server nodes, tool listing, SSE, auth support                                                            |
| Safety & Control             | Input moderation & output post-processing                                                                           |
| API, SDK, CLI                | API access, JS/Python SDK, Command Line Interface                                                                   |
| Embedded & Share Chatbot     | Customizable embedded chat widget and component                                                                     |
| Templates & Components       | Template marketplace, reusable components                                                                           |
| Security Controls            | RBAC, SSO, encrypted creds, secret managers, rate limit, restricted domains                                         |
| Scalability                  | Vertical/horizontal scale, high throughput/workflow load                                                            |
| Evaluations                  | Datasets, Evaluators and Evaluations                                                                                |
| Community Support            | Active community forum                                                                                              |
| Vendor Support               | SLA support, consultations, fixed/deterministic pricing                                                             |

## Contributing

If you want to help this project, please consider reviewing the [Contribution Guide](broken-reference/).

## Need Help?

For support and further discussion, head over to our [Discord](https://discord.gg/jbaHfsRVBW) server.
