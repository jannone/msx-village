# Project instructions

These instructions apply to all agents working in this repository, including spawned agents.

## Project paths

- `SPEC.md`: product intent, scope, technical choices, and open decisions. Read it before extending the product.
- `msx/`: MSX1 game source, assets, build tooling, and MegaROM generation inputs.
- `webapp/`: React, Vite, and TypeScript website with its Cloudflare Worker backend. Run web app commands from this directory.
- `webapp/src/`: frontend components and styles.
- `webapp/worker/`: backend API handlers.
- `webapp/wrangler.jsonc`: source Cloudflare configuration.
- `webapp/vite.config.ts`: frontend and Worker build configuration.
- `webapp/worker-configuration.d.ts`: generated Worker types; regenerate with `npm run cf-typegen` when bindings or compatibility settings change.
- `webapp/README.md`: local development, validation, and deployment instructions.
- `webapp/dist/` and `webapp/.wrangler/`: ignored generated output; do not edit or commit these directories.

## Deployment

- GitHub repository: `jannone/msx-village`.
- Cloudflare Worker: `msx-village`.
- Live website: https://msx-village.jannone.workers.dev/.
- Cloudflare Workers Builds automatically deploys pushes to `main` using `webapp` as the root directory, `npm run build` as the build command, and `npx wrangler deploy` as the deploy command.
- Preview builds are currently disabled. Pushing to `main` publishes changes to the live website.

## WebMSX source requirement

When WebMSX integration begins, obtain its source by cloning or fetching a Git repository. Use the upstream repository at https://github.com/ppeccin/WebMSX.git unless the user specifies a different repository or fork.

Do not substitute an npm package, CDN script, release archive, or hand-written emulator for the Git source checkout. Pin and document the Git commit used so the integration and any emulator changes are reproducible. This requirement applies to every agent working on WebMSX integration.

WebMSX does not need to be downloaded before work requiring it begins.

## Local MSX testing references

The existing project at `/Users/jannone/Documents/prj/msx/msx-beam-rider` is a read-only reference for local OpenMSX testing. All agents may inspect and copy useful files from it into this repository, then adapt the copies here. Do not modify, create, delete, or regenerate files in the Beam Rider directory, change its Git state, or run builds or test runners that write there. Keep all Village work and test outputs in this repository or a Village-specific temporary directory.

Inspect its current instructions and fixtures when setting up Village ROM validation:

- `AGENTS.md` and `docs/README.md`: build and emulator instructions.
- `tests/README.md`: regression, visual capture, and profiling workflows.
- `tests/headless.xml`: isolated settings with rendering disabled, vsync disabled, and settings persistence disabled.
- `tests/run_cover.py` and `tests/run_megarom.py`: Python runners with subprocess timeouts, launcher logs, explicit report validation, separate machine outputs, and ROM hashes.
- `tests/megarom.tcl`: mapper/bank checks, interrupt safety, and bank restoration.
- `tests/startup.tcl`: startup and restart checks with VRAM captures.
- `tests/presentation.tcl`: state-driven screenshots with throttled rendering.
- `tests/profile.tcl` and `tests/full_run.tcl`: timing measurements and VDP access checks.

OpenMSX 21.0 is installed at `/opt/homebrew/bin/openmsx`. The local `C-BIOS_MSX1` and `C-BIOS_MSX1_EU` configurations passed `-testconfig` checks on 2026-10-07. Explicitly select an MSX1 machine rather than relying on the emulator default. Use both configurations for NTSC/PAL coverage and verify the actual refresh rate in the test.

Example command shapes, with paths and mapper replaced by the actual Village build values:

```sh
openmsx -machine C-BIOS_MSX1 -cart <village-rom> -romtype <chosen-mapper>
openmsx -setting <village-headless-settings.xml> -machine C-BIOS_MSX1 -cart <village-rom> -romtype <chosen-mapper> -script <village-test.tcl>
```

Adapt these patterns into `msx/` when testing is introduced. Beam Racer fixtures contain game-specific symbols, memory addresses, bank counts, controls, and output paths; they cannot validate Village unchanged. Use Village-specific environment variables and result paths, preserve user emulator settings, and keep screenshots throttled so rendering can complete. Check test reports as well as process exit status: some Tcl fixtures exit normally after writing a failure report. Retain ROM hashes with results and use `VDP.too_fast_vram_access_callback` where appropriate to detect unsafe VRAM access timing.

C-BIOS emulator checks do not replace release validation on suitable MSX1 BIOS configurations and real hardware.

## Confirmed implementation choices

- Invitation-based username/password access; invitations are issued by an operator.
- MSX1 with 64 KB RAM and a 1 MiB ASCII8 MegaROM.
- Build the MSX core with `node msx/tools/build.mjs` from the repository root. Regenerate the checked-in Worker ROM template after MSX source changes.
- Run API tests only against a local Worker/D1; `webapp/tests/api.mjs` refuses non-local URLs.
- Apply D1 migrations before publishing code that uses them.
- Keep invitation codes, test credentials, generated ROMs, and vendor checkouts out of Git.
