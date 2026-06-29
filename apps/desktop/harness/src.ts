interface CaptureSource {
  id: string;
  name: string;
  displayId: string;
  type: 'screen' | 'window';
}

interface DesktopGateApi {
  environment(): Promise<Record<string, string | number>>;
  listCaptureSources(): Promise<CaptureSource[]>;
  selectCaptureSource(sourceId: string): Promise<boolean>;
  registerShortcut(accelerator: string): Promise<boolean>;
  unregisterShortcut(): Promise<void>;
  sampleProcess(): Promise<unknown>;
  onShortcutTrigger(listener: (payload: unknown) => void): () => void;
}

declare global {
  interface Window {
    desktopGate: DesktopGateApi;
  }
}

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const record: Record<string, unknown> = {
  candidate: 'electron',
  recordedAt: new Date().toISOString(),
  environment: {},
  observations: {},
};

function show(id: string, value: unknown) {
  element(id).textContent = JSON.stringify(value, null, 2);
  element<HTMLTextAreaElement>('report').value = JSON.stringify(record, null, 2);
}

const environment = await window.desktopGate.environment();
record.environment = environment;
element('runtime').textContent =
  `Electron ${environment.electron} · Chromium ${environment.chromium}`;
show('process-result', { startupMs: environment.startupMs, status: 'Ready for idle sample' });

element('load-sources').addEventListener('click', async () => {
  const sources = await window.desktopGate.listCaptureSources();
  const select = element<HTMLSelectElement>('capture-source');
  select.replaceChildren(
    ...sources.map((source) => {
      const option = document.createElement('option');
      option.value = source.id;
      option.textContent = `${source.type}: ${source.name}`;
      return option;
    }),
  );
  element<HTMLButtonElement>('start-capture').disabled = sources.length === 0;
  record.captureSources = {
    count: sources.length,
    types: [...new Set(sources.map((s) => s.type))],
  };
  show('capture-result', record.captureSources);
});

element('start-capture').addEventListener('click', async () => {
  const selected = element<HTMLSelectElement>('capture-source').value;
  if (!(await window.desktopGate.selectCaptureSource(selected))) return;
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const preview = element<HTMLVideoElement>('capture-preview');
    preview.srcObject = stream;
    preview.classList.add('is-active');
    const video = stream.getVideoTracks()[0];
    const settings = video?.getSettings();
    const result = {
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length,
      width: settings?.width,
      height: settings?.height,
      frameRate: settings?.frameRate,
      readyState: video?.readyState,
    };
    record.displayCapture = result;
    show('capture-result', result);
  } catch (error) {
    record.displayCapture = { error: error instanceof Error ? error.message : String(error) };
    show('capture-result', record.displayCapture);
  }
});

async function deviceSnapshot(event: string) {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const snapshot = {
    event,
    capturedAt: new Date().toISOString(),
    audioInputs: devices.filter((device) => device.kind === 'audioinput').length,
    audioOutputs: devices.filter((device) => device.kind === 'audiooutput').length,
    videoInputs: devices.filter((device) => device.kind === 'videoinput').length,
  };
  record.devices = snapshot;
  show('device-result', snapshot);
}

element('request-audio').addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await deviceSnapshot('permission-granted');
    stream.getTracks().forEach((track) => track.stop());
  } catch (error) {
    record.devices = { error: error instanceof Error ? error.message : String(error) };
    show('device-result', record.devices);
  }
});
navigator.mediaDevices.addEventListener('devicechange', () => void deviceSnapshot('devicechange'));

element('register-shortcut').addEventListener('click', async () => {
  const accelerator = element<HTMLInputElement>('shortcut').value;
  const registered = await window.desktopGate.registerShortcut(accelerator);
  record.shortcut = { accelerator, registered, semantics: 'trigger-only; no release event' };
  show('shortcut-result', record.shortcut);
});
window.desktopGate.onShortcutTrigger((payload) => {
  record.shortcut = { ...(record.shortcut as object), lastTrigger: payload };
  show('shortcut-result', record.shortcut);
});

element('sample-process').addEventListener('click', async () => {
  record.processSample = await window.desktopGate.sampleProcess();
  show('process-result', record.processSample);
});

element('copy-report').addEventListener('click', async () => {
  await navigator.clipboard.writeText(element<HTMLTextAreaElement>('report').value);
  element('copy-status').textContent = 'Copied';
});

window.addEventListener('beforeunload', () => void window.desktopGate.unregisterShortcut());
