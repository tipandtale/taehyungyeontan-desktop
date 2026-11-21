const {
  app, BrowserWindow, Tray, Menu, screen, powerMonitor, ipcMain, nativeImage, Notification
} = require('electron');
const path = require('path');
const fs = require('fs');

const SIZES = { small: 110, medium: 150, large: 200 };
const SLEEP_AFTER_SEC = 120;       // system idle time before a nap
const POMODORO_SEC = 25 * 60;
const WALK_SPEED = 45;             // px/s
const RUN_SPEED = 120;             // px/s

const QUOTES = [
  'break the glass ceiling that cages you',
  'raise a toast to the fog, on clear days',
  "live your life. it's yours anyway",
  "don't be trapped in someone else's dream",
  'being weird is the best thing that could happen to me',
  'if you feel drained, why not do less',
  'if i give up here, then i am not the star of my life',
  "don't think too deeply"
];

let win = null;
let tray = null;
let settings = { size: 'medium' };
let settingsFile = null;

// --- pet state ---------------------------------------------------------
let mode = 'walk';        // walk | pause | sleep | react | drag | fall
let reactState = 'saved'; // sprite shown while mode === 'react'
let dir = 1;              // 1 = right, -1 = left
let running = false;
let modeUntil = 0;
let nextDecision = 0;
let manualSleep = false;
let pos = { x: 0, y: 0 };
let vy = 0;
let press = null;         // { cursor, pos, moved }
let lastTick = Date.now();
let lastSet = { x: NaN, y: NaN };

// --- pomodoro ----------------------------------------------------------
let pomoEnd = 0;
let pomoTimer = null;

const S = () => SIZES[settings.size] || SIZES.medium;
const W = () => S() + 50;
const H = () => S() + 110;

function loadSettings() {
  settingsFile = path.join(app.getPath('userData'), 'settings.json');
  try { settings = { ...settings, ...JSON.parse(fs.readFileSync(settingsFile, 'utf8')) }; } catch (_) {}
}
function saveSettings() {
  try { fs.writeFileSync(settingsFile, JSON.stringify(settings)); } catch (_) {}
}

function workArea() {
  return screen.getDisplayNearestPoint({ x: pos.x + W() / 2, y: pos.y + H() / 2 }).workArea;
}
const groundY = () => { const wa = workArea(); return wa.y + wa.height - H(); };
const minX = () => workArea().x;
const maxX = () => { const wa = workArea(); return wa.x + wa.width - W(); };

function send(channel, data) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, data);
}
function say(text, ms = 2800) { send('say', { text, ms }); }

function spriteState() {
  switch (mode) {
    case 'walk': return running ? 'run' : 'walk';
    case 'pause': return 'idle';
    case 'sleep': return 'sleep';
    case 'react': return reactState;
    default: return 'worry'; // drag, fall
  }
}
function pushState() { send('state', { state: spriteState(), dir }); }

function setMode(next, opts = {}) {
  mode = next;
  if (opts.ms) modeUntil = Date.now() + opts.ms;
  if (opts.react) reactState = opts.react;
  if (next === 'walk') { scheduleDecision(); }
  pushState();
}

function scheduleDecision() { nextDecision = Date.now() + 3000 + Math.random() * 5000; }

function react(state, ms) { setMode('react', { react: state, ms }); }

// --- main loop ---------------------------------------------------------
function tick() {
  if (!win || win.isDestroyed()) return;
  const now = Date.now();
  const dt = Math.min(0.1, (now - lastTick) / 1000);
  lastTick = now;

  // press / drag handling
  if (press) {
    const c = screen.getCursorScreenPoint();
    if (!press.moved && Math.hypot(c.x - press.cursor.x, c.y - press.cursor.y) > 5) {
      press.moved = true;
      manualSleep = false;
      setMode('drag');
      say('oh na na na..', 1800);
    }
    if (press.moved) {
      pos.x = c.x - (press.cursor.x - press.pos.x);
      pos.y = c.y - (press.cursor.y - press.pos.y);
    }
  }

  switch (mode) {
    case 'walk': {
      const speed = running ? RUN_SPEED : WALK_SPEED;
      pos.x += dir * speed * dt;
      if (pos.x >= maxX()) { pos.x = maxX(); dir = -1; pushState(); }
      else if (pos.x <= minX()) { pos.x = minX(); dir = 1; pushState(); }
      pos.y = groundY();
      if (now >= nextDecision) decide();
      break;
    }
    case 'pause':
      pos.y = groundY();
      if (now >= modeUntil) setMode('walk');
      break;
    case 'react':
      pos.y = groundY();
      if (now >= modeUntil) setMode('walk');
      break;
    case 'sleep':
      pos.y = groundY();
      break;
    case 'fall': {
      vy += 2400 * dt;
      pos.y += vy * dt;
      const g = groundY();
      if (pos.y >= g) { pos.y = g; vy = 0; running = false; react('saved', 1200); say('phew!', 1500); }
      break;
    }
  }

  if (mode !== 'drag') {
    pos.x = Math.min(Math.max(pos.x, minX()), maxX());
  }

  const x = Math.round(pos.x), y = Math.round(pos.y);
  if (x !== lastSet.x || y !== lastSet.y) {
    win.setPosition(x, y);
    lastSet = { x, y };
  }
}

function decide() {
  const r = Math.random();
  if (running) { running = false; pushState(); scheduleDecision(); return; }
  if (r < 0.30) setMode('pause', { ms: 2000 + Math.random() * 3000 });
  else if (r < 0.50) { dir = -dir; pushState(); scheduleDecision(); }
  else if (r < 0.70) { running = true; pushState(); nextDecision = Date.now() + 1500 + Math.random() * 1500; }
  else scheduleDecision();
}

