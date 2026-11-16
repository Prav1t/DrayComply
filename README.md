# DrayComply

- `packages/rates`: one file per OBCCTC schedule, each with an integrity suite. Only `obcctc-2026-07-01.ts` is verified.
- `packages/engine`: the pure compliance engine (v0.3.0).
- `DECISIONS.md`, `NEEDS_HUMAN.md`, `CHECKPOINTS.md`, `HANDOFF.md`: the working record.

Run `npm install`, then `npx tsc --noEmit -p .` and `npx vitest run`.
