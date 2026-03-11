---
description: How to think about export across multiple technology stacks.
---

# Multi-Platform Export

Multi-platform export in Universo Platformo is a strategic property of the
platform. Not every current feature is expected to ship everywhere today.

## Recommended Approach

1. Start from portable definitions and stable domain semantics.
2. Separate design-time structures from stack-specific runtime details.
3. Identify what can stay shared across implementations and what needs adaptation.
4. Validate exports against the target stack and document any adaptation gaps.
5. Treat the React repository as the main public reference, not the only future client.

This keeps export discussions grounded in current architecture and delivery reality.
