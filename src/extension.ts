import * as vscode from "vscode";

type MoodName =
  | "Deep Work"
  | "Debugging Hell"
  | "Writing Lodge"
  | "Arcade Mode"
  | "Soft Focus"
  | "Night Drive"
  | "Ship It";

type SidebarNodeKind = "section" | "action" | "mood" | "status" | "analytics";
type CommandHook = "onActivate" | "onStartSession" | "onStopSession";

interface MoodDefinition {
  name: MoodName;
  icon: string;
  description: string;
  accent: string;
}

interface MoodTimerConfig {
  durationMinutes?: number;
}

interface SessionState {
  mood: MoodName;
  startedAt: number;
  endsAt?: number;
  timerCompleted?: boolean;
}

interface SessionRecord {
  mood: MoodName;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  workspaceName: string;
}

interface WeeklyMoodStat {
  mood: MoodName;
  durationMs: number;
  sessions: number;
}

interface WeeklyAnalytics {
  totalDurationMs: number;
  totalSessions: number;
  moods: WeeklyMoodStat[];
}

interface DashboardState {
  activeMood?: MoodName;
  workspaceDefaultMood?: MoodName;
  session?: SessionState;
  moods: MoodDefinition[];
  spotlightMood?: MoodName;
  weeklyAnalytics: WeeklyAnalytics;
  nextRitual?: string[];
}

interface SidebarNode {
  kind: SidebarNodeKind;
  id: string;
  label: string;
  description?: string;
  tooltip?: string;
  icon?: vscode.ThemeIcon;
  command?: vscode.Command;
  children?: SidebarNode[];
  mood?: MoodName;
}

interface SettingSnapshot {
  scope: string;
  value: unknown;
}

interface ModeSoundtrack {
  label?: string;
  url?: string;
  youtubeUrl?: string;
  spotifyUrl?: string;
  customUrl?: string;
}

interface CommandSpec {
  command: string;
  args?: unknown[];
}

interface HookCommandMap {
  onActivate?: CommandSpec[];
  onStartSession?: CommandSpec[];
  onStopSession?: CommandSpec[];
}

interface TimerCycleConfig {
  breakMinutes?: number;
  offerNextFocusBlock?: boolean;
}

interface MemoryProfile {
  preferredDirectories?: string[];
  boostFilenames?: string[];
}

interface SuggestedCommandSpec extends CommandSpec {
  group?: string;
  label: string;
  description?: string;
  whenMoodActive?: boolean;
  priority?: number;
}

interface SuggestedCommandQuickPickItem extends vscode.QuickPickItem {
  command?: string;
  args?: unknown[];
  suggestion?: SuggestedCommandSpec;
}

interface SuggestedCommandUsage {
  mood: MoodName;
  signature: string;
  command: string;
  label: string;
  count: number;
  lastUsedAt: number;
}

type RestoreSnapshot = Record<string, SettingSnapshot>;
type MoodSettingsMap = Record<string, Record<string, unknown>>;
type MoodColorMap = Record<string, Record<string, string>>;
type MoodCommandMap = Record<string, HookCommandMap>;
type MoodSuggestedCommandMap = Record<string, SuggestedCommandSpec[]>;
type MoodTimerMap = Record<string, MoodTimerConfig>;
type MoodRitualMap = Record<string, string[]>;
type MoodKeywordMap = Record<string, string[]>;
type MoodSoundtrackMap = Record<string, ModeSoundtrack>;
type MoodTimerCycleMap = Record<string, TimerCycleConfig>;
type MoodMemoryProfileMap = Record<string, MemoryProfile>;

const ACTIVE_MOOD_KEY = "moodSwitcher.activeMood";
const WORKSPACE_DEFAULT_MOOD_KEY = "moodSwitcher.workspaceDefaultMood";
const SESSION_STATE_KEY = "moodSwitcher.session";
const RESTORE_SNAPSHOT_KEY = "moodSwitcher.restoreSnapshot";
const SESSION_HISTORY_KEY = "moodSwitcher.sessionHistory";
const SUGGESTED_COMMAND_USAGE_KEY = "moodSwitcher.suggestedCommandUsage";
const DASHBOARD_VIEW_TYPE = "moodSwitcher.dashboard";
const MAX_RESOURCE_OPENS = 6;
const SESSION_HISTORY_FALLBACK_LIMIT = 250;
const SUGGESTED_COMMAND_USAGE_LIMIT = 200;

const MOODS: MoodDefinition[] = [
  { name: "Deep Work", icon: "$(flame)", description: "Trim distractions and lock onto the core task.", accent: "#ff6b35" },
  { name: "Debugging Hell", icon: "$(bug)", description: "Bring up tests, logs, and breakpoints.", accent: "#ff4d6d" },
  { name: "Writing Lodge", icon: "$(book)", description: "A calmer mode for docs, notes, and prose.", accent: "#c08552" },
  { name: "Arcade Mode", icon: "$(game)", description: "A higher-energy mode for playful building.", accent: "#00d1b2" },
  { name: "Soft Focus", icon: "$(symbol-color)", description: "Gentle structure for low-friction progress.", accent: "#7db7ff" },
  { name: "Night Drive", icon: "$(zap)", description: "Late-session cruising with a darker palette.", accent: "#3dd6d0" },
  { name: "Ship It", icon: "$(rocket)", description: "Release-focused mode for final checks and momentum.", accent: "#ffd166" }
];

const MOOD_NAMES = new Set<MoodName>(MOODS.map((mood) => mood.name));

let statusBarItem: vscode.StatusBarItem;
let dashboardPanel: vscode.WebviewPanel | undefined;
let sidebarProvider: MoodSidebarProvider | undefined;
let dashboardSpotlightMood: MoodName | undefined;
let sessionTimer: NodeJS.Timeout | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = "moodSwitcher.openDashboard";
  context.subscriptions.push(statusBarItem);

  sidebarProvider = new MoodSidebarProvider(context);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("moodSwitcher.sidebar", sidebarProvider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("moodSwitcher.openDashboard", () => {
      openDashboard(context);
    }),
    vscode.commands.registerCommand("moodSwitcher.openDocs", async () => {
      await openDocs(context);
    }),
    vscode.commands.registerCommand("moodSwitcher.activateSpecificMode", async (input: MoodName | SidebarNode) => {
      const mood = normalizeMoodInput(input);
      if (mood) {
        await applyMood(context, mood, { promptForSession: true });
      }
    }),
    vscode.commands.registerCommand("moodSwitcher.setSpecificModeAsDefault", async (input: MoodName | SidebarNode) => {
      const mood = normalizeMoodInput(input);
      if (!mood) {
        return;
      }

      await context.workspaceState.update(WORKSPACE_DEFAULT_MOOD_KEY, mood);
      updateUI(context);
      vscode.window.showInformationMessage(`Mood Switcher default for this workspace set to ${mood}.`);
    }),
    vscode.commands.registerCommand("moodSwitcher.openSpecificModeResources", async (input: MoodName | SidebarNode) => {
      const mood = normalizeMoodInput(input);
      if (mood) {
        await openModeResources(mood);
      }
    }),
    vscode.commands.registerCommand("moodSwitcher.startSpecificModeSession", async (input: MoodName | SidebarNode) => {
      const mood = normalizeMoodInput(input);
      if (mood) {
        await startSessionFlow(context, mood);
      }
    }),
    vscode.commands.registerCommand("moodSwitcher.openDashboardForMode", async (input: MoodName | SidebarNode) => {
      const mood = normalizeMoodInput(input);
      if (!mood) {
        return;
      }

      dashboardSpotlightMood = mood;
      openDashboard(context);
    }),
    vscode.commands.registerCommand("moodSwitcher.copyMoodSettings", async (input: MoodName | SidebarNode) => {
      const mood = normalizeMoodInput(input);
      if (!mood) {
        return;
      }

      await vscode.env.clipboard.writeText(buildMoodExport(mood));
      vscode.window.showInformationMessage(`Copied ${mood} settings to the clipboard.`);
    }),
    vscode.commands.registerCommand("moodSwitcher.previewModePreset", async (input: MoodName | SidebarNode) => {
      const mood = normalizeMoodInput(input);
      if (mood) {
        await previewModePreset(context, mood);
      }
    }),
    vscode.commands.registerCommand("moodSwitcher.restoreOriginalWorkspaceState", async () => {
      await restoreOriginalWorkspaceState(context, true);
    }),
    vscode.commands.registerCommand("moodSwitcher.resetWorkspaceToUserSettings", async () => {
      await resetWorkspaceToUserSettings(context, true);
    }),
    vscode.commands.registerCommand("moodSwitcher.openModeSoundtrack", async () => {
      const mood = getActiveMood(context) ?? (await pickMood());
      if (mood) {
        await openModeSoundtrack(mood);
      }
    }),
    vscode.commands.registerCommand("moodSwitcher.exportSessionHistory", async () => {
      await exportSessionHistory(context);
    }),
    vscode.commands.registerCommand("moodSwitcher.importSessionHistory", async () => {
      await importSessionHistory(context);
    }),
    vscode.commands.registerCommand("moodSwitcher.validateModeCommands", async () => {
      await validateConfiguredCommands();
    }),
    vscode.commands.registerCommand("moodSwitcher.openModeCommandPalette", async () => {
      await openModeCommandPalette(context);
    }),
    vscode.commands.registerCommand("moodSwitcher.runSuggestedCommand", async (input?: SuggestedCommandSpec) => {
      await runSuggestedCommandFlow(context, input);
    }),
    vscode.commands.registerCommand("moodSwitcher.openRankedMemoryDocs", async () => {
      const mood = getActiveMood(context) ?? (await pickMood());
      if (mood) {
        await openRankedMemoryDocs(mood);
      }
    }),
    vscode.commands.registerCommand("moodSwitcher.showModeRitual", async () => {
      const mood = getActiveMood(context) ?? (await pickMood());
      if (mood) {
        await showModeRitual(mood);
      }
    }),
    vscode.commands.registerCommand("moodSwitcher.startBreakCycle", async () => {
      const mood = getActiveMood(context) ?? (await pickMood());
      if (mood) {
        await startBreakCycle(context, mood, true);
      }
    }),
    vscode.commands.registerCommand("moodSwitcher.selectMode", async () => {
      const mood = await pickMood();
      if (mood) {
        await applyMood(context, mood, { promptForSession: true });
      }
    }),
    vscode.commands.registerCommand("moodSwitcher.startSession", async () => {
      const mood = getActiveMood(context) ?? (await pickMood());
      if (mood) {
        await startSessionFlow(context, mood);
      }
    }),
    vscode.commands.registerCommand("moodSwitcher.stopSession", async () => {
      await stopSession(context, true);
    }),
    vscode.commands.registerCommand("moodSwitcher.setWorkspaceDefaultMode", async () => {
      const mood = await pickMood();
      if (!mood) {
        return;
      }

      await context.workspaceState.update(WORKSPACE_DEFAULT_MOOD_KEY, mood);
      updateUI(context);
      vscode.window.showInformationMessage(`Mood Switcher default for this workspace set to ${mood}.`);
    }),
    vscode.commands.registerCommand("moodSwitcher.clearWorkspaceDefaultMode", async () => {
      await context.workspaceState.update(WORKSPACE_DEFAULT_MOOD_KEY, undefined);
      updateUI(context);
      vscode.window.showInformationMessage("Mood Switcher workspace default cleared.");
    }),
    vscode.commands.registerCommand("moodSwitcher.openModeResources", async () => {
      const mood = getActiveMood(context) ?? (await pickMood());
      if (mood) {
        await openModeResources(mood);
      }
    })
  );

  const workspaceDefault = normalizeStoredMood(context.workspaceState.get<unknown>(WORKSPACE_DEFAULT_MOOD_KEY));
  if (workspaceDefault) {
    await applyMood(context, workspaceDefault);
  }

  const session = normalizeSessionState(context.workspaceState.get<unknown>(SESSION_STATE_KEY));
  if (session) {
    resumeSessionTimer(context, session);
  }

  if (getConfiguration<boolean>("dashboardOpensOnStartup")) {
    openDashboard(context);
  }

  updateUI(context);
}

