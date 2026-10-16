# Plan: Upgrade Omisa Hermes To v0.22.2 Without Losing Local Integrations

> Created: 2026-10-16
> Status: Proposed
> Research: ../research/hermes-v0-22-2-omisa-upgrade-research-2026-10-16.md

## Overview

Upgrade the production Hermes Gateway on `84.54.57.187` from the current v0.20.6-era dirty checkout to exact upstream v0.22.2 while preserving all Omisa-specific behavior: Telegram routing and command fixes, MAX, ACP/OmniRoute resume, disclosure filtering, attachment/transcription capability boundaries, document/history plugins, Skills/memory/cron/session state, Multica integration, and rollback safety.

The migration will use a clean versioned v0.22.2 release plus selective porting and testing. The production checkout will not be updated in place.

## Affected Areas

- Core checkout: `/opt/hermes-agent` and the ten currently modified tracked files plus two local added files.
- Python runtime: `/opt/omisa-venv` and locally required packages, including Multica ACP support.
- Gateway service: `omisa-gateway.service` and its `HERMES_HOME`, working directory, and executable paths.
- Profile state: `/home/omisa/.hermes`, including `state.db`, sessions, routing, cron, memories, Skills, `SOUL.md`, config, env, pairings, plugin state, and caches that are part of durable behavior.
- Local plugins: `max`, `omisa-document-store`, and `omisa-history`, including broker/socket helpers.
- Telegram adapter behavior and current-turn attachment provenance.
- MAX webhook/TLS/auth/media/dedup/persistent-state behavior.
- ACP custom-provider restore path used by OmniRoute and Multica.
- Disclosure policy and outbound message paths.
- Model-facing transcription and toolset exposure.
- Multiplex/profile topology semantics introduced by v0.22.2.
- Multica wrapper/services that call the Hermes executable.
- Server documentation and upgrade/rollback records.

## Plan Steps

- [ ] **1. Freeze and record the production baseline.** Capture exact Hermes/Git/Python/OpenAI-SDK versions, service units, executable paths, effective non-secret config, plugin manifests, file ownership/permissions, current dirty diff, untracked files, dependency inventory, active listeners, Multica daemon status, MAX mode, Telegram connectivity baseline, and database integrity. Record hashes for every local core/plugin file that will be ported.

- [ ] **2. Create a complete rollback package before touching production binaries.** Preserve the current `/opt/hermes-agent` checkout, its full diff and untracked files, the current venv/dependency inventory, systemd units, Multica wrapper/configuration, and all relevant Hermes-home content. At the final cutover boundary, stop the production Gateway and take a cold snapshot of `state.db` plus any WAL/SHM files, sessions/routing, config and `.env`, Skills, memories, cron, plugins, MAX persistent state, document registry/originals, CA bundle, pairings, `SOUL.md`, and ownership/mode metadata. Keep this snapshot unopened by v0.22.2.

- [ ] **3. Prepare exact v0.22.2 in a separate versioned release area.** Check out commit `d923a5eb487a17c0a68801bba9ef0f56c81040a8` into a new staging/release directory and create a fresh Python virtual environment from v0.22.2 dependencies. Add only explicitly required local dependencies afterward. Do not reuse the production venv and do not run `hermes update` against `/opt/hermes-agent`.

- [ ] **4. Create a staging Hermes home and disable topology side effects.** Use a separate staging `HERMES_HOME` with copied test-safe configuration/state. Before any target-version gateway start, set `gateway.auto_multiplex_migration=false` through the v0.22.2 CLI and read the effective value back. Evaluate v0.22.2's retired `gateway.multiplex_profiles:false` behavior on this single-profile host. Do not introduce profiles, profile routes, or a multiplex migration as part of this upgrade.

- [ ] **5. Port local core behavior as separate, reviewable patch sets.** Re-implement each behavior against v0.22.2 structure rather than merging the old files wholesale:
  1. recipient-aware disclosure policy and every outbound enforcement point;
  2. current-turn attachment provenance/capabilities and session-context bindings;
  3. guarded model-facing transcription plus required toolset exposure;
  4. Telegram attachment provenance/merge behavior;
  5. the Telegram `/command@OwnBot args` separator repair, which is not currently present on this production checkout but is still required by v0.22.2;
  6. ACP custom-provider restoration only if the clean v0.22.2 OmniRoute resume reproduction still fails;
  7. any remaining small `model_tools`/tool integration changes that are necessary for those contracts.

