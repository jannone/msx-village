# First-version implementation status

The website and API are deployed through the GitHub-connected Cloudflare Workers Builds pipeline. The deployed implementation includes invitation-based username/password accounts, one-plot ownership, a neighborhood map, exterior/interior editing, read-only visits, standard tiles and objects, four 16×16 avatar appearances with two walking frames in each direction, pixel movement with solid-object collision, facing-based building, 1×1/2×2 decorative objects and a 2×2 door, online saves and offline ROM downloads. Custom artwork creation and live multiplayer remain deferred.

## Validation completed

- SDCC/MSXgl compilation produces a 1 MiB ASCII8 ROM with resident code below A000 and ordinary RAM below D000.
- OpenMSX C-BIOS MSX1 NTSC (60 Hz) and PAL (50 Hz): owner and guest startup, mapper/snapshot data, initial tool state, keyboard input, interiors, object placement, entrance removal retaining the interior, offline save behavior, save handshake, neighbor read-only protection and return home. VDP timing callback reports zero violations.
- Local Cloudflare runtime and D1: invitation reuse, passwords, session logout, cross-origin rejection, simultaneous account/coordinate claims, owner-only saves, concurrent stale-save rejection, malformed content, snapshot byte layout and recovery of persisted content.
- Browser integration: register, claim, launch, avatar changes, place an interior object, save through F5, conflict display and explicit replacement, expired authentication retaining edits, sign back in without reloading, and successful retry.
- Production: actual GitHub push triggered a successful automatic build/deploy. Public APIs and 1 MiB guest snapshots work. Secure password derivation runs on the actual Cloudflare runtime. The embedded WebMSX guest ROM reaches its read-only ready state.
- Additional audit: occupied-neighbor house entry and furniture preservation are covered on PAL/NTSC, catching and fixing an incorrect bank selection. Confirmed-save acknowledgement is regression-tested against account-refresh failures. API timeouts retain RAM edits for retry.
- Format-2 validation and read-time v1 migration preserve existing maps and placements. Full object footprints and the 2×2 entrance are validated on the server; artwork metadata and immutable revision relationships are reserved for the future custom-artwork release.
- Updated browser check: a large tree was placed in front of the avatar, saved via F5 as local revision 6, and recovered in a fresh snapshot.
- Updated OpenMSX checks: all four avatars and facing directions, both rendered walk frames, aligned turns, tile/object targeting, whole-object removal from a quadrant, 1×1/2×2 solid collision from every side, non-solid passage, ground collision, save freeze and neighbor visits. Measured half-second walks are 43 pixels at 60 Hz and 45 pixels at 50 Hz, with zero VDP timing violations.
- Production schema migrations are installed and recorded in D1. Dedicated database: `msx-village-production`.

## Remaining release validation

The intended real MSX1 and ASCII8 flash cartridge have not been physically tested. The owner demo at `msx/out/village-demo.rom` supports offline building for that test. Emulation does not prove cartridge compatibility.

The pinned WebMSX checkout lacks the license file referenced by its headers; upstream issue #4 documents the missing declaration. Its copyright notices are preserved; no license is assumed.

The initial production invitation was activated after explicit user approval and verified as usable. Synthetic accounts and interactive save tests remain confined to local D1.

See `SPEC.md`, `msx/README.md`, and `webapp/README.md` for product boundaries, binary layout, build/test commands, API behavior and operator invitation tooling.
