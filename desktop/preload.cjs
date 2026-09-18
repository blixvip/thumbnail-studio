const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("thumbnail", {
  library: () => ipcRenderer.invoke("thumbnail:library"),
  references: (open) =>
    ipcRenderer.invoke("thumbnail:references", Boolean(open)),
  copy: (id) => ipcRenderer.invoke("thumbnail:copy", id),
  chat: (action) => ipcRenderer.invoke("thumbnail:chat", action),
  template: (open) => ipcRenderer.invoke("thumbnail:template", Boolean(open)),
  external: (url) => ipcRenderer.invoke("thumbnail:external", url),
  onStatus: (listener) => {
    ipcRenderer.on("thumbnail:status", (_event, state) => listener(state));
  },
  status: () => ipcRenderer.invoke("thumbnail:status"),
  skills: () => ipcRenderer.invoke("thumbnail:skills"),
  skillPrompt: (id, brief, copy = false) =>
    ipcRenderer.invoke("thumbnail:skill-prompt", { id, brief, copy }),
});