- [ ] **6. Port and ABI-audit all profile plugins.** Copy `max`, `omisa-document-store`, and `omisa-history` into staging without production credentials. Validate their imports and registration contracts against v0.22.2. For MAX, explicitly verify `PluginContext.register_platform`, `PlatformEntry` kwargs, `BasePlatformAdapter`, `MessageEvent`, `MessageType`, `SendResult`, media-cache helpers, standalone sender behavior, authorization delegation, and webhook lifecycle. Preserve the broker/socket integration used by history/document parsing.

- [ ] **7. Reconcile MAX with v0.22.2 profile/runtime semantics.** Keep exactly one production MAX transport consumer, preserve loopback webhook binding, profile-scoped CA verification, allowed users/chats, mention requirements, admin slash ACL, dedup, persistent state, media roots, callbacks, edit/delete handling, and the rule that unauthorized inbound attachments cannot become durable data before authorization. Do not use `verify=False`, global CA changes, or a duplicate long-poll/webhook consumer.

- [ ] **8. Reconcile Telegram behavior with v0.22.2.** Implement a narrow, idempotent command-address normalization that changes only `/command@OwnBotName` addressing and preserves the separator before arguments. Test Telegram entities/UTF-16 offsets, own/foreign bot mentions, captions where supported, edited/event paths that are actually handled, forum topics, reply routing, group mention gates, allowlists, and the attachment provenance carried by merged/batched events.

- [ ] **9. Prove ACP/OmniRoute and Multica compatibility before deciding whether to keep the ACP patch.** Create a persisted ACP session using the configured custom OmniRoute provider, restart/recreate the session, and verify that the same provider/base URL/API mode is restored and a successful continuation is produced. If clean v0.22.2 passes, drop the obsolete local ACP patch. If it fails, port the smallest compatible fix and add a regression test. Verify the Multica ACP daemon against the staging Hermes executable without replacing the production daemon yet.

- [ ] **10. Run focused regression gates in staging.** At minimum run import/compile checks, v0.22.2 config validation, local disclosure-policy tests, attachment/session capability tests, transcription access-boundary tests, Telegram parser/event-path tests, MAX plugin tests, document/history capability tests, ACP resume tests, and applicable upstream Gateway/platform tests. Keep production Telegram/MAX bot credentials disconnected from staging; use fixtures/mocks or separate test credentials for transport tests.

- [ ] **11. Run a copied-state rehearsal with production transports disabled.** Open only a copied production state set with the staging runtime, verify schema/config migration behavior, session visibility, cron parsing, Skills/memory loading, plugin discovery, MAX persistent-state compatibility, document/history registry access, and absence of unexpected writes outside the staging home. Confirm that the original production state remains byte-for-byte untouched by this rehearsal.

- [ ] **12. Prepare an atomic core/runtime cutover and a tested rollback command sequence.** Keep the current checkout and venv intact. Prepare versioned v0.22.2 checkout/venv paths and update the service boundary only during the maintenance window. Ensure the Multica wrapper either continues to resolve the intended Hermes executable through a stable path or is switched together with the Gateway. Document the inverse switch before production start.

- [ ] **13. Perform the production maintenance cutover.** Stop `omisa-gateway.service`, take the final cold mutable-state snapshot, switch the service to the verified v0.22.2 checkout/venv, confirm the intended effective configuration, start the Gateway, and inspect readiness/listeners/journal before accepting any user canaries. Keep Multica transport available unless its Hermes daemon needs a coordinated short restart for the executable switch.

- [ ] **14. Run production canaries in a fixed order.** Verify: basic Gateway response; Telegram DM; Telegram group mention; `/command@BotName args`; foreign-bot command rejection; forum/topic route; Telegram attachment; MAX allowed DM; denied/pairing DM; allowed group mention; unmentioned group behavior; MAX attachment/callback/edit/delete; document save/get/parse/read and scope denial; disclosure filtering; transcription only for current-turn media; ACP/OmniRoute session continuation; Multica agent task; cron delivery; and absence of duplicate replies/consumers.

