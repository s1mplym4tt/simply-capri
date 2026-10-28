'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('capriSettings', {
  get: () => ipcRenderer.invoke('settings:get'),
  save: (data) => ipcRenderer.invoke('settings:save', data),
  refresh: () => ipcRenderer.invoke('settings:refresh'),
  clearKey: (provider) => ipcRenderer.invoke('settings:clear-key', provider),
  pickClaude: () => ipcRenderer.invoke('settings:pick-claude'),
  openPath: (kind) => ipcRenderer.invoke('settings:open-path', kind),
  saveHa: (data) => ipcRenderer.invoke('settings:save-ha', data),
  installHa: () => ipcRenderer.invoke('settings:install-ha'),
  openHa: () => ipcRenderer.invoke('settings:open-ha'),
  openExternal: (url) => ipcRenderer.invoke('settings:open-external', url),
  close: () => ipcRenderer.send('settings:close'),
});