export async function deactivate(): Promise<void> {
  if (sessionTimer) {
    clearInterval(sessionTimer);
  }
}

async function pickMood(): Promise<MoodName | undefined> {
  const selected = await vscode.window.showQuickPick(
    MOODS.map((mood) => ({
      label: `${mood.icon} ${mood.name}`,
      description: mood.description,
      mood: mood.name
    })),
    { placeHolder: "Choose the workspace mood" }
  );

  return selected?.mood;
}

function getActiveMood(context: vscode.ExtensionContext): MoodName | undefined {
  return normalizeStoredMood(context.workspaceState.get<unknown>(ACTIVE_MOOD_KEY));
}

async function applyMood(
  context: vscode.ExtensionContext,
  mood: MoodName,
  options?: { promptForSession?: boolean }
): Promise<void> {
  await ensureRestoreSnapshot(context);
  await context.workspaceState.update(ACTIVE_MOOD_KEY, mood);
  await maybeApplyTheme(mood);
  await maybeApplyColorCustomizations(mood);
  await maybeApplyPresetSettings(mood);
  await maybeRunConfiguredCommands(mood, "onActivate");
  updateUI(context);

  if (getConfiguration<boolean>("autoOpenResourcesOnModeSwitch")) {
    await openModeResources(mood);
  }

  if (options?.promptForSession) {
    const action = await vscode.window.showInformationMessage(
      `${mood} is active.`,
      "Start session",
      "Open resources"
    );

    if (action === "Start session") {
      await startSession(context, mood);
    }

    if (action === "Open resources") {
      await openModeResources(mood);
    }
  }
}

async function startSessionFlow(context: vscode.ExtensionContext, mood: MoodName): Promise<void> {
  if (getActiveMood(context) !== mood) {
    await applyMood(context, mood);
  }

  await startSession(context, mood);
}

async function maybeApplyTheme(mood: MoodName): Promise<void> {
  if (!getConfiguration<boolean>("enableThemeSwitching")) {
    return;
  }

  const themeName = getConfiguration<Record<string, string>>("modeThemes")[mood];
  if (!themeName) {
    return;
  }

  await vscode.workspace.getConfiguration("workbench").update(
    "colorTheme",
    themeName,
    vscode.ConfigurationTarget.Workspace
  );
}

async function maybeApplyColorCustomizations(mood: MoodName): Promise<void> {
  const customizations = getConfiguration<MoodColorMap>("modeColorCustomizations")[mood];
  if (!customizations || Object.keys(customizations).length === 0) {
    return;
  }

  await vscode.workspace.getConfiguration("workbench").update(
    "colorCustomizations",
    customizations,
    vscode.ConfigurationTarget.Workspace
  );
}

async function maybeApplyPresetSettings(mood: MoodName): Promise<void> {
  if (!getConfiguration<boolean>("enableModePresets")) {
    return;
  }

  const settings = getModeSettings(mood);
  const failed: string[] = [];

  for (const [settingPath, value] of Object.entries(settings)) {
    try {
      await updateWorkspaceSetting(settingPath, value);
    } catch {
      failed.push(settingPath);
    }
  }

  if (failed.length > 0) {
    vscode.window.showWarningMessage(
      `Mood Switcher skipped ${failed.length} invalid or unsupported setting(s) for ${mood}: ${failed.join(", ")}.`
    );
  }
}

async function maybeRunConfiguredCommands(mood: MoodName, hook: CommandHook): Promise<void> {
  const hooks = getConfiguration<MoodCommandMap>("modeCommands")[mood];
  const commands = hooks?.[hook] ?? [];
  const failed: string[] = [];

  for (const spec of commands) {
    if (!spec?.command) {
      continue;
    }

    try {
      await vscode.commands.executeCommand(spec.command, ...(spec.args ?? []));
    } catch {
      failed.push(spec.command);
    }
  }

  if (failed.length > 0) {
    vscode.window.showWarningMessage(
      `Mood Switcher could not run ${failed.length} configured command(s) for ${mood}: ${failed.join(", ")}.`
    );
  }
}

async function updateWorkspaceSetting(settingPath: string, value: unknown): Promise<void> {
  const [section, ...rest] = settingPath.split(".");
  if (!section || rest.length === 0) {
    return;
  }

  await vscode.workspace.getConfiguration(section).update(
    rest.join("."),
    value,
    vscode.ConfigurationTarget.Workspace
  );
}

async function startSession(context: vscode.ExtensionContext, mood: MoodName): Promise<void> {
  const ritualAccepted = await promptForRitualIfNeeded(mood);
  if (!ritualAccepted) {
    return;
  }

  const timerConfig = getModeTimer(mood);
  const endsAt =
    timerConfig.durationMinutes && timerConfig.durationMinutes > 0
      ? Date.now() + timerConfig.durationMinutes * 60 * 1000
      : undefined;

  const session: SessionState = {
    mood,
    startedAt: Date.now(),
    endsAt
  };

  await context.workspaceState.update(SESSION_STATE_KEY, session);
  resumeSessionTimer(context, session);
  await maybeRunConfiguredCommands(mood, "onStartSession");
  updateUI(context);

  const timerSummary = endsAt ? ` for ${timerConfig.durationMinutes} minutes` : "";
  vscode.window.showInformationMessage(`Started ${mood} session${timerSummary}.`);
}

async function promptForRitualIfNeeded(mood: MoodName): Promise<boolean> {
  const ritual = getModeRitual(mood);
  if (ritual.length === 0) {
    return true;
  }

  const action = await vscode.window.showInformationMessage(
    `${mood} ritual:\n${ritual.map((step, index) => `${index + 1}. ${step}`).join("\n")}`,
    { modal: true },
    "Begin Session",
    "Cancel"
  );

  return action === "Begin Session";
}