- [ ] **15. Observe the new runtime before declaring success.** Monitor Gateway restarts, Telegram reconnect behavior, MAX webhook/dedup state, SQLite errors, cron duplication, plugin hook timeouts, Multica daemon health, and resource usage for a bounded post-cutover window. Compare Telegram network failures against the captured pre-upgrade baseline.

- [ ] **16. Roll back immediately on a contract-breaking failure.** Stop the v0.22.2 Gateway if it fails startup/readiness, corrupts or unexpectedly migrates state, duplicates Telegram/MAX replies, bypasses authorization, misroutes a profile/chat/thread, exposes protected documents/internal details, breaks ACP/Multica continuation, duplicates cron, or enters reconnect loops. Restore the old checkout/venv/service boundary; restore the cold Hermes-home snapshot if v0.22.2 wrote incompatible state; then start the old Gateway and repeat short Telegram/MAX/Multica health checks.

- [ ] **17. Finalize documentation only after production proof.** Update the Hermes server documentation with v0.22.2 commit, versioned paths, every retained/dropped custom patch and why, new venv/dependencies, multiplex decision, MAX/plugin compatibility results, backup paths, exact test commands/results, production canaries, and rollback procedure. Correct the stale MAX plugin manifest description/version so it matches the production webhook implementation.

## Potential Challenges

- The locally modified core files have undergone very large upstream changes, so textual patch replay will produce misleading conflicts and can accidentally resurrect removed upstream code. Functional re-porting is required.
- The current customizations are uncommitted in production, so the upgrade must first turn the dirty tree into an immutable backup/patch artifact before any switch.
- v0.22.2 changes gateway topology semantics: `multiplex_profiles:false` is retired. Even on a single-profile host this can alter runtime scoping and plugin assumptions.
- MAX is a custom out-of-tree platform with production webhook/TLS/auth/media behavior. Static ABI compatibility does not prove runtime compatibility.
- Document/history/transcription safety relies on custom core capability plumbing; losing only one of those supporting changes could silently widen filesystem or cross-chat access.
- The state database is healthy now but was recently recovered from corruption. A first-launch migration must never run on the only rollback copy.
- Staging cannot consume the same Telegram or MAX bot credentials as production at the same time without risking duplicate consumers/replies.
- Existing Telegram transport instability through the current network/proxy path can resemble an application regression, so baseline evidence is required before and after the cutover.
- Multica currently depends on a stable Hermes executable path; a versioned venv rollout must account for that wrapper explicitly.

## Dependencies

- Sufficient free disk space for a full cold Hermes-home snapshot, the 642 MiB state database, the current checkout, a separate v0.22.2 checkout, and a fresh venv.
- A short maintenance window for the final Gateway stop, cold snapshot, executable switch, restart, and production canaries.
- Separate test credentials or mocked transport paths for pre-production Telegram/MAX testing.
- Continued SSH/root-equivalent operational access for service, snapshot, ownership, and rollback work.

## Completion Criteria

- Exact v0.22.2 commit `d923a5eb487a17c0a68801bba9ef0f56c81040a8` is the production runtime.
- Every current local core change is classified as retained, replaced by upstream, or intentionally dropped with evidence.
- Telegram separator handling works on the real event path without weakening mention/ACL/topic routing.
- MAX webhook, authorization, TLS, dedup, media, persistent state, callbacks, and group behavior pass production canaries.
- Document/history/current-turn attachment capability boundaries remain enforced.
- ACP resumes the configured OmniRoute provider correctly and Multica continues working.
- Skills, memories, sessions, cron, plugins, and state are preserved.
- No unintended multiplex/profile migration occurs during the upgrade.
- `state.db` remains healthy after cutover.
- Rollback remains executable from preserved old binaries plus the cold pre-v0.22.2 state snapshot.
- Final server documentation records the actual tested state and any remaining limitations.
