# Mood-Driven Theme Switcher

A playful VS Code extension that changes editor theme, status bar context, and workspace flow based on your current mode.

The current build includes the full v2 bundle plus the Phase 4 and Phase 5 follow-up features. For phased progress and remaining work, see [ROADMAP.md](./ROADMAP.md).

## Included modes

- Deep Work
- Debugging Hell
- Writing Lodge
- Arcade Mode
- Soft Focus
- Night Drive
- Ship It

## What this version does

- Adds a dedicated sidebar/activity bar entry with quick actions, mode switching, and docs access
- Opens a visual dashboard for picking moods and running actions
- Lets you switch between moods with a command palette picker
- Applies a configurable VS Code theme per mood
- Applies per-mode status bar colors using `workbench.colorCustomizations`
- Applies configurable workspace and editor presets per mood
- Keeps the main activity bar visible across modes so core VS Code navigation stays accessible
- Can run optional VS Code command hooks per mood
- Shows the active mood and session timer in the status bar
- Supports per-mode timer defaults and ritual prompts before a session starts
- Stores a per-workspace default mood
- Starts and stops timed sessions
- Persists completed sessions and shows weekly mood analytics
- Adds richer dashboard analytics visuals
- Can export and import session history
- Opens a set of mode-specific project files and optional memory docs
- Discovers likely `.codex/` and `docs/` memory files based on mood keywords
- Ranks discovered project-memory docs using mood-specific directory and filename hints
- Can open per-mode soundtrack links
- Can validate configured mode command hooks
- Adds a mode-aware command palette with mood-specific suggested commands
- Can run a single suggested command directly from a dedicated action
- Can reopen ranked memory docs and mode rituals directly from Quick Actions
- Can start a standalone break cycle outside the timer-complete prompt

## Current Status

- `DONE` Core mood switching, restore/reset flows, and sidebar/dashboard UX
- `DONE` V2 workflow bundle: status bar colors, command hooks, timers, rituals, analytics, and smarter project memory discovery
- `DONE` Phase 4 follow-up: soundtrack links, richer analytics visuals, session history export/import, timer cycles, command validation, and ranked project memory discovery
- `DONE` Phase 5 mode-aware command palette, sidebar/dashboard surfacing, and suggested command groups

## Getting Started

### Run it locally

```bash
npm install
npm run build
```

Open this folder in VS Code and press `F5` to launch an Extension Development Host that opens `/Users/jasonp/repos/personal`.

### First-time setup

1. Open the Mood Switcher icon in the activity bar.
2. Click a mode like `Deep Work` or `Arcade Mode`.
3. Let the extension apply its theme and preset settings for that mode.
4. Start a session if you want a live timer in the status bar.
5. Right-click the mode row to preview changes, open resources, restore your original state, or make that mode the workspace default.
6. Open `Open Mode Command Palette` from `Quick Actions` to see commands that fit the current mood.

### Fastest path to seeing it work

1. Choose `Arcade Mode` from the sidebar.
2. Open `Preview Mode Preset` from the mood row context menu.
3. Confirm the `current [scope] -> new` settings diff looks right.
4. Apply the mood.
5. Start and stop a session to verify the original theme/layout/workbench settings are restored.

If your Extension Development Host workspace already has old mood overrides from an earlier run, use `Mood Switcher: Reset Workspace To User Settings` once. That clears the workspace-level theme/layout/workbench overrides so the F5 window falls back to your normal user settings, such as your light theme.

## Intended Usage

This extension works best as a lightweight workspace ritual rather than a one-time theme toggle.

- Pick a mood when you change task type, not just when you want a different color theme.
- Use workspace defaults when a repo tends to have a natural mode, like `Writing Lodge` for docs-heavy work or `Ship It` for release coordination.
- Start sessions when you want a visible timer and a stronger sense of focus.
- Use resource opening as a shortcut into the files that usually matter for that mode.
- Use the weekly analytics section to spot which moods you are actually spending time in.
- Use export/import if you want to carry session history between machines or reset test data safely.
- Use preset preview before switching when you want to understand exactly which editor or workbench settings will change.
- Use the mode-aware command palette when you want a smaller, mood-specific shortlist instead of the full VS Code command palette.
- End a session when you want to restore the original workspace theme and managed layout/workbench settings.
- Use `Mood Switcher: Restore Original Workspace State` if you want the same restore behavior without starting or stopping a session.
- Use `Mood Switcher: Reset Workspace To User Settings` when you want to wipe the workspace's saved mood overrides entirely and fall back to your regular VS Code settings.

