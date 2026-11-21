const petEl = document.getElementById('pet');
const imgEl = document.getElementById('img');
const bubbleEl = document.getElementById('bubble');
const chipEl = document.getElementById('chip');

const FILES = {
  idle: 'idle', walk1: 'walk1', walk2: 'walk2', running: 'running',
  sleep: 'sleeping', saved: 'saved', worry: 'broken-code'
};
const SRC = {};
for (const [key, file] of Object.entries(FILES)) {
  SRC[key] = `../assets/${file}.png`;
  new Image().src = SRC[key]; // preload
}

const BOB = {
  walk: 'walk-bob', run: 'run-bob', sleep: 'sleep-bob',
  saved: 'saved-bob', worry: 'worry-bob', idle: ''
};

let state = 'walk';
let dir = 1;
let tick = 0;

function render() {
  petEl.className = BOB[state] + (pressed ? ' grabbing' : '');
  let src = SRC.idle;
  if (state === 'walk') src = (tick >> 1) % 2 === 0 ? SRC.walk1 : SRC.walk2;
  else if (state === 'run') src = tick % 2 === 0 ? SRC.running : SRC.walk2;
  else if (SRC[state]) src = SRC[state];
  if (!imgEl.src.endsWith(src.replace('..', ''))) imgEl.src = src;
  // Walk sprites face left, so flip them when heading right.
  const moving = state === 'walk' || state === 'run';
  imgEl.style.transform = moving && dir === 1 ? 'scaleX(-1)' : 'none';
}

setInterval(() => {
  tick++;
  if (state === 'walk' || state === 'run') render();
}, 120);

window.pet.onState((d) => { state = d.state; dir = d.dir; render(); });

let bubbleTimer;
window.pet.onSay(({ text, ms }) => {
  bubbleEl.textContent = text;
  bubbleEl.classList.add('visible');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubbleEl.classList.remove('visible'), ms || 2500);
});

window.pet.onPomodoro((d) => {
  if (!d) { chipEl.style.display = 'none'; return; }
  const m = String(Math.floor(d.sec / 60)).padStart(2, '0');
  const s = String(d.sec % 60).padStart(2, '0');
  chipEl.textContent = `FOCUS ${m}:${s}`;
  chipEl.style.display = 'block';
});

window.pet.onConfig((c) => {
  document.documentElement.style.setProperty('--s', c.size + 'px');
});

// Click-through everywhere except the pet and the speech bubble.
// (Mouse events are forwarded on macOS/Windows; Linux can't forward, so main skips this.)
let pressed = false;
let ignoring = null;
function setIgnore(v) {
  if (ignoring === v) return;
  ignoring = v;
  window.pet.setIgnore(v);
}
window.addEventListener('mousemove', (e) => {
  if (pressed) return;
  const r = petEl.getBoundingClientRect();
  const over = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  setIgnore(!over);
});

petEl.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  pressed = true;
  petEl.setPointerCapture(e.pointerId);
  setIgnore(false);
  window.pet.press();
  render();
});
function up() {
  if (!pressed) return;
  pressed = false;
  window.pet.release();
  render();
}
petEl.addEventListener('pointerup', up);
petEl.addEventListener('pointercancel', up);

window.pet.ready();
