import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('fotoQuAPI', {
    savePhoto: (base64Data) => ipcRenderer.invoke('save-photo', base64Data),
    getAppInfo: () => ipcRenderer.invoke('get-app-info'),
    onCameraChange: (callback) => {
        // In a real scenario, we might listen to main process events for hardware changes
        // For now, navigator.mediaDevices.ondevicechange in renderer is usually sufficient
        // But if we needed main process USB detection, we'd wire it here.
        // We'll leave this as a placeholder or wire up a specific IPC event if needed.
    }
});
