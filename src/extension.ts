import * as vscode from "vscode";

type MoodName =
  | "Deep Work"
  | "Debugging Hell"
  | "Writing Lodge"
  | "Arcade Mode"
  | "Soft Focus"
  | "Night Drive"
  | "Ship It";

interface MoodDefinition {
  name: MoodName;
  icon: string;
  description: string;
  accent: string;
}

interface SessionState {
  mood: MoodName;
  startedAt: number;
}

interface DashboardState {
  activeMood?: MoodName;
  workspaceDefaultMood?: MoodName;
  session?: SessionState;
  moods: MoodDefinition[];
  spotlightMood?: MoodName;
}

type MoodSettingsMap = Record<string, Record<string, unknown>>;
type SidebarNodeKind = "section" | "action" | "mood" | "status";

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

type RestoreSnapshot = Record<string, SettingSnapshot>;

const ACTIVE_MOOD_KEY = "moodSwitcher.activeMood";
const WORKSPACE_DEFAULT_MOOD_KEY = "moodSwitcher.workspaceDefaultMood";
const SESSION_STATE_KEY = "moodSwitcher.session";
const RESTORE_SNAPSHOT_KEY = "moodSwitcher.restoreSnapshot";
const DASHBOARD_VIEW_TYPE = "moodSwitcher.dashboard";

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
let sessionTimer: NodeJS.Timeout | undefined;
let dashboardPanel: vscode.WebviewPanel | undefined;
let sidebarProvider: MoodSidebarProvider | undefined;
let dashboardSpotlightMood: MoodName | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = "moodSwitcher.openDashboard";
  context.subscriptions.push(statusBarItem);

  sidebarProvider = new MoodSidebarProvider(context);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("moodSwitcher.sidebar", sidebarProvider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("moodSwitcher.openDashboard", async () => {
      openDashboard(context);
    }),
    vscode.commands.registerCommand("moodSwitcher.openDocs", async () => {
      await openDocs(context);
    }),
    vscode.commands.registerCommand("moodSwitcher.activateSpecificMode", async (input: MoodName | SidebarNode) => {
      const mood = normalizeMoodInput(input);
      if (!mood) {
        return;
      }

      await applyMood(context, mood, { promptForSession: true });
    }),
    vscode.commands.registerCommand("moodSwitcher.setSpecificModeAsDefault", async (input: MoodName | SidebarNode) => {
      const mood = normalizeMoodInput(input);
      if (!mood) {
        return;
      }

      await context.workspaceState.update(WORKSPACE_DEFAULT_MOOD_KEY, mood);
      refreshViews();
      updateDashboard(context);
      vscode.window.showInformationMessage(`Mood Switcher default for this workspace set to ${mood}.`);
    }),
    vscode.commands.registerCommand("moodSwitcher.openSpecificModeResources", async (input: MoodName | SidebarNode) => {
      const mood = normalizeMoodInput(input);
      if (!mood) {
        return;
      }

      await openModeResources(mood);
    }),
    vscode.commands.registerCommand("moodSwitcher.startSpecificModeSession", async (input: MoodName | SidebarNode) => {
      const mood = normalizeMoodInput(input);
      if (!mood) {
        return;
      }

      if (getActiveMood(context) !== mood) {
        await applyMood(context, mood);
      }

      await startSession(context, mood);
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

      const exportText = buildMoodExport(mood);
      await vscode.env.clipboard.writeText(exportText);
      vscode.window.showInformationMessage(`Copied ${mood} settings to the clipboard.`);
    }),
    vscode.commands.registerCommand("moodSwitcher.previewModePreset", async (input: MoodName | SidebarNode) => {
      const mood = normalizeMoodInput(input);
      if (!mood) {
        return;
      }

      await previewModePreset(context, mood);
    }),
    vscode.commands.registerCommand("moodSwitcher.restoreOriginalWorkspaceState", async () => {
      await restoreOriginalWorkspaceState(context, true);
    }),
    vscode.commands.registerCommand("moodSwitcher.resetWorkspaceToUserSettings", async () => {
      await resetWorkspaceToUserSettings(context, true);
    }),
    vscode.commands.registerCommand("moodSwitcher.selectMode", async () => {
      const selected = await pickMood();
      if (selected) {
        await applyMood(context, selected, { promptForSession: true });
      }
    }),
    vscode.commands.registerCommand("moodSwitcher.startSession", async () => {
      const mood = getActiveMood(context) ?? (await pickMood());
      if (!mood) {
        return;
      }

      if (getActiveMood(context) !== mood) {
        await applyMood(context, mood);
      }

      await startSession(context, mood);
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
      refreshViews();
      updateDashboard(context);
      vscode.window.showInformationMessage(`Mood Switcher default for this workspace set to ${mood}.`);
    }),
    vscode.commands.registerCommand("moodSwitcher.clearWorkspaceDefaultMode", async () => {
      await context.workspaceState.update(WORKSPACE_DEFAULT_MOOD_KEY, undefined);
      refreshViews();
      updateDashboard(context);
      vscode.window.showInformationMessage("Mood Switcher workspace default cleared.");
    }),
    vscode.commands.registerCommand("moodSwitcher.openModeResources", async () => {
      const mood = getActiveMood(context) ?? (await pickMood());
      if (!mood) {
        return;
      }

      await openModeResources(mood);
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

  updateStatusBar(context);
  refreshViews();
}

export async function deactivate(): Promise<void> {
  if (sessionTimer) {
    clearInterval(sessionTimer);
  }
}

async function pickMood(): Promise<MoodName | undefined> {
  const choice = await vscode.window.showQuickPick(
    MOODS.map((mood) => ({
      label: `${mood.icon} ${mood.name}`,
      description: mood.description,
      mood: mood.name
    })),
    {
      placeHolder: "Choose the workspace mood"
    }
  );

  return choice?.mood;
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
  await maybeApplyPreset(mood);
  updateStatusBar(context);
  updateDashboard(context);
  refreshViews();

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
    } else if (action === "Open resources") {
      await openModeResources(mood);
    }
  }
}