async function stopSession(context: vscode.ExtensionContext, notify: boolean): Promise<void> {
  const session = normalizeSessionState(context.workspaceState.get<unknown>(SESSION_STATE_KEY));
  await context.workspaceState.update(SESSION_STATE_KEY, undefined);

  if (sessionTimer) {
    clearInterval(sessionTimer);
    sessionTimer = undefined;
  }

  if (session) {
    await recordCompletedSession(context, session, Date.now());
    await maybeRunConfiguredCommands(session.mood, "onStopSession");
  }

  updateUI(context);

  if (notify && session) {
    vscode.window.showInformationMessage(
      `Stopped ${session.mood} session after ${formatDuration(Date.now() - session.startedAt)}.`
    );
  }

  if (session) {
    await maybeOfferTimerCycle(context, session.mood);
  }

  await restoreOriginalWorkspaceState(context, false);
}

function resumeSessionTimer(context: vscode.ExtensionContext, session: SessionState): void {
  if (sessionTimer) {
    clearInterval(sessionTimer);
  }

  sessionTimer = setInterval(() => {
    void tickSession(context);
  }, 1000);

  void tickSession(context, session);
}

async function tickSession(context: vscode.ExtensionContext, current?: SessionState): Promise<void> {
  const session = current ?? normalizeSessionState(context.workspaceState.get<unknown>(SESSION_STATE_KEY));
  if (!session) {
    return;
  }

  if (session.endsAt && !session.timerCompleted && Date.now() >= session.endsAt) {
    const completed: SessionState = { ...session, timerCompleted: true };
    await context.workspaceState.update(SESSION_STATE_KEY, completed);
    vscode.window.showInformationMessage(
      `${session.mood} timer complete.`,
      "Stop Session",
      "Open Resources"
    ).then(async (action) => {
      if (action === "Stop Session") {
        await stopSession(context, true);
      } else if (action === "Open Resources") {
        await openModeResources(session.mood);
      }
    });
  }

  updateUI(context);
}

function updateStatusBar(context: vscode.ExtensionContext): void {
  if (!getConfiguration<boolean>("enableStatusBarLabel")) {
    statusBarItem.hide();
    return;
  }

  const mood = getActiveMood(context);
  const session = normalizeSessionState(context.workspaceState.get<unknown>(SESSION_STATE_KEY));

  if (!mood) {
    statusBarItem.text = "$(paintcan) Mood: unset";
    statusBarItem.tooltip = "Open the Mood Switcher dashboard";
    statusBarItem.show();
    return;
  }

  let sessionText = "";
  if (session?.mood === mood) {
    if (session.endsAt) {
      const remaining = session.endsAt - Date.now();
      sessionText = session.timerCompleted || remaining <= 0
        ? " • timer done"
        : ` • ${formatDuration(remaining)} left`;
    } else {
      sessionText = ` • ${formatDuration(Date.now() - session.startedAt)}`;
    }
  }

  statusBarItem.text = `$(paintcan) ${mood}${sessionText}`;
  statusBarItem.tooltip = `Active mood: ${mood}`;
  statusBarItem.show();
}

async function openModeResources(mood: MoodName): Promise<void> {
  const uris = new Map<string, vscode.Uri>();

  for (const pattern of getModeGlobs(mood)) {
    const matches = await vscode.workspace.findFiles(pattern, "**/node_modules/**", 4);
    for (const uri of matches) {
      uris.set(uri.fsPath, uri);
    }
  }

  const memoryUris = await resolveModeMemoryUris(mood);
  for (const uri of memoryUris) {
    uris.set(uri.fsPath, uri);
  }

  if (uris.size === 0) {
    vscode.window.showWarningMessage(
      `No resources found for ${mood}. Update moodSwitcher.modeResourceGlobs or moodSwitcher.modeMemoryFiles to tune it.`
    );
    return;
  }

  const ordered = Array.from(uris.values())
    .sort((left, right) => left.fsPath.localeCompare(right.fsPath))
    .slice(0, MAX_RESOURCE_OPENS);

  for (const uri of ordered) {
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });
  }
}

async function resolveModeMemoryUris(mood: MoodName): Promise<vscode.Uri[]> {
  const uris = new Map<string, vscode.Uri>();

  for (const relativePath of getModeMemoryFiles(mood)) {
    const uri = firstWorkspaceUri(relativePath);
    if (!uri) {
      continue;
    }

    try {
      await vscode.workspace.fs.stat(uri);
      uris.set(uri.fsPath, uri);
    } catch {
      // Optional configured file.
    }
  }

  if (getConfiguration<boolean>("enableSmartProjectMemory")) {
    const discovered = await discoverSmartProjectMemory(mood);
    for (const uri of discovered) {
      uris.set(uri.fsPath, uri);
    }
  }

  return Array.from(uris.values()).sort((left, right) => scoreMemoryUri(right, mood) - scoreMemoryUri(left, mood));
}

async function discoverSmartProjectMemory(mood: MoodName): Promise<vscode.Uri[]> {
  const uris = new Map<string, vscode.Uri>();
  const keywords = getModeMemoryKeywords(mood);
  const patterns: string[] = [];

  for (const keyword of keywords) {
    patterns.push(`.codex/**/*${keyword}*.md`);
    patterns.push(`docs/**/*${keyword}*.md`);
    patterns.push(`*${keyword}*.md`);
  }

  patterns.push(".codex/**/*.md");

  for (const pattern of patterns) {
    const matches = await vscode.workspace.findFiles(pattern, "**/node_modules/**", 2);
    for (const uri of matches) {
      uris.set(uri.fsPath, uri);
    }
  }

  return Array.from(uris.values());
}

function firstWorkspaceUri(relativePath: string): vscode.Uri | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder ? vscode.Uri.joinPath(folder.uri, relativePath) : undefined;
}

function getConfiguration<T>(key: string): T {
  return vscode.workspace.getConfiguration("moodSwitcher").get<T>(key)!;
}

async function openDocs(context: vscode.ExtensionContext): Promise<void> {
  const readmeUri = vscode.Uri.joinPath(context.extensionUri, "README.md");
  const document = await vscode.workspace.openTextDocument(readmeUri);
  await vscode.window.showTextDocument(document, { preview: false });
}

async function previewModePreset(context: vscode.ExtensionContext, mood: MoodName): Promise<void> {
  const themeName = getConfiguration<Record<string, string>>("modeThemes")[mood] ?? "No theme configured";
  const currentTheme = getSettingSnapshot("workbench.colorTheme");
  const currentColors = getSettingSnapshot("workbench.colorCustomizations");
  const nextColors = getConfiguration<MoodColorMap>("modeColorCustomizations")[mood] ?? {};
  const settings = getModeSettings(mood);
  const commands = getConfiguration<MoodCommandMap>("modeCommands")[mood] ?? {};
  const timer = getModeTimer(mood);
  const cycle = getModeTimerCycle(mood);
  const soundtrack = getModeSoundtrack(mood);
  const activeMood = getActiveMood(context);

  const lines = [
    `Mode: ${mood}`,
    `Theme: ${formatDiffValue(currentTheme.value)} [${currentTheme.scope}] -> ${formatDiffValue(themeName)}`,
    `Status bar colors: ${formatDiffValue(currentColors.value)} [${currentColors.scope}] -> ${formatDiffValue(nextColors)}`,
    `Resources: ${getModeGlobs(mood).length} glob(s), ${getModeMemoryFiles(mood).length} explicit memory file hint(s)`,
    `Commands: activate=${(commands.onActivate ?? []).length}, start=${(commands.onStartSession ?? []).length}, stop=${(commands.onStopSession ?? []).length}`,
    `Timer: ${timer.durationMinutes ? `${timer.durationMinutes} minute default` : "No default timer"}`,
    `Cycle: ${cycle.breakMinutes ? `${cycle.breakMinutes} minute break offer` : "No break cycle configured"}`,
    `Soundtrack: ${soundtrack.url ? soundtrack.label ?? soundtrack.url : "No soundtrack configured"}`,
    `State: ${activeMood === mood ? "Already active" : `Would switch from ${activeMood ?? "unset"}`}`,
    "",
    "Preset changes:"
  ];

  const settingEntries = Object.entries(settings);
  if (settingEntries.length === 0) {
    lines.push("- No workspace preset changes configured.");
  } else {
    for (const [settingPath, value] of settingEntries) {
      const currentSetting = getSettingSnapshot(settingPath);
      const unchanged = areValuesEqual(currentSetting.value, value) ? " (unchanged)" : "";
      lines.push(
        `- ${settingPath}: ${formatDiffValue(currentSetting.value)} [${currentSetting.scope}] -> ${formatDiffValue(value)}${unchanged}`
      );
    }
  }

  const action = await vscode.window.showInformationMessage(
    lines.join("\n"),
    { modal: true },
    "Apply Mood",
    "Copy Settings"
  );

  if (action === "Apply Mood") {
    await applyMood(context, mood, { promptForSession: true });
  } else if (action === "Copy Settings") {
    await vscode.env.clipboard.writeText(buildMoodExport(mood));
    vscode.window.showInformationMessage(`Copied ${mood} settings to the clipboard.`);
  }
}

