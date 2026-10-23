# Publishing Claw Foundry

Package: `@essex75/claw-foundry` (public, MIT). Author and maintainer: Egor Kislitsyn, GitHub ESSEX75. The first version is `0.1.0`.

1. Confirm npm access to the `@essex75` scope. Configure the repository secret `NPM_ACCESS_TOKEN` with publish permission for this package. Never reuse upstream credentials. Use the Node version in `.nvmrc` and npm version from `package.json`.
2. Run `npm ci`, `npm run arch:check:strict`, `npm run check`, `npm run build`, `npm run test`, and `git diff --check`. Inspect `npm pack --dry-run` for bundled code, defaults, docs, README, and LICENSE with both copyright notices.
3. Smoke-test an installed package with the supported OpenClaw version. Test a fresh workspace and an explicitly migrated workspace following [MIGRATION.md](docs/MIGRATION.md). Verify registration reports 25 tools, one CLI group, one service and three hooks.
4. Move the intended entries from Unreleased into `0.1.0` in CHANGELOG.md and write the release date. Keep package.json and package-lock.json versions identical.
5. After review and a separately authorized commit/push, create tag `v0.1.0` and publish its GitHub Release in [ESSEX75/claw-foundry](https://github.com/ESSEX75/claw-foundry/releases/new). The workflow `.github/workflows/npm-publish.yml` verifies repository, package identity and tag/version agreement, runs checks, builds, tests and publishes with provenance. Alternatively dispatch that workflow with the exact version tag.
6. Verify the [npm package](https://www.npmjs.com/package/@essex75/claw-foundry), install the released version in a clean environment and inspect gateway logs. Do not overwrite an existing npm version; publish a new patch version for corrections.

Manual publication, when explicitly intended: from the reviewed version-tag checkout, after all checks, run `npm publish --provenance --access public` in a supported CI environment. Local publishing without provenance requires a separately chosen process; the normal release path is GitHub Actions.

Upstream tags and releases are historical objects. Never delete them as part of a release script. Before any cleanup, list exact objects in the Claw Foundry repository and request explicit approval. Do not change the upstream DevClaw repository.
