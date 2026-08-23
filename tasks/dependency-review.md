# LeadsRadar Dependency Review

The release branch was audited on 2026-08-23 with `npm ls --depth=0 --omit=optional`, `npm outdated`, `npm audit --audit-level=high`, and `npm audit --omit=dev --audit-level=high`. The installed dependency tree is consistent, and both audit commands report zero vulnerabilities. No `npm audit fix --force` operation was used.

| Area | Observed state | Release decision |
| --- | --- | --- |
| Runtime | Node 22 is pinned through `.nvmrc`; Firebase Admin 14 and the current build are compatible with this runtime. | Keep the current runtime contract. |
| Gemini SDK | Installed `@google/genai` is 1.52.0; npm reports 2.18.0 as latest. | Keep v1.52.0. The provider model selector is configurable and defaults to `gemini-2.5-flash`; an SDK major migration needs isolated compatibility testing. |
| React | Installed React and React DOM are 19.2.6; patch updates are available. | Do not change during the release hardening pass; run the patch update in a separate lockfile-reviewed change. |
| Vite and plugin | Vite 6.4.3 and plugin-react 5.2.0 are installed; Vite 8 and plugin-react 6 are major migrations. | Keep current majors because the custom Express middleware and transformIndexHtml behavior are release-critical. |
| Express | Express 4.22.2 is installed; Express 5.2.1 is a major migration. | Keep Express 4; defer route/error middleware migration. |
| Tailwind | Tailwind 4.3.0 is installed; 4.3.3 is a compatible patch update. | Defer until a clean lockfile-only patch update can be tested separately. |
| Firebase | Firebase client 12.13.0 and Admin 14.3.0 are installed; Firebase client patch/minor updates are available. | Keep current versions for this release; re-run emulator and auth regression tests after any update. |
| Build tooling | `tsx`, `esbuild`, type packages, and autoprefixer have compatible updates available. | No bulk update; keep the passed lockfile and CI contract stable. |

The current main-client build is approximately 787.8 kB minified and 201.7 kB gzip, so Vite emits a non-fatal large-chunk warning. The gzip size is within the documented initial-shell budget, but the bundle should be reduced in a separate measured optimization track through route ownership and dependency inspection rather than by changing major toolchain versions during release preparation.
