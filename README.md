# DrayComply

- `packages/rates`: one file per OBCCTC schedule, each with an integrity suite. Only `obcctc-2026-07-01.ts` is verified.
- `packages/engine`: the pure compliance engine (v0.3.0).
- `packages/ingest`: reads CSV and XLSX exports into engine input, with a reject list and file hashes.
- `packages/report`: turns a run into an audit binder (data) and a PDF.
- `DECISIONS.md`, `NEEDS_HUMAN.md`, `CHECKPOINTS.md`, `HANDOFF.md`: the working record.

Run `npm install`, then `npx tsc --noEmit -p .` and `npx vitest run`.
