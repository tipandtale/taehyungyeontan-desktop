const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (cb) => ipcRenderer.on(channel, (_e, data) => cb(data));

contextBridge.exposeInMainWorld('pet', {
  onState: on('state'),
  onSay: on('say'),
  onPomodoro: on('pomodoro'),
  onConfig: on('config'),
  press: () => ipcRenderer.send('press'),
  release: () => ipcRenderer.send('release'),
  setIgnore: (ignore) => ipcRenderer.send('ignore', ignore),
  ready: () => ipcRenderer.send('ready')
});
