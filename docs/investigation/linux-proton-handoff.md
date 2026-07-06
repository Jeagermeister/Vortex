# Linux Proton Personal Fork Handoff

This file preserves the current Linux/Proton work context for future
ChatGPT/Codex sessions and for moving the work to another machine.

## Repository Intent

This fork is for Brian/Jeagermeister's personal Vortex Linux and Proton work.

- Personal fork: `Jeagermeister/Vortex`
- Upstream source: `Nexus-Mods/Vortex`
- Do not open pull requests to `Nexus-Mods/Vortex` unless Brian explicitly asks.
- Push Brian's changes only to `Jeagermeister/Vortex`.
- Pull upstream changes from `Nexus-Mods/Vortex` when needed, then merge or rebase
  them into the personal fork.

On a new machine, the simplest checkout is:

```bash
git clone https://github.com/Jeagermeister/Vortex.git
cd Vortex
git remote add upstream https://github.com/Nexus-Mods/Vortex.git
git remote -v
```

With that layout, `origin` is Brian's fork and `upstream` is the original Vortex
repository.

The Windows staging checkout used during the initial import had the opposite
layout:

- `origin` -> `https://github.com/Nexus-Mods/Vortex.git`
- `fork` -> `https://github.com/Jeagermeister/Vortex.git`

## Current State

The first Linux/Proton milestone was merged into the personal fork on
2026-07-05 through `Jeagermeister/Vortex#1`.

- Feature commit: `40a18f8 Add Proton-aware adaptor snapshots`
- Fork merge commit: `e1f3b46`
- Base upstream commit at import time: `67dc8ab`

The merged work makes adaptor path snapshots Proton-aware. Before this change,
Vortex could discover Linux Steam paths and Steam discovery already had Proton
metadata, but adaptor snapshots still assumed `baseOS === gameOS`. For Steam
Proton on Linux, that is wrong:

- Host OS: Linux
- Game runtime OS: Windows

The implementation threads Steam Proton metadata through discovery, IPC, and
adaptor snapshot creation so Steam Proton snapshots can use:

```ts
baseOS = "linux";
gameOS = "windows";
bases.get("linux").get("game"); // linux:///...
bases.get("windows").get("game"); // windows://proton:...///Z/home/...
```

## Files Changed

Discovery and renderer metadata:

- `src/renderer/src/types/IGameStoreEntry.ts`
    - Adds optional `usesProton`, `compatDataPath`, and `protonPath`.
- `src/renderer/src/extensions/gamemode_management/types/IDiscoveryResult.ts`
    - Adds optional `usesProton`, `compatDataPath`, and `protonPath`.
- `src/renderer/src/extensions/gamemode_management/util/discovery.ts`
    - Preserves Proton metadata from `IGameStoreEntry` into persisted discovery
      results.

IPC and preload:

- `src/shared/src/types/ipc.ts`
    - Adds `AdaptorSnapshotOptions`.
    - Extends `adaptors:build-snapshot` with optional snapshot options.
- `src/shared/src/types/preload.ts`
    - Extends `AdaptorsApi.buildSnapshot(...)` with optional snapshot options.
- `src/preload/src/index.ts`
    - Passes snapshot options through Electron IPC.

Adaptor bridge:

- `src/renderer/src/extensions/adaptor_bridge/index.ts`
    - Passes discovery Proton metadata into `window.api.adaptors.buildSnapshot(...)`.
    - Converts Proton-tagged `windows://` qualified paths back to Linux host paths
      where needed for game executables and mod type registration.

Main process and snapshot builder:

- `src/main/src/adaptors.ts`
    - Registers a Linux-side Proton Windows path resolver.
    - Builds Steam Proton snapshots with `baseOS: linux` and `gameOS: windows`.
    - Adds Linux host bases and Windows runtime bases to the same snapshot.
    - Maps game install paths through Wine `Z:`.
    - Maps Proton user paths through `C:\users\steamuser`.
    - Updates version detection path conversion so Proton-tagged Windows paths can
      resolve to Linux host paths.

New resolver:

- `src/main/src/filesystem/paths.proton.ts`
    - Encodes Proton compatdata paths into `windows://` qualified path data.
    - Resolves tagged Windows paths on Linux:
        - `C:` -> `<compatdata>/pfx/drive_c`
        - `Z:` -> Linux host root `/`
