# MSX Village Product and Technical Specification

Status: Updated first-version software implemented and verified in emulators; real-hardware acceptance pending

## Product intent

MSX Village is a peaceful toy village for MSX1 computers. Each player owns a small settlement and a house interior, decorates them using a shared collection of assets, and explores other players’ creations in a contiguous two-dimensional world.

Every plot is an independent little exhibit. The shared world provides a sense of place and an audience for each creation, without requiring simultaneous play. The first version has no live multiplayer, survival mechanics, economy, or competitive objectives.

The website connects accounts and persistent settlement data to the MSX experience. It allocates plots, provides a world map, generates MegaROM snapshots, and hosts an embedded WebMSX player. A downloaded snapshot also runs on compatible real MSX hardware.

## Product principles

- Make building approachable and enjoyable with a small, coherent asset catalog.
- Make a settlement feel personal through decoration, an avatar, and a permanent location.
- Make visiting other exhibits easy, while keeping ownership independent.
- Preserve the same core MSX game experience in the browser and on real hardware.
- Clearly distinguish a saved world snapshot from the current online database.
- Enforce ownership and allocation rules on the server, regardless of client behavior.

## Player experience

### Claiming a settlement

A player signs in to the website, sees the village map, and claims an available plot. Each account can own one plot. A plot has stable world coordinates and includes both its exterior and its house interior; the interior does not consume another world location.

Plot allocation should favor a compact, inhabited neighborhood. The first version lets players select an available location on the neighborhood map, starting at the village center. Plot relocation and ownership transfers are outside the first version.

### Building and exploring

The player launches a ROM snapshot through the website and enters the village as an avatar. They can edit their own exterior and interior, visit neighboring plots, and return home. Other settlements are read-only exhibits. Visiting does not imply that their owners are currently online.

Building tools support choosing, placing, replacing, and removing tiles and objects. Exploration should retain a clear view of the settlement; a temporary palette or menu can provide editing controls.

The first version provides:

- A 32 by 24 tile exterior for each settlement.
- A separate 32 by 24 tile house interior.
- A standard collection of ground, path, building, plant, and interior tiles.
- Placeable decorative objects such as trees and furniture, with both 1 by 1 and 2 by 2 tile objects in the standard catalog.
- A collection of player avatar appearances, rendered as 16 by 16 pixel sprites.
- One special house entrance connecting the exterior to its interior, occupying 2 by 2 tiles.

The base tile remains 8 by 8 pixels. A 1 by 1 tile object occupies 8 by 8 pixels; a 2 by 2 tile object occupies 16 by 16 pixels. All sprites, including player avatars and future custom sprites, use a 16 by 16 pixel canvas. Object footprint and sprite dimensions are separate catalog properties: small decorative objects can use background tiles rather than hardware sprites.

Moving or removing the entrance preserves the interior contents. The interior must always provide a reliable way to leave. The door is one semantic object with a 2 by 2 tile footprint, anchored at its top-left tile. Its entire footprint must fit within the exterior, including placements near plot edges. Enter when the avatar is at the entrance activates it; Enter or Escape from inside returns outside to a safe position. Door placement, selection, movement, and removal operate on the whole object rather than on four independent tiles.

Tiles and objects are product concepts. An object may be rendered using background tiles or hardware sprites depending on the MSX graphics budget. The asset catalog and placement limits must produce scenes that remain readable on MSX1 hardware.

### Player movement

Movement should feel like the original NES Zelda: continuous pixel movement while a direction is held, four cardinal directions, and directional walking animation for the 16 by 16 avatar. The player must not jump a full tile for each movement step or move diagonally. Releasing directional input stops movement. Direction changes use alignment to the 8 pixel grid, retaining the current axis until a valid turning point when input remains held. Simultaneous direction inputs resolve consistently to one direction.

