---
name: Orval codegen quirks (api-spec)
description: Non-obvious failure modes when editing openapi.yaml and consuming generated hooks in this repo.
---

# Orval codegen quirks

## "Failed to resolve input" usually = a duplicate path key, not bad YAML
When `pnpm --filter @workspace/api-spec run codegen` errors with a vague
"Failed to resolve input", first suspect a **duplicate key** in `openapi.yaml`
(e.g. two `/users` path entries). YAML parses fine but Orval chokes. It is rarely
a syntax error.

## 201-status responses get no generated `<Op>Response` zod schema
Orval only emits a `<Op>Response` schema for 200 responses. For 201-created
endpoints there is no generated response schema — reuse a same-shape schema from
another operation (e.g. createUser response validated with the update-user
response schema; createAccessRequest with the list-item schema).

## Generated hook call signatures differ by kind
- Mutations are `export const useXxx` and take `{ data }` (and `{ id }` for path params).
- GET hooks are `export function useXxx`.
  - GET **with** query params: `useXxx(params | undefined, { query: {...} })`.
  - GET **without** params: `useXxx({ query: {...} })`.
Passing `{ query }` as the first arg to a with-params GET hook fails typecheck
("query does not exist in type XxxParams"). Pass `undefined` first.

**Why:** these cost real debugging time during the user/permission system build.
**How to apply:** when codegen fails or a generated hook won't typecheck, check
these three before rewriting the spec.