- `src/main/src/filesystem/paths.proton.test.ts`
    - Covers `C:`, `Z:`, untagged Windows paths, and unsupported drives.

## Verification So Far

Done during the Windows import:

- Compared the patched archive against a clean upstream checkout.
- Applied only the intended ten-file Proton snapshot change set.
- Ran `git diff --check` successfully.

Not done yet:

- Typecheck.
- Unit tests.
- Runtime testing on Linux.

The Windows machine used for the import did not have these commands available:

- `node --version`
- `pnpm --version`
- `corepack --version`

The repo expects:

- Node `>=24.15.0`
- pnpm `11.5.1`

## 2026-07-05 Bannerlord Runtime Milestone

Mount & Blade II: Bannerlord is the first proven Linux/Proton game support
slice in this fork.

Test environment:

- OS: Ubuntu 26.04
- Steam compatibility tool: Proton Experimental
- Game app id: `261550`
- Steam library:
  `/mnt/304cc9a6-2e94-4da5-bc51-40e5280e9e37/SteamLibrary`
- Game path:
  `/mnt/304cc9a6-2e94-4da5-bc51-40e5280e9e37/SteamLibrary/steamapps/common/Mount & Blade II Bannerlord`
- Compatdata:
  `/mnt/304cc9a6-2e94-4da5-bc51-40e5280e9e37/SteamLibrary/steamapps/compatdata/261550`

What now works:

- Steam discovery finds Bannerlord on a mounted SSD, not just under `$HOME`.
- Vortex can manage Bannerlord with a Linux-safe built-in module-folder profile.
- `nxm://` browser downloads work through the local development desktop handler.
- Vortex downloads, installs, enables, and deploys Bannerlord module mods.
- Bannerlord's launcher sees deployed modules.
- The game reaches the main menu under Proton Experimental with deployed mods.

Mods tested:

- Harmony
- ButterLib
- UIExtenderEx
- Mod Configuration Menu
- Industrial Revolution
- VillageFarming V 1.0.5
- Additional small module mods after the browser-handler fix

Follow-up runtime validation:

- Industrial Revolution and its support stack downloaded and installed quickly.
- The game launched with Harmony, ButterLib, UIExtenderEx, Mod Configuration
  Menu, and Industrial Revolution enabled.
- Mod Configuration Menu showed the installed mods in the main game menu.
- A saved game reloaded successfully with the enabled mod stack.

Bannerlord is considered solid enough for the first milestone. Avoid using a
real save to test mod disable/update behavior unless the save is disposable;
Bannerlord is sensitive to module version mismatches.

The original downloaded BUTR Bannerlord extension is Windows-native. On Linux it
failed in Electron with `invalid ELF header` while trying to load a `.node`
addon that is actually a PE/Windows binary. The current fork handles this by:

- registering the built-in Bannerlord module profile on Linux instead of the
  stub downloader, and
- skipping the known Linux-incompatible dynamic BUTR extension when its top-level
  `.node` addon is a Windows `MZ` binary.

This is intentionally narrow. If BUTR ships a Linux-capable extension later, it
should not be skipped unless it still contains the Windows-native addon.

## 2026-07-05 Subnautica Starting Point

Subnautica is the next Linux/Proton game target.

Current public modding guidance uses the modern BepInEx/Nautilus stack:

- Tobey's BepInEx Pack for Subnautica: Nexus mod `1108`
- Nautilus: Nexus mod `1262`
- Mod deployment path: `BepInEx/plugins`

The Subnautica extension in upstream Vortex is still a downloaded `QMods` stub.
The Linux fork now keeps that behavior for non-Linux platforms but registers a
Linux built-in profile that:

- discovers the Steam install with app id `264710`
- uses `Subnautica.exe`
- deploys ordinary mods to `BepInEx/plugins`
- launches with `WINEDLLOVERRIDES=winhttp=n,b` so Proton loads the deployed
  Doorstop `winhttp.dll`
- requires `modtype-bepinex`
- auto-registers the current Tobey BepInEx Pack file
  `5.4.23-pack.3.1.1` / Nexus file `10667`

