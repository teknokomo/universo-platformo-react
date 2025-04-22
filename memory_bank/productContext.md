# Product Context

## Purpose  
Expanding Flowise AI with multi‑user capabilities for collaborative workflows within Uniq (workflows/projects), creating visual‑programming functionality, business applications, games, and AR/VR applications.

## Development Philosophy  
- Minimal changes to the original codebase  
- Backwards compatibility  
- Simplicity over complexity

## 3D/AR/VR

Modern AR/VR and 3D application development faces a key problem: a multitude of different engines and frameworks often require reimplementing the same logic for each platform. **UPDL** is designed to solve this problem by providing a **unified description language** for content. Implementing UPDL will allow development teams to:

- **Develop faster and only once:** Create the scene description and game logic a single time, rather than redoing it for every engine. UPDL acts as an intermediate layer that can automatically generate platform-specific implementations across different tech stacks. This is especially valuable for studios targeting multiple platforms (for example, WebAR and native apps) – they can design in UPDL and export to each target as needed without starting from scratch.  
- **Embrace multi-platform from the start:** Thanks to UPDL’s abstract nature, multi-platform deployment is considered from the design phase. The project is built with the assumption it might run anywhere. All engine-specific details remain “behind the scenes” until the export stage. The team can focus on user experience and game mechanics without being distracted by the syntax of different APIs.  
- **Scale projects efficiently:** The format is intended for a wide range of applications – from a simple AR quiz to an MMO game. UPDL’s node-based structure and extensibility make it suitable for small prototypes as well as complex projects, promoting reuse of design and easier project evolution. As the project grows, the same UPDL description can be expanded and exported to new platforms, ensuring consistency across versions.

By addressing these needs, UPDL will streamline development workflows. Teams can iterate rapidly on the core experience in a platform-agnostic way, then rely on exporters to bring that experience to each target environment. This unification reduces duplicated effort, lowers the barrier to support new platforms, and helps maintain consistency in functionality across all outputs.

## Current Phase & Roadmap (v0.7.0 prototype, April 2025)
The project has shifted from design to **implementation**. Our end‑to‑end milestone:

> *“UPDL graph in Flowise → AR.js application in browser”*

### Near‑term deliverables  
| Deliverable | Definition of Done |
|-------------|-------------------|
| **UPDL core node set** | Nodes can be created, saved, and displayed in the editor |
| **AR.js exporter** | A working HTML page with a 3D model on a marker is generated |
| **Publish flow (MVP)** | CLI or API returns a URL for the generated build |

### Priorities  
1. Prove the viability of the pipeline (editor → export → publish).  
2. Conduct an internal UX test to identify bottlenecks (node hierarchy, drag‑and‑drop workflow).  
3. Prepare the foundation for the next platforms: **PlayCanvas React → Babylon.js → Three.js → A‑Frame VR** (in that order).

### Known Limitations for v0.7.0  
- **Web‑only:** native ARKit/ARCore are not supported.  
- **UI nodes:** 2D interface nodes are currently outside UPDL; a React UI can be overlaid on the canvas if needed.  
- **Complex nodes (Physics, Networking)** are postponed; exporters ignore them with a warning.  
- **Single‑scene assumption:** the first Scene node is treated as the main scene.  
- **Focus on functionality > optimization:** performance will be polished later.