async function maybeApplyTheme(mood: MoodName): Promise<void> {
  if (!getConfiguration<boolean>("enableThemeSwitching")) {
    return;
  }

  const themes = getConfiguration<Record<string, string>>("modeThemes");
  const themeName = themes[mood];
  if (!themeName) {
    return;
  }

  await vscode.workspace.getConfiguration("workbench").update(
    "colorTheme",
    themeName,
    vscode.ConfigurationTarget.Workspace
  );
}

async function maybeApplyPreset(mood: MoodName): Promise<void> {
  if (!getConfiguration<boolean>("enableModePresets")) {
    return;
  }

  const modeSettings = getConfiguration<MoodSettingsMap>("modeSettings");
  const settings = modeSettings[mood];

  if (!settings) {
    return;
  }

  const failedSettings: string[] = [];
  for (const [settingPath, value] of Object.entries(settings)) {
    try {
      await updateWorkspaceSetting(settingPath, value);
    } catch {
      failedSettings.push(settingPath);
    }
  }

  if (failedSettings.length > 0) {
    vscode.window.showWarningMessage(
      `Mood Switcher skipped ${failedSettings.length} invalid or unsupported setting(s) for ${mood}: ${failedSettings.join(", ")}.`
    );
  }
}

async function updateWorkspaceSetting(settingPath: string, value: unknown): Promise<void> {
  const [section, ...rest] = settingPath.split(".");
  if (!section || rest.length === 0) {
    return;
  }

  const key = rest.join(".");
  await vscode.workspace.getConfiguration(section).update(
    key,
    value,
    vscode.ConfigurationTarget.Workspace
  );
}

async function startSession(context: vscode.ExtensionContext, mood: MoodName): Promise<void> {
  const session: SessionState = {
    mood,
    startedAt: Date.now()
  };

  await context.workspaceState.update(SESSION_STATE_KEY, session);
  resumeSessionTimer(context, session);
  updateStatusBar(context);
  updateDashboard(context);
  refreshViews();
  vscode.window.showInformationMessage(`Started ${mood} session.`);
}

async function stopSession(context: vscode.ExtensionContext, notify: boolean): Promise<void> {
  const session = normalizeSessionState(context.workspaceState.get<unknown>(SESSION_STATE_KEY));
  await context.workspaceState.update(SESSION_STATE_KEY, undefined);

  if (sessionTimer) {
    clearInterval(sessionTimer);
    sessionTimer = undefined;
  }

  updateStatusBar(context);
  updateDashboard(context);
  refreshViews();

  if (notify && session) {
    const elapsed = formatDuration(Date.now() - session.startedAt);
    vscode.window.showInformationMessage(`Stopped ${session.mood} session after ${elapsed}.`);
  }

  await restoreOriginalWorkspaceState(context, false);
}