Every object has an explicit solid or non-solid property, independent of whether it occupies 1 by 1 or 2 by 2 tiles or is rendered with background tiles or sprites. The player cannot walk over solid objects. Non-solid objects permit walking over their footprint, provided the underlying terrain is walkable. Collision follows the Zelda NES movement/collision approach: check the avatar's walking footprint in the intended movement direction before advancing, and stop at blocking terrain or objects without clipping through them. All occupied cells of a solid multi-tile object participate in collision. The visible 16 by 16 sprite and its walking footprint are distinct; the precise collision footprint remains a tuning decision.

Each avatar must display facing up, down, left, and right, with a two-frame walking cycle for each direction: eight directional walk frames, each 16 by 16 pixels. Alternate the two frames during actual movement; when stopped or blocked, stop the walking cycle and retain the last facing direction in a standing pose. Standard avatars and future custom avatars must support the same directional frame layout.

Movement must allow entrance interaction and preserve navigation between neighboring exhibits. Door interaction is a separate behavior from solidity, so an entrance must remain usable even when adjacent scenery is solid. Building uses a tile-aligned placement cursor independently of the avatar's pixel position. Walking speed and animation cadence should remain comparable on PAL and NTSC MSX1 machines; exact speed and animation timing are tuning decisions.

Building targets the space immediately in front of the avatar in its current facing direction, never the space underneath it. Tile placement, object placement, replacement, and removal use this facing-based target. Show a clear tile-aligned preview of the target and the selected object's full footprint, including the 2 by 2 door. Multi-tile placement must keep the entire footprint in front of and clear of the avatar's walking footprint; reject invalid placement rather than shifting it underneath the player. Stopping movement preserves facing and therefore the build direction. Targeting must continue to enforce space boundaries, footprint rules, and settlement ownership.

Use the local [Zelda disassembly reference](/Users/jannone/Documents/prj/msx/test-zelda-nes-decomp/zelda1-disassembly) for inspiration, particularly `Walker_Move`, grid-offset movement, and directional tile-collision checks in `src/Z_07.asm` and the corresponding routines in `msx-zcc/movement.c`. Treat that project as a read-only reference. The requirement concerns movement, collision, and walking animation; it does not add Zelda combat or other game systems.

### Planned custom artwork

In the near future, players will be able to create a limited set of special tiles and special sprites, and customize their avatar sprites. This extends personal expression beyond the standard catalog while retaining the MSX1 visual constraints and a bounded ROM budget.

This capability is planned after the first version, but the initial storage and snapshot models must accommodate it. Custom tile patterns use the 8 by 8 base tile format, while custom sprites and avatar frames use 16 by 16 pixels. Exact per-player quotas, animation limits, support for custom multi-tile objects, and the creation interface remain to be defined.

### Saving in the browser

The player requests a save from the game. The website submits the player’s current exterior and interior to the backend and communicates the outcome back to the game.

The experience distinguishes unsaved changes, saving, saved, and failed saves. A save is successful only after the backend confirms persistence. A failed request keeps the player’s current work available in the running session and supports retrying. Expired authentication must not be presented as a successful save.

If another session has already saved a newer revision, the older session must receive a conflict response rather than silently overwrite it. The resolution interface must let the player make an informed choice before replacing or discarding work.

Saving updates the database. It does not automatically refresh the other exhibits embedded in an already running snapshot.

### Playing on real hardware

The website provides a downloadable MegaROM snapshot. The player can explore and build during an offline session, but the first version does not persist those offline edits or import them back into the website.

This limitation must be visible before download and within the offline game experience. The ROM must remain playable without the website or an emulator bridge.

## World snapshots

A snapshot contains the game, standard assets, an index of included plots, and their saved exterior and interior data. It identifies its creation time and format version.

When custom artwork is introduced, snapshots must also embed the specific asset versions required by their included exhibits and the playable avatar. Downloaded ROMs must display that artwork without fetching it from the website. The capacity budget must reserve room for these assets as well as the standard catalog.

The database is the authoritative current world. A ROM is an edition of that world at a particular time. Players can load a fresh snapshot to see newer exhibits and keep old downloads to revisit earlier versions.

