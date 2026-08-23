# Render deployment source notes

Retrieved 2026-08-23 from official Render documentation.

- https://render.com/docs/deploy-node-express-app — Render Node/Express services use the repository's build and start commands; linked branches can auto-deploy, and a failed deploy leaves the last successful version running.
- https://render.com/docs/blueprint-spec — `render.yaml` is the default root Blueprint filename. A Docker web service uses `type: web`, `runtime: docker`, optional `dockerfilePath`, `healthCheckPath`, `maxShutdownDelaySeconds`, `autoDeployTrigger`, and `envVars`. Blueprint validation is available through Render tooling/API; the official schema is https://render.com/schema/render.yaml.json.
- https://render.com/docs/deploy-hooks — deploy hook URLs are secrets; store them as GitHub Actions secrets, and trigger only after CI succeeds. The documented secret name example is `RENDER_DEPLOY_HOOK_URL`.
- https://render.com/docs/deploys — Render supports automatic deploys on commit or after CI checks pass, manual deploys, deploy hooks, and specific-commit deploys. Failed builds leave the current successful instance running. Web services receive SIGTERM during replacement and should implement graceful shutdown. Render supports `healthCheckPath` and `maxShutdownDelaySeconds` in Blueprints.

Implementation boundary: repository changes can add a Render Blueprint and CI workflow, but creating or changing the live Render service, entering credentials, triggering a deploy, or changing environment variables requires point-of-action user confirmation. No deploy hook, Render API token, or secret value is stored in the repository.
