import { app, BrowserWindow, desktopCapturer, globalShortcut, ipcMain, session } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { cpus, release as osRelease, totalmem, version as osVersion } from 'node:os';
import { probePttBackend, pttAdapter } from './ptt-adapter.js';

const processStartedAt = performance.now();
const directory = path.dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;
let selectedCaptureSourceId: string | null = null;
let registeredAccelerator: string | null = null;
let shortcutTriggerCount = 0;

async function captureSources() {
  return desktopCapturer.getSources({
    types: ['screen', 'window'],
    fetchWindowIcons: false,
    thumbnailSize: { width: 0, height: 0 },
  });
}

function installIpc() {
  ipcMain.handle('gate:environment', () => ({
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron ?? 'unknown',
    chromium: process.versions.chrome ?? 'unknown',
    node: process.versions.node,
    osRelease: osRelease(),
    osVersion: osVersion(),
    cpu: cpus()[0]?.model ?? 'unknown',
    logicalCpuCount: cpus().length,
    totalMemoryGb: Math.round(totalmem() / 1024 ** 3),
    startupMs: Math.round(performance.now() - processStartedAt),
    pttSemantics:
      'Electron globalShortcut confirms unfocused registration but does not expose release events.',
  }));

  ipcMain.handle('gate:list-capture-sources', async () =>
    (await captureSources()).map((source) => ({
      id: source.id,
      name: source.name,
      displayId: source.display_id,
      type: source.id.startsWith('screen:') ? 'screen' : 'window',
    })),
  );

  ipcMain.handle('gate:select-capture-source', async (_event, sourceId: unknown) => {
    if (typeof sourceId !== 'string') return false;
    const source = (await captureSources()).find((candidate) => candidate.id === sourceId);
    selectedCaptureSourceId = source?.id ?? null;
    return selectedCaptureSourceId !== null;
  });

  ipcMain.handle('gate:register-shortcut', (_event, accelerator: unknown) => {
    if (registeredAccelerator) globalShortcut.unregister(registeredAccelerator);
    if (typeof accelerator !== 'string' || accelerator.length > 40) return false;
    shortcutTriggerCount = 0;
    const registered = globalShortcut.register(accelerator, () => {
      shortcutTriggerCount += 1;
      mainWindow?.webContents.send('gate:shortcut-trigger', {
        accelerator,
        count: shortcutTriggerCount,
        occurredAt: new Date().toISOString(),
      });
    });
    registeredAccelerator = registered ? accelerator : null;
    return registered;
  });

  ipcMain.handle('gate:unregister-shortcut', () => {
    if (registeredAccelerator) globalShortcut.unregister(registeredAccelerator);
    registeredAccelerator = null;
  });

  ipcMain.handle('gate:probe-ptt', async () => probePttBackend());

  ipcMain.handle('gate:register-ptt-key', async (_event, keyCode: unknown) => {
    if (typeof keyCode !== 'number' || !Number.isInteger(keyCode)) return false;
    return pttAdapter.register(keyCode, (pttEvent) => {
      mainWindow?.webContents.send('gate:ptt-event', pttEvent);
    });
  });

  ipcMain.handle('gate:unregister-ptt-key', () => {
    pttAdapter.unregister();
  });

  ipcMain.handle('gate:sample-process', async () => {
    const memory = await process.getProcessMemoryInfo();
    const metrics = app.getAppMetrics();
    return {
      capturedAt: new Date().toISOString(),
      privateMemoryMb: Math.round(memory.private / 1024),
      residentSetMb: Math.round(memory.residentSet / 1024),
      processes: metrics.map((metric) => ({
        type: metric.type,
        cpuPercent: metric.cpu.percentCPUUsage,
        workingSetMb: Math.round(metric.memory.workingSetSize / 1024),
      })),
    };
  });
}

function installDisplayCapture() {
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!request.userGesture || !selectedCaptureSourceId) {
      callback({});
      return;
    }
    const source = (await captureSources()).find(
      (candidate) => candidate.id === selectedCaptureSourceId,
    );
    selectedCaptureSourceId = null;
    if (!source) {
      callback({});
      return;
    }
    callback({
      video: source,
      ...(request.audioRequested && process.platform === 'win32' ? { audio: 'loopback' } : {}),
    });
  });
}

async function createWindow(showOnReady = true) {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 680,
    backgroundColor: '#0d1015',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.resolve(directory, '../../preload.cjs'),
    },
  });
  if (showOnReady) mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  await mainWindow.loadFile(path.resolve(directory, '../renderer/index.html'));
}

async function runPreflight() {
  const sources = await captureSources();
  const shortcutRegistered = globalShortcut.register('F8', () => undefined);
  if (shortcutRegistered) globalShortcut.unregister('F8');
  const memory = await process.getProcessMemoryInfo();
  const appMetrics = app.getAppMetrics();
  const result = {
    recordedAt: new Date().toISOString(),
    candidate: 'electron',
    environment: {
      platform: process.platform,
      arch: process.arch,
      electron: process.versions.electron ?? 'unknown',
      chromium: process.versions.chrome ?? 'unknown',
      node: process.versions.node,
      osRelease: osRelease(),
      osVersion: osVersion(),
      cpu: cpus()[0]?.model ?? 'unknown',
      logicalCpuCount: cpus().length,
      totalMemoryGb: Math.round(totalmem() / 1024 ** 3),
    },
    probes: {
      rendererReadyMs: Math.round(performance.now() - processStartedAt),
      captureSourceCount: sources.length,
      captureSourceTypes: [...new Set(sources.map((source) => source.id.split(':')[0]))],
      shortcutRegistration: shortcutRegistered,
      privateMemoryMb: Math.round(memory.private / 1024),
      residentSetMb: Math.round(memory.residentSet / 1024),
      processWorkingSetMb: appMetrics.map((metric) => ({
        type: metric.type,
        workingSetMb: Math.round(metric.memory.workingSetSize / 1024),
      })),
      totalWorkingSetMb: Math.round(
        appMetrics.reduce((total, metric) => total + metric.memory.workingSetSize, 0) / 1024,
      ),
    },
    limitations: [
      'Source enumeration does not prove a stable video track or system-audio track.',
      'globalShortcut registration does not provide release events and is not a PTT pass.',
      'A single process sample is not an idle p95 or soak measurement.',
    ],
  };
  console.log(`DESKTOP_GATE_PREFLIGHT ${JSON.stringify(result)}`);
}

app.whenReady().then(async () => {
  if (process.argv.includes('--preflight')) {
    installIpc();
    installDisplayCapture();
    await createWindow(false);
    await runPreflight();
    app.quit();
    return;
  }
  installIpc();
  installDisplayCapture();
  const smoke = process.argv.includes('--smoke');
  await createWindow(!smoke);
  if (smoke && mainWindow) {
    const renderer = await mainWindow.webContents.executeJavaScript(`({
      title: document.title,
      heading: document.querySelector('h1')?.textContent,
      cards: document.querySelectorAll('.card').length,
      apiAvailable: typeof window.desktopGate?.environment === 'function'
    })`);
    console.log(`DESKTOP_GATE_SMOKE ${JSON.stringify(renderer)}`);
    app.quit();
  }
});

app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => globalShortcut.unregisterAll());
