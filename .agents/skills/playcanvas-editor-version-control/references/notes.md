# PlayCanvas Editor Version Control Reference Notes

- PlayCanvas Editor uses a custom distributed-like VCS built on top of scene/asset state forks.
- Key concepts:
  - **Checkpoints:** Immutable snapshots of the project at a point in time.
  - **Branches:** Mutable paths that can fork from checkpoints and merge back into other branches.
- Merge operations generate conflicts when the same entity component properties or asset attributes are changed concurrently in both branches.
