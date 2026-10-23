# Reference Examples

This directory contains reference scaffolds that illustrate the patterns
expected by the AI generation flow of `@modyo/mcp` (Widgets module).

**These files are excluded from TypeScript compilation** (see `tsconfig.app.json`).
They exist as references — copy them to their destination locations and
adapt them to your widget's domain.

## Files

| Reference file              | Destination location                       | Naming convention            |
|-----------------------------|--------------------------------------------|------------------------------|
| `MockTemplate.ts`           | `src/services/mocks/<entityName>.ts`       | `mockEntities` → `mock<Entity>` |
| `RepositoryTemplate.ts`     | `src/services/repositories/<EntityName>Repository.ts` | `getEntities` → `get<Entity>` |
| `QueryHookTemplate.ts`      | `src/hooks/use<EntityName>.ts`             | `useEntities` → `use<Entity>` |
| `EntityListScreen.tsx`      | `src/screens/<EntityName>ListScreen.tsx`   | (Composes the above) |
| `ModyoAuthTemplate.ts`      | `src/services/api/modyoAuth.ts`            | (One-time setup, not per entity) |
| `ProfileHookTemplate.ts`    | `src/hooks/useProfile.ts`                  | (Requires `modyoAuth.ts` above) |

## Modyo delegated token

`ModyoAuthTemplate.ts` and `ProfileHookTemplate.ts` are the cooked wiring for the
delegated token flow (`Authorization: Bearer` against the client's API). Unlike
the entity scaffolds, these are **one-time setup**: copy them once, not once per
entity. The reusable parts they build on — the session, the cache and the
interceptors — are real compiled and tested code under `src/services/api/`; only
the wiring lives here. See the main README, section "Sesión de Modyo y token
delegado".

## Why this exists

The AI agent that generates widgets reads these files to learn the
expected patterns: how repositories use `AbortSignal`, how mocks toggle
via `USE_MOCKS`, how query hooks compose query keys, and how a typical
screen integrates `<DataStateWrapper>`, `<ErrorBoundary>`, `useTranslation`,
and TanStack Query.

The developer can safely delete this directory once they no longer need it.

## Convention

File name prefix `_` or directory prefix `_examples/` marks scaffolds —
they are not production code. Build, lint, and test ignore them.

The relative imports inside each scaffold already match the **destination
location**, not the current location in `_examples/`. After copying a
file to its destination, no path adjustments are needed (only the
`<entityName>` placeholders).