## Things To Try

- Set `Deep Work` as the workspace default for one repo and `Ship It` for another, then reopen both to compare the startup behavior.
- Preview the preset for `Debugging Hell` and look at where each current setting is coming from: `workspace folder`, `workspace`, `user`, or `default`.
- Copy a mood’s settings to the clipboard and use that JSON as a starting point for customizing `moodSwitcher.modeSettings`.
- Turn on `moodSwitcher.autoOpenResourcesOnModeSwitch` and switch between `Writing Lodge` and `Debugging Hell` to feel the workflow difference.
- Add one of your own `.codex/` or `docs/` memory files to `moodSwitcher.modeMemoryFiles` and verify it opens with the matching mood.
- Switch into `Arcade Mode`, then stop the session and confirm your original theme and layout come back.
- Run `Mood Switcher: Validate Mode Commands` after customizing `moodSwitcher.modeCommands`.
- Open `Mood Switcher: Open Mode Command Palette` in `Debugging Hell` or `Writing Lodge` and compare how the suggested command groups change.
- Export session history, reset the workspace, then import the history back in to test the analytics flow.
- Open a mode soundtrack from `Quick Actions` or the dashboard and see whether it fits your mood ritual.

## Commands

- `Mood Switcher: Open Dashboard`
- `Mood Switcher: Open Docs`
- `Mood Switcher: Activate Mode`
- `Mood Switcher: Make Mode Workspace Default`
- `Mood Switcher: Open Resources For Mode`
- `Mood Switcher: Start Session For Mode`
- `Mood Switcher: Open Dashboard For Mode`
- `Mood Switcher: Copy Mood Settings`
- `Mood Switcher: Preview Mode Preset`
- `Mood Switcher: Restore Original Workspace State`
- `Mood Switcher: Reset Workspace To User Settings`
- `Mood Switcher: Open Mode Soundtrack`
- `Mood Switcher: Open Mode Command Palette`
- `Mood Switcher: Run Suggested Command`
- `Mood Switcher: Open Ranked Memory Docs`
- `Mood Switcher: Show Mode Ritual`
- `Mood Switcher: Start Break Cycle`
- `Mood Switcher: Export Session History`
- `Mood Switcher: Import Session History`
- `Mood Switcher: Validate Mode Commands`
- `Mood Switcher: Select Mode`
- `Mood Switcher: Start Session`
- `Mood Switcher: Stop Session`
- `Mood Switcher: Set Workspace Default Mode`
- `Mood Switcher: Clear Workspace Default Mode`
- `Mood Switcher: Open Mode Resources`

## Settings

- `moodSwitcher.enableThemeSwitching`
- `moodSwitcher.enableStatusBarLabel`
- `moodSwitcher.enableModePresets`
- `moodSwitcher.modeThemes`
- `moodSwitcher.modeColorCustomizations`
- `moodSwitcher.modeSettings`
- `moodSwitcher.modeCommands`
- `moodSwitcher.modeSuggestedCommands`
- `moodSwitcher.modeTimers`
- `moodSwitcher.modeTimerCycles`
- `moodSwitcher.modeRituals`
- `moodSwitcher.modeSoundtracks`
- `moodSwitcher.modeResourceGlobs`
- `moodSwitcher.modeMemoryFiles`
- `moodSwitcher.enableSmartProjectMemory`
- `moodSwitcher.modeMemoryKeywords`
- `moodSwitcher.modeMemoryProfiles`
- `moodSwitcher.autoOpenResourcesOnModeSwitch`
- `moodSwitcher.sessionHistoryLimit`
- `moodSwitcher.dashboardOpensOnStartup`

Use the new Mood Switcher icon in the activity bar to open the sidebar. From there you can:

- see active mood, default mood, and session state
- review weekly analytics
- switch directly into any mode
- start or stop sessions
- open the mode-aware command palette for the active mood
- run one suggested command directly for the active mood
- open a mode soundtrack
- reopen ranked memory docs
- reopen the current mood ritual
- start the configured break timer for the active mood
- export or import session history
- validate configured mode commands
- restore the original workspace state
- reset the workspace back to user/default settings
- open the visual dashboard
- jump to the extension docs

