# First-version implementation status

The website and API are deployed through the GitHub-connected Cloudflare Workers Builds pipeline. The deployed implementation includes invitation-based username/password accounts, one-plot ownership, a neighborhood map, exterior/interior editing, read-only visits, standard tiles and objects, four avatar appearances, online saves and offline ROM downloads. Custom artwork creation and live multiplayer remain deferred.

## Validation completed

- SDCC/MSXgl compilation produces a 1 MiB ASCII8 ROM with resident code below A000 and ordinary RAM below D000.
- OpenMSX C-BIOS MSX1 NTSC (60 Hz) and PAL (50 Hz): owner and guest startup, mapper/snapshot data, initial tool state, keyboard input, interiors, object placement, entrance removal retaining the interior, offline save behavior, save handshake, neighbor read-only protection and return home. VDP timing callback reports zero violations.
- Local Cloudflare runtime and D1: invitation reuse, passwords, session logout, cross-origin rejection, simultaneous account/coordinate claims, owner-only saves, concurrent stale-save rejection, malformed content, snapshot byte layout and recovery of persisted content.
- Browser integration: register, claim, launch, avatar changes, place an interior object, save through F5, conflict display and explicit replacement, expired authentication retaining edits, sign back in without reloading, and successful retry.
- Production: actual GitHub push triggered a successful automatic build/deploy. Public APIs and 1 MiB guest snapshots work. Secure password derivation runs on the actual Cloudflare runtime. The embedded WebMSX guest ROM reaches its read-only ready state.
- Additional audit: occupied-neighbor house entry and furniture preservation are covered on PAL/NTSC, catching and fixing an incorrect bank selection. Confirmed-save acknowledgement is regression-tested against account-refresh failures. API timeouts retain RAM edits for retry.
- Production schema migrations are installed and recorded in D1. Dedicated database: `msx-village-production`.

## Remaining release validation

The intended real MSX1 and ASCII8 flash cartridge have not been physically tested. The owner demo at `msx/out/village-demo.rom` supports offline building for that test. Emulation does not prove cartridge compatibility.

The pinned WebMSX checkout lacks the license file referenced by its headers; upstream issue #4 documents the missing declaration. Its copyright notices are preserved; no license is assumed.

An initial production invitation is awaiting the user's approval. Automatic approval review rejected an unspecified-recipient access grant; no invitation was inserted. The privately generated code is not usable until its hash is installed with authorization. No production test accounts or plots were created.

See `SPEC.md`, `msx/README.md`, and `webapp/README.md` for product boundaries, binary layout, build/test commands, API behavior and operator invitation tooling.
