# Player-built cottage acceptance

Verified locally on 2026-10-08. No production database or deployment was changed.

## Playthrough

The local WebMSX session used the production game ROM and ordinary keyboard
controls: arrows to walk, F1 to build, F2/F3 and Z/X to select catalog entries,
Space to place, Enter/Escape to enter and exit, and F5 to save. No RAM edits or
database writes constructed the acceptance exhibit.

The player placed a 6×2 cottage roof at (21,5), 2×3 windowed walls at (21,7) and
(25,7), and moved the 2×2 entrance to (23,8). The garden includes an old oak at
(5,7) and a well at (23,13). Inside, the player placed a cottage bed at (3,12) and
a hearth at (9,7). The original starter structure and earlier test decorations
remain in this test plot; this is a functional prototype exhibit, not a finished
art composition.

F5 saved the furnished interior as revision 8 and the completed building as
revision 9. The website reported success and “Up to date.” Clicking **Load fresh
neighborhood** restarted the emulator from a newly generated ROM. The new cottage,
garden, and entrance reappeared. Walking to that entrance and pressing Enter
recovered the bed and hearth; Escape returned to the cottage exterior.

A read-only local D1 query confirmed revision 9, format 3, the entrance, and every
listed object. An independent fetch of the public neighborhood ROM then decoded
the same placements and revision and verified its engine bytes against the
checked-in Worker template.

## Evidence

Generated artifacts remain ignored under `msx/out/tests/`:

- `cottage-reloaded-exterior.jpg`: fresh ROM exterior after leaving the house.
- `cottage-reloaded-interior.jpg`: furnished interior entered after fresh reload.
- `cottage-revision-9.rom`: independently fetched public, read-only 1 MiB snapshot.
- `cottage-revision-9.json`: decoded settlement, revision, and snapshot SHA-256.

The captured public snapshot SHA-256 is
`01a7201d531a744de26dd237f03c00390e9dea0e73dbebf1820d90c93b6461a0`.
Creation timestamps mean future downloads need not have the same whole-ROM hash.
The tested resident engine SHA-256 is
`08bdfde5571f14fdfa1173058f47e9f39e80ad662c933a77f808497d93c185f5`.

## Supporting checks

- Production ROM build and Worker-template equality check passed.
- Startup, interaction, and display fixtures passed for owner and visitor ROMs
  on C-BIOS MSX1 NTSC (60 Hz) and PAL (50 Hz), with zero VDP timing violations.
- Interaction coverage includes rectangular trees and cottage pieces in all four
  directions, complete object removal, collision escape, and entrance behavior.
- Display coverage includes temporary bottom/full-screen text and full scene
  restoration. Its keyboard helper waits until the game samples key release.
- Settlement round trips, rectangular bounds, legacy migration, and save
  acknowledgement tests passed.
- Local Worker/D1 tests passed for ownership, concurrent claims, stale saves,
  malformed footprints, and fresh snapshots containing the rich cottage catalog.
- The web production build and TypeScript checks passed.

Real MSX1 hardware and flash-cartridge acceptance remain a release gate. Custom
artwork authoring and further themed collections remain separate milestones.