function resumeSessionTimer(context: vscode.ExtensionContext, session: SessionState): void {
  if (sessionTimer) {
    clearInterval(sessionTimer);
  }

  sessionTimer = setInterval(() => {
    updateStatusBar(context);
    updateDashboard(context);
    refreshViews();
  }, 1000);
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

  const sessionText =
    session && session.mood === mood
      ? ` • ${formatDuration(Date.now() - session.startedAt)}`
      : "";

  statusBarItem.text = `$(paintcan) ${mood}${sessionText}`;
  statusBarItem.tooltip = `Active mood: ${mood}`;
  statusBarItem.show();
}

async function openModeResources(mood: MoodName): Promise<void> {
  const patterns = getConfiguration<Record<string, string[]>>("modeResourceGlobs")[mood] ?? [];
  const memoryFiles = getConfiguration<Record<string, string[]>>("modeMemoryFiles")[mood] ?? [];
  const uris = new Map<string, vscode.Uri>();

  for (const pattern of patterns) {
    const matches = await vscode.workspace.findFiles(pattern, "**/node_modules/**", 4);
    for (const uri of matches) {
      uris.set(uri.fsPath, uri);
    }
  }

  for (const relativePath of memoryFiles) {
    const uri = firstWorkspaceUri(relativePath);
    if (!uri) {
      continue;
    }

    try {
      await vscode.workspace.fs.stat(uri);
      uris.set(uri.fsPath, uri);
    } catch {
      // Missing project memory docs are optional.
    }
  }

  if (uris.size === 0) {
    vscode.window.showWarningMessage(`No resources found for ${mood}. Update moodSwitcher.modeResourceGlobs to tune it.`);
    return;
  }

  const ordered = Array.from(uris.values()).slice(0, 6);
  for (const uri of ordered) {
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });
  }
}

function firstWorkspaceUri(relativePath: string): vscode.Uri | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return undefined;
  }

  return vscode.Uri.joinPath(folder.uri, relativePath);
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
  const themes = getConfiguration<Record<string, string>>("modeThemes");
  const activeMood = getActiveMood(context);
  const settings = getModeSettings(mood);
  const currentTheme = getSettingSnapshot("workbench.colorTheme");
  const nextTheme = themes[mood] ?? "No theme configured";

  const lines = [
    `Mode: ${mood}`,
    `Theme: ${formatDiffValue(currentTheme.value)} [${currentTheme.scope}] -> ${formatDiffValue(nextTheme)}`,
    `Resources: ${getModeGlobs(mood).length} glob(s), ${getModeMemoryFiles(mood).length} memory file hint(s)`,
    `State: ${activeMood === mood ? "Already active" : `Would switch from ${activeMood ?? "unset"}`}`,
    "",
    "Preset changes:"
  ];

  const settingEntries = Object.entries(settings);
  if (settingEntries.length === 0) {
    lines.push("- No workspace preset changes configured.");
  } else {
    for (const [key, value] of settingEntries) {
      const currentSetting = getSettingSnapshot(key);
      const unchanged = areValuesEqual(currentSetting.value, value) ? " (unchanged)" : "";
      lines.push(
        `- ${key}: ${formatDiffValue(currentSetting.value)} [${currentSetting.scope}] -> ${formatDiffValue(value)}${unchanged}`
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
          if (getActiveMood(context) !== message.mood) {
            await applyMood(context, message.mood);
          }
          await startSession(context, message.mood);
        }
        break;
      case "stopSession":
        await stopSession(context, true);
        break;
      case "openResources":
        if (message.mood) {
          await openModeResources(message.mood);
        }
        break;
      case "setDefault":
        if (message.mood) {
          await context.workspaceState.update(WORKSPACE_DEFAULT_MOOD_KEY, message.mood);
          vscode.window.showInformationMessage(`Default mood set to ${message.mood}.`);
        }
        break;
      case "clearDefault":
        await context.workspaceState.update(WORKSPACE_DEFAULT_MOOD_KEY, undefined);
        vscode.window.showInformationMessage("Default mood cleared.");
        break;
      default:
        break;
    }

    updateDashboard(context);
  });

  updateDashboard(context);
}