// --- sleep when you're away -------------------------------------------
function checkIdle() {
  if (mode === 'drag' || mode === 'fall') return;
  const idle = powerMonitor.getSystemIdleTime();
  if (mode !== 'sleep' && idle >= SLEEP_AFTER_SEC) {
    setMode('sleep');
    say('zzz..', 3000);
  } else if (mode === 'sleep' && !manualSleep && idle < 4) {
    setMode('walk');
  }
}

// --- pomodoro ----------------------------------------------------------
function pomoTick() {
  const sec = Math.max(0, Math.ceil((pomoEnd - Date.now()) / 1000));
  send('pomodoro', { sec });
  if (tray && process.platform === 'darwin') {
    tray.setTitle(`${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`);
  }
  if (sec <= 0) {
    stopPomodoro();
    if (mode === 'sleep') { manualSleep = false; }
    react('saved', 3000);
    say('25 minutes done! stretch time', 6000);
    try { new Notification({ title: 'Focus session done', body: 'Nice work. Take a break with Taehyung and Yeontan.' }).show(); } catch (_) {}
  }
}
function startPomodoro() {
  clearInterval(pomoTimer);
  pomoEnd = Date.now() + POMODORO_SEC * 1000;
  pomoTimer = setInterval(pomoTick, 1000);
  if (win && !win.isVisible()) win.showInactive();
  pomoTick();
  say("let's focus together", 3000);
  buildMenu();
}
function stopPomodoro() {
  clearInterval(pomoTimer);
  pomoTimer = null;
  send('pomodoro', null);
  if (tray && process.platform === 'darwin') tray.setTitle('');
  buildMenu();
}

// --- window + tray -----------------------------------------------------
function applySize() {
  const wa = workArea();
  win.setBounds({ x: Math.round(pos.x), y: Math.round(pos.y), width: W(), height: H() });
  lastSet = { x: NaN, y: NaN };
  send('config', { size: S() });
}

function createWindow() {
  const wa = screen.getPrimaryDisplay().workArea;
  pos.x = wa.x + Math.round(wa.width * 0.3);
  pos.y = wa.y + wa.height - H();

  win = new BrowserWindow({
    width: W(), height: H(), x: Math.round(pos.x), y: Math.round(pos.y),
    transparent: true, frame: false, hasShadow: false, resizable: false,
    movable: false, minimizable: false, maximizable: false, fullscreenable: false,
    alwaysOnTop: true, skipTaskbar: true, show: false,
    focusable: process.platform === 'linux',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (process.platform !== 'linux') win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.showInactive());
  win.on('closed', () => { win = null; });
}

function buildMenu() {
  if (!tray) return;
  const visible = win && win.isVisible();
  const pomoOn = !!pomoTimer;
  const menu = Menu.buildFromTemplate([
    { label: visible ? 'Hide' : 'Show', click: () => { visible ? win.hide() : win.showInactive(); buildMenu(); } },
    { type: 'separator' },
    pomoOn
      ? { label: 'Stop focus session', click: stopPomodoro }
      : { label: 'Start 25-minute focus', click: startPomodoro },
    {
      label: mode === 'sleep' && manualSleep ? 'Wake up' : 'Take a nap',
      click: () => {
        if (mode === 'sleep') { manualSleep = false; setMode('walk'); }
        else { manualSleep = true; setMode('sleep'); say('zzz..', 3000); }
        buildMenu();
      }
    },
    { label: 'Say something', click: () => { react('saved', 1400); say(QUOTES[Math.floor(Math.random() * QUOTES.length)], 4000); } },
    { type: 'separator' },
    {
      label: 'Size',
      submenu: Object.keys(SIZES).map((k) => ({
        label: k[0].toUpperCase() + k.slice(1), type: 'radio', checked: settings.size === k,
        click: () => { settings.size = k; saveSettings(); applySize(); }
      }))
    },
    {
      label: 'Launch at login', type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked })
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);
}

function createTray() {
  const size = process.platform === 'darwin' ? 18 : 22;
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png')).resize({ width: size, height: size });
  tray = new Tray(icon);
  tray.setToolTip('Taehyung and Yeontan');
  buildMenu();
  // Keep the Hide/Show and nap labels honest when the menu is about to open.
  tray.on('click', () => { if (process.platform !== 'darwin') { win.isVisible() ? win.hide() : win.showInactive(); buildMenu(); } });
}

// --- IPC ---------------------------------------------------------------
ipcMain.on('ready', () => { send('config', { size: S() }); pushState(); });
ipcMain.on('ignore', (_e, ignore) => {
  if (process.platform === 'linux' || !win) return;
  win.setIgnoreMouseEvents(!!ignore, { forward: true });
});
ipcMain.on('press', () => {
  press = { cursor: screen.getCursorScreenPoint(), pos: { ...pos }, moved: false };
});
ipcMain.on('release', () => {
  if (!press) return;
  const wasDrag = press.moved;
  press = null;
  if (wasDrag) {
    vy = 0;
    setMode('fall');
  } else if (mode === 'sleep') {
    manualSleep = false;
    react('saved', 1200);
    say('mm? five more minutes..', 2500);
  } else {
    react('saved', 1400);
    say(QUOTES[Math.floor(Math.random() * QUOTES.length)], 4000);
  }
});

// --- boot --------------------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { win.showInactive(); say('hi again!', 2000); } });
  app.whenReady().then(() => {
    if (process.platform === 'darwin') app.dock.hide();
    loadSettings();
    createWindow();
    createTray();
    setInterval(tick, 16);
    setInterval(checkIdle, 3000);
    setTimeout(() => say('annyeong!', 2500), 800);
  });
  // The pet lives in the tray, so closing the window never quits the app.
  app.on('window-all-closed', (e) => e.preventDefault());
}
