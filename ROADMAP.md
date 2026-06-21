# Mood Switcher Roadmap

This roadmap tracks what has been implemented and what is still intentionally left for later.

## Phase 1: Core Mood Switching

- `DONE` Mood picker, dashboard, and sidebar workflow
- `DONE` Per-workspace default mood
- `DONE` Theme switching per mood
- `DONE` Workspace/editor preset settings per mood
- `DONE` Mode resource opening
- `DONE` Optional project memory file hints
- `DONE` Session start/stop support
- `DONE` Restore original workspace state
- `DONE` Reset workspace to user settings

## Phase 2: UX Polish

- `DONE` Sidebar activity bar container and quick actions
- `DONE` Mood-row context menu actions
- `DONE` Preset preview with `current [scope] -> new` diffs
- `DONE` Safer sidebar input normalization
- `DONE` More complete README and getting started guide
- `DONE` Mode-by-mode explanation of layout/workbench effects
- `DONE` Mode-by-mode explanation of resource opening behavior

## Phase 3: V2 Workflow Bundle

- `DONE` Per-mode status bar colors via `workbench.colorCustomizations`
- `DONE` Optional per-mode command hooks (`onActivate`, `onStartSession`, `onStopSession`)
- `DONE` Per-mode session timers
- `DONE` Per-mode ritual prompts before starting a session
- `DONE` Persisted session history
- `DONE` Weekly mood analytics in the sidebar and dashboard
- `DONE` Smarter project-memory discovery using `.codex/`, `docs/`, and mood keywords
- `DONE` Exportable mood configuration bundles via `Copy Mood Settings`

## Phase 4: Done

- `DONE` Mode-specific soundtrack links and provider choice behavior
- `DONE` Richer weekly charts in the dashboard beyond the original summary-only view
- `DONE` Session history export/import
- `DONE` Per-repo memory ranking profiles beyond the original keyword-only discovery
- `DONE` Command validation flow for configured `modeCommands`
- `DONE` More advanced timer-cycle behavior with break and next-focus prompts

## Phase 5: Mode-Aware Command Palette

- `DONE` Current-mode command palette surface in the extension
- `DONE` Sidebar entry for opening a mode-aware command palette
- `DONE` Dashboard entry for opening a mode-aware command palette
- `DONE` Mood-specific recommended command groups that mix built-in VS Code commands with extension commands

### Candidate Built-In Commands By Mood

- `Deep Work`
  Potential commands: `workbench.action.focusActiveEditorGroup`, `workbench.action.toggleSidebarVisibility`, `workbench.action.closeAuxiliaryBar`, `workbench.action.toggleZenMode`
- `Debugging Hell`
  Potential commands: `workbench.action.problems.focus`, `workbench.view.debug`, `editor.debug.action.toggleBreakpoint`, `workbench.action.debug.start`
- `Writing Lodge`
  Potential commands: `markdown.showPreview`, `editor.action.toggleWordWrap`, `workbench.action.files.newUntitledFile`, `workbench.action.quickOpen`
- `Arcade Mode`
  Potential commands: `workbench.action.terminal.toggleTerminal`, `workbench.action.togglePanel`, `workbench.view.explorer`, `workbench.action.files.saveAll`
- `Soft Focus`
  Potential commands: `workbench.action.focusActiveEditorGroup`, `workbench.action.toggleSidebarVisibility`, `workbench.action.quickOpen`, `workbench.action.files.save`
- `Night Drive`
  Potential commands: `workbench.action.terminal.focus`, `workbench.action.togglePanel`, `workbench.action.tasks.runTask`, `workbench.view.scm`
- `Ship It`
  Potential commands: `workbench.view.scm`, `workbench.action.tasks.runTask`, `workbench.action.problems.focus`, `workbench.action.files.saveAll`

### New Extension Commands

- `DONE` `Mood Switcher: Open Mode Command Palette`
- `DONE` `Mood Switcher: Run Suggested Command`
- `DONE` `Mood Switcher: Show Mode Ritual`
- `DONE` `Mood Switcher: Start Break Cycle`
- `DONE` `Mood Switcher: Open Ranked Memory Docs`
- `DONE` `Mood Switcher: Open Mode Soundtrack`

## Current Recommendation

If the next pass happens soon, the highest-value unfinished items are:

- `NOT DONE` Command execution telemetry or recency-based suggestion ranking
- `NOT DONE` Even richer per-mood recommendation curation and grouping