function refreshViews(): void {
  sidebarProvider?.refresh();
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

async function restoreOriginalWorkspaceState(
  context: vscode.ExtensionContext,
  notify: boolean
): Promise<void> {
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
  updateStatusBar(context);
  updateDashboard(context);
  refreshViews();

  if (notify) {
    vscode.window.showInformationMessage("Restored the original workspace theme and layout settings.");
  }
}

async function resetWorkspaceToUserSettings(
  context: vscode.ExtensionContext,
  notify: boolean
): Promise<void> {
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
  updateStatusBar(context);
  updateDashboard(context);
  refreshViews();

  if (notify) {
    vscode.window.showInformationMessage(
      "Cleared workspace mood overrides. This workspace will now fall back to your normal user/default settings."
    );
  }
}

function updateDashboard(context: vscode.ExtensionContext): void {
  if (!dashboardPanel) {
    return;
  }

  const state: DashboardState = {
    activeMood: getActiveMood(context),
    workspaceDefaultMood: normalizeStoredMood(context.workspaceState.get<unknown>(WORKSPACE_DEFAULT_MOOD_KEY)),
    session: normalizeSessionState(context.workspaceState.get<unknown>(SESSION_STATE_KEY)),
    moods: MOODS,
    spotlightMood: dashboardSpotlightMood
  };

  dashboardPanel.webview.html = getDashboardHtml(state);
}

function getDashboardHtml(state: DashboardState): string {
  const moodCards = state.moods
    .map((mood) => {
      const isActive = state.activeMood === mood.name;
      const isDefault = state.workspaceDefaultMood === mood.name;
      const isSpotlight = state.spotlightMood === mood.name;
      const sessionBadge =
        state.session?.mood === mood.name
          ? `<span class="pill session">Session ${escapeHtml(formatDuration(Date.now() - state.session.startedAt))}</span>`
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
            <button class="ghost" data-action="setDefault" data-mood="${escapeHtml(mood.name)}">Make Default</button>
          </div>
        </article>
      `;
    })
    .join("");

  const currentSession = state.session
    ? `<strong>${escapeHtml(state.session.mood)}</strong> for ${escapeHtml(formatDuration(Date.now() - state.session.startedAt))}`
    : "No active session";

  const defaultMood = state.workspaceDefaultMood
    ? escapeHtml(state.workspaceDefaultMood)
    : "None";

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Mood Switcher</title>
      <style>
        :root {
          color-scheme: light dark;
        }
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          font-family: Georgia, "Iowan Old Style", "Palatino Linotype", serif;
          color: var(--vscode-editor-foreground);
          background:
            radial-gradient(circle at top left, color-mix(in srgb, var(--vscode-textLink-foreground) 18%, transparent), transparent 28%),
            linear-gradient(160deg, var(--vscode-editor-background), color-mix(in srgb, var(--vscode-editor-background) 80%, black));
        }
        .shell {
          max-width: 1100px;
          margin: 0 auto;
          padding: 32px 24px 40px;
        }
        .hero {
          display: grid;
          gap: 18px;
          margin-bottom: 28px;
          padding: 24px;
          border: 1px solid color-mix(in srgb, var(--vscode-editor-foreground) 14%, transparent);
          border-radius: 24px;
          background: color-mix(in srgb, var(--vscode-editor-background) 86%, white 4%);
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.22);
        }
        .hero h1 {
          margin: 0;
          font-size: 42px;
          line-height: 1;
          letter-spacing: -0.03em;
        }
        .hero p {
          margin: 0;
          max-width: 700px;
          color: var(--vscode-descriptionForeground);
          font-size: 15px;
        }
        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        .meta-card {
          padding: 12px 14px;
          border-radius: 16px;
          background: color-mix(in srgb, var(--vscode-sideBar-background) 82%, transparent);
          border: 1px solid color-mix(in srgb, var(--vscode-editor-foreground) 12%, transparent);
          min-width: 180px;
        }
        .meta-label {
          display: block;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: var(--vscode-descriptionForeground);
          margin-bottom: 4px;
        }
        .toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 22px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 16px;
        }
        .card {
          position: relative;
          overflow: hidden;
          padding: 18px;
          border-radius: 22px;
          border: 1px solid color-mix(in srgb, var(--accent) 36%, var(--vscode-editor-foreground) 10%);
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--accent) 12%, transparent), transparent 36%),
            color-mix(in srgb, var(--vscode-editor-background) 90%, black 4%);
          transition: transform 120ms ease, border-color 120ms ease;
        }
        .card.active {
          transform: translateY(-2px);
          border-color: color-mix(in srgb, var(--accent) 70%, white 10%);
          box-shadow: 0 12px 36px color-mix(in srgb, var(--accent) 28%, transparent);
        }
        .card.spotlight {
          outline: 2px solid color-mix(in srgb, var(--accent) 85%, white 8%);
          outline-offset: 2px;
        }
        .card-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: start;
        }
        .eyebrow {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: color-mix(in srgb, var(--accent) 70%, var(--vscode-descriptionForeground));
          margin-bottom: 6px;
        }
        h2 {
          margin: 0;
          font-size: 24px;
          line-height: 1.05;
        }
        .badges {
          display: flex;
          flex-wrap: wrap;
          justify-content: end;
          gap: 6px;
        }
        .pill {
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 11px;
          border: 1px solid color-mix(in srgb, var(--vscode-editor-foreground) 12%, transparent);
          background: color-mix(in srgb, var(--vscode-editor-background) 72%, transparent);
        }
        .active-pill {
          border-color: color-mix(in srgb, var(--accent) 70%, transparent);
        }
        .default-pill {
          border-color: color-mix(in srgb, var(--vscode-textLink-foreground) 60%, transparent);
        }
        .spotlight-pill {
          border-color: color-mix(in srgb, var(--accent) 80%, transparent);
          background: color-mix(in srgb, var(--accent) 18%, transparent);
        }
        .session {
          border-color: color-mix(in srgb, var(--vscode-testing-iconPassed) 50%, transparent);
        }
        .card p {
          min-height: 44px;
          color: var(--vscode-descriptionForeground);
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }
        button {
          border: 0;
          border-radius: 999px;
          padding: 10px 14px;
          font: inherit;
          cursor: pointer;
          color: var(--vscode-button-foreground);
          background: color-mix(in srgb, var(--accent) 70%, var(--vscode-button-background));
        }
        button.ghost {
          color: var(--vscode-editor-foreground);
          background: color-mix(in srgb, var(--vscode-editor-background) 72%, transparent);
          border: 1px solid color-mix(in srgb, var(--vscode-editor-foreground) 12%, transparent);
        }
        button:hover {
          filter: brightness(1.06);
        }
        @media (max-width: 720px) {
          .hero h1 {
            font-size: 34px;
          }
        }
      </style>
    </head>
    <body>
      <main class="shell">
        <section class="hero">
          <div>
            <h1>Mood Switcher</h1>
            <p>Pick a mode, apply its theme and layout preset, then jump into the files that match the energy of the work.</p>
          </div>
          <div class="meta">
            <div class="meta-card">
              <span class="meta-label">Active Mood</span>
              <strong>${escapeHtml(state.activeMood ?? "Unset")}</strong>
            </div>
            <div class="meta-card">
              <span class="meta-label">Workspace Default</span>
              <strong>${defaultMood}</strong>
            </div>
            <div class="meta-card">
              <span class="meta-label">Current Session</span>
              <span>${currentSession}</span>
            </div>
          </div>
        </section>
        <section class="toolbar">
          <button data-action="stopSession">Stop Session</button>
          <button class="ghost" data-action="clearDefault">Clear Default</button>
        </section>
        <section class="grid">
          ${moodCards}
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
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
      this.buildActionsSection(),
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
          label: session ? formatDuration(Date.now() - session.startedAt) : "No Active Session",
          description: session ? session.mood : "Session timer",
          tooltip: session ? `Current ${session.mood} session` : "No active session running.",
          icon: new vscode.ThemeIcon(session ? "watch" : "debug-pause")
        }
      ]
    };
  }

  private buildActionsSection(): SidebarNode {
    return {
      kind: "section",
      id: "actions",
      label: "Quick Actions",
      icon: new vscode.ThemeIcon("rocket"),
      children: [
        actionNode("action.dashboard", "Open Dashboard", "Visual control panel", "dashboard", "moodSwitcher.openDashboard"),
        actionNode("action.pick", "Pick Mood", "Command palette picker", "list-selection", "moodSwitcher.selectMode"),
        actionNode("action.start", "Start Session", "Start timing the current mood", "play", "moodSwitcher.startSession"),
        actionNode("action.stop", "Stop Session", "Stop the current timer", "debug-stop", "moodSwitcher.stopSession"),
        actionNode(
          "action.restore",
          "Restore Original Workspace State",
          "Roll back to the pre-mood theme and managed layout settings",
          "history",
          "moodSwitcher.restoreOriginalWorkspaceState"
        ),
        actionNode(
          "action.reset",
          "Reset Workspace To User Settings",
          "Clear workspace mood overrides and fall back to normal user settings",
          "discard",
          "moodSwitcher.resetWorkspaceToUserSettings"
        ),
        actionNode("action.resources", "Open Mode Resources", "Jump to the files for this mood", "files", "moodSwitcher.openModeResources"),
        actionNode("action.default", "Set Workspace Default", "Persist a default mood for this project", "pin", "moodSwitcher.setWorkspaceDefaultMode"),
        actionNode("action.clearDefault", "Clear Workspace Default", "Remove the saved workspace default", "pinned-dirty", "moodSwitcher.clearWorkspaceDefaultMode")
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
          session?.mood === mood.name ? formatDuration(Date.now() - session.startedAt) : undefined
        ]
          .filter(Boolean)
          .join(" • "),
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
        actionNode("help.docs", "Open Docs", "Open the extension README", "book", "moodSwitcher.openDocs")
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

  const candidates = [input.mood, input.label, input.description];
  for (const candidate of candidates) {
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
    startedAt: session.startedAt
  };
}

function isMoodName(value: unknown): value is MoodName {
  return typeof value === "string" && MOOD_NAMES.has(value as MoodName);
}

function getModeSettings(mood: MoodName): Record<string, unknown> {
  return getConfiguration<MoodSettingsMap>("modeSettings")[mood] ?? {};
}

function getModeGlobs(mood: MoodName): string[] {
  return getConfiguration<Record<string, string[]>>("modeResourceGlobs")[mood] ?? [];
}

function getModeMemoryFiles(mood: MoodName): string[] {
  return getConfiguration<Record<string, string[]>>("modeMemoryFiles")[mood] ?? [];
}

function getSettingSnapshot(settingPath: string): SettingSnapshot {
  const [section, ...rest] = settingPath.split(".");
  if (!section || rest.length === 0) {
    return {
      scope: "unknown",
      value: undefined
    };
  }

  const key = rest.join(".");
  const configuration = vscode.workspace.getConfiguration(section);
  const inspection = configuration.inspect(key);

  if (!inspection) {
    return {
      scope: "unknown",
      value: configuration.get(key)
    };
  }

  if (inspection.workspaceFolderValue !== undefined) {
    return {
      scope: "workspace folder",
      value: inspection.workspaceFolderValue
    };
  }

  if (inspection.workspaceValue !== undefined) {
    return {
      scope: "workspace",
      value: inspection.workspaceValue
    };
  }

  if (inspection.globalValue !== undefined) {
    return {
      scope: "user",
      value: inspection.globalValue
    };
  }

  return {
    scope: "default",
    value: inspection.defaultValue
  };
}

async function restoreWorkspaceSetting(settingPath: string, snapshot: SettingSnapshot): Promise<void> {
  const [section, ...rest] = settingPath.split(".");
  if (!section || rest.length === 0) {
    return;
  }

  const key = rest.join(".");
  const workspaceValue =
    snapshot.scope === "workspace"
      ? snapshot.value
      : undefined;

  await vscode.workspace.getConfiguration(section).update(
    key,
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
  const keys = new Set<string>(["workbench.colorTheme"]);

  for (const moodSettings of Object.values(settings)) {
    for (const settingPath of Object.keys(moodSettings)) {
      keys.add(settingPath);
    }
  }

  return Array.from(keys);
}

function buildMoodExport(mood: MoodName): string {
  const themes = getConfiguration<Record<string, string>>("modeThemes");
  const payload = {
    mood,
    theme: themes[mood] ?? null,
    settings: getModeSettings(mood),
    resourceGlobs: getModeGlobs(mood),
    memoryFiles: getModeMemoryFiles(mood)
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

  const snapshotEntries = Object.entries(value as Record<string, unknown>);
  const snapshot: RestoreSnapshot = {};

  for (const [key, entry] of snapshotEntries) {
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
