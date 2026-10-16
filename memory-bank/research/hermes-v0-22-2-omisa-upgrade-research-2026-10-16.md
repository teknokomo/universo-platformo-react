# Research: Hermes v0.22.2 Upgrade For Omisa With Local Integrations

> Created: 2026-10-16
> Status: Reviewed
> Trigger: PLAN request to upgrade the production Hermes instance while preserving all local modifications and integrations
> Follow-up plan: ../plan/hermes-v0-22-2-omisa-upgrade-plan-2026-10-16.md

## Research Question

How can the production Hermes instance on `84.54.57.187` be upgraded from its current Hermes Agent v0.20.6-era checkout to exact upstream v0.22.2 while preserving Omisa-specific core changes, Telegram behavior, the custom MAX platform plugin, document/history capabilities, Multica ACP behavior, user state, and a reliable rollback path?

## Source Inventory

| Source | Type | Date / Freshness | Why It Matters |
|--------|------|------------------|----------------|
| Live SSH inspection of `84.54.57.187` | Primary operational evidence | 2026-10-16 | Establishes the actual production version, dirty tree, services, plugins, effective configuration, MAX listener, and database health. |
| `.backup/hermes-v0.22.2-telegram-separator-patch-handoff.md` | Local handoff | 2026-10-16 | Describes the Telegram command separator defect and a safe-porting strategy from another Hermes deployment. |
| `.backup/codex-context-hermes-v0.22.2-omisa-local-integrations-safety.md` | Local handoff | 2026-10-16 | Describes Omisa-specific MAX, document/history, capability, state, profile, and rollback invariants. |
| `/mnt/4159B2494BDADB75/Yandex.Disk/ai-agents/.agents/server-84.54.57.187-hermes.md` | Local operational documentation | Current local documentation, revalidated where material | Documents the Gateway, Multica link, ACP custom-provider repair, Desktop tunnel, and prior state-database incident. |
| https://github.com/NousResearch/hermes-agent/releases/tag/v0.22.2 | Upstream release | Published 2026-10-15 | Confirms v0.22.2 as the latest release and identifies the release commit. |
| https://github.com/NousResearch/hermes-agent/tree/v0.22.2 | Exact upstream source | Tag inspected 2026-10-16 | Provides the code actually targeted by the upgrade. |
| https://github.com/NousResearch/hermes-agent/blob/v0.22.2/plugins/platforms/telegram/adapter.py | Exact upstream source | Tag inspected 2026-10-16 | Confirms the Telegram command-cleaning defect still exists in v0.22.2. |
| https://github.com/NousResearch/hermes-agent/blob/v0.22.2/acp_adapter/session.py | Exact upstream source | Tag inspected 2026-10-16 | Shows the new ACP runtime-provider restoration path and its differences from the Omisa patch. |
| https://github.com/NousResearch/hermes-agent/blob/v0.22.2/hermes_cli/gateway_multiplex_mode.py | Exact upstream source | Tag inspected 2026-10-16 | Confirms the changed semantics of `gateway.multiplex_profiles: false`. |
| https://github.com/NousResearch/hermes-agent/blob/v0.22.2/hermes_cli/gateway_migrate.py | Exact upstream source | Tag inspected 2026-10-16 | Confirms the post-update automatic multiplex migration hook and opt-out path. |
| https://github.com/NousResearch/hermes-agent/blob/v0.22.2/gateway/platform_registry.py | Exact upstream source | Tag inspected 2026-10-16 | Confirms the plugin registration fields used by the local MAX adapter still exist. |
| https://github.com/NousResearch/hermes-agent/blob/v0.22.2/gateway/platforms/base.py | Exact upstream source | Tag inspected 2026-10-16 | Confirms the key base adapter and media helper APIs still exist, while internal behavior has changed heavily. |

## Key Findings

