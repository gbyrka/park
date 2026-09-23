'use strict';

const physics = ParkPhysics;
const $ = id => document.getElementById(id);
const canvas = $('game');
const scene = new ParkScene(canvas);
const keys = new Set();
const COOKIE = 'park_scores_v1';
const HOLD_TIME = .75;
const modeNames = { 'classic-60s': 'Classic', 'trailer-180s': 'Car + trailer' };
const ui = Object.fromEntries(['score', 'best', 'time', 'clock', 'time-fill', 'speed', 'gear', 'brake-indicator', 'assist-text', 'parking-fill', 'parking-progress', 'target-label', 'mission-text'].map(id => [id, $(id)]));
const state = {
  phase: 'menu', mode: 'classic-60s', color: '#f1ba58', world: null, rig: null,
  target: -1, targetBag: [], score: 0, remaining: 60, parkedHold: 0,
  collisions: 0, legCollisions: 0, cleanParks: 0, bestPark: null, legStarted: 60,
  collisionCooldown: 0, collisionFlash: 0, celebration: null,
};
let records = readRecords();
let previousTime = 0, accumulator = 0, frameId = null, toastTimer = null;

function readRecords() {
  const empty = { version: 1, bestByMode: {}, history: [] };
  try {
    const value = document.cookie.split('; ').find(item => item.startsWith(COOKIE + '='));
    if (!value) return empty;
    const data = JSON.parse(decodeURIComponent(value.slice(COOKIE.length + 1)));
    if (data.version !== 1 || !Array.isArray(data.history) || !data.bestByMode || typeof data.bestByMode !== 'object') return empty;
    const validScore = n => Number.isSafeInteger(n) && n >= 0;
    empty.history = data.history.filter(r => r && typeof r.mode === 'string' && /^[a-z0-9-]{1,40}$/.test(r.mode) && validScore(r.score) && Number.isFinite(r.at) && !isNaN(new Date(r.at).getTime()))
      .slice(-20).map(({ mode, score, at }) => ({ mode, score, at }));
    for (const [mode, best] of Object.entries(data.bestByMode)) {
      if (/^[a-z0-9-]{1,40}$/.test(mode) && validScore(best)) Object.defineProperty(empty.bestByMode, mode, { value: best, enumerable: true, writable: true, configurable: true });
    }
    return empty;
  } catch { return empty; }
}

function renderRecords() {
  ui.best.textContent = String(records.bestByMode[state.mode] || 0).padStart(2, '0');
  const list = $('history');
  list.replaceChildren();
  for (const record of records.history.slice().reverse()) {
    const item = document.createElement('li');
    item.textContent = `${record.score} ${record.score === 1 ? 'park' : 'parks'} · ${modeNames[record.mode] || record.mode} · ${new Date(record.at).toLocaleString('en-GB')}`;
    list.append(item);
  }
  if (!records.history.length) {
    const item = document.createElement('li'); item.textContent = 'A fresh start. Your completed rounds will appear here.'; list.append(item);
  }
}

