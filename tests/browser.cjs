/* Run against a local HTTP server. Playwright is a development-only tool. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const url = process.env.PARK_URL || 'http://127.0.0.1:8765';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  await context.route('https://www.googletagmanager.com/**', route => route.abort());
  const legacy = { version: 1, bestByMode: { 'classic-60s': 8, 'trailer-180s': 3 }, history: [{ mode: 'classic-60s', score: 8, at: 1750000000000 }] };
  await context.addCookies([{ name: 'park_scores_v1', value: encodeURIComponent(JSON.stringify(legacy)), url }]);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const snapshot = name => process.env.PARK_SCREENSHOT_DIR ? page.screenshot({ path: path.join(process.env.PARK_SCREENSHOT_DIR, name + '.png'), fullPage: true }) : Promise.resolve();
  const read = () => page.evaluate(() => ({ phase: state.phase, car: { ...state.rig.car }, remaining: state.remaining, score: state.score, target: state.target, hold: state.parkedHold, mode: state.mode, collisions: state.collisions }));
  const start = async () => { await page.click('#start'); await page.waitForFunction(() => state.phase === 'playing'); };
  const parkInTarget = () => page.evaluate(() => {
    const lot = state.world.lots[state.target];
    Object.assign(state.rig.car, { x: lot.x + lot.w / 2, y: lot.y + lot.h / 2 - (state.rig.trailer ? 47 : 0), a: 0, steer: 0, speed: 0 });
    if (state.rig.trailer) {
      const h = physics.hitch(state.rig.car);
      Object.assign(state.rig.trailer, { x: h.x, y: h.y + 54, a: 0 });
    }
  });
  try {
    if (process.env.PARK_SCREENSHOT_DIR) fs.mkdirSync(process.env.PARK_SCREENSHOT_DIR, { recursive: true });
    await page.goto(url);
    await page.waitForFunction(() => typeof state !== 'undefined' && !!state.rig);
    assert.equal(await page.textContent('#best'), '08', 'legacy personal best survives');
    assert.equal(await page.locator('script[src*="gtag/js?id=G-WTPHWDLQ7K"]').count(), 1);
    assert.match(await page.textContent('footer'), /Space.*brake/);
    assert.equal(await page.locator('#game').evaluate(el => el.inert), true, 'canvas cannot steal focus behind the dialog');
    await snapshot('menu-desktop');
    await start();
    await snapshot('play-desktop');
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(() => state.rig.car.speed > 75);
    const accelerating = await read();
    assert.ok(accelerating.car.x < 470, 'up arrow drives forward');
    await page.keyboard.down('Space');
    await page.waitForFunction(() => state.rig.car.speed === 0);
    const stopped = await read();
    assert.ok(stopped.car.x > accelerating.car.x - 25, 'space brakes promptly');
    await page.waitForTimeout(160);
    assert.equal((await read()).car.x, stopped.car.x, 'space overrides a held accelerator');
    assert.equal(await page.locator('#brake-indicator').evaluate(el => el.classList.contains('active')), true);
    assert.equal(await page.evaluate(() => window.scrollY), 0, 'space does not scroll the page');
    await page.keyboard.up('ArrowUp'); await page.keyboard.up('Space');
    console.log('PASS: original forward control, Space stopping, brake priority, lights indicator, no page scrolling');

    await page.keyboard.down('ArrowDown');
    await page.waitForFunction(() => state.rig.car.speed < -35);
    await page.keyboard.up('ArrowDown'); await page.keyboard.down('Space');
    await page.waitForFunction(() => state.rig.car.speed === 0);
    await page.keyboard.up('Space');
    assert.equal(await page.textContent('#gear'), 'N');
    const stationary = await read();
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(200); await page.keyboard.up('ArrowRight');
    assert.equal((await read()).car.a, stationary.car.a, 'steering at rest cannot rotate the car');
    console.log('PASS: reverse braking and steering at rest');

    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(() => state.rig.car.speed > 20);
    await page.keyboard.press('Escape'); await page.keyboard.up('ArrowUp');
    const paused = await read();
    assert.equal(paused.phase, 'paused');
    await page.waitForTimeout(250);
    assert.deepEqual(await read(), paused, 'paused time and position are frozen');
    await page.selectOption('#mode', 'trailer-180s');
    await page.click('#resume');
    assert.equal((await read()).mode, 'classic-60s', 'changing next mode cannot mutate a paused round');
    assert.ok((await read()).remaining <= paused.remaining);
    await page.keyboard.press('r');
    assert.ok((await read()).remaining > 59.5);
    assert.equal((await read()).car.speed, 0, 'restart clears held input');
    await page.keyboard.down('ArrowUp');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.keyboard.up('ArrowUp');
    assert.equal((await read()).phase, 'paused', 'losing focus pauses automatically');
    await page.keyboard.press('Escape');
    assert.equal((await read()).phase, 'playing', 'Escape also resumes');
    await page.evaluate(() => { previousTime = performance.now() - 900; });
    await page.waitForFunction(() => state.phase === 'paused');
    console.log('PASS: Escape, resume, restart, input cleanup, focus loss, suspended frame protection');

    await start();
    await parkInTarget();
    await page.waitForFunction(() => state.parkedHold > .2);
    await page.evaluate(() => { state.rig.car.x = state.world.lots[state.target].x; });
    await page.waitForFunction(() => state.parkedHold === 0);
    assert.equal((await read()).score, 0, 'leaving a bay interrupts parking');
    await parkInTarget();
    const firstTarget = (await read()).target;
    await page.waitForFunction(() => state.score === 1);
    assert.notEqual((await read()).target, firstTarget);
    await page.waitForTimeout(900);
    assert.equal((await read()).score, 1, 'same bay cannot score twice');
    await page.evaluate(() => { state.remaining = .015; });
    await page.waitForFunction(() => state.phase === 'finished');
    assert.equal(await page.textContent('#time'), '0:00');
    assert.match(await page.textContent('#round-summary'), /without a bump/);
    const saved = await page.evaluate(() => JSON.parse(decodeURIComponent(document.cookie.split('; ').find(x => x.startsWith('park_scores_v1=')).split('=')[1])));
    assert.equal(saved.bestByMode['classic-60s'], 8, 'lower new score cannot erase legacy record');
    assert.equal(saved.history.length, 2, 'one finished round produces exactly one history entry');
    assert.equal(saved.history[1].score, 1);
    await snapshot('round-summary');
    console.log('PASS: parking hold reset, scoring once, new target, timer expiry and legacy-compatible persistence');

    await page.selectOption('#mode', 'trailer-180s'); await start();
    assert.equal((await read()).mode, 'trailer-180s');
    assert.equal(await page.textContent('#best'), '03');
    assert.ok((await read()).remaining > 179);
    await snapshot('trailer-desktop');
    await page.evaluate(() => {
      const lot = state.world.lots[state.target];
      Object.assign(state.rig.car, { x: lot.x + lot.w / 2, y: lot.y + lot.h - 40, a: 0, speed: 0, steer: 0 });
      const h = physics.hitch(state.rig.car);
      Object.assign(state.rig.trailer, { x: h.x, y: h.y + 54, a: 0 });
    });
    await page.waitForTimeout(850);
    assert.equal((await read()).score, 0, 'trailer outside target blocks points');
    await parkInTarget();
    await page.waitForFunction(() => state.score === 1);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    assert.ok(await page.locator('#overlay').evaluate(el => el.contains(document.activeElement)), 'modal contains keyboard focus');
    await page.locator('.menu-credit a').focus(); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'mode', 'Tab wraps inside dialog');
    console.log('PASS: full trailer containment, trailer scoring, distinct record, modal keyboard navigation');

    for (const [width, height] of [[1280, 720], [1024, 768], [800, 600], [390, 844], [360, 640]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(80);
      const layout = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        canvas: canvas.getBoundingClientRect().toJSON(),
        board: $('board-wrap').getBoundingClientRect().toJSON(),
        controls: document.querySelector('footer').getBoundingClientRect().toJSON(),
      }));
      assert.ok(layout.scrollWidth <= layout.width, `no horizontal overflow at ${width}x${height}`);
      assert.ok(layout.canvas.height > 200 && layout.canvas.width > 300, 'board remains usable');
      assert.ok(Math.abs(layout.canvas.height - layout.board.height) < 1, 'canvas fits its frame');
      if (width >= 800) assert.ok(layout.controls.bottom <= height, 'desktop instructions fit in viewport');
      await snapshot(`menu-${width}x${height}`);
      await page.click('#resume');
      await snapshot(`play-${width}x${height}`);
      await page.keyboard.press('Escape');
    }
    console.log('PASS: desktop, short-window and small-screen layout, readable controls, no horizontal overflow');

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    assert.equal(await page.inputValue('#mode'), 'trailer-180s', 'mode preference survives reload');
    assert.equal(await page.textContent('#best'), '03');
    await page.evaluate(() => {
      Object.defineProperty(document, 'cookie', { configurable: true, get: () => '', set: () => {} });
      state.phase = 'playing'; state.score = 0; finish();
    });
    assert.match(await page.textContent('#storage-status'), /session only/);
    await start(); assert.equal((await read()).phase, 'playing', 'blocked cookies do not stop play');
    console.log('PASS: preferences, reduced motion and blocked-cookie fallback');
    assert.deepEqual(errors, [], 'no browser JavaScript errors');
    console.log('PASS: no JavaScript errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
