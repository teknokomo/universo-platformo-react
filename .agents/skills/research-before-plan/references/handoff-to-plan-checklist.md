# Handoff To PLAN Checklist

Before PLAN mode consumes a research artifact, verify:

- [ ] The artifact is in `memory-bank/research/`.
- [ ] The artifact includes the research question.
- [ ] Every user-provided URL was opened and listed.
- [ ] Non-trivial decisions include additional authoritative sources.
- [ ] Source freshness is recorded for unstable topics.
- [ ] Key findings separate facts from inferences.
- [ ] Conflicts and uncertainty are explicit.
- [ ] Project implications are mapped to repository areas.
- [ ] Open questions before PLAN are listed, or explicitly marked as none.
- [ ] The artifact path is included in the PLAN context.

If any required item is missing during standalone RESEARCH, complete the research artifact before handing off to PLAN.
If PLAN mode detects that research is missing, it should not stop by default; it should complete the necessary research inline or delegate it to a research-capable subagent when the environment supports subagents, then continue planning from the findings.