- The production Gateway is healthy and currently runs Hermes Agent `v0.20.6 (2026.8.27)` from `/opt/hermes-agent` with Python `3.12.3`. Its Git HEAD is `5fc308a70719a83cccdbba4c0e39c23f5a8239d5`, tagged `v2026.8.27`, and the working tree is dirty.
- The production tree has no local commits carrying the Omisa customizations. They exist as uncommitted changes in ten tracked core files plus two untracked core/test files. A direct in-place update would therefore place the only working copy of those changes in the conflict path.
- The locally modified tracked files are `acp_adapter/session.py`, `cron/scheduler.py`, `gateway/platforms/base.py`, `gateway/run.py`, `gateway/session_context.py`, `model_tools.py`, `plugins/platforms/telegram/adapter.py`, `tools/send_message_tool.py`, `tools/transcription_tools.py`, and `toolsets.py`. The added files are `gateway/disclosure_policy.py` and `tests/gateway/test_disclosure_policy_vps.py`.
- Those local core changes form several independent features: ACP custom-provider restoration, recipient-aware outbound disclosure filtering, current-turn attachment provenance/capabilities, a model-facing guarded transcription tool, and related toolset/session-context support.
- The exact upstream release target is `v0.22.2`, published 2026-10-15, at commit `d923a5eb487a17c0a68801bba9ef0f56c81040a8`.
- Upstream churn is very large in every locally modified core file. Comparing the production base commit with v0.22.2 across those ten files yields about 17,920 upstream insertions and 59,699 upstream deletions. This makes a blind merge, cherry-pick, or in-place `hermes update` an unsafe migration strategy.
- The Telegram separator defect still exists in exact v0.22.2. `_clean_bot_trigger_text()` removes `@BotName` plus following separators/whitespace with an empty replacement, so `/kanban@hermes_bot list` becomes `/kanbanlist` and similar commands lose the command/argument boundary.
- The production Omisa checkout does **not** currently contain that Telegram separator fix. Its local Telegram changes are attachment provenance/merge changes. Therefore the separator repair described by the first handoff must be added as a new v0.22.2 patch for this server, rather than merely preserved from the current dirty tree.
- The production ACP patch repairs persisted custom-provider identity by deriving the named provider from the saved base URL and passing that URL into provider resolution. v0.22.2 has substantially evolved custom-provider resolution and additional identity helpers, but its ACP restoration call is not the same as the Omisa patch. The required decision is behavioral: first reproduce the persisted OmniRoute session-resume case on clean v0.22.2, then port only the minimal remaining fix if it still fails.
- The MAX integration is an active production plugin, not only an MVP stub. `platforms.max.enabled` is true, webhook mode is enabled, long polling is disabled, persistent state is enabled, a profile-scoped CA bundle is configured, group allow/mention rules are active, and the Gateway process listens on `127.0.0.1:8765` for the MAX webhook. The plugin manifest text describing long-poll-only development behavior is stale.
- Static MAX plugin ABI compatibility looks promising: v0.22.2 still exposes `PluginContext.register_platform`, all `PlatformEntry` kwargs used by the plugin, `BasePlatformAdapter(config, platform)`, `MessageEvent`, `MessageType`, `SendResult`, `cache_document_from_bytes`, and `cache_image_from_bytes`. Runtime semantics around profile scoping, authorization, media handling, and gateway topology changed enough that static import compatibility is insufficient.
- Local backend plugins also include `omisa-document-store` and `omisa-history`, plus broker/socket helpers and skills. Their security model depends on session-bound/current-turn capabilities and must be ported together with the corresponding core session/attachment changes.
- The installation currently has no named `profiles/` directory, so it is a single-profile host. Even so, v0.22.2 changes the meaning of `gateway.multiplex_profiles`: explicit `false` is retired and may be rewritten/resolved into the new one-gateway-per-host model. The current production effective value is explicitly `false`, while `gateway.auto_multiplex_migration` is unset. A blind `hermes update` therefore introduces an unnecessary topology/configuration side effect.
- The production state database was rechecked read-only on 2026-10-16: `/home/omisa/.hermes/state.db` is about 642 MiB, `PRAGMA quick_check` returns `ok`, and `PRAGMA foreign_key_check` returns no rows. Because this database was recently recovered from corruption, the upgrade must preserve a cold pre-v0.22.2 snapshot before the new runtime opens production state.
- `omisa-gateway.service`, `multica-link.service`, and `multica-hermes-daemon.service` are currently active. The Multica wrapper ultimately calls `/opt/omisa-venv/bin/hermes`, so a versioned venv/check-out cutover must preserve or deliberately update that executable boundary.
- Recent production logs also contain intermittent Telegram transport failures (`Bad Gateway`, TLS/remote-protocol errors). Upgrade validation therefore needs a pre-cutover network baseline so an external Telegram-path outage is not misdiagnosed as a v0.22.2 regression.