Nautilus should be tested through the normal Nexus "Mod Manager Download" flow
first rather than auto-installed as a hard-coded dependency. If that works, the
initial Subnautica runtime sequence is:

1. Install and launch Subnautica once through Steam/Proton.
2. Manage Subnautica in Vortex.
3. Confirm the BepInEx pack downloads/installs/enables/deploys.
4. Install Nautilus from Nexus mod `1262`.
5. Launch the game and check for a `Mods` tab in Options.
6. Install one Nautilus-dependent content mod and verify it appears in game.

Runtime note from the first Subnautica attempt:

- Tobey's BepInEx Pack, Nautilus, and SubnauticaMap all installed and deployed
  to the expected paths.
- No `BepInEx/LogOutput.log` was created after launching the game, and the
  Unity `Player.log` did not mention BepInEx, Nautilus, or SubnauticaMap.
- That indicates the pack was present but Doorstop did not inject.
- A direct Proton Experimental launch with `WINEDLLOVERRIDES=winhttp=n,b`
  successfully created `BepInEx/LogOutput.log`.
- That log confirmed BepInEx, Nautilus `1.0.0.51`, and SubnauticaMap `1.5.12`
  all loaded and the BepInEx chainloader completed.
- The failed Vortex launch was traced to stale development build output:
  Vortex was loading `src/main/build/bundledPlugins/game-subnautica/index.js`,
  which did not yet include `WINEDLLOVERRIDES`.
- After changing `extensions/games/game-subnautica/src/index.js`, rebuild the
  extension and refresh bundled plugins before retesting:

```bash
pnpm run build
cd ../../../../src/main
node ./copy-extensions.mjs
```

Then restart Vortex, relaunch Subnautica from Vortex, and check that
`BepInEx/LogOutput.log` receives a new timestamp.

## Development NXM Handler

The local Linux development handler used for browser downloads is:

- desktop file:
  `~/.local/share/applications/com.nexusmods.vortex.dev.desktop`
- wrapper:
  `~/.local/bin/vortex-dev-nxm`

The wrapper launches the dev Electron app in `src/main` and forwards the clicked
`nxm://` URL. In this development checkout it must pass `--no-sandbox` to the
second Electron process:

```bash
"$ELECTRON" --no-sandbox . -d "$@"
```

Without this, Firefox successfully launches the wrapper, but Electron aborts
before notifying the running Vortex instance:

```text
The SUID sandbox helper binary was found, but is not configured correctly.
... chrome-sandbox is owned by root and has mode 4755.
```

For production packaging, prefer a correctly configured Electron sandbox helper.
For local development, `--no-sandbox` keeps protocol handoff working without
changing ownership or mode bits inside `node_modules`.

## First Linux Verification

On the Linux machine:

```bash
pnpm install
pnpm run typecheck
pnpm run test
```

If the full suite is too large at first, start with the main/filesystem tests
around `paths.proton`.

## First Runtime Test

On Ubuntu or another Linux desktop with Steam installed:

1. Install a Windows-only Steam game through Proton, ideally Cyberpunk 2077 or
   Fallout: New Vegas.
2. Launch the game once through Steam so Proton creates
   `steamapps/compatdata/<appid>/pfx`.
3. Start Vortex from Brian's fork.
4. Check whether Steam discovery stores:
    - `usesProton: true`
    - `compatDataPath`
    - `protonPath`
5. Activate the adaptor-backed game and inspect logs for snapshot creation.

## Next Coding Milestones

After Steam Proton passes typecheck and basic runtime testing:

1. Add Heroic Launcher discovery.
2. Model GOG, Epic, Heroic, and custom Wine prefixes with the same
   "Linux host, Windows runtime" snapshot shape.
3. Generalize the Proton resolver into a broader Wine-prefix resolver if needed.
4. Revisit packaging, especially Flatpak, because source generation still relies
   on Yarn-compatible Flatpak inputs even though the repo uses pnpm.

## Codex Notes

For future Codex sessions:

- Read this file before changing Linux/Proton adaptor behavior.
- Keep work scoped to Brian's personal fork unless Brian explicitly requests an
  upstream contribution.
- Prefer fork-local PRs for reviewable changes.
- Record test commands and results in PR descriptions or follow-up handoff notes.
