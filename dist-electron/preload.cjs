"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('fotoQuAPI', {
    savePhoto: (base64Data) => electron_1.ipcRenderer.invoke('save-photo', base64Data),
    getAppInfo: () => electron_1.ipcRenderer.invoke('get-app-info'),
    getSettings: () => electron_1.ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => electron_1.ipcRenderer.invoke('save-settings', settings),
    getPrinters: () => electron_1.ipcRenderer.invoke('get-printers'),
    selectOutputFolder: () => electron_1.ipcRenderer.invoke('select-output-folder'),
    print: (filePath) => electron_1.ipcRenderer.invoke('print-file', filePath),
    onCameraChange: (callback) => {
        // In a real scenario, we might listen to main process events for hardware changes
        // For now, navigator.mediaDevices.ondevicechange in renderer is usually sufficient
        // But if we needed main process USB detection, we'd wire it here.
        // We'll leave this as a placeholder or wire up a specific IPC event if needed.
    }
});