## Conflicts And Uncertainty

- The first handoff was written for another server with a partially similar Telegram modification. Its assumption that a separator patch already exists locally is false for the current Omisa production checkout. The defect itself is real in v0.22.2 and still needs a fix here.
- The MAX `plugin.yaml` description says production webhook is not included, while the actual adapter, effective configuration, process listener, and production behavior show that webhook support is implemented and active. The implementation is authoritative; the manifest needs cleanup after a successful upgrade.
- The ACP custom-provider fix is not literally present in upstream v0.22.2, but the surrounding provider-resolution subsystem changed substantially. Static source comparison alone cannot determine whether the original failure still reproduces; an integration reproduction is required before porting that patch.
- The current single-profile topology reduces the immediate risk of merging multiple live profile gateways, but it does not remove the configuration and runtime-scope changes introduced by v0.22.2 multiplex behavior.
- Some local core changes have focused tests, while others are only represented by production behavior or plugin-local tests. The upgrade should treat behavior as the contract and create/port focused regression coverage where the target upstream structure differs.

## Project Implications

- Do not upgrade `/opt/hermes-agent` in place and do not run `hermes update` on the production checkout.
- Treat the migration as a clean v0.22.2 build plus selective functional porting of Omisa changes.
- Preserve each custom behavior as an independent patch/test slice so upstream replacements can be accepted where they already solve the same problem.
- Keep the production checkout and venv available until the new build passes production canaries.
- Preserve the full mutable Hermes home separately from core binaries; the first production start of v0.22.2 must occur only after a cold state snapshot.
- Explicitly suppress automatic multiplex migration during the upgrade and evaluate the new single-profile runtime semantics before production cutover.
- Test Telegram, MAX, document/history capabilities, disclosure filtering, transcription, ACP/OmniRoute resume, and Multica independently before declaring the upgrade complete.

## Recommended Decision

Build exact v0.22.2 in a separate versioned checkout and fresh virtual environment, copy/port the Omisa features into that staging build as independent patch sets, run offline/focused integration tests against a staging Hermes home, and only then perform a short controlled production cutover with a cold state snapshot and an immediate path back to the untouched v0.20.6-era checkout/venv.

The production upgrade should use a versioned-release switch rather than modifying `/opt/hermes-agent` and `/opt/omisa-venv` in place. This keeps the old executable environment available while the state snapshot provides rollback if v0.22.2 mutates persistent data.

## Open Questions Before PLAN

None. The maintenance window and final production canary timing are implementation/cutover decisions and do not block planning.

## Sources

- https://github.com/NousResearch/hermes-agent/releases/tag/v0.22.2
- https://github.com/NousResearch/hermes-agent/tree/v0.22.2
- https://github.com/NousResearch/hermes-agent/blob/v0.22.2/plugins/platforms/telegram/adapter.py
- https://github.com/NousResearch/hermes-agent/blob/v0.22.2/acp_adapter/session.py
- https://github.com/NousResearch/hermes-agent/blob/v0.22.2/hermes_cli/gateway_multiplex_mode.py
- https://github.com/NousResearch/hermes-agent/blob/v0.22.2/hermes_cli/gateway_migrate.py
- https://github.com/NousResearch/hermes-agent/blob/v0.22.2/gateway/platform_registry.py
- https://github.com/NousResearch/hermes-agent/blob/v0.22.2/gateway/platforms/base.py
