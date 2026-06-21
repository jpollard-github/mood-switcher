# Mood-Driven Theme Switcher

A playful VS Code extension that changes editor theme, status bar context, and workspace flow based on your current mode.

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
- Applies configurable workspace and editor presets per mood
- Shows the active mood and session timer in the status bar
- Stores a per-workspace default mood
- Starts and stops timed sessions
- Opens a set of mode-specific project files and optional memory docs

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
- Use preset preview before switching when you want to understand exactly which editor or workbench settings will change.
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
- `moodSwitcher.modeSettings`
- `moodSwitcher.modeResourceGlobs`
- `moodSwitcher.modeMemoryFiles`
- `moodSwitcher.autoOpenResourcesOnModeSwitch`
- `moodSwitcher.dashboardOpensOnStartup`

Use the new Mood Switcher icon in the activity bar to open the sidebar. From there you can:

- see active mood, default mood, and session state
- switch directly into any mode
- start or stop sessions
- restore the original workspace state
- reset the workspace back to user/default settings
- open the visual dashboard
- jump to the extension docs

The sidebar is organized so the most-used commands live in `Quick Actions`, while documentation stays in the `Help` section. These commands are intended to be accessed from the list itself rather than from the sidebar title area.

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

## Mode Effects

The extension currently manages theme plus a small set of editor/workbench settings. Here is what each mode does and the intended benefit.

- `Deep Work`
  Hides the activity bar, reduces tab noise, disables the minimap, keeps breadcrumbs on, and uses `Default Dark Modern`.
  Benefit: fewer peripheral UI signals, more room for focused code reading and editing.
  Opening resources for this mode looks for `README.md`, `docs/**`, and `src/**`, plus optional memory files like `.codex/project-memory.md` or `docs/project-memory.md`.
  Resource intent: bring the main code surface and project context into view together.
- `Debugging Hell`
  Uses `Default Dark+`, opens debug UI on session start, keeps the minimap on, shows problems, prefers side-by-side diffs, and keeps the panel at the bottom.
  Benefit: faster movement between failing output, diffs, and debugger context.
  Opening resources for this mode looks for `**/*test*`, `**/*spec*`, `logs/**`, and `.vscode/launch.json`, plus optional memory files like `.codex/debug-notes.md` or `docs/debug-notes.md`.
  Resource intent: surface tests, logs, and launch config so debugging starts close to the likely failure points.
- `Writing Lodge`
  Uses `Default Light Modern`, enables word wrap, disables the minimap and sticky scroll, places the activity bar at the top, and keeps tabs minimal.
  Benefit: a quieter writing-oriented layout for docs, notes, and prose-heavy work.
  Opening resources for this mode looks for `README.md`, `docs/**`, and `**/*.md`.
  Resource intent: center the workspace on prose, documentation, and notes rather than implementation files.
- `Arcade Mode`
  Uses `Abyss`, enables phase cursor blinking, keeps the minimap on, moves the activity bar to the bottom, and opens the terminal in the editor area.
  Benefit: a more energetic, playful layout without flipping the side bar position.
  Opening resources for this mode looks for `src/**`, `assets/**`, and `public/**`.
  Resource intent: jump into the files that usually matter for playful UI, interaction, and front-end iteration.
- `Soft Focus`
  Uses `Quiet Light`, disables the minimap, uses bounded word wrap, shows whitespace only on selection, hides the activity bar, and keeps tabs minimal.
  Benefit: low-friction editing with less chrome and gentler visual pressure.
  Opening resources for this mode looks for `README.md` and `src/**`.
  Resource intent: keep the working set small by pairing lightweight context with the main source tree.
- `Night Drive`
  Uses `Monokai`, enables smooth caret animation, disables the minimap, opens the terminal in the editor area, puts the activity bar at the bottom, and moves the panel to the right.
  Benefit: better for longer solo sessions where terminal and output feel like part of the main workspace.
  Opening resources for this mode looks for `src/**`, `.github/**`, and `.vscode/**`.
  Resource intent: support deeper evening sessions where you may bounce between code, automation, and workspace configuration.
- `Ship It`
  Uses `Kimbie Dark`, enables autosave, shows problems, puts the activity bar at the top, keeps the panel at the bottom, and uses tree view for source control.
  Benefit: optimized for release passes, checklists, and fast iteration across code, problems, and SCM.
  Opening resources for this mode looks for `package.json`, `CHANGELOG.md`, `.github/**`, and `.vscode/**`, plus optional memory files like `.codex/release-checklist.md` or `docs/release-checklist.md`.
  Resource intent: bring release metadata, workflow files, and ship-checklist context into one place.

## Preset Behavior

Each mood can change regular workspace settings, which makes the extension useful even before it starts doing anything fancier. Examples:

- Deep Work hides the activity bar and minimizes tab noise
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

## Nice next steps

- Add per-mode status bar colors using `workbench.colorCustomizations`
- Persist session history and show weekly mood analytics
- Let presets optionally run VS Code commands in addition to settings changes
- Add mode-specific soundtracks, timers, or focus rituals
- Add smarter project-memory integration for `.codex/` or repo-specific docs
