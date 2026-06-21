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
5. Right-click the mode row to preview changes, open resources, or make that mode the workspace default.

### Fastest path to seeing it work

1. Choose `Arcade Mode` from the sidebar.
2. Open `Preview Mode Preset` from the mood row context menu.
3. Confirm the `current [scope] -> new` settings diff looks right.
4. Apply the mood.
5. Open the dashboard and compare how the active mood, session state, and highlighted actions behave.

## Intended Usage

This extension works best as a lightweight workspace ritual rather than a one-time theme toggle.

- Pick a mood when you change task type, not just when you want a different color theme.
- Use workspace defaults when a repo tends to have a natural mode, like `Writing Lodge` for docs-heavy work or `Ship It` for release coordination.
- Start sessions when you want a visible timer and a stronger sense of focus.
- Use resource opening as a shortcut into the files that usually matter for that mode.
- Use preset preview before switching when you want to understand exactly which editor or workbench settings will change.

## Things To Try

- Set `Deep Work` as the workspace default for one repo and `Ship It` for another, then reopen both to compare the startup behavior.
- Preview the preset for `Debugging Hell` and look at where each current setting is coming from: `workspace folder`, `workspace`, `user`, or `default`.
- Copy a mood’s settings to the clipboard and use that JSON as a starting point for customizing `moodSwitcher.modeSettings`.
- Turn on `moodSwitcher.autoOpenResourcesOnModeSwitch` and switch between `Writing Lodge` and `Debugging Hell` to feel the workflow difference.
- Add one of your own `.codex/` or `docs/` memory files to `moodSwitcher.modeMemoryFiles` and verify it opens with the matching mood.

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
- open the visual dashboard
- jump to the extension docs

Right-click any mood in the sidebar for row-specific actions like:

- make that mood the workspace default
- open resources for that mood
- start a session directly for that mood
- open the dashboard with that mood highlighted
- preview preset changes as `current [scope] -> new` diffs before applying them
- copy that mood's settings, theme, and resource config to the clipboard

Sidebar mood actions are normalized internally, so row clicks and context-menu actions both resolve to a valid mood name before state is stored or previews are rendered.

## Preset examples

Each mood can change regular workspace settings, which makes the extension useful even before it starts doing anything fancier. Examples:

- Deep Work hides the activity bar and minimizes tab noise
- Writing Lodge turns on word wrap and softens editor chrome
- Debugging Hell favors debug output and a bottom panel
- Ship It enables autosave and release-friendly panel defaults

You can override everything in `moodSwitcher.modeSettings`.

Preset previews now label where the current value comes from:

- `workspace folder`
- `workspace`
- `user`
- `default`

## Nice next steps

- Add per-mode status bar colors using `workbench.colorCustomizations`
- Persist session history and show weekly mood analytics
- Let presets optionally run VS Code commands in addition to settings changes
- Add mode-specific soundtracks, timers, or focus rituals
- Add smarter project-memory integration for `.codex/` or repo-specific docs
