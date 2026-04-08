# OHIF Viewer — Agent Quick Reference

> Medical imaging web viewer monorepo. React + Cornerstone3D. Lerna + Yarn workspaces.

## Project Structure

```
platform/           # Core platform packages
├── app/            # Main PWA entry point (webpack/rsbuild)
├── core/           # Business logic, DICOMWeb, services
├── ui/             # React component library (legacy)
├── ui-next/        # React component library (new)
└── i18n/           # Internationalization

extensions/         # Feature extensions
├── cornerstone/    # Image rendering via Cornerstone3D
├── cornerstone-dicom-*
├── default/        # Basic datasources, panels
├── dicom-pdf/
├── dicom-video/
└── ...

modes/              # Application modes (workflow configurations)
├── basic/
├── longitudinal/   # Measurement tracking
├── tmtv/           # Total Metabolic Tumor Volume
├── microscopy/
└── ...
```

## Quick Commands

| Command | Purpose |
|---------|---------|
| `yarn install --frozen-lockfile` | Install deps (required first step) |
| `yarn dev` | Start dev server (webpack) at localhost:3000 |
| `yarn dev:fast` | Start dev server (rsbuild) - faster experimental mode |
| `yarn dev:orthanc` | Dev with local Orthanc PACS proxy |
| `yarn build` | Production build → `platform/app/dist` |
| `yarn test:unit` | Jest tests across all packages |
| `yarn test:e2e` | Playwright tests (builds + serves first) |
| `yarn test:e2e:ui` | Playwright interactive UI mode |
| `yarn test:e2e:headed` | Playwright headed mode for debugging |

## Testing

**Unit Tests (Jest)**
- Config: `jest.config.js` (root), `jest.config.base.js` (shared)
- Pattern: `src/**/*.test.{js,ts}` next to source files
- Run single package: `cd platform/core && yarn test:unit`

**E2E Tests (Playwright)**
- Config: `playwright.config.ts` (root)
- Tests: `tests/*.spec.ts`
- Uses `data-cy` attribute for selectors (configured in playwright.config.ts)
- Requires test data: `yarn test:data` (git submodule)
- Snapshots: `tests/screenshots/`

## Key Technologies

- **Node**: 18+ (see `.node-version` for exact: 20.9.0)
- **Package Manager**: Yarn 1.22+ with workspaces
- **Monorepo**: Lerna 7.x + Yarn workspaces
- **Build**: Webpack 5 (primary), Rsbuild (experimental fast mode)
- **Test**: Jest (unit), Playwright (e2e), Cypress (legacy e2e)
- **Image Rendering**: Cornerstone3D (@cornerstonejs/core, @cornerstonejs/tools)
- **UI**: React 18, TailwindCSS, Zustand (state)
- **DICOM**: dcmjs, dicom-parser, @cornerstonejs/dicom-image-loader

## Development Workflow

1. **Install**: `yarn install --frozen-lockfile`
2. **Dev**: `yarn dev` (webpack) or `yarn dev:fast` (rsbuild)
3. **Test**: `yarn test:unit` (Jest) or `yarn test:e2e` (Playwright)
4. **Build**: `yarn build` → outputs to `platform/app/dist`

## Important File Locations

| Purpose | Path |
|---------|------|
| App entry | `platform/app/src/index.js` |
| App init | `platform/app/src/appInit.js` |
| Core exports | `platform/core/src/index.ts` |
| Webpack config | `platform/app/.webpack/webpack.pwa.js` |
| Rsbuild config | `rsbuild.config.ts` (root) |
| TypeScript paths | `tsconfig.json` (root) |
| Jest base config | `jest.config.base.js` (root) |
| Playwright config | `playwright.config.ts` (root) |

## TypeScript Path Aliases

```json
"@ohif/core" → "platform/core/src"
"@ohif/ui" → "platform/ui/src"
"@ohif/ui-next" → "platform/ui-next/src"
"@ohif/i18n" → "platform/i18n/src"
"@state" → "platform/app/src/state"
"@ohif/extension-*" → "extensions/*/src"
```

## Lint & Format

- **ESLint**: `.eslintrc.json` — extends react-app, typescript, prettier
- **Prettier**: `.prettierrc` — singleQuote, trailingComma: es5, printWidth: 100
- **Plugins**: prettier-plugin-tailwindcss for Tailwind class sorting

## Testing Tips

- **E2E tests need the dev server**: Playwright config auto-starts server on :3335
- **Test data**: Run `yarn test:data` to populate `testdata/` submodule
- **Update snapshots**: `yarn test:e2e:update`
- **Debug e2e**: `yarn test:e2e:debug` (Playwright inspector)

## Build Variants

| Command | Config | Use Case |
|---------|--------|----------|
| `yarn build` | `config/default.js` | Default production |
| `yarn build:dev` | development | Dev build |
| `yarn build:ci` | `config/netlify.js` | CI/Netlify deploy |
| `yarn build:demo` | `config/demo.js` | Demo site |

## Docker

```bash
# Build image
docker build -t ohif/viewer:latest .

# Run with custom config
docker run -p 80:80 -e APP_CONFIG=/config/myconfig.js ohif/viewer:latest
```

## Cornerstone3D Integration

This repo consumes `@cornerstonejs/*` packages. For cross-repo development:

```bash
# Link local CS3D (after cloning to libs/@cornerstonejs)
yarn cs3d:link

# Unlink when done
yarn cs3d:unlink
```

CI supports testing against CS3D branches via `ohif-integration` label + `CS3D_REF: branch-name` in PR body.

## Common Gotchas

- **Always use frozen-lockfile**: `yarn install --frozen-lockfile` (security requirement)
- **Memory issues**: Builds use `--max_old_space_size=8096` (configured in scripts)
- **Webpack vs Rsbuild**: `yarn dev` = webpack, `yarn dev:fast` = rsbuild (experimental)
- **Modes vs Extensions**: Modes = workflow configs, Extensions = feature implementations
- **Lerna versioning**: Single version across all packages (see `lerna.json`)

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `APP_CONFIG` | Path to config file (e.g., `config/orthanc.js`) |
| `PUBLIC_URL` | Base URL path (default: `/`) |
| `NODE_ENV` | `development` or `production` |
| `OHIF_PORT` | Dev server port (default: 3000) |
| `PROXY_TARGET` | DICOMweb proxy target for local PACS |

## Docs

- Main docs: https://docs.ohif.org/
- Architecture: https://docs.ohif.org/architecture/
- Live demo: https://viewer.ohif.org/
- Component library: https://ui.ohif.org/
