# TypeScript Strictness Plan

This project migrated to TypeScript. To increase type-safety progressively without blocking delivery, adopt the following staged plan:

- Stage 1 (done)
  - Convert all JS to TS and add tsx runner for scripts
  - Introduce focused typecheck configs and ESLint + Prettier

- Stage 2 (repositories)
  - Replace generic `Document` types with per-collection interfaces
  - Add helper generics for common repository patterns

- Stage 3 (app components/hooks)
  - Tighten types in `src/components` and `src/hooks`
  - Remove augmentation fallbacks (`augmentations.d.ts`) once underlying types are aligned

- Stage 4 (services)
  - Bring `src/services` into `tsconfig.app-typecheck.json`
  - Add explicit DTOs for service inputs/outputs

- Stage 5 (pages)
  - Gradually include selected `src/app/**` routes into typecheck
  - Address `searchParams`/`params` nullability and API response shapes

- Stage 6 (compiler flags)
  - Enable `noImplicitAny`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` incrementally per directory

- Stage 7 (cleanup)
  - Remove `augmentations.d.ts` and any remaining `ts-nocheck`
  - Consolidate common types into `src/types`

Run:
- `npm run typecheck` for core checks
- `cd mongodb-explorer && npm run typecheck:app` to typecheck app components/hooks/lib

