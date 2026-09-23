/* Shared by the browser and the dependency-free physics tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ParkPhysics = factory();
})(globalThis, () => {
  'use strict';

  const STEP = 1 / 120;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const approach = (value, target, amount) => value + clamp(target - value, -amount, amount);
  const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

  function corners(body) {
    const cos = Math.cos(body.a), sin = Math.sin(body.a);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => ({
      x: body.x + x * body.w / 2 * cos - y * body.h / 2 * sin,
      y: body.y + x * body.w / 2 * sin + y * body.h / 2 * cos,
    }));
  }

  // SAT handles both rotated edge crossings and complete containment.
  function overlaps(a, b) {
    for (const polygon of [a, b]) {
      for (let i = 0; i < polygon.length; i++) {
        const p = polygon[i], q = polygon[(i + 1) % polygon.length];
        const ax = p.y - q.y, ay = q.x - p.x;
        let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
        for (const v of a) { const d = v.x * ax + v.y * ay; aMin = Math.min(aMin, d); aMax = Math.max(aMax, d); }
        for (const v of b) { const d = v.x * ax + v.y * ay; bMin = Math.min(bMin, d); bMax = Math.max(bMax, d); }
        if (aMax <= bMin || bMax <= aMin) return false;
      }
    }
    return true;
  }

  function makeWorld(withTrailer = false) {
    const width = 960, height = withTrailer ? 680 : 600, depth = withTrailer ? 198 : 128;
    const lots = [52, height - 52 - depth].flatMap((y, row) =>
      [150, 240, 330, 556, 646, 736].map((x, column) => ({
        x, y, w: 74, h: depth, label: `${row ? 'B' : 'A'}${column + 1}`, row,
      })));
    const islands = [42, height - 62 - depth].flatMap(y => [74, 836].map(x => ({ x, y, w: 50, h: depth + 20 })));
    const curbs = [{ x: 0, y: 0, w: width, h: 24 }, { x: 0, y: height - 24, w: width, h: 24 },
      { x: 0, y: 0, w: 24, h: height }, { x: width - 24, y: 0, w: 24, h: height }, ...islands];
    const occupied = [1, 4, 7, 10];
    const colors = ['#708faa', '#bd7670', '#9b9b83', '#8889a8'];
    const parked = occupied.map((index, n) => {
      const lot = lots[index];
      return { x: lot.x + lot.w / 2, y: lot.y + lot.h / 2, a: lot.row ? Math.PI : 0, w: 34, h: 64, color: colors[n] };
    });
    const solids = [...curbs.map(r => corners({ x: r.x + r.w / 2, y: r.y + r.h / 2, w: r.w, h: r.h, a: 0 })), ...parked.map(corners)];
    return { width, height, lots, islands, curbs, parked, occupied, solids };
  }

  function hitch(car) {
    return { x: car.x - Math.sin(car.a) * 40, y: car.y + Math.cos(car.a) * 40 };
  }

  function makeRig(withTrailer = false, height = 600) {
    const car = { x: 480, y: height / 2, a: -Math.PI / 2, w: 34, h: 64, speed: 0, steer: 0, braking: false };
    const h = hitch(car);
    const trailer = withTrailer ? { x: h.x - Math.sin(car.a) * 54, y: h.y + Math.cos(car.a) * 54, a: car.a, w: 32, h: 58 } : null;
    return { car, trailer };
  }

  function collides(rig, world) {
    const carShape = corners(rig.car);
    if (world.solids.some(shape => overlaps(carShape, shape))) return true;
    if (!rig.trailer) return false;
    const trailerShape = corners(rig.trailer);
    return overlaps(carShape, trailerShape) || world.solids.some(shape => overlaps(trailerShape, shape));
  }

  function step(rig, input, dt, world) {
    const { car, trailer } = rig;
    const old = { x: car.x, y: car.y, a: car.a }, oldTrailer = trailer && { ...trailer };
    const throttle = Number(!!input.up) - Number(!!input.down);
    const opposing = throttle !== 0 && car.speed * throttle < -0.1;
    car.braking = !!input.brake || (!!input.up && !!input.down) || opposing;
    const load = trailer ? 0.84 : 1;

    if (car.braking) {
      // Approach zero: a brake must never turn into reverse thrust.
      car.speed = approach(car.speed, 0, (input.brake ? 390 : 310) * load * dt);
    } else if (throttle) {
      car.speed += throttle * (throttle > 0 ? 158 : 110) * load * dt;
    }
    const resistance = 12 + Math.abs(car.speed) * 0.19 + car.speed * car.speed * 0.0008;
    car.speed = approach(car.speed, 0, resistance * dt);
    car.speed = clamp(car.speed, trailer ? -72 : -84, trailer ? 154 : 174);

    const steeringInput = Number(!!input.right) - Number(!!input.left);
    const steeringLimit = 0.61 / (1 + Math.abs(car.speed) / 360);
    car.steer = approach(car.steer, steeringInput * steeringLimit, (steeringInput ? 2.3 : 2.9) * dt);

    // Bicycle model, integrated about the rear axle rather than the body centre.
    // Reverse naturally reverses the turn; steering while stopped only turns the wheels.
    const rearOffset = 20, wheelbase = 43;
    const rearX = car.x - Math.sin(car.a) * rearOffset;
    const rearY = car.y + Math.cos(car.a) * rearOffset;
    const turn = car.speed / wheelbase * Math.tan(car.steer) * dt;
    const middleAngle = car.a + turn / 2;
    car.a = wrapAngle(car.a + turn);
    car.x = rearX + Math.sin(middleAngle) * car.speed * dt + Math.sin(car.a) * rearOffset;
    car.y = rearY - Math.cos(middleAngle) * car.speed * dt - Math.cos(car.a) * rearOffset;

    if (trailer) {
      const h = hitch(car);
      // The axle follows the hitch with a fixed drawbar length. Small fixed steps
      // preserve the natural instability when backing up without sideways drift.
      trailer.a = Math.atan2(h.x - trailer.x, -(h.y - trailer.y));
      trailer.x = h.x - Math.sin(trailer.a) * 54;
      trailer.y = h.y + Math.cos(trailer.a) * 54;
    }

    if (collides(rig, world)) {
      const impact = Math.abs(car.speed);
      Object.assign(car, old);
      if (trailer) Object.assign(trailer, oldTrailer);
      car.speed = 0;
      return impact;
    }
    return 0;
  }

  function parking(rig, lot) {
    const points = [...corners(rig.car), ...(rig.trailer ? corners(rig.trailer) : [])];
    const inside = points.every(p => p.x >= lot.x + 5 && p.x <= lot.x + lot.w - 5 && p.y >= lot.y + 5 && p.y <= lot.y + lot.h - 5);
    return { inside, stopped: Math.abs(rig.car.speed) < 4, ready: inside && Math.abs(rig.car.speed) < 4 };
  }

  return { STEP, clamp, approach, wrapAngle, corners, overlaps, makeWorld, makeRig, hitch, collides, step, parking };
});
