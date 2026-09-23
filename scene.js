/* Canvas artwork stays local and sharp at any display density. */
window.ParkScene = class ParkScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.background = document.createElement('canvas');
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    this.scale = 1;
  }

  configure(world) {
    this.world = world;
    this.resize();
  }

  resize() {
    if (!this.world) return;
    const { width, height } = this.world;
    const rect = this.canvas.getBoundingClientRect();
    this.scale = Math.min(2.5, Math.max(1, Math.min(rect.width / width, rect.height / height) * (devicePixelRatio || 1)));
    this.canvas.width = Math.round(width * this.scale);
    this.canvas.height = Math.round(height * this.scale);
    this.background.width = this.canvas.width;
    this.background.height = this.canvas.height;
    const ctx = this.background.getContext('2d');
    ctx.setTransform(this.canvas.width / width, 0, 0, this.canvas.height / height, 0, 0);
    this.drawGround(ctx);
  }

  rect(ctx, x, y, w, h, radius, fill, stroke) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  text(ctx, text, x, y, size, color, weight = 600) {
    ctx.font = `${weight} ${size}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(text, x, y);
  }

  drawGround(ctx) {
    const { width: w, height: h, lots, islands } = this.world;
    ctx.fillStyle = '#2e3734'; ctx.fillRect(0, 0, w, h);
    const light = ctx.createRadialGradient(w * .4, h * .4, 40, w / 2, h / 2, w * .65);
    light.addColorStop(0, '#5b685525'); light.addColorStop(1, '#0b191444');
    ctx.fillStyle = light; ctx.fillRect(0, 0, w, h);
    // A seeded texture is generated once, never randomised on each frame.
    let seed = 1947;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 23000; i++) {
      ctx.fillStyle = i % 3 === 0 ? '#b1bfa510' : '#101a1818';
      ctx.fillRect(random() * w, random() * h, random() * 1.6 + .3, .7);
    }
    // Subtle weathered asphalt seams.
    ctx.strokeStyle = '#17211e44'; ctx.lineWidth = 1;
    for (const x of [137, 430, 820]) {
      ctx.beginPath(); ctx.moveTo(x, 24); ctx.lineTo(x + 3, h * .42); ctx.lineTo(x - 2, h * .75); ctx.lineTo(x + 4, h - 24); ctx.stroke();
    }
    ctx.fillStyle = '#687267';
    ctx.fillRect(0, 0, w, 24); ctx.fillRect(0, h - 24, w, 24); ctx.fillRect(0, 0, 24, h); ctx.fillRect(w - 24, 0, 24, h);
    ctx.fillStyle = '#86907b';
    ctx.fillRect(24, 22, w - 48, 3); ctx.fillRect(24, h - 25, w - 48, 3); ctx.fillRect(22, 24, 3, h - 48); ctx.fillRect(w - 25, 24, 3, h - 48);
    ctx.strokeStyle = '#35443870'; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 22); ctx.moveTo(x, h - 22); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(22, y); ctx.moveTo(w - 22, y); ctx.lineTo(w, y); ctx.stroke(); }
    lots.forEach(lot => {
      ctx.strokeStyle = '#ced2b57a'; ctx.lineWidth = 2;
      const back = lot.row ? lot.y + lot.h : lot.y, front = lot.row ? lot.y : lot.y + lot.h;
      ctx.beginPath(); ctx.moveTo(lot.x, front); ctx.lineTo(lot.x, back); ctx.lineTo(lot.x + lot.w, back); ctx.lineTo(lot.x + lot.w, front); ctx.stroke();
      this.text(ctx, lot.label, lot.x + lot.w / 2, lot.row ? lot.y + lot.h + 17 : lot.y - 9, 11, '#acb5a4', 650);
      // Wheel stops are paint, not additional invisible collision objects.
      this.rect(ctx, lot.x + 13, lot.row ? lot.y + lot.h - 14 : lot.y + 10, lot.w - 26, 4, 1, '#a8ab9070');
    });
    for (const row of [0, 1]) {
      const y = row ? h - 52 - lots[0].h : 52;
      ctx.save();
      ctx.beginPath(); ctx.rect(438, y, 84, lots[0].h); ctx.clip();
      ctx.strokeStyle = '#c2b98120'; ctx.lineWidth = 2;
      for (let dy = -84; dy < lots[0].h + 84; dy += 19) { ctx.beginPath(); ctx.moveTo(438, y + dy); ctx.lineTo(522, y + dy + 84); ctx.stroke(); }
      ctx.restore();
      this.rect(ctx, 448, y + lots[0].h / 2 - 22, 64, 44, 3, '#2e3833');
      this.text(ctx, 'KEEP', 480, y + lots[0].h / 2 - 3, 11, '#b2b29790');
      this.text(ctx, 'CLEAR', 480, y + lots[0].h / 2 + 12, 11, '#b2b29790');
    }
    ctx.strokeStyle = '#c4cbb64a'; ctx.lineWidth = 2; ctx.setLineDash([18, 17]);
    ctx.beginPath(); ctx.moveTo(154, h / 2); ctx.lineTo(806, h / 2); ctx.stroke(); ctx.setLineDash([]);
    this.roadArrow(ctx, 260, h / 2 - 44, -Math.PI / 2);
    this.roadArrow(ctx, 700, h / 2 + 44, Math.PI / 2);
    this.text(ctx, 'S L O W', 480, h / 2 + 57, 11, '#bdc4b735');
    this.text(ctx, 'G A R D E N   L O T', 480, 17, 10, '#e0e5d3a0');
    this.text(ctx, 'P A R K   /   0 1', 480, h - 7, 10, '#e0e5d3a0');
    for (const x of [39, w - 51]) {
      this.rect(ctx, x, h / 2 - 20, 12, 40, 2, '#1c2522', '#6a756655');
      ctx.fillStyle = '#86908055';
      for (let y = h / 2 - 16; y < h / 2 + 18; y += 5) ctx.fillRect(x + 2, y, 8, 1);
    }
    for (const island of islands) {
      ctx.save(); ctx.shadowColor = '#07130c65'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 6;
      this.rect(ctx, island.x, island.y, island.w, island.h, 12, '#87917b'); ctx.restore();
      this.rect(ctx, island.x + 4, island.y + 4, island.w - 8, island.h - 8, 9, '#334d35');
      this.rect(ctx, island.x + 8, island.y + 8, island.w - 16, island.h - 16, 8, '#405638');
      for (let y = island.y + 29; y < island.y + island.h - 12; y += 45) this.tree(ctx, island.x + island.w / 2, y, random);
      for (const y of [island.y + 9, island.y + island.h - 9]) {
        this.rect(ctx, island.x + 19, y - 3, 12, 6, 2, '#d1c596');
        ctx.fillStyle = '#ffe5ae80'; ctx.fillRect(island.x + 22, y - 1, 6, 2);
      }
    }
    this.world.parked.forEach(car => this.drawCar(ctx, car, car.color, false));
  }

  roadArrow(ctx, x, y, angle) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = '#c8d0bb50';
    ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(10, -6); ctx.lineTo(4, -6); ctx.lineTo(4, 17); ctx.lineTo(-4, 17); ctx.lineTo(-4, -6); ctx.lineTo(-10, -6); ctx.closePath(); ctx.fill(); ctx.restore();
  }

  tree(ctx, x, y, random) {
    ctx.save(); ctx.shadowColor = '#07190ec0'; ctx.shadowBlur = 10; ctx.shadowOffsetX = 7; ctx.shadowOffsetY = 9;
    ctx.fillStyle = '#26412d'; ctx.beginPath(); ctx.arc(x, y, 19, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    for (let i = 0; i < 14; i++) {
      const angle = random() * Math.PI * 2, distance = random() * 14;
      ctx.fillStyle = ['#4a6740', '#58764a', '#3a5838', '#63814e'][i % 4];
      ctx.beginPath(); ctx.arc(x + Math.cos(angle) * distance - 2, y + Math.sin(angle) * distance - 2, 6 + random() * 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#95a66744'; ctx.beginPath(); ctx.arc(x - 7, y - 8, 5, 0, Math.PI * 2); ctx.fill();
  }

  drawLights(ctx, car) {
    ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.a);
    const beam = ctx.createLinearGradient(0, -car.h / 2, 0, -car.h / 2 - 100);
    beam.addColorStop(0, '#f2ecc91c'); beam.addColorStop(1, '#f2ecc900');
    ctx.fillStyle = beam;
    for (const x of [-11, 11]) {
      ctx.beginPath(); ctx.moveTo(x - 4, -29); ctx.lineTo(x - 32, -125); ctx.lineTo(x + 32, -125); ctx.lineTo(x + 4, -29); ctx.fill();
    }
    ctx.restore();
  }

  brakeLights(ctx, width, length, active, reverse) {
    ctx.save();
    ctx.fillStyle = active ? '#ff6d55' : '#923e38';
    ctx.shadowColor = '#ff533b'; ctx.shadowBlur = active ? 13 : 0;
    this.rect(ctx, -width / 2 + 3, length / 2 - 6, 8, 3, 1, ctx.fillStyle);
    this.rect(ctx, width / 2 - 11, length / 2 - 6, 8, 3, 1, ctx.fillStyle);
    if (active) this.rect(ctx, -5, length / 2 - 8, 10, 2, 1, '#ff6d55');
    if (reverse) { ctx.shadowColor = '#fffbd6'; ctx.fillStyle = '#fffbd6'; ctx.fillRect(-7, length / 2 - 5, 3, 2); ctx.fillRect(4, length / 2 - 5, 3, 2); }
    ctx.restore();
  }

  drawCar(ctx, car, color, player) {
    ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.a);
    ctx.save(); ctx.shadowColor = '#050e0ddd'; ctx.shadowBlur = 7; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 5;
    this.rect(ctx, -17, -32, 34, 64, 9, '#121b18'); ctx.restore();
    for (const x of [-17, 17]) for (const y of [-19, 20]) {
      ctx.save(); ctx.translate(x, y); if (y < 0 && player) ctx.rotate(car.steer);
      this.rect(ctx, -3, -7, 6, 14, 2, '#0b1110'); ctx.fillStyle = '#59615a'; ctx.fillRect(x < 0 ? -3 : 2, -4, 1, 8); ctx.restore();
    }
    const paint = ctx.createLinearGradient(-17, 0, 17, 0);
    paint.addColorStop(0, '#1a211d'); paint.addColorStop(.12, color); paint.addColorStop(.5, color); paint.addColorStop(.87, color); paint.addColorStop(1, '#253027');
    this.rect(ctx, -17, -32, 34, 64, 8, paint, '#0b151888');
    this.rect(ctx, -14, -29, 28, 14, 5, '#ffffff10');
    ctx.strokeStyle = '#161e2033'; ctx.lineWidth = .7;
    ctx.beginPath(); ctx.moveTo(-10, -25); ctx.lineTo(-11, -18); ctx.moveTo(10, -25); ctx.lineTo(11, -18); ctx.stroke();
    ctx.fillStyle = '#172e30';
    ctx.beginPath(); ctx.moveTo(-12, -16); ctx.quadraticCurveTo(0, -20, 12, -16); ctx.lineTo(10, -4); ctx.lineTo(-10, -4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#aed1c63a'; ctx.beginPath(); ctx.moveTo(-11, -15); ctx.lineTo(5, -16); ctx.lineTo(-3, -5); ctx.lineTo(-10, -5); ctx.fill();
    this.rect(ctx, -10, -2, 20, 18, 4, color);
    this.rect(ctx, -9, -1, 18, 2, 1, '#ffffff28');
    ctx.fillStyle = '#192d2e'; ctx.beginPath(); ctx.moveTo(-10, 17); ctx.lineTo(10, 17); ctx.lineTo(12, 25); ctx.lineTo(-12, 25); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b3d1c429'; ctx.fillRect(-8, 18, 13, 2);
    ctx.fillStyle = '#142524'; ctx.fillRect(-15, -8, 3, 22); ctx.fillRect(12, -8, 3, 22);
    this.rect(ctx, -21, -12, 5, 7, 2, color); this.rect(ctx, 16, -12, 5, 7, 2, color);
    ctx.fillStyle = '#ffffff55'; ctx.fillRect(-14, 8, 2, 4); ctx.fillRect(12, 8, 2, 4);
    ctx.save(); ctx.shadowColor = '#fff3c1'; ctx.shadowBlur = player ? 7 : 0;
    this.rect(ctx, -13, -30, 8, 3, 1, player ? '#fff0bc' : '#b8c3b6'); this.rect(ctx, 5, -30, 8, 3, 1, player ? '#fff0bc' : '#b8c3b6'); ctx.restore();
    this.rect(ctx, -6, -31, 12, 2, 1, '#172421');
    this.rect(ctx, -5, 29, 10, 2, 1, '#e3dfbb');
    this.brakeLights(ctx, car.w, car.h, player && car.braking, player && car.speed < -.5);
    ctx.restore();
  }

  drawTrailer(ctx, rig) {
    const trailer = rig.trailer, h = ParkPhysics.hitch(rig.car);
    ctx.strokeStyle = '#88958c'; ctx.lineWidth = 3;
    const sin = Math.sin(trailer.a), cos = Math.cos(trailer.a);
    const front = { x: trailer.x + sin * 26, y: trailer.y - cos * 26 };
    ctx.beginPath(); ctx.moveTo(front.x - cos * 12, front.y - sin * 12); ctx.lineTo(h.x, h.y); ctx.lineTo(front.x + cos * 12, front.y + sin * 12); ctx.stroke();
    ctx.save(); ctx.translate(trailer.x, trailer.y); ctx.rotate(trailer.a);
    this.rect(ctx, -20, -2, 6, 16, 2, '#0d1713'); this.rect(ctx, 14, -2, 6, 16, 2, '#0d1713');
    ctx.save(); ctx.shadowColor = '#020c0999'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 5;
    this.rect(ctx, -16, -29, 32, 58, 4, '#d4d9cd'); ctx.restore();
    const roof = ctx.createLinearGradient(-14, 0, 14, 0); roof.addColorStop(0, '#b0baad'); roof.addColorStop(.25, '#f1f1e6'); roof.addColorStop(1, '#c7cfc1');
    this.rect(ctx, -14, -27, 28, 52, 3, roof, '#879786');
    ctx.strokeStyle = '#a7b3a4'; ctx.lineWidth = 1;
    for (const x of [-8, 0, 8]) { ctx.beginPath(); ctx.moveTo(x, -22); ctx.lineTo(x, 21); ctx.stroke(); }
    this.rect(ctx, -9, -4, 18, 12, 2, '#b9c4b5');
    this.text(ctx, 'P', 0, 5, 9, '#738570', 800);
    this.brakeLights(ctx, trailer.w, trailer.h, rig.car.braking, rig.car.speed < -.5);
    ctx.restore();
  }

  drawTarget(ctx, state, now) {
    const lot = this.world.lots[state.target], pulse = this.reducedMotion.matches ? .5 : .5 + Math.sin(now * .003) * .5;
    const progress = Math.min(1, state.parkedHold / .75);
    ctx.save();
    ctx.shadowColor = '#bff19d'; ctx.shadowBlur = 7 + pulse * 5; ctx.lineWidth = 2;
    this.rect(ctx, lot.x + 2, lot.y + 2, lot.w - 4, lot.h - 4, 4, `rgba(169, 228, 136, ${.08 + progress * .12})`, '#c4ee91');
    ctx.shadowBlur = 0;
    // Corner brackets keep the goal legible even with the player in the bay.
    ctx.lineWidth = 4; ctx.strokeStyle = '#d1f5a7';
    for (const [x, y, sx, sy] of [[lot.x, lot.y, 1, 1], [lot.x + lot.w, lot.y, -1, 1], [lot.x, lot.y + lot.h, 1, -1], [lot.x + lot.w, lot.y + lot.h, -1, -1]]) {
      ctx.beginPath(); ctx.moveTo(x, y + sy * 13); ctx.lineTo(x, y); ctx.lineTo(x + sx * 13, y); ctx.stroke();
    }
    ctx.globalAlpha = .28; ctx.setLineDash([4, 5]); ctx.lineWidth = 1;
    const bodyLength = state.rig.trailer ? 155 : 64;
    this.rect(ctx, lot.x + lot.w / 2 - 17, lot.y + lot.h / 2 - bodyLength / 2, 34, bodyLength, 7, null, '#ddf4ca');
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    this.text(ctx, 'P', lot.x + lot.w / 2, lot.y + lot.h / 2 + 9, 28, '#ceefa784', 650);
    const labelY = lot.row ? lot.y - 17 : lot.y + lot.h + 25;
    this.rect(ctx, lot.x + lot.w / 2 - 26, labelY - 13, 52, 20, 4, '#c4ee91');
    this.text(ctx, lot.label, lot.x + lot.w / 2, labelY + 1, 12, '#243923', 800);
    if (progress > 0) {
      ctx.fillStyle = '#d5f6a8'; ctx.fillRect(lot.x + 7, lot.y + lot.h - 8, (lot.w - 14) * progress, 3);
    }
    ctx.restore();
  }

  draw(state, now) {
    const ctx = this.ctx, { width: w, height: h } = this.world;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(this.background, 0, 0);
    ctx.setTransform(this.canvas.width / w, 0, 0, this.canvas.height / h, 0, 0);
    this.drawTarget(ctx, state, now);
    // Brief, restrained rings mark a successful park without hiding the next bay.
    if (state.celebration && !this.reducedMotion.matches) {
      const age = (now - state.celebration.at) / 1000;
      if (age < 1.2) {
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - age / 1.2); ctx.strokeStyle = '#d7f8ae'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(state.celebration.x, state.celebration.y, 26 + age * 38, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    }
    this.drawLights(ctx, state.rig.car);
    if (state.rig.trailer) this.drawTrailer(ctx, state.rig);
    this.drawCar(ctx, state.rig.car, state.color, true);
    if (state.collisionFlash > 0 && !this.reducedMotion.matches) {
      ctx.strokeStyle = `rgba(246, 153, 107, ${state.collisionFlash * .5})`; ctx.lineWidth = 5; ctx.strokeRect(27, 27, w - 54, h - 54);
    }
  }
};
