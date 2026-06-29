const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopGate', {
  environment: () => ipcRenderer.invoke('gate:environment'),
  listCaptureSources: () => ipcRenderer.invoke('gate:list-capture-sources'),
  selectCaptureSource: (sourceId) => ipcRenderer.invoke('gate:select-capture-source', sourceId),
  registerShortcut: (accelerator) => ipcRenderer.invoke('gate:register-shortcut', accelerator),
  unregisterShortcut: () => ipcRenderer.invoke('gate:unregister-shortcut'),
  sampleProcess: () => ipcRenderer.invoke('gate:sample-process'),
  onShortcutTrigger: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on('gate:shortcut-trigger', handler);
    return () => ipcRenderer.removeListener('gate:shortcut-trigger', handler);
  },
});