The initial target is a 1 MB MegaROM, interpreted as approximately one mebibyte of ROM capacity rather than one megabit. Confirmed target: 1 MiB ASCII8 MegaROM on MSX1 with 64 KB RAM.

A fixed ROM cannot contain an indefinitely growing world. The design should support snapshots of a bounded contiguous region, initially centered on the player’s neighborhood. The website can later expose region selection for visiting more distant exhibits. The first snapshot format includes 81 plots in a 9 by 9 region, with 336 KiB reserved in banks 86–127 for future artwork.

Snapshots contain public exhibit data only. They must not include email addresses, session credentials, provider credentials, or any secret that grants write access. Plot identifiers in a ROM are references, never authorization.

## Ownership and allocation

### Protecting other players’ data

All persistent writes pass through the backend. The server derives the account identity from a verified session and resolves that account’s owned plot. Client-supplied user IDs, plot IDs, coordinates, ROM metadata, and emulator state do not establish ownership.

A settlement save can modify only allowed content fields in the authenticated account’s plot. It cannot change ownership, world coordinates, or another player’s content. Validation covers map dimensions, valid asset IDs, object positions and counts, full object footprints, supported format versions, and payload size. Catalog metadata determines object dimensions; a client cannot change an asset's footprint to bypass placement validation. A 2 by 2 object or door must fit completely inside its space, and placement rules must account for every occupied tile.

Exterior and interior are persisted together as one settlement revision. Saves include an expected revision, and the update checks ownership and revision atomically to prevent stale writes.

The browser and emulator are untrusted clients. Editing the ROM, modifying JavaScript, or sending API requests directly must not bypass these rules. Sessions should use secure HTTP-only cookies, with appropriate protection against cross-site write requests.

### Preventing multiple claims

The database enforces a unique owner for each coordinate pair and a unique plot ownership record for each account. A claim is an atomic operation; simultaneous requests cannot allocate two plots to one account or one plot to two accounts. Initialization of the plot and interior must commit with the claim or roll back together.

One plot per account is a hard invariant. One plot per human cannot be guaranteed merely through email verification or social login, because a person may hold multiple identities.

For the initial small community, invitation-based username/password registration is the confirmed policy. Public registration can introduce verified identities, rate limits, and bot protection. These reduce abuse without claiming to prove unique humans. Shared IP addresses must not be treated as proof of duplicate players.

## Technical stack

| Component | Choice | Purpose |
| --- | --- | --- |
| MSX game | C with MSXgl and SDCC | Rendering, input, movement, editing, interiors, ROM banking, and snapshot navigation |
| Website | React, Vite, and TypeScript | Accounts, world map, claiming, emulator hosting, downloads, and save feedback |
| Hosting and API | Cloudflare Worker with Workers Static Assets | Serve the website and handle authentication, authorization, claims, saves, and ROM assembly on one origin |
| Persistent storage | Cloudflare D1 | Accounts, plot ownership, coordinates, settlement content, revisions, and custom asset records |
| Browser emulator | Pinned WebMSX version with a small integration layer | Run the MSX game and exchange save requests and results with the website |
| ROM assembly | TypeScript snapshot encoder using a precompiled ROM template | Produce downloadable snapshots without compiling the game per request |

React and Vite are supported together with a Worker backend through Cloudflare’s Vite integration. D1 provides relational storage and transactional batches for related database changes. See the [Cloudflare React and Vite guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/) and [D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/).

