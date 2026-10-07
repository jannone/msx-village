# MSX Village Product and Technical Specification

Status: Draft for product discussion

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

Plot allocation should favor a compact, inhabited neighborhood. Whether players choose among available locations or receive an automatically assigned location remains a product decision. Plot relocation and ownership transfers are outside the first version.

### Building and exploring

The player launches a ROM snapshot through the website and enters the village as an avatar. They can edit their own exterior and interior, visit neighboring plots, and return home. Other settlements are read-only exhibits. Visiting does not imply that their owners are currently online.

Building tools support choosing, placing, replacing, and removing tiles and objects. Exploration should retain a clear view of the settlement; a temporary palette or menu can provide editing controls.

The first version provides:

- A 32 by 24 tile exterior for each settlement.
- A separate 32 by 24 tile house interior.
- A standard collection of ground, path, building, plant, and interior tiles.
- Placeable decorative objects such as trees and furniture.
- A collection of player avatar appearances.
- One special house entrance connecting the exterior to its interior.

Moving or removing the entrance preserves the interior contents. The interior must always provide a reliable way to leave. Exact entrance placement and exit behavior will be defined with the interaction design.

Tiles and objects are product concepts. An object may be rendered using background tiles or hardware sprites depending on the MSX graphics budget. The asset catalog and placement limits must produce scenes that remain readable on MSX1 hardware.

### Planned custom artwork

In the near future, players will be able to create a limited set of special tiles and special sprites, and customize their avatar sprites. This extends personal expression beyond the standard catalog while retaining the MSX1 visual constraints and a bounded ROM budget.

This capability is planned after the first version, but the initial storage and snapshot models must accommodate it. Exact per-player quotas, artwork dimensions, animation limits, and the creation interface remain to be defined.

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

The initial target is a 1 MB MegaROM, interpreted as approximately one mebibyte of ROM capacity rather than one megabit. This assumption needs confirmation before fixing the binary layout.

A fixed ROM cannot contain an indefinitely growing world. The design should support snapshots of a bounded contiguous region, initially centered on the player’s neighborhood. The website can later expose region selection for visiting more distant exhibits. The number of plots per snapshot will follow a measured budget for code, assets, map data, objects, and indexing.

Snapshots contain public exhibit data only. They must not include email addresses, session credentials, provider credentials, or any secret that grants write access. Plot identifiers in a ROM are references, never authorization.

## Ownership and allocation

### Protecting other players’ data

All persistent writes pass through the backend. The server derives the account identity from a verified session and resolves that account’s owned plot. Client-supplied user IDs, plot IDs, coordinates, ROM metadata, and emulator state do not establish ownership.

A settlement save can modify only allowed content fields in the authenticated account’s plot. It cannot change ownership, world coordinates, or another player’s content. Validation covers map dimensions, valid asset IDs, object positions and counts, supported format versions, and payload size.

Exterior and interior are persisted together as one settlement revision. Saves include an expected revision, and the update checks ownership and revision atomically to prevent stale writes.

The browser and emulator are untrusted clients. Editing the ROM, modifying JavaScript, or sending API requests directly must not bypass these rules. Sessions should use secure HTTP-only cookies, with appropriate protection against cross-site write requests.

### Preventing multiple claims

The database enforces a unique owner for each coordinate pair and a unique plot ownership record for each account. A claim is an atomic operation; simultaneous requests cannot allocate two plots to one account or one plot to two accounts. Initialization of the plot and interior must commit with the claim or roll back together.

One plot per account is a hard invariant. One plot per human cannot be guaranteed merely through email verification or social login, because a person may hold multiple identities.

For an initial small community, invitation-based registration is the proposed starting policy. Public registration can introduce verified identities, rate limits, and bot protection. These reduce abuse without claiming to prove unique humans. Shared IP addresses must not be treated as proof of duplicate players.

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

WebMSX is designed to embed MSX software in webpages. The exact save integration hook remains to be validated in a prototype; it is a proposed extension rather than an assumed existing API. See the [WebMSX repository](https://github.com/ppeccin/WebMSX).

### ROM generation

The game engine and standard assets are compiled during development or release builds. The resulting ROM template reserves defined regions for snapshot data and indexing. The Worker encodes validated database records and fills those regions to produce a ROM.

The snapshot format is versioned and has shared definitions for tile IDs, object IDs, plot references, and data limits. The MSX reader and web encoder must agree on these definitions. The current plot is edited in RAM; the ROM remains the source for the snapshot’s original data.

### Storage model for custom artwork

The initial data model must distinguish standard catalog assets from player-created assets. Custom asset records should carry a stable identifier, owner, asset kind, format version, artwork revision, and the pattern, color, and frame data needed for MSX rendering. Settlement placements and avatar appearance should reference assets rather than duplicate artwork in every placement.

Asset ownership and permissions follow the same server-side rules as settlement ownership. A player can modify only their own artwork. The server validates custom artwork against supported MSX formats and per-player quotas. Creating an asset does not allow a player to define executable code or change game behavior.

Asset revisions must preserve the artwork referenced by saved settlement revisions. Editing or deleting an asset must not leave an existing exhibit with a missing or silently changed dependency. Snapshot generation resolves the required revisions and maps their stable database identifiers to compact ROM-local tile and sprite indices; globally shared numeric tile slots must not be assumed.

D1 is the starting storage choice for the small, bounded artwork payloads and their metadata. The model should keep asset records separate from settlement maps so binary payload storage can change later if needed, without changing ownership or placement references. A separate object store is not required for the initial release.

### Browser save bridge

The proposed bridge uses a designated RAM buffer and a versioned request protocol:

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

- Confirm 1 MB ROM capacity, mapper, supported flash cartridges, and minimum MSX1 RAM.
- Define tile pixel size, object sizes, avatar rendering, and practical placement limits.
- Define custom tile and sprite quotas, artwork and animation formats, revision retention, and their reserved snapshot budget before finalizing the storage and ROM formats.
- Choose the initial authentication provider and registration policy.
- Choose manual plot selection or automatic allocation.
- Define snapshot region size and behavior at its edges.
- Validate the WebMSX save hook and game-to-browser response mechanism.
- Define the house exit and entrance-removal behavior.
- Define the save-conflict recovery interface.

The first technical validation should demonstrate a hardware-compatible MegaROM, one browser save round trip, and ownership enforcement under concurrent claims and saves. These checks establish feasibility without expanding the product scope.
