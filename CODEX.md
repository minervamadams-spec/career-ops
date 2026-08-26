@AGENTS.md

## Build verification in sandboxed environments

If `cd web && npm run build` stalls at “Creating an optimized production build” in a sandbox, treat it as a Turbopack worker-coordination limitation, not an Offerly code failure. Verify with `cd web && BUILD_DIST=.next-webpack-verify npx next build --webpack`; this is diagnostic-only and does not change the shipped Turbopack-default scripts.
<!-- Codex config — imports AGENTS.md -->