The sidebar is organized so the most-used commands live in `Quick Actions`, while documentation stays in the `Help` section. These commands are intended to be accessed from the list itself rather than from the sidebar title area.

The mode-aware command palette is surfaced in both places where it is most useful:

- `Quick Actions` in the sidebar
- the dashboard toolbar

It uses `moodSwitcher.modeSuggestedCommands` so each mood can surface a tighter set of built-in VS Code commands and Mood Switcher actions.

`Run Suggested Command` uses that same recommendation list when you want one next action quickly instead of opening the broader control palette.

Right-click any mood in the sidebar for row-specific actions like:

- make that mood the workspace default
- open resources for that mood
- start a session directly for that mood
- open the dashboard with that mood highlighted
- preview preset changes as `current [scope] -> new` diffs before applying them
- copy that mood's settings, theme, and resource config to the clipboard

Stopping a session restores the original workspace theme plus any managed layout/workbench settings that a mood changed. If you switch moods without starting a session, use `Mood Switcher: Restore Original Workspace State` to roll back to the pre-mood state.

`Mood Switcher: Reset Workspace To User Settings` is the stronger reset. It clears the workspace's mood-managed overrides and saved mood state entirely, which is especially useful for one-time cleanup in the F5 Extension Development Host.

Sidebar mood actions are normalized internally, so row clicks and context-menu actions both resolve to a valid mood name before state is stored or previews are rendered.

## Workflow Features

- Per-mode status bar colors come from `moodSwitcher.modeColorCustomizations` and are restored with the rest of the workspace snapshot.
- Per-mode command hooks come from `moodSwitcher.modeCommands` and can run on activate, on session start, or on session stop.
- Per-mode timers come from `moodSwitcher.modeTimers`. When a session reaches the configured duration, Mood Switcher notifies you and lets you stop the session or jump to resources.
- Per-mode timer cycles come from `moodSwitcher.modeTimerCycles`. When a timed session ends, Mood Switcher can offer a break timer, another focus block, or a clean end-session choice.
- `Mood Switcher: Start Break Cycle` exposes that break-timer flow as a standalone command, so you can use it on demand.
- Per-mode rituals come from `moodSwitcher.modeRituals`. When you start a session, the ritual appears as a short confirmation checklist before the timer begins.
- Per-mode soundtracks come from `moodSwitcher.modeSoundtracks` and can offer YouTube, Spotify, or a custom playlist link.
- Per-mode suggested commands come from `moodSwitcher.modeSuggestedCommands` and are grouped in a compact mood-aware quick pick.
- Weekly analytics come from completed session history. The sidebar and dashboard both summarize the last 7 days by mood and total session time.
- Session history can be exported and imported as JSON for backup, migration, or testing.
- Command validation checks configured `moodSwitcher.modeCommands` entries against registered VS Code commands and can copy an invalid-command report.
- Smarter project memory discovery uses `moodSwitcher.modeMemoryKeywords`, `moodSwitcher.modeMemoryProfiles`, plus `.codex/`, `docs/`, and root-level markdown lookups to find and rank likely context files even when they are not explicitly configured.

## Mode Effects

The extension currently manages theme plus a small set of editor/workbench settings. Here is what each mode does and the intended benefit.

- `Deep Work`
  Reduces tab noise, disables the minimap, keeps breadcrumbs on, and uses `Default Dark Modern`.
  Benefit: fewer peripheral UI signals, more room for focused code reading and editing while keeping core VS Code navigation visible.
  Session default: 50 minutes with a ritual that emphasizes closing distractions and skimming the current task first.
  Opening resources for this mode looks for `README.md`, `docs/**`, and `src/**`, plus optional memory files like `.codex/project-memory.md` or `docs/project-memory.md`.
  Resource intent: bring the main code surface and project context into view together.
- `Debugging Hell`
  Uses `Default Dark+`, opens debug UI on session start, keeps the minimap on, shows problems, prefers side-by-side diffs, and keeps the panel at the bottom.
  Benefit: faster movement between failing output, diffs, and debugger context.
  Session default: 30 minutes with a ritual focused on finding the failing test or log and naming the current hypothesis.
  Opening resources for this mode looks for `**/*test*`, `**/*spec*`, `logs/**`, and `.vscode/launch.json`, plus optional memory files like `.codex/debug-notes.md` or `docs/debug-notes.md`.
  Resource intent: surface tests, logs, and launch config so debugging starts close to the likely failure points.
