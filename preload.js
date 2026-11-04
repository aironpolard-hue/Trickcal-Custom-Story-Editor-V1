'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('engine', {
  openHelp: () => ipcRenderer.invoke('help:open'),
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  chooseDirectory: () => ipcRenderer.invoke('dialog:chooseDirectory'),
  createProject: (payload) => ipcRenderer.invoke('project:create', payload),
  openProject: (projectPath) => ipcRenderer.invoke('project:open', projectPath),
  chooseAndOpen: () => ipcRenderer.invoke('project:chooseAndOpen'),
  readProject: (projectPath) => ipcRenderer.invoke('project:read', projectPath),
  saveStory: (payload) => ipcRenderer.invoke('project:saveStory', payload),
  compile: (payload) => ipcRenderer.invoke('project:compile', payload),
  previewUrl: (payload) => ipcRenderer.invoke('project:previewUrl', payload),
  presetPreviewUrl: (payload) => ipcRenderer.invoke('project:presetPreviewUrl', payload),
  build: (payload) => ipcRenderer.invoke('project:build', payload),
  listPresets: (projectPath) => ipcRenderer.invoke('project:presets', projectPath),
  listAssets: (projectPath) => ipcRenderer.invoke('project:assets', projectPath),
  importAsset: (payload) => ipcRenderer.invoke('project:importAsset', payload),
  writePreset: (payload) => ipcRenderer.invoke('project:presetWrite', payload),
  deletePreset: (payload) => ipcRenderer.invoke('project:presetDelete', payload),
  openPath: (p) => ipcRenderer.invoke('shell:openPath', p),
  showItem: (p) => ipcRenderer.invoke('shell:showItem', p),
  openVSCode: (p) => ipcRenderer.invoke('shell:openVSCode', p),
});
