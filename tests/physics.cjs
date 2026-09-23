const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../physics.js');
const open = { solids: [] };
function drive(rig, input, seconds, world = open) {
  for (let n = 0; n < Math.round(seconds / P.STEP); n++) P.step(rig, input, P.STEP, world);
}
function near(actual, expected, tolerance = 1e-8) { assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be close to ${expected}`); }

for (const trailer of [false, true]) {
  for (const speed of [174, 30, -84, -5]) {
    test(`Space stops ${trailer ? 'trailer rig' : 'car'} from ${speed} without changing direction`, () => {
      const rig = P.makeRig(trailer), before = rig.car.x;
      rig.car.speed = speed;
      let previous = Math.abs(speed);
      for (let i = 0; i < 120; i++) {
        P.step(rig, { brake: true }, P.STEP, open);
        assert.ok(rig.car.speed * speed >= 0);
        assert.ok(Math.abs(rig.car.speed) <= previous);
        previous = Math.abs(rig.car.speed);
      }
      assert.equal(rig.car.speed, 0);
      assert.ok(Math.abs(rig.car.x - before) < 48, 'stopping distance is short enough for a bay approach');
      const parked = { ...rig.car };
      drive(rig, { brake: true, up: true, right: true }, 2);
      assert.equal(rig.car.speed, 0, 'brake overrides the accelerator');
      near(rig.car.x, parked.x); near(rig.car.y, parked.y); near(rig.car.a, parked.a);
    });
  }
}

test('existing arrow pedals brake before changing direction; reverse is slower', () => {
  const rig = P.makeRig();
  drive(rig, { up: true }, 3);
  assert.equal(rig.car.speed, 174);
  drive(rig, { down: true }, .2);
  assert.ok(rig.car.speed > 0 && rig.car.speed < 120);
  assert.ok(rig.car.braking);
  drive(rig, { down: true }, 3);
  assert.equal(rig.car.speed, -84);
  drive(rig, { up: true }, .1);
  assert.ok(rig.car.speed < 0 && rig.car.braking);
  drive(rig, { up: true }, 2);
  assert.ok(rig.car.speed > 100);
});

test('both arrow pedals hold still; coasting gradually comes to a full stop', () => {
  const rig = P.makeRig();
  drive(rig, { up: true, down: true }, 2);
  assert.equal(rig.car.speed, 0);
  drive(rig, { up: true }, 1);
  const speed = rig.car.speed;
  drive(rig, {}, .1);
  assert.ok(rig.car.speed < speed && rig.car.speed > speed * .8);
  drive(rig, {}, 8);
  assert.equal(rig.car.speed, 0);
});

test('steering turns wheels at rest and reverses yaw when backing up', () => {
  const rig = P.makeRig();
  const angle = rig.car.a;
  drive(rig, { right: true }, .5);
  assert.ok(rig.car.steer > .5);
  near(rig.car.a, angle);
  drive(rig, { right: true, up: true }, .4);
  assert.ok(P.wrapAngle(rig.car.a - angle) > 0);
  const reverse = P.makeRig();
  drive(reverse, { right: true, down: true }, .4);
  assert.ok(P.wrapAngle(reverse.car.a - angle) < 0);
  drive(reverse, {}, .5);
  assert.equal(reverse.car.steer, 0);
});

test('front bumper cannot tunnel through curbs; reversing frees the car', () => {
  const world = P.makeWorld(), rig = P.makeRig();
  drive(rig, { up: true }, 10, world);
  assert.ok(!P.collides(rig, world));
  assert.ok(P.corners(rig.car).every(p => p.x >= 24));
  assert.ok(rig.car.x < 60);
  const stoppedX = rig.car.x;
  drive(rig, { down: true }, 1, world);
  assert.ok(rig.car.x > stoppedX + 20);
});

test('rotated cars cannot pass through parked vehicles or landscaping', () => {
  const world = P.makeWorld(), rig = P.makeRig();
  Object.assign(rig.car, { x: 277, y: 300, a: 0 });
  drive(rig, { up: true }, 4, world);
  assert.ok(!P.collides(rig, world));
  assert.ok(rig.car.y > 170, 'parked car blocks the occupied bay');
  Object.assign(rig.car, { x: 120, y: 300, a: -.18, speed: 174 });
  drive(rig, { up: true }, 2, world);
  assert.ok(!P.collides(rig, world));
  assert.ok(rig.car.y > 190, 'planter curb blocks the car');
});

test('SAT detects edge crossings and containment, allowing separated bodies', () => {
  const rect = P.corners({ x: 0, y: 0, w: 20, h: 100, a: 0 });
  assert.ok(P.overlaps(rect, P.corners({ x: 0, y: 0, w: 20, h: 100, a: Math.PI / 2 })));
  assert.ok(P.overlaps(rect, P.corners({ x: 0, y: 0, w: 5, h: 5, a: .5 })));
  assert.ok(!P.overlaps(rect, P.corners({ x: 100, y: 0, w: 20, h: 100, a: .5 })));
});

test('trailer keeps its drawbar length and never penetrates the car or scenery', () => {
  const world = P.makeWorld(true), rig = P.makeRig(true, world.height);
  let seed = 2026;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  let input = {};
  for (let i = 0; i < 18000; i++) {
    if (i % 90 === 0) { const reverse = random() < .45; input = { up: !reverse, down: reverse, left: random() < .4, right: random() < .4, brake: random() < .1 }; }
    P.step(rig, input, P.STEP, world);
    const h = P.hitch(rig.car);
    near(Math.hypot(h.x - rig.trailer.x, h.y - rig.trailer.y), 54, 1e-7);
    assert.ok(!P.collides(rig, world), `collision at step ${i}`);
    assert.ok([rig.car.x, rig.car.y, rig.car.a, rig.trailer.a].every(Number.isFinite));
  }
});

test('forward driving straightens an angled trailer', () => {
  const rig = P.makeRig(true), h = P.hitch(rig.car);
  rig.trailer.a += .4;
  rig.trailer.x = h.x - Math.sin(rig.trailer.a) * 54;
  rig.trailer.y = h.y + Math.cos(rig.trailer.a) * 54;
  drive(rig, { up: true }, 3);
  assert.ok(Math.abs(P.wrapAngle(rig.car.a - rig.trailer.a)) < .03);
});

test('every available bay fits the complete rig in either orientation', () => {
  for (const withTrailer of [false, true]) {
    const world = P.makeWorld(withTrailer);
    for (const [index, lot] of world.lots.entries()) {
      if (world.occupied.includes(index)) continue;
      for (const angle of [0, Math.PI]) {
        const rig = P.makeRig(withTrailer, world.height);
        Object.assign(rig.car, { x: lot.x + lot.w / 2, y: lot.y + lot.h / 2 - (withTrailer ? 47 * Math.cos(angle) : 0), a: angle });
        if (rig.trailer) { const h = P.hitch(rig.car); Object.assign(rig.trailer, { x: h.x - Math.sin(angle) * 54, y: h.y + Math.cos(angle) * 54, a: angle }); }
        assert.ok(!P.collides(rig, world));
        assert.ok(P.parking(rig, lot).ready, `${lot.label} must fit ${withTrailer ? 'trailer' : 'car'}`);
        rig.car.speed = 10;
        assert.ok(!P.parking(rig, lot).ready, 'rolling through is not parking');
        rig.car.speed = 0; rig.car.x = lot.x;
        assert.ok(!P.parking(rig, lot).ready, 'partial containment does not count');
      }
    }
  }
});

test('a trailer outside the bay prevents scoring even when the car is inside', () => {
  const world = P.makeWorld(true), rig = P.makeRig(true, world.height), lot = world.lots[0];
  Object.assign(rig.car, { x: lot.x + lot.w / 2, y: lot.y + lot.h - 40, a: 0 });
  const h = P.hitch(rig.car);
  Object.assign(rig.trailer, { x: h.x, y: h.y + 54, a: 0 });
  assert.ok(!P.parking(rig, lot).inside);
});

test('both modes can drive from spawn into a bay using only pedals, steering and brake', () => {
  for (const withTrailer of [false, true]) {
    const world = P.makeWorld(withTrailer), rig = P.makeRig(withTrailer, world.height);
    let stage = 'approach';
    for (let i = 0; i < 1200; i++) {
      const car = rig.car;
      if (stage === 'approach' && car.x < 432) stage = 'turn';
      if (stage === 'turn' && car.a > -.065) stage = 'enter';
      if (stage === 'enter' && car.y < (withTrailer ? 108 : 120)) stage = 'stop';
      const impact = P.step(rig, { up: stage !== 'stop' && car.speed < 55, right: stage === 'turn', brake: stage === 'stop' }, P.STEP, world);
      assert.equal(impact, 0, 'a controlled approach should not hit obstacles');
      if (stage === 'stop' && car.speed === 0) break;
    }
    assert.equal(stage, 'stop');
    assert.ok(P.parking(rig, world.lots[2]).ready, `${withTrailer ? 'trailer' : 'car'} can complete an actual parking manoeuvre`);
  }
});