- `Writing Lodge`
  Uses `Default Light Modern`, enables word wrap, disables the minimap and sticky scroll, and keeps tabs minimal.
  Benefit: a quieter writing-oriented layout for docs, notes, and prose-heavy work.
  Session default: 45 minutes with a ritual for outlining or choosing whether the session is drafting, editing, or pruning.
  Opening resources for this mode looks for `README.md`, `docs/**`, and `**/*.md`.
  Resource intent: center the workspace on prose, documentation, and notes rather than implementation files.
- `Arcade Mode`
  Uses `Abyss`, enables phase cursor blinking, keeps the minimap on, and opens the terminal in the editor area.
  Benefit: a more energetic, playful layout without moving the main VS Code navigation.
  Session default: 25 minutes with a ritual centered on opening the target UI surface and keeping feedback loops close.
  Opening resources for this mode looks for `src/**`, `assets/**`, and `public/**`.
  Resource intent: jump into the files that usually matter for playful UI, interaction, and front-end iteration.
- `Soft Focus`
  Uses `Quiet Light`, disables the minimap, uses bounded word wrap, shows whitespace only on selection, and keeps tabs minimal.
  Benefit: low-friction editing with less chrome and gentler visual pressure.
  Session default: 20 minutes with a ritual that encourages picking one small next action and keeping scope narrow.
  Opening resources for this mode looks for `README.md` and `src/**`.
  Resource intent: keep the working set small by pairing lightweight context with the main source tree.
- `Night Drive`
  Uses `Monokai`, enables smooth caret animation, disables the minimap, opens the terminal in the editor area, and moves the panel to the right.
  Benefit: better for longer solo sessions where terminal and output feel like part of the main workspace.
  Session default: 60 minutes with a ritual that asks you to decide what done looks like before the long session drifts.
  Opening resources for this mode looks for `src/**`, `.github/**`, and `.vscode/**`.
  Resource intent: support deeper evening sessions where you may bounce between code, automation, and workspace configuration.
- `Ship It`
  Uses `Kimbie Dark`, enables autosave, shows problems, keeps the panel at the bottom, and uses tree view for source control.
  Benefit: optimized for release passes, checklists, and fast iteration across code, problems, and SCM.
  Session default: 20 minutes with a ritual that checks problems, tests, and release notes first.
  Opening resources for this mode looks for `package.json`, `CHANGELOG.md`, `.github/**`, and `.vscode/**`, plus optional memory files like `.codex/release-checklist.md` or `docs/release-checklist.md`.
  Resource intent: bring release metadata, workflow files, and ship-checklist context into one place.

## Preset Behavior

Each mood can change regular workspace settings, which makes the extension useful even before it starts doing anything fancier. Examples:

- Deep Work minimizes tab noise while keeping the main activity bar visible
- Writing Lodge turns on word wrap and softens editor chrome
- Debugging Hell favors debug output and a bottom panel
- Ship It enables autosave and release-friendly panel defaults

You can override everything in `moodSwitcher.modeSettings`.

If a custom preset includes an invalid or unsupported VS Code setting, Mood Switcher skips that setting and keeps applying the rest of the mood instead of failing the whole switch.

Preset previews now label where the current value comes from:

- `workspace folder`
- `workspace`
- `user`
- `default`

`Open Resources` uses `moodSwitcher.modeResourceGlobs` and `moodSwitcher.modeMemoryFiles`, opens up to six matching files, and skips missing optional memory docs.

`Open Mode Soundtrack` uses `moodSwitcher.modeSoundtracks`. A mood can expose a YouTube link, a Spotify search or playlist URL, a custom playlist URL, or a legacy single-link fallback. If multiple sources are configured, Mood Switcher lets you choose which one to open.

## Dev Scripts

- `npm run lint` checks the TypeScript extension source with ESLint.
- `npm run lint:fix` applies safe auto-fixes where ESLint can.
- `npm run build` compiles the extension into `dist/`.
- `npm run vscode:prepublish` runs lint plus build before packaging.
- `npm run package:vsix` creates a versioned `.vsix` in `vsix/`.
- `npm run package:vsix:no-deps` packages with `vsce --no-dependencies`.

## Nice next steps

- Add command execution telemetry or recency-based ranking for suggested commands
- Keep refining per-mood command grouping and recommendations
- Expand the dashboard so suggested commands are visible inline per mood card

See [ROADMAP.md](./ROADMAP.md) for phased done/not done tracking.
