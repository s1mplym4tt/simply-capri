'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('capriSettings', {
  get: () => ipcRenderer.invoke('settings:get'),
  save: (data) => ipcRenderer.invoke('settings:save', data),
  refresh: () => ipcRenderer.invoke('settings:refresh'),
  installHa: () => ipcRenderer.invoke('settings:install-ha'),
  openHa: () => ipcRenderer.invoke('settings:open-ha'),
  openExternal: (url) => ipcRenderer.invoke('settings:open-external', url),
  close: () => ipcRenderer.send('settings:close'),
});