MSXgl provides C tooling and mapped-ROM targets, including ASCII8 and Konami formats with sufficient documented capacity for the proposed ROM size. The final mapper and minimum machine RAM requirement depend on the intended hardware and flash cartridges. See [MSXgl targets](https://aoineko.org/msxgl/index.php?title=Targets).

WebMSX is designed to embed MSX software in webpages. The same-origin integration reads and writes a designated RAM bridge through WebMSX’s machine bus; save round trips and failure recovery have been verified. See the [WebMSX repository](https://github.com/ppeccin/WebMSX).

### ROM generation

The game engine and standard assets are compiled during development or release builds. The resulting ROM template reserves defined regions for snapshot data and indexing. The Worker encodes validated database records and fills those regions to produce a ROM.

The snapshot format is versioned and has shared definitions for tile IDs, object IDs, plot references, and data limits. The MSX reader and web encoder must agree on these definitions. The current plot is edited in RAM; the ROM remains the source for the snapshot’s original data.

The standard catalog must describe each object's footprint, constituent background patterns or sprite reference, and collision and interaction behavior. Store a multi-tile object as one placement with an asset reference and top-left tile anchor, not as unrelated tile placements. Count each placed object once toward the existing limit of 32 decorative objects per space, irrespective of footprint; the special entrance remains separately represented. Object replacement removes complete intersecting object placements. Erasing any occupied cell removes the whole object. Ground painting preserves objects. Object placement cannot overlap the entrance; placing or moving the entrance clears intersecting exterior objects while preserving the interior. Any incompatible change to existing placements, door data, sprite patterns, or binary encoding requires a versioned format and an explicit migration of saved settlements and ROM generation.

### Storage model for custom artwork

The initial data model must distinguish standard catalog assets from player-created assets. Custom asset records should carry a stable identifier, owner, asset kind, format version, artwork revision, and the pattern, color, and frame data needed for MSX rendering. Settlement placements and avatar appearance should reference assets rather than duplicate artwork in every placement.

Artwork metadata must include pixel dimensions, frame layout, and, for placeable objects, tile footprint, constituent patterns, and an explicit solid/non-solid property. Solidity belongs to the versioned asset definition, so all placements referencing that asset revision share its collision behavior. Sprite and avatar artwork uses 16 by 16 pixel frames; avatar definitions include two walking frames for each of the four facing directions. Validate these properties against the catalog and custom-artwork rules, and budget their pattern data and animation frames explicitly when assembling a 1 MiB snapshot.

Asset ownership and permissions follow the same server-side rules as settlement ownership. A player can modify only their own artwork. The server validates custom artwork against supported MSX formats and per-player quotas. Creating an asset does not allow a player to define executable code or change game behavior.

Asset revisions must preserve the artwork referenced by saved settlement revisions. Editing or deleting an asset must not leave an existing exhibit with a missing or silently changed dependency. Snapshot generation resolves the required revisions and maps their stable database identifiers to compact ROM-local tile and sprite indices; globally shared numeric tile slots must not be assumed.

D1 is the starting storage choice for the small, bounded artwork payloads and their metadata. The model should keep asset records separate from settlement maps so binary payload storage can change later if needed, without changing ownership or placement references. A separate object store is not required for the initial release.

### Browser save bridge

The implemented bridge uses a designated RAM buffer and a versioned request protocol:

1. The game prepares its editable settlement data and signals a save request.
2. The WebMSX integration reads a stable copy of the buffer.
3. The website sends the data and expected revision using its authenticated session.
4. The Worker checks ownership and content, then persists the settlement.
5. The website communicates success, failure, or conflict back to the game.

Authentication remains in the website. The game does not hold credentials. On real hardware, requesting a save reports that persistence is unavailable and continues the session normally.

### Future multiplayer

Live multiplayer is deferred. The first version needs HTTP requests and persistent exhibits rather than live player synchronization. Cloudflare Durable Objects and WebSockets can be evaluated if shared live sessions are introduced later. No real-time infrastructure is required for the initial release.

## First version boundaries

Included: account access, one plot per account, exterior and interior editing, a curated asset catalog, avatar selection, read-only visits, browser persistence, world map, snapshot generation, and offline ROM downloads.

Deferred: simultaneous multiplayer, visitor edits, chat, crafting, resources, trading, economy, competitive goals, multiple houses, custom asset uploads, plot transfers, and offline save import.

Limited custom tile and sprite creation and avatar sprite customization are specifically planned for a near-future release. Their storage compatibility is part of the initial design, even though their authoring tools are deferred.

## Acceptance criteria

- Player avatars and other sprites render at 16 by 16 pixels; the base tile grid remains 8 by 8 pixels and each space remains 32 by 24 tiles.
- Held directional input produces smooth, four-direction Zelda-inspired walking with directional animation, aligned turns, predictable collision, and comparable PAL/NTSC speed.
- Every avatar displays up, down, left, and right facing with a two-frame walking cycle in each direction; the cycle stops when stationary or blocked and preserves facing.
- In all four facing directions, building places, replaces, or removes content in front of the avatar rather than underneath it. The preview matches the affected tile or complete object footprint; multi-tile placement does not overlap the avatar's walking footprint.
- Solid 1 by 1 and 2 by 2 objects block the player's walking footprint from every approach direction, without clipping. Non-solid objects allow passage over walkable underlying terrain. These behaviors survive saving and snapshot reload.
- The standard catalog includes both 1 by 1 and 2 by 2 tile objects. Full footprints survive placement, selection, removal, save, and snapshot reload, including boundary validation.
- The 2 by 2 door functions as one entrance; moving or removing it preserves the interior and exiting remains reliable.
- A player can claim one plot, build its exterior and interior, save in the browser, and recover the saved content in a fresh snapshot.
- A player can explore included neighbors and enter their houses without gaining write access to those exhibits.
- Direct or modified-client requests cannot save another account’s content or change ownership and coordinates.
- Concurrent claims preserve both ownership uniqueness rules.
- Stale saves produce a conflict rather than silently replacing newer work.
- Save failures are visible and are never reported as successful persistence.
- A downloaded ROM runs in WebMSX and on the agreed real MSX1 configuration without website connectivity.
- Offline players are told that their edits will not persist.
- Snapshot generation respects the fixed ROM budget and excludes private account data and credentials.

## Decisions to resolve before implementation

- Confirmed: 1 MiB ASCII8, MSX1, 64 KB RAM. Validate the intended flash cartridge on real hardware.
- Revised requirement: 8 by 8 pixel base tiles; 16 by 16 sprites, including the four selectable avatar appearances; both 1 by 1 and 2 by 2 tile catalog objects; a 2 by 2 door. Retain up to 32 decorative objects per space, with background patterns available for decoration. Implemented in format 2; original object IDs retain their one-tile sizes, and new IDs provide larger objects.
- Implemented: Zelda NES-inspired pixel movement and collision, explicit solid/non-solid objects, and two-frame walking animation for all four facing directions. Walking targets 90 pixels/second using BIOS refresh rate; the walking footprint is an 8 by 8 feet region at sprite offset (4,8). Perpendicular turns use 8-pixel alignment; simultaneous input prioritizes left, right, up, then down. PAL/NTSC emulator tests cover these choices.
- Implemented: whole-object replacement/removal, footprint validation, and version-2 settlement/snapshot encoding. Read-time migration preserves legacy maps and objects and relocates an entrance only when necessary for its new footprint; the next owner save persists a new version-2 revision.
- Define custom tile and sprite quotas, artwork and animation formats, revision retention, and their reserved snapshot budget before finalizing the storage and ROM formats.
- Confirmed: invitation-based registration with username/password.
- Confirmed: manual selection from available map locations; initial claims are bounded to coordinates -100 through 100.
- Confirmed: 9 by 9 region; crossing an outer edge reports the snapshot boundary. The website can generate another region.
- Verified: same-origin WebMSX RAM polling, game-requested saves, success/failure acknowledgements, and revision updates.
- Verified in PAL/NTSC emulators: the 2 by 2 entrance renders and activates correctly; Enter/Escape exits from any interior position, and entrance removal preserves the interior.
- Verified: preserve the running session, then explicitly discard it for the latest snapshot or confirm replacement using the latest expected revision.

The first technical validation should demonstrate a hardware-compatible MegaROM, one browser save round trip, and ownership enforcement under concurrent claims and saves. These checks establish feasibility without expanding the product scope.