function saveResult() {
  records.history.push({ mode: state.mode, score: state.score, at: Date.now() });
  records.history = records.history.slice(-20);
  records.bestByMode[state.mode] = Math.max(records.bestByMode[state.mode] || 0, state.score);
  try {
    const encoded = encodeURIComponent(JSON.stringify(records));
    if (encoded.length > 3800) throw new Error('Cookie too large');
    document.cookie = `${COOKIE}=${encoded}; Max-Age=31536000; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    if (!document.cookie.split('; ').includes(`${COOKIE}=${encoded}`)) throw new Error('Cookies unavailable');
    $('storage-status').textContent = '';
  } catch {
    $('storage-status').textContent = 'Scores are kept for this session only. Allow cookies and use HTTP or HTTPS to save your garage log.';
  }
  renderRecords();
}

function savePreferences() {
  try { localStorage.setItem('park_preferences_v1', JSON.stringify({ color: $('color').value, mode: $('mode').value })); } catch { /* Preferences are optional. */ }
}

function roundDuration() { return state.mode === 'trailer-180s' ? 180 : 60; }

function chooseTarget() {
  if (!state.targetBag.length) {
    state.targetBag = state.world.lots.map((_, i) => i).filter(i => !state.world.occupied.includes(i));
    for (let i = state.targetBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.targetBag[i], state.targetBag[j]] = [state.targetBag[j], state.targetBag[i]];
    }
    if (state.targetBag[0] === state.target) [state.targetBag[0], state.targetBag[1]] = [state.targetBag[1], state.targetBag[0]];
  }
  state.target = state.targetBag.shift();
  state.parkedHold = 0;
  state.legCollisions = 0;
  state.legStarted = state.remaining;
  ui['target-label'].textContent = state.world.lots[state.target].label;
}

function configure() {
  state.mode = $('mode').value;
  state.color = $('color').value;
  const withTrailer = state.mode === 'trailer-180s';
  state.world = physics.makeWorld(withTrailer);
  state.rig = physics.makeRig(withTrailer, state.world.height);
  state.remaining = roundDuration();
  state.score = 0; state.collisions = 0; state.cleanParks = 0; state.bestPark = null;
  state.collisionCooldown = 0; state.collisionFlash = 0; state.celebration = null;
  state.target = -1; state.targetBag = []; accumulator = 0;
  chooseTarget();
  $('mode-label').textContent = withTrailer ? 'CAR + TRAILER / 3 MINUTES' : 'CLASSIC / 60 SECONDS';
  scene.configure(state.world);
  renderRecords(); updateModeHelp(); updateHUD(); scene.draw(state, performance.now());
}

function updateModeHelp() {
  const trailer = $('mode').value === 'trailer-180s';
  let help = trailer ? 'Park the car AND white trailer. Reverse slowly; small turns work best.' : 'One car. One minute. How many perfect parks?';
  if (state.phase === 'paused' && $('mode').value !== state.mode) help += ' This mode starts with your next round.';
  $('mode-help').textContent = help;
}

function setOverlay(visible) {
  $('overlay').hidden = !visible;
  canvas.inert = visible;
  if (visible) {
    $('overlay').scrollTop = 0;
    const button = state.phase === 'paused' ? $('resume') : $('start');
    button.focus({ preventScroll: true });
  } else canvas.focus({ preventScroll: true });
}

function hideToast() { clearTimeout(toastTimer); $('toast').classList.remove('visible'); }
function toast(message, warning = false) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').classList.toggle('warning', warning);
  $('toast').classList.add('visible');
  toastTimer = setTimeout(hideToast, warning ? 1900 : 2500);
}

function scheduleFrame() {
  if (frameId === null && state.phase === 'playing') frameId = requestAnimationFrame(loop);
}

function start() {
  keys.clear(); hideToast();
  state.phase = 'playing';
  configure(); savePreferences();
  $('round-summary').hidden = true;
  setOverlay(false);
  previousTime = performance.now();
  $('announcement').textContent = `Round started. Park in bay ${state.world.lots[state.target].label}.`;
  scheduleFrame();
}

function pause(reason = 'manual') {
  if (state.phase !== 'playing') {
    if ($('overlay').hidden) setOverlay(true);
    return;
  }
  state.phase = 'paused';
  keys.clear(); state.rig.car.braking = false; accumulator = 0;
  if (frameId !== null) cancelAnimationFrame(frameId);
  frameId = null;
  hideToast();
  $('overlay-eyebrow').textContent = 'TAKE YOUR TIME. THE CLOCK CAN WAIT.';
  $('overlay-title').textContent = 'A little breathing room.';
  $('overlay-copy').textContent = reason === 'focus' ? 'Your drive is paused while you are away. Pick up exactly where you left off.' : 'Your round is paused. Resume your drive, or choose a fresh challenge below.';
  $('resume').hidden = false;
  $('start').textContent = 'Start a new round ↗';
  $('start').classList.add('secondary');
  $('round-summary').hidden = true;
  updateModeHelp(); updateHUD(); scene.draw(state, performance.now()); setOverlay(true);
}

function resume() {
  if (state.phase !== 'paused') return;
  $('mode').value = state.mode;
  keys.clear(); state.phase = 'playing'; accumulator = 0;
  previousTime = performance.now();
  setOverlay(false); updateHUD(); scheduleFrame();
}

function finish() {
  if (state.phase !== 'playing') return;
  state.phase = 'finished'; state.remaining = 0; keys.clear(); state.rig.car.braking = false;
  const record = state.score > (records.bestByMode[state.mode] || 0);
  saveResult(); hideToast();
  $('overlay-eyebrow').textContent = record ? 'A NEW PERSONAL BEST. NICELY DONE.' : 'ANOTHER DRIVE IN THE BOOKS.';
  $('overlay-title').textContent = `${state.score} ${state.score === 1 ? 'perfect park.' : 'perfect parks.'}`;
  $('overlay-copy').textContent = state.score === 0 ? 'Take it slow on the turns. Get fully inside the green bay, then hold Space to settle into place.' : record ? 'That is your best round in this mode. There is always room for one more.' : 'Smooth steering, a gentle approach, and one well-timed brake. Ready for another drive?';
  const summary = $('round-summary'); summary.replaceChildren();
  for (const [value, label] of [[state.cleanParks, 'without a bump'], [state.collisions, 'bumps'], [state.bestPark === null ? '—' : `${state.bestPark.toFixed(1)}s`, 'quickest park']]) {
    const item = document.createElement('div'), strong = document.createElement('strong');
    strong.textContent = value; item.append(strong, document.createTextNode(label)); summary.append(item);
  }
  summary.hidden = false;
  $('resume').hidden = true; $('start').classList.remove('secondary'); $('start').textContent = 'Another round ↗';
  $('announcement').textContent = `Round complete. ${state.score} parks. ${record ? 'New personal best.' : ''}`;
  updateHUD(); setOverlay(true);
}

function inputState() {
  return { up: keys.has('ArrowUp'), down: keys.has('ArrowDown'), left: keys.has('ArrowLeft'), right: keys.has('ArrowRight'), brake: keys.has('Space') };
}

function update(dt) {
  state.remaining = Math.max(0, state.remaining - dt);
  if (state.remaining <= 0) { finish(); return; }
  state.collisionCooldown = Math.max(0, state.collisionCooldown - dt);
  state.collisionFlash = Math.max(0, state.collisionFlash - dt * 2);
  const impact = physics.step(state.rig, inputState(), dt, state.world);
  if (impact > 15 && state.collisionCooldown === 0) {
    state.collisions++; state.legCollisions++; state.collisionCooldown = .9; state.collisionFlash = 1;
    toast('A little bump. Reverse gently and try a wider turn.', true);
  }
  const result = physics.parking(state.rig, state.world.lots[state.target]);
  state.parkedHold = result.ready ? state.parkedHold + dt : 0;
  if (state.parkedHold >= HOLD_TIME) {
    state.score++;
    if (state.legCollisions === 0) state.cleanParks++;
    const elapsed = state.legStarted - state.remaining;
    state.bestPark = state.bestPark === null ? elapsed : Math.min(state.bestPark, elapsed);
    state.celebration = { x: state.rig.car.x, y: state.rig.car.y, at: performance.now() };
    const clean = state.legCollisions === 0;
    chooseTarget();
    const label = state.world.lots[state.target].label;
    toast(`${clean ? 'Beautifully parked' : 'Park complete'}  +1  ·  Next: ${label}`);
  }
}

function setText(element, text) { if (element.textContent !== String(text)) element.textContent = text; }
function updateHUD() {
  const { car, trailer } = state.rig;
  const time = Math.ceil(state.remaining), progress = Math.min(1, state.parkedHold / HOLD_TIME);
  setText(ui.score, String(state.score).padStart(2, '0'));
  setText(ui.time, `${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`);
  ui.clock.classList.toggle('urgent', time <= 10);
  ui['time-fill'].style.transform = `scaleX(${state.remaining / roundDuration()})`;
  // 64 world units represent a compact car roughly 4.5 metres long.
  setText(ui.speed, Math.round(Math.abs(car.speed) * .253));
  setText(ui.gear, car.speed > .5 ? 'D' : car.speed < -.5 ? 'R' : 'N');
  ui['brake-indicator'].classList.toggle('active', car.braking);
  ui['parking-fill'].style.transform = `scaleX(${progress})`;
  const percent = String(Math.round(progress * 100));
  if (ui['parking-progress'].getAttribute('aria-valuenow') !== percent) ui['parking-progress'].setAttribute('aria-valuenow', percent);
  const lot = state.world.lots[state.target], result = physics.parking(state.rig, lot);
  let assist = 'FIND THE GREEN BAY';
  if (state.phase === 'menu') assist = 'GET READY';
  else if (state.phase === 'paused') assist = 'DRIVE PAUSED';
  else if (state.phase === 'finished') assist = 'ROUND COMPLETE';
  else if (result.ready) assist = 'HOLD STILL. LOOKING GOOD.';
  else if (result.inside) assist = 'SPACE TO STOP';
  else if (trailer && Math.abs(physics.wrapAngle(car.a - trailer.a)) > 1) assist = 'PULL FORWARD TO STRAIGHTEN';
  else if (Math.hypot(car.x - lot.x - lot.w / 2, car.y - lot.y - lot.h / 2) < lot.h / 2 + 50) assist = trailer ? 'GET BOTH FULLY INSIDE' : 'EASE INTO POSITION';
  setText(ui['assist-text'], assist);
  setText(ui['mission-text'], state.phase === 'playing' ? `Park ${trailer ? 'car + trailer' : 'your car'} in bay ${lot.label}. Stop inside the lines.` : state.phase === 'paused' ? 'Drive paused. Your time and position are safe.' : state.phase === 'finished' ? 'Round complete. A little better with every drive.' : 'Your next perfect park starts here.');
}

function loop(now) {
  frameId = null;
  if (state.phase !== 'playing') return;
  const elapsed = Math.max(0, (now - previousTime) / 1000);
  previousTime = now;
  // Freeze after suspension or a long stall instead of teleporting through walls.
  if (elapsed > .5) { pause('focus'); return; }
  accumulator += elapsed;
  while (accumulator >= physics.STEP && state.phase === 'playing') {
    update(physics.STEP); accumulator -= physics.STEP;
  }
  updateHUD(); scene.draw(state, now); scheduleFrame();
}

function normaliseKey(event) {
  return event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar' ? 'Space' : event.key;
}

addEventListener('keydown', event => {
  const key = normaliseKey(event);
  // Keep the modal usable with just the keyboard, including at small heights.
  if (!$('overlay').hidden && key === 'Tab') {
    const controls = [...$('overlay').querySelectorAll('button, input, select')].filter(el => !el.hidden && !el.disabled);
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
    return;
  }
  if (key === 'Escape' && !event.repeat) {
    event.preventDefault();
    if (state.phase === 'playing') pause();
    else if (state.phase === 'paused') resume();
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const editable = event.target?.closest('input, select, textarea, button, [contenteditable="true"], summary, a');
  if (editable) return;
  if (key.toLowerCase() === 'r' && !event.repeat) { event.preventDefault(); start(); return; }
  if (state.phase !== 'playing') return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(key)) {
    event.preventDefault(); keys.add(key);
  }
});
addEventListener('keyup', event => keys.delete(normaliseKey(event)));
addEventListener('blur', () => { keys.clear(); pause('focus'); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); pause('focus'); } });
$('start').addEventListener('click', start);
$('resume').addEventListener('click', resume);
$('menu').addEventListener('click', () => pause());
$('mode').addEventListener('change', () => {
  if (state.phase === 'menu') configure();
  updateModeHelp(); savePreferences();
});
$('color').addEventListener('input', () => { state.color = $('color').value; savePreferences(); scene.draw(state, performance.now()); });

try {
  const preferences = JSON.parse(localStorage.getItem('park_preferences_v1'));
  if (preferences && Object.hasOwn(modeNames, preferences.mode)) $('mode').value = preferences.mode;
  if (preferences && /^#[a-f0-9]{6}$/i.test(preferences.color)) $('color').value = preferences.color;
} catch { /* Defaults also work with blocked storage. */ }
configure();
canvas.inert = true;
new ResizeObserver(() => { scene.resize(); scene.draw(state, performance.now()); }).observe($('board-wrap'));