function openDashboard(context: vscode.ExtensionContext): void {
  if (dashboardPanel) {
    dashboardPanel.reveal(vscode.ViewColumn.One);
    updateDashboard(context);
    return;
  }

  dashboardPanel = vscode.window.createWebviewPanel(
    DASHBOARD_VIEW_TYPE,
    "Mood Switcher",
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  dashboardPanel.onDidDispose(() => {
    dashboardPanel = undefined;
    dashboardSpotlightMood = undefined;
  });

  dashboardPanel.webview.onDidReceiveMessage(async (message: { type: string; mood?: MoodName }) => {
    switch (message.type) {
      case "switchMood":
        if (message.mood) {
          await applyMood(context, message.mood);
        }
        break;
      case "startSession":
        if (message.mood) {
          await startSessionFlow(context, message.mood);
        }
        break;
      case "openResources":
        if (message.mood) {
          await openModeResources(message.mood);
        }
        break;
      case "openSoundtrack":
        if (message.mood) {
          await openModeSoundtrack(message.mood);
        }
        break;
      case "openCommandPalette":
        await openModeCommandPalette(context);
        break;
      case "stopSession":
        await stopSession(context, true);
        break;
      case "restoreState":
        await restoreOriginalWorkspaceState(context, true);
        break;
      case "clearDefault":
        await context.workspaceState.update(WORKSPACE_DEFAULT_MOOD_KEY, undefined);
        break;
      default:
        break;
    }

    updateUI(context);
  });

  updateDashboard(context);
}

function updateUI(context: vscode.ExtensionContext): void {
  updateStatusBar(context);
  updateDashboard(context);
  sidebarProvider?.refresh();
}

function updateDashboard(context: vscode.ExtensionContext): void {
  if (!dashboardPanel) {
    return;
  }

  const activeMood = getActiveMood(context);
  const state: DashboardState = {
    activeMood,
    workspaceDefaultMood: normalizeStoredMood(context.workspaceState.get<unknown>(WORKSPACE_DEFAULT_MOOD_KEY)),
    session: normalizeSessionState(context.workspaceState.get<unknown>(SESSION_STATE_KEY)),
    moods: MOODS,
    spotlightMood: dashboardSpotlightMood,
    weeklyAnalytics: calculateWeeklyAnalytics(getSessionHistory(context)),
    nextRitual: activeMood ? getModeRitual(activeMood) : undefined
  };

  dashboardPanel.webview.html = getDashboardHtml(state);
}

function getDashboardHtml(state: DashboardState): string {
  const moodCards = state.moods.map((mood) => {
    const isActive = state.activeMood === mood.name;
    const isDefault = state.workspaceDefaultMood === mood.name;
    const isSpotlight = state.spotlightMood === mood.name;
    const sessionBadge =
      state.session?.mood === mood.name
        ? `<span class="pill session">${escapeHtml(getSessionBadge(state.session))}</span>`
        : "";

    return `
      <article class="card ${isActive ? "active" : ""} ${isSpotlight ? "spotlight" : ""}" style="--accent:${mood.accent}">
        <div class="card-top">
          <div>
            <div class="eyebrow">${escapeHtml(mood.icon.replace("$(", "").replace(")", ""))}</div>
            <h2>${escapeHtml(mood.name)}</h2>
          </div>
          <div class="badges">
            ${isSpotlight ? '<span class="pill spotlight-pill">Focus</span>' : ""}
            ${isActive ? '<span class="pill active-pill">Active</span>' : ""}
            ${isDefault ? '<span class="pill default-pill">Default</span>' : ""}
            ${sessionBadge}
          </div>
        </div>
        <p>${escapeHtml(mood.description)}</p>
        <div class="actions">
          <button data-action="switchMood" data-mood="${escapeHtml(mood.name)}">Switch</button>
          <button data-action="startSession" data-mood="${escapeHtml(mood.name)}">Start</button>
          <button data-action="openResources" data-mood="${escapeHtml(mood.name)}">Resources</button>
        </div>
      </article>
    `;
  }).join("");

  const analyticsList =
    state.weeklyAnalytics.moods.length > 0
      ? state.weeklyAnalytics.moods
          .slice(0, 4)
          .map((entry) => `<li>${escapeHtml(entry.mood)}: ${escapeHtml(formatDuration(entry.durationMs))} across ${entry.sessions} session(s)</li>`)
          .join("")
      : "<li>No completed sessions this week yet.</li>";

  const maxDuration = Math.max(...state.weeklyAnalytics.moods.map((entry) => entry.durationMs), 1);
  const analyticsBars =
    state.weeklyAnalytics.moods.length > 0
      ? state.weeklyAnalytics.moods
          .slice(0, 5)
          .map((entry) => {
            const width = Math.max(12, Math.round((entry.durationMs / maxDuration) * 100));
            return `<div class="bar-row"><span>${escapeHtml(entry.mood)}</span><div class="bar"><div class="bar-fill" style="width:${width}%"></div></div><strong>${escapeHtml(formatDuration(entry.durationMs))}</strong></div>`;
          })
          .join("")
      : "<p>No chart data yet.</p>";

  const ritualList =
    state.nextRitual && state.nextRitual.length > 0
      ? state.nextRitual.map((step) => `<li>${escapeHtml(step)}</li>`).join("")
      : "<li>No ritual configured for the active mood.</li>";

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Mood Switcher</title>
      <style>
        :root { color-scheme: light dark; }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: Georgia, "Iowan Old Style", "Palatino Linotype", serif;
          color: var(--vscode-editor-foreground);
          background:
            radial-gradient(circle at top left, color-mix(in srgb, var(--vscode-textLink-foreground) 18%, transparent), transparent 28%),
            linear-gradient(160deg, var(--vscode-editor-background), color-mix(in srgb, var(--vscode-editor-background) 80%, black));
        }
        .shell { max-width: 1100px; margin: 0 auto; padding: 32px 24px 40px; }
        .hero, .panel {
          display: grid;
          gap: 18px;
          padding: 24px;
          border: 1px solid color-mix(in srgb, var(--vscode-editor-foreground) 14%, transparent);
          border-radius: 24px;
          background: color-mix(in srgb, var(--vscode-editor-background) 86%, white 4%);
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.16);
        }
        .hero { margin-bottom: 28px; }
        .hero h1 { margin: 0; font-size: 42px; line-height: 1; letter-spacing: -0.03em; }
        .hero p { margin: 0; max-width: 720px; color: var(--vscode-descriptionForeground); font-size: 15px; }
        .meta, .detail-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
        .meta-card {
          padding: 12px 14px;
          border-radius: 16px;
          background: color-mix(in srgb, var(--vscode-sideBar-background) 82%, transparent);
          border: 1px solid color-mix(in srgb, var(--vscode-editor-foreground) 12%, transparent);
        }
        .meta-label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--vscode-descriptionForeground); margin-bottom: 4px; }
        .toolbar, .actions { display: flex; flex-wrap: wrap; gap: 10px; }
        .toolbar { margin-bottom: 22px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 20px; }
        .chart { display: grid; gap: 8px; margin-bottom: 14px; }
        .bar-row { display: grid; grid-template-columns: 120px 1fr auto; gap: 10px; align-items: center; }
        .bar { height: 10px; border-radius: 999px; background: color-mix(in srgb, var(--vscode-editor-foreground) 10%, transparent); overflow: hidden; }
        .bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--vscode-textLink-foreground), color-mix(in srgb, var(--vscode-textLink-foreground) 60%, white 10%)); }
        .card {
          overflow: hidden;
          padding: 18px;
          border-radius: 22px;
          border: 1px solid color-mix(in srgb, var(--accent) 36%, var(--vscode-editor-foreground) 10%);
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--accent) 12%, transparent), transparent 36%),
            color-mix(in srgb, var(--vscode-editor-background) 90%, black 4%);
        }
        .card.active { transform: translateY(-2px); border-color: color-mix(in srgb, var(--accent) 70%, white 10%); box-shadow: 0 12px 36px color-mix(in srgb, var(--accent) 28%, transparent); }
        .card.spotlight { outline: 2px solid color-mix(in srgb, var(--accent) 85%, white 8%); outline-offset: 2px; }
        .card-top { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
        .eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: color-mix(in srgb, var(--accent) 70%, var(--vscode-descriptionForeground)); margin-bottom: 6px; }
        h2, h3 { margin: 0; }
        h2 { font-size: 24px; line-height: 1.05; }
        .badges { display: flex; flex-wrap: wrap; justify-content: end; gap: 6px; }
        .pill {
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 11px;
          border: 1px solid color-mix(in srgb, var(--vscode-editor-foreground) 12%, transparent);
          background: color-mix(in srgb, var(--vscode-editor-background) 72%, transparent);
        }
        .active-pill { border-color: color-mix(in srgb, var(--accent) 70%, transparent); }
        .default-pill { border-color: color-mix(in srgb, var(--vscode-textLink-foreground) 60%, transparent); }
        .spotlight-pill { border-color: color-mix(in srgb, var(--accent) 80%, transparent); background: color-mix(in srgb, var(--accent) 18%, transparent); }
        .session { border-color: color-mix(in srgb, var(--vscode-testing-iconPassed) 50%, transparent); }
        .card p, .panel p, li { color: var(--vscode-descriptionForeground); }
        button {
          border: 0;
          border-radius: 999px;
          padding: 10px 14px;
          font: inherit;
          cursor: pointer;
          color: var(--vscode-button-foreground);
          background: color-mix(in srgb, var(--accent, var(--vscode-button-background)) 70%, var(--vscode-button-background));
        }
        button.ghost {
          color: var(--vscode-editor-foreground);
          background: color-mix(in srgb, var(--vscode-editor-background) 72%, transparent);
          border: 1px solid color-mix(in srgb, var(--vscode-editor-foreground) 12%, transparent);
        }
        ul { margin: 0; padding-left: 18px; display: grid; gap: 6px; }
      </style>
    </head>
    <body>
      <main class="shell">
        <section class="hero">
          <div>
            <h1>Mood Switcher</h1>
            <p>Pick a mode, apply its theme, status-bar signal, layout preset, and workflow hooks, then use resources, rituals, and analytics to keep the session intentional.</p>
          </div>
          <div class="meta">
            <div class="meta-card">
              <span class="meta-label">Active Mood</span>
              <strong>${escapeHtml(state.activeMood ?? "Unset")}</strong>
            </div>
            <div class="meta-card">
              <span class="meta-label">Workspace Default</span>
              <strong>${escapeHtml(state.workspaceDefaultMood ?? "None")}</strong>
            </div>
            <div class="meta-card">
              <span class="meta-label">Session</span>
              <span>${escapeHtml(state.session ? getSessionBadge(state.session) : "No active session")}</span>
            </div>
            <div class="meta-card">
              <span class="meta-label">This Week</span>
              <span>${escapeHtml(formatDuration(state.weeklyAnalytics.totalDurationMs))} across ${state.weeklyAnalytics.totalSessions} session(s)</span>
            </div>
          </div>
        </section>
        <section class="toolbar">
          <button data-action="stopSession">Stop Session</button>
          <button class="ghost" data-action="restoreState">Restore State</button>
          <button class="ghost" data-action="clearDefault">Clear Default</button>
          <button class="ghost" data-action="openCommandPalette">Mode Command Palette</button>
          ${state.activeMood ? `<button class="ghost" data-action="openSoundtrack" data-mood="${escapeHtml(state.activeMood)}">Open Soundtrack</button>` : ""}
        </section>
        <section class="grid">${moodCards}</section>
        <section class="detail-grid">
          <section class="panel">
            <h3>Weekly Analytics</h3>
            <div class="chart">${analyticsBars}</div>
            <ul>${analyticsList}</ul>
          </section>
          <section class="panel">
            <h3>Next Ritual</h3>
            <ul>${ritualList}</ul>
          </section>
        </section>
      </main>
      <script>
        const vscode = acquireVsCodeApi();
        document.querySelectorAll("button[data-action]").forEach((button) => {
          button.addEventListener("click", () => {
            vscode.postMessage({
              type: button.dataset.action,
              mood: button.dataset.mood
            });
          });
        });
      </script>
    </body>
  </html>`;
}

function getSessionBadge(session: SessionState): string {
  if (!session.endsAt) {
    return `Session ${formatDuration(Date.now() - session.startedAt)}`;
  }

  const remaining = session.endsAt - Date.now();
  return session.timerCompleted || remaining <= 0
    ? "Timer done"
    : `${formatDuration(remaining)} left`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDuration(durationMs: number): string {
  const clamped = Math.max(durationMs, 0);
  const totalSeconds = Math.floor(clamped / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

class MoodSidebarProvider implements vscode.TreeDataProvider<SidebarNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<SidebarNode | undefined>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  getTreeItem(element: SidebarNode): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.label,
      element.children?.length
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None
    );

    item.id = element.id;
    item.description = element.description;
    item.tooltip = element.tooltip;
    item.iconPath = element.icon;
    item.command = element.command;
    item.contextValue = element.kind;
    return item;
  }

  getChildren(element?: SidebarNode): SidebarNode[] {
    if (element) {
      return element.children ?? [];
    }

    return [
      this.buildStatusSection(),
      this.buildQuickActionsSection(),
      this.buildAnalyticsSection(),
      this.buildMoodsSection(),
      this.buildHelpSection()
    ];
  }

  private buildStatusSection(): SidebarNode {
    const activeMood = getActiveMood(this.context);
    const defaultMood = normalizeStoredMood(this.context.workspaceState.get<unknown>(WORKSPACE_DEFAULT_MOOD_KEY));
    const session = normalizeSessionState(this.context.workspaceState.get<unknown>(SESSION_STATE_KEY));

    return {
      kind: "section",
      id: "status",
      label: "Current State",
      icon: new vscode.ThemeIcon("pulse"),
      children: [
        {
          kind: "status",
          id: "status.activeMood",
          label: activeMood ?? "Mood Unset",
          description: "Active mood",
          tooltip: activeMood ? `Active mood: ${activeMood}` : "No active mood set yet.",
          icon: new vscode.ThemeIcon(activeMood ? "paintcan" : "circle-large-outline")
        },
        {
          kind: "status",
          id: "status.defaultMood",
          label: defaultMood ?? "No Default",
          description: "Workspace default",
          tooltip: defaultMood ? `Workspace default mood: ${defaultMood}` : "No workspace default mood set.",
          icon: new vscode.ThemeIcon("pin")
        },
        {
          kind: "status",
          id: "status.session",
          label: session ? getSessionBadge(session) : "No Active Session",
          description: session?.mood ?? "Session timer",
          tooltip: session ? `Current ${session.mood} session` : "No active session running.",
          icon: new vscode.ThemeIcon(session ? "watch" : "debug-pause")
        }
      ]
    };
  }

  private buildQuickActionsSection(): SidebarNode {
    return {
      kind: "section",
      id: "actions",
      label: "Quick Actions",
      icon: new vscode.ThemeIcon("rocket"),
      children: [
        actionNode("action.dashboard", "Open Dashboard", "Visual control panel", "dashboard", "moodSwitcher.openDashboard"),
        actionNode("action.pick", "Pick Mood", "Command palette picker", "list-selection", "moodSwitcher.selectMode"),
        actionNode("action.modePalette", "Open Mode Command Palette", "Open suggested commands for the active mood", "terminal-cmd", "moodSwitcher.openModeCommandPalette"),
        actionNode("action.runSuggested", "Run Suggested Command", "Pick and run one recommended command for the active mood", "wand", "moodSwitcher.runSuggestedCommand"),
        actionNode("action.start", "Start Session", "Start timing the current mood", "play", "moodSwitcher.startSession"),
        actionNode("action.stop", "Stop Session", "Stop the current timer and restore the previous state", "debug-stop", "moodSwitcher.stopSession"),
        actionNode("action.break", "Start Break Cycle", "Start the configured break timer for the current mood", "watch", "moodSwitcher.startBreakCycle"),
        actionNode("action.soundtrack", "Open Mode Soundtrack", "Open the soundtrack or playlist for the current mood", "music", "moodSwitcher.openModeSoundtrack"),
        actionNode("action.restore", "Restore Original Workspace State", "Roll back to the pre-mood theme and managed layout settings", "history", "moodSwitcher.restoreOriginalWorkspaceState"),
        actionNode("action.reset", "Reset Workspace To User Settings", "Clear workspace mood overrides and fall back to normal user settings", "discard", "moodSwitcher.resetWorkspaceToUserSettings"),
        actionNode("action.resources", "Open Mode Resources", "Jump to the files for this mood", "files", "moodSwitcher.openModeResources"),
        actionNode("action.memory", "Open Ranked Memory Docs", "Open the best matching memory docs for the current mood", "book", "moodSwitcher.openRankedMemoryDocs"),
        actionNode("action.ritual", "Show Mode Ritual", "Review the ritual for the current mood without starting a session", "checklist", "moodSwitcher.showModeRitual"),
        actionNode("action.default", "Set Workspace Default", "Persist a default mood for this project", "pin", "moodSwitcher.setWorkspaceDefaultMode"),
        actionNode("action.clearDefault", "Clear Workspace Default", "Remove the saved workspace default", "pinned-dirty", "moodSwitcher.clearWorkspaceDefaultMode"),
        actionNode("action.exportHistory", "Export Session History", "Save completed sessions as JSON", "export", "moodSwitcher.exportSessionHistory"),
        actionNode("action.importHistory", "Import Session History", "Import session history from JSON", "cloud-download", "moodSwitcher.importSessionHistory"),
        actionNode("action.validateCommands", "Validate Mode Commands", "Check configured modeCommands for invalid command IDs", "checklist", "moodSwitcher.validateModeCommands")
      ]
    };
  }

  private buildAnalyticsSection(): SidebarNode {
    const analytics = calculateWeeklyAnalytics(getSessionHistory(this.context));

    return {
      kind: "section",
      id: "analytics",
      label: "Weekly Analytics",
      icon: new vscode.ThemeIcon("graph"),
      children: [
        {
          kind: "analytics",
          id: "analytics.total",
          label: formatDuration(analytics.totalDurationMs),
          description: `${analytics.totalSessions} session(s)`,
          tooltip: "Completed session time in the last 7 days",
          icon: new vscode.ThemeIcon("clock")
        },
        ...analytics.moods.slice(0, 3).map((entry) => ({
          kind: "analytics" as const,
          id: `analytics.${entry.mood}`,
          label: entry.mood,
          description: `${formatDuration(entry.durationMs)} • ${entry.sessions} session(s)`,
          tooltip: `Weekly total for ${entry.mood}`,
          icon: themeIconForMood(entry.mood)
        }))
      ]
    };
  }

  private buildMoodsSection(): SidebarNode {
    const activeMood = getActiveMood(this.context);
    const defaultMood = normalizeStoredMood(this.context.workspaceState.get<unknown>(WORKSPACE_DEFAULT_MOOD_KEY));
    const session = normalizeSessionState(this.context.workspaceState.get<unknown>(SESSION_STATE_KEY));

    return {
      kind: "section",
      id: "moods",
      label: "Modes",
      icon: new vscode.ThemeIcon("symbol-color"),
      children: MOODS.map((mood) => ({
        kind: "mood",
        id: `mood.${mood.name}`,
        label: mood.name,
        description: [
          activeMood === mood.name ? "active" : undefined,
          defaultMood === mood.name ? "default" : undefined,
          session?.mood === mood.name ? getSessionBadge(session) : undefined
        ].filter(Boolean).join(" • "),
        tooltip: mood.description,
        icon: themeIconForMood(mood.name),
        mood: mood.name,
        command: {
          command: "moodSwitcher.activateSpecificMode",
          title: `Activate ${mood.name}`,
          arguments: [mood.name]
        }
      }))
    };
  }

  private buildHelpSection(): SidebarNode {
    return {
      kind: "section",
      id: "help",
      label: "Help",
      icon: new vscode.ThemeIcon("book"),
      children: [
        actionNode("help.docs", "Open Docs", "Open the extension README", "book", "moodSwitcher.openDocs"),
        actionNode("help.exportHistory", "Export Session History", "Save completed sessions as JSON", "export", "moodSwitcher.exportSessionHistory")
      ]
    };
  }
}

function actionNode(
  id: string,
  label: string,
  description: string,
  iconId: string,
  commandId: string
): SidebarNode {
  return {
    kind: "action",
    id,
    label,
    description,
    tooltip: description,
    icon: new vscode.ThemeIcon(iconId),
    command: {
      command: commandId,
      title: label
    }
  };
}

function themeIconForMood(mood: MoodName): vscode.ThemeIcon {
  switch (mood) {
    case "Deep Work":
      return new vscode.ThemeIcon("flame");
    case "Debugging Hell":
      return new vscode.ThemeIcon("bug");
    case "Writing Lodge":
      return new vscode.ThemeIcon("book");
    case "Arcade Mode":
      return new vscode.ThemeIcon("game");
    case "Soft Focus":
      return new vscode.ThemeIcon("symbol-color");
    case "Night Drive":
      return new vscode.ThemeIcon("zap");
    case "Ship It":
      return new vscode.ThemeIcon("rocket");
  }
}

function normalizeMoodInput(input: MoodName | SidebarNode | undefined): MoodName | undefined {
  if (isMoodName(input)) {
    return input;
  }

  if (!input || typeof input !== "object") {
    return undefined;
  }

  for (const candidate of [input.mood, input.label, input.description]) {
    if (isMoodName(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function normalizeStoredMood(value: unknown): MoodName | undefined {
  return isMoodName(value) ? value : undefined;
}

function normalizeSessionState(value: unknown): SessionState | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const session = value as Partial<SessionState>;
  if (!isMoodName(session.mood) || typeof session.startedAt !== "number") {
    return undefined;
  }

  return {
    mood: session.mood,
    startedAt: session.startedAt,
    endsAt: typeof session.endsAt === "number" ? session.endsAt : undefined,
    timerCompleted: session.timerCompleted === true
  };
}

function isMoodName(value: unknown): value is MoodName {
  return typeof value === "string" && MOOD_NAMES.has(value as MoodName);
}

function getModeSettings(mood: MoodName): Record<string, unknown> {
  return getConfiguration<MoodSettingsMap>("modeSettings")[mood] ?? {};
}

function getModeTimer(mood: MoodName): MoodTimerConfig {
  return getConfiguration<MoodTimerMap>("modeTimers")[mood] ?? {};
}

function getModeRitual(mood: MoodName): string[] {
  return getConfiguration<MoodRitualMap>("modeRituals")[mood] ?? [];
}

function getModeSoundtrack(mood: MoodName): ModeSoundtrack {
  return getConfiguration<MoodSoundtrackMap>("modeSoundtracks")[mood] ?? {};
}

function getModeTimerCycle(mood: MoodName): TimerCycleConfig {
  return getConfiguration<MoodTimerCycleMap>("modeTimerCycles")[mood] ?? {};
}

function getModeGlobs(mood: MoodName): string[] {
  return getConfiguration<Record<string, string[]>>("modeResourceGlobs")[mood] ?? [];
}

function getModeMemoryFiles(mood: MoodName): string[] {
  return getConfiguration<Record<string, string[]>>("modeMemoryFiles")[mood] ?? [];
}

function getModeMemoryKeywords(mood: MoodName): string[] {
  return getConfiguration<MoodKeywordMap>("modeMemoryKeywords")[mood] ?? [];
}

function getModeMemoryProfile(mood: MoodName): MemoryProfile {
  return getConfiguration<MoodMemoryProfileMap>("modeMemoryProfiles")[mood] ?? {};
}

function getModeSuggestedCommands(mood: MoodName): SuggestedCommandSpec[] {
  return getConfiguration<MoodSuggestedCommandMap>("modeSuggestedCommands")[mood] ?? [];
}

function getSessionHistory(context: vscode.ExtensionContext): SessionRecord[] {
  const value = context.globalState.get<unknown>(SESSION_HISTORY_KEY);
  return normalizeSessionHistory(value);
}

function calculateWeeklyAnalytics(history: SessionRecord[]): WeeklyAnalytics {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = history.filter((record) => record.endedAt >= cutoff);
  const totals = new Map<MoodName, WeeklyMoodStat>();

  for (const record of recent) {
    const current = totals.get(record.mood) ?? {
      mood: record.mood,
      durationMs: 0,
      sessions: 0
    };

    current.durationMs += record.durationMs;
    current.sessions += 1;
    totals.set(record.mood, current);
  }

  const moods = Array.from(totals.values()).sort((left, right) => right.durationMs - left.durationMs);
  const totalDurationMs = moods.reduce((sum, entry) => sum + entry.durationMs, 0);

  return {
    totalDurationMs,
    totalSessions: recent.length,
    moods
  };
}

function getSettingSnapshot(settingPath: string): SettingSnapshot {
  const [section, ...rest] = settingPath.split(".");
  if (!section || rest.length === 0) {
    return { scope: "unknown", value: undefined };
  }

  const key = rest.join(".");
  const configuration = vscode.workspace.getConfiguration(section);
  const inspection = configuration.inspect(key);

  if (!inspection) {
    return { scope: "unknown", value: configuration.get(key) };
  }

  if (inspection.workspaceFolderValue !== undefined) {
    return { scope: "workspace folder", value: inspection.workspaceFolderValue };
  }

  if (inspection.workspaceValue !== undefined) {
    return { scope: "workspace", value: inspection.workspaceValue };
  }

  if (inspection.globalValue !== undefined) {
    return { scope: "user", value: inspection.globalValue };
  }

  return { scope: "default", value: inspection.defaultValue };
}

async function ensureRestoreSnapshot(context: vscode.ExtensionContext): Promise<void> {
  const existing = normalizeRestoreSnapshot(context.workspaceState.get<unknown>(RESTORE_SNAPSHOT_KEY));
  if (existing) {
    return;
  }

  const snapshot: RestoreSnapshot = {};
  for (const settingPath of getManagedSettingPaths()) {
    snapshot[settingPath] = getSettingSnapshot(settingPath);
  }

  await context.workspaceState.update(RESTORE_SNAPSHOT_KEY, snapshot);
}

async function restoreOriginalWorkspaceState(context: vscode.ExtensionContext, notify: boolean): Promise<void> {
  const snapshot = normalizeRestoreSnapshot(context.workspaceState.get<unknown>(RESTORE_SNAPSHOT_KEY));
  if (!snapshot) {
    if (notify) {
      vscode.window.showInformationMessage("No original workspace state snapshot is available to restore.");
    }
    return;
  }

  for (const [settingPath, original] of Object.entries(snapshot)) {
    await restoreWorkspaceSetting(settingPath, original);
  }

  await context.workspaceState.update(RESTORE_SNAPSHOT_KEY, undefined);
  await context.workspaceState.update(ACTIVE_MOOD_KEY, undefined);
  dashboardSpotlightMood = undefined;
  updateUI(context);

  if (notify) {
    vscode.window.showInformationMessage("Restored the original workspace theme, colors, and managed layout settings.");
  }
}

async function resetWorkspaceToUserSettings(context: vscode.ExtensionContext, notify: boolean): Promise<void> {
  for (const settingPath of getManagedSettingPaths()) {
    await clearWorkspaceSetting(settingPath);
  }

  await context.workspaceState.update(RESTORE_SNAPSHOT_KEY, undefined);
  await context.workspaceState.update(ACTIVE_MOOD_KEY, undefined);
  await context.workspaceState.update(WORKSPACE_DEFAULT_MOOD_KEY, undefined);
  await context.workspaceState.update(SESSION_STATE_KEY, undefined);

  if (sessionTimer) {
    clearInterval(sessionTimer);
    sessionTimer = undefined;
  }

  dashboardSpotlightMood = undefined;
  updateUI(context);

  if (notify) {
    vscode.window.showInformationMessage(
      "Cleared workspace mood overrides. This workspace will now fall back to your normal user/default settings."
    );
  }
}

async function restoreWorkspaceSetting(settingPath: string, snapshot: SettingSnapshot): Promise<void> {
  const [section, ...rest] = settingPath.split(".");
  if (!section || rest.length === 0) {
    return;
  }

  const workspaceValue = snapshot.scope === "workspace" ? snapshot.value : undefined;
  await vscode.workspace.getConfiguration(section).update(
    rest.join("."),
    workspaceValue,
    vscode.ConfigurationTarget.Workspace
  );
}

async function clearWorkspaceSetting(settingPath: string): Promise<void> {
  const [section, ...rest] = settingPath.split(".");
  if (!section || rest.length === 0) {
    return;
  }

  await vscode.workspace.getConfiguration(section).update(
    rest.join("."),
    undefined,
    vscode.ConfigurationTarget.Workspace
  );
}

function getManagedSettingPaths(): string[] {
  const settings = getConfiguration<MoodSettingsMap>("modeSettings");
  const keys = new Set<string>(["workbench.colorTheme", "workbench.colorCustomizations"]);

  for (const moodSettings of Object.values(settings)) {
    for (const settingPath of Object.keys(moodSettings)) {
      keys.add(settingPath);
    }
  }

  return Array.from(keys);
}

async function recordCompletedSession(
  context: vscode.ExtensionContext,
  session: SessionState,
  endedAt: number
): Promise<void> {
  const history = getSessionHistory(context);
  const limit = Math.max(
    1,
    getConfiguration<number>("sessionHistoryLimit") || SESSION_HISTORY_FALLBACK_LIMIT
  );

  const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name ?? "workspace";
  const record: SessionRecord = {
    mood: session.mood,
    startedAt: session.startedAt,
    endedAt,
    durationMs: Math.max(endedAt - session.startedAt, 0),
    workspaceName
  };

  const updated = [record, ...history].slice(0, limit);
  await context.globalState.update(SESSION_HISTORY_KEY, updated);
}

async function maybeOfferTimerCycle(context: vscode.ExtensionContext, mood: MoodName): Promise<void> {
  const cycle = getModeTimerCycle(mood);
  if (!cycle.breakMinutes) {
    return;
  }

  const action = await vscode.window.showInformationMessage(
    `${mood} session complete. Start a ${cycle.breakMinutes}-minute break?`,
    ...(cycle.offerNextFocusBlock
      ? ["Start Break", "Start Next Focus Block", "End Session"]
      : ["Start Break", "End Session"])
  );

  if (action === "Start Break") {
    await startBreakCycle(context, mood, false);
  } else if (action === "Start Next Focus Block") {
    await startSessionFlow(context, mood);
  } else if (action === "End Session") {
    void vscode.window.showInformationMessage(`${mood} session fully ended.`);
  }
}

async function openModeCommandPalette(context: vscode.ExtensionContext): Promise<void> {
  const mood = getActiveMood(context) ?? (await pickMood());
  if (!mood) {
    return;
  }

  const selected = await pickSuggestedCommand(context, mood, {
    placeHolder: `${mood} command palette`
  });
  if (!selected?.command) {
    return;
  }

  await executeSuggestedCommand(selected);
}

async function runSuggestedCommandFlow(
  context: vscode.ExtensionContext,
  input?: SuggestedCommandSpec
): Promise<void> {
  const mood = getActiveMood(context) ?? (await pickMood());
  if (!mood) {
    return;
  }

  if (input?.command) {
    await executeSuggestedCommand(input);
    return;
  }

  const selected = await pickSuggestedCommand(context, mood, {
    placeHolder: `Run one suggested command for ${mood}`
  });
  if (!selected?.command) {
    return;
  }

  await executeSuggestedCommand(selected);
}

async function pickSuggestedCommand(
  context: vscode.ExtensionContext,
  mood: MoodName,
  options?: { placeHolder?: string }
): Promise<SuggestedCommandSpec | undefined> {
  const suggestions = getPolishedSuggestedCommands(context, mood);
  if (suggestions.length === 0) {
    vscode.window.showInformationMessage(`No suggested commands are configured for ${mood}.`);
    return;
  }

  const grouped = new Map<string, SuggestedCommandSpec[]>();
  for (const suggestion of suggestions) {
    const group = suggestion.group ?? "Suggested";
    const current = grouped.get(group) ?? [];
    current.push(suggestion);
    grouped.set(group, current);
  }

  const items: SuggestedCommandQuickPickItem[] = [];
  for (const [group, groupItems] of grouped.entries()) {
    items.push({ label: group, kind: vscode.QuickPickItemKind.Separator });
    for (const item of groupItems) {
      items.push({
        label: item.label,
        description: item.description,
        detail: item.command,
        command: item.command,
        args: item.args,
        suggestion: item
      });
    }
  }

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: options?.placeHolder ?? `${mood} command palette`,
    matchOnDescription: true,
    matchOnDetail: true
  });

  return selected?.suggestion;
}

async function executeSuggestedCommand(suggestion: SuggestedCommandSpec): Promise<void> {
  try {
    await vscode.commands.executeCommand(suggestion.command, ...(suggestion.args ?? []));
  } catch {
    vscode.window.showWarningMessage(`Could not execute ${suggestion.command}.`);
  }
}

function getPolishedSuggestedCommands(
  context: vscode.ExtensionContext,
  mood: MoodName
): SuggestedCommandSpec[] {
  const configured = getModeSuggestedCommands(mood);
  const activeMood = getActiveMood(context);
  const suggestions: SuggestedCommandSpec[] = [...configured];
  const existing = new Set(suggestions.map((entry) => `${entry.command}:${JSON.stringify(entry.args ?? [])}`));

  const addIfMissing = (entry: SuggestedCommandSpec): void => {
    const key = `${entry.command}:${JSON.stringify(entry.args ?? [])}`;
    if (!existing.has(key)) {
      suggestions.push(entry);
      existing.add(key);
    }
  };

  addIfMissing({
    group: "Mood Switcher",
    label: "Open Mode Resources",
    description: "Open the files and docs tied to this mood",
    command: "moodSwitcher.openModeResources"
  });

  addIfMissing({
    group: "Mood Switcher",
    label: "Preview Mode Preset",
    description: "See current values versus this mood preset",
    command: "moodSwitcher.previewModePreset",
    args: [mood]
  });

  addIfMissing({
    group: "Mood Switcher",
    label: "Open Dashboard For Mood",
    description: "Jump to the dashboard with this mood highlighted",
    command: "moodSwitcher.openDashboardForMode",
    args: [mood]
  });

  addIfMissing({
    group: "Mood Switcher",
    label: "Open Mode Soundtrack",
    description: "Open music or playlist links for this mood",
    command: "moodSwitcher.openModeSoundtrack"
  });

  if (activeMood === mood) {
    addIfMissing({
      group: "Session",
      label: "Start Session",
      description: "Begin a timed session for the active mood",
      command: "moodSwitcher.startSession",
      whenMoodActive: true
    });

    addIfMissing({
      group: "Session",
      label: "Stop Session",
      description: "End the active session and restore the workspace state",
      command: "moodSwitcher.stopSession",
      whenMoodActive: true
    });

    if (getModeTimerCycle(mood).breakMinutes) {
      addIfMissing({
        group: "Session",
        label: "Start Break Cycle",
        description: "Run the configured break timer for this mood",
        command: "moodSwitcher.startBreakCycle",
        whenMoodActive: true
      });
    }
  }

  return suggestions.sort((left, right) => {
    const leftGroup = left.group ?? "Suggested";
    const rightGroup = right.group ?? "Suggested";
    const groupCompare = leftGroup.localeCompare(rightGroup);
    if (groupCompare !== 0) {
      return groupCompare;
    }

    return left.label.localeCompare(right.label);
  });
}

async function startBreakCycle(
  context: vscode.ExtensionContext,
  mood: MoodName,
  notifyMissing: boolean
): Promise<void> {
  const cycle = getModeTimerCycle(mood);
  if (!cycle.breakMinutes) {
    if (notifyMissing) {
      vscode.window.showInformationMessage(`No break cycle is configured for ${mood}.`);
    }
    return;
  }

  vscode.window.showInformationMessage(`${mood} break started for ${cycle.breakMinutes} minute(s).`);
  const breakEndsAt = Date.now() + cycle.breakMinutes * 60 * 1000;
  const interval = setInterval(() => {
    if (Date.now() >= breakEndsAt) {
      clearInterval(interval);
      void vscode.window.showInformationMessage(
        `${mood} break complete.`,
        ...(cycle.offerNextFocusBlock ? ["Start Next Focus Block", "Done"] : ["Done"])
      ).then(async (action) => {
        if (action === "Start Next Focus Block") {
          await startSessionFlow(context, mood);
        }
      });
    }
  }, 1000);
}

async function openModeSoundtrack(mood: MoodName): Promise<void> {
  const soundtrack = getModeSoundtrack(mood);
  const options = [
    soundtrack.spotifyUrl
      ? {
          label: "Open in Spotify",
          description: soundtrack.label ?? "Spotify search or playlist",
          url: soundtrack.spotifyUrl
        }
      : undefined,
    soundtrack.youtubeUrl
      ? {
          label: "Open in YouTube",
          description: soundtrack.label ?? "YouTube search or playlist",
          url: soundtrack.youtubeUrl
        }
      : undefined,
    soundtrack.customUrl
      ? {
          label: "Open Custom Playlist",
          description: soundtrack.label ?? "Custom playlist link",
          url: soundtrack.customUrl
        }
      : undefined,
    soundtrack.url
      ? {
          label: "Open Legacy Link",
          description: soundtrack.label ?? "Legacy soundtrack URL",
          url: soundtrack.url
        }
      : undefined
  ].filter((option): option is { label: string; description: string; url: string } => Boolean(option));

  if (options.length === 0) {
    vscode.window.showInformationMessage(`No soundtrack is configured for ${mood}.`);
    return;
  }

  const selected =
    options.length === 1
      ? options[0]
      : await vscode.window.showQuickPick(options, {
          placeHolder: `Choose a soundtrack source for ${mood}`
        });

  if (!selected) {
    return;
  }

  await vscode.env.openExternal(vscode.Uri.parse(selected.url));
}

async function openRankedMemoryDocs(mood: MoodName): Promise<void> {
  const ranked = await resolveModeMemoryUris(mood);
  if (ranked.length === 0) {
    vscode.window.showInformationMessage(`No ranked memory docs were found for ${mood}.`);
    return;
  }

  for (const uri of ranked.slice(0, 4)) {
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });
  }
}

async function showModeRitual(mood: MoodName): Promise<void> {
  const ritual = getModeRitual(mood);
  if (ritual.length === 0) {
    vscode.window.showInformationMessage(`No ritual is configured for ${mood}.`);
    return;
  }

  await vscode.window.showInformationMessage(
    `${mood} ritual:\n${ritual.map((step, index) => `${index + 1}. ${step}`).join("\n")}`,
    { modal: true }
  );
}

async function exportSessionHistory(context: vscode.ExtensionContext): Promise<void> {
  const suggestedBase = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
  const target = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(`${suggestedBase}/mood-session-history.json`),
    filters: { JSON: ["json"] }
  });

  if (!target) {
    return;
  }

  const history = getSessionHistory(context);
  await vscode.workspace.fs.writeFile(target, Buffer.from(JSON.stringify(history, null, 2), "utf8"));
  vscode.window.showInformationMessage(`Exported ${history.length} session record(s).`);
}

async function importSessionHistory(context: vscode.ExtensionContext): Promise<void> {
  const picked = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: { JSON: ["json"] }
  });

  const source = picked?.[0];
  if (!source) {
    return;
  }

  const buffer = await vscode.workspace.fs.readFile(source);
  const imported = normalizeSessionHistory(JSON.parse(Buffer.from(buffer).toString("utf8")));
  const limit = Math.max(1, getConfiguration<number>("sessionHistoryLimit") || SESSION_HISTORY_FALLBACK_LIMIT);
  await context.globalState.update(SESSION_HISTORY_KEY, imported.slice(0, limit));
  updateUI(context);
  vscode.window.showInformationMessage(`Imported ${imported.length} session record(s).`);
}

async function validateConfiguredCommands(): Promise<void> {
  const registered = new Set(await vscode.commands.getCommands(true));
  const configured = getConfiguration<MoodCommandMap>("modeCommands");
  const invalid: string[] = [];

  for (const [mood, hooks] of Object.entries(configured)) {
    for (const hook of ["onActivate", "onStartSession", "onStopSession"] as CommandHook[]) {
      for (const spec of hooks?.[hook] ?? []) {
        if (spec.command && !registered.has(spec.command)) {
          invalid.push(`${mood}.${hook}: ${spec.command}`);
        }
      }
    }
  }

  if (invalid.length === 0) {
    vscode.window.showInformationMessage("All configured modeCommands resolved to registered VS Code commands.");
    return;
  }

  const action = await vscode.window.showWarningMessage(
    `Mood Switcher found ${invalid.length} invalid configured command(s).`,
    "Copy Report"
  );

  if (action === "Copy Report") {
    await vscode.env.clipboard.writeText(invalid.join("\n"));
  }
}

function buildMoodExport(mood: MoodName): string {
  const payload = {
    mood,
    theme: getConfiguration<Record<string, string>>("modeThemes")[mood] ?? null,
    colorCustomizations: getConfiguration<MoodColorMap>("modeColorCustomizations")[mood] ?? {},
    settings: getModeSettings(mood),
    commands: getConfiguration<MoodCommandMap>("modeCommands")[mood] ?? {},
    timer: getModeTimer(mood),
    timerCycle: getModeTimerCycle(mood),
    ritual: getModeRitual(mood),
    soundtrack: getModeSoundtrack(mood),
    resourceGlobs: getModeGlobs(mood),
    memoryFiles: getModeMemoryFiles(mood),
    memoryKeywords: getModeMemoryKeywords(mood),
    memoryProfile: getModeMemoryProfile(mood)
  };

  return JSON.stringify(payload, null, 2);
}

function formatDiffValue(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }

  if (typeof value === "string") {
    return `"${value}"`;
  }

  return JSON.stringify(value);
}

function areValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeRestoreSnapshot(value: unknown): RestoreSnapshot | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const snapshot: RestoreSnapshot = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") {
      return undefined;
    }

    const candidate = entry as Partial<SettingSnapshot>;
    if (typeof candidate.scope !== "string") {
      return undefined;
    }

    snapshot[key] = {
      scope: candidate.scope,
      value: candidate.value
    };
  }

  return snapshot;
}

function normalizeSessionHistory(value: unknown): SessionRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const record = entry as Partial<SessionRecord>;
    if (
      !isMoodName(record.mood) ||
      typeof record.startedAt !== "number" ||
      typeof record.endedAt !== "number" ||
      typeof record.durationMs !== "number" ||
      typeof record.workspaceName !== "string"
    ) {
      return [];
    }

    return [{
      mood: record.mood,
      startedAt: record.startedAt,
      endedAt: record.endedAt,
      durationMs: record.durationMs,
      workspaceName: record.workspaceName
    }];
  });
}

function scoreMemoryUri(uri: vscode.Uri, mood: MoodName): number {
  const fsPath = uri.fsPath.toLowerCase();
  const keywords = getModeMemoryKeywords(mood).map((keyword) => keyword.toLowerCase());
  const profile = getModeMemoryProfile(mood);
  let score = 0;

  for (const keyword of keywords) {
    if (fsPath.includes(keyword)) {
      score += 4;
    }
  }

  for (const directory of profile.preferredDirectories ?? []) {
    const normalized = directory.toLowerCase();
    if (fsPath.includes(`/${normalized}/`) || fsPath.includes(`\\${normalized}\\`)) {
      score += 5;
    }
  }

  for (const boost of profile.boostFilenames ?? []) {
    if (fsPath.includes(boost.toLowerCase())) {
      score += 6;
    }
  }

  if (fsPath.endsWith(".md")) {
    score += 1;
  }

  return score;
}
