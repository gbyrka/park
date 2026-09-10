const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const scoreEl = document.querySelector('#score');
const timeEl = document.querySelector('#time');
const overlay = document.querySelector('#overlay');
const titleEl = document.querySelector('#overlay-title');
const copyEl = document.querySelector('#overlay-copy');
const startBtn = document.querySelector('#start');

const W = canvas.width, H = canvas.height;
const keys = new Set();
const lots = [
  {x:150,y:52,w:74,h:128,a:0},{x:240,y:52,w:74,h:128,a:0},{x:330,y:52,w:74,h:128,a:0},{x:556,y:52,w:74,h:128,a:0},{x:646,y:52,w:74,h:128,a:0},{x:736,y:52,w:74,h:128,a:0},
  {x:150,y:420,w:74,h:128,a:0},{x:240,y:420,w:74,h:128,a:0},{x:330,y:420,w:74,h:128,a:0},{x:556,y:420,w:74,h:128,a:0},{x:646,y:420,w:74,h:128,a:0},{x:736,y:420,w:74,h:128,a:0}
];
const obstacles = [
  {x:0,y:0,w:960,h:24},{x:0,y:576,w:960,h:24},{x:0,y:0,w:24,h:600},{x:936,y:0,w:24,h:600},
  {x:74,y:42,w:50,h:148},{x:836,y:42,w:50,h:148},{x:74,y:410,w:50,h:148},{x:836,y:410,w:50,h:148}
];
const parked = [1,4,7,10];
let car, target, score, seconds, running = false, last = 0, deadline = 0, parkedHold = 0;

function resetCar(){ car={x:480,y:300,a:-Math.PI/2,speed:0,w:34,h:64}; }
function newTarget(){ const available=lots.map((_,i)=>i).filter(i=>!parked.includes(i)&&i!==target); target=available[Math.floor(Math.random()*available.length)]; parkedHold=0; }
function start(){ score=0; seconds=60; scoreEl.textContent=score; timeEl.textContent=seconds; resetCar(); newTarget(); deadline=performance.now()+60000; running=true; overlay.classList.add('hidden'); last=performance.now(); requestAnimationFrame(loop); }

addEventListener('keydown',e=>{ if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault(); keys.add(e.key); if(e.key.toLowerCase()==='r') start(); });
addEventListener('keyup',e=>keys.delete(e.key)); startBtn.addEventListener('click',start);

function carCorners(c=car){ const ca=Math.cos(c.a),sa=Math.sin(c.a), pts=[]; for(const [x,y] of [[-c.w/2,-c.h/2],[c.w/2,-c.h/2],[c.w/2,c.h/2],[-c.w/2,c.h/2]]) pts.push({x:c.x+x*ca-y*sa,y:c.y+x*sa+y*ca}); return pts; }
function hitRect(rect){ return carCorners().some(p=>p.x>rect.x&&p.x<rect.x+rect.w&&p.y>rect.y&&p.y<rect.y+rect.h); }
function update(dt){
  const old={...car};
  if(keys.has('ArrowUp')) car.speed+=150*dt;
  if(keys.has('ArrowDown')) car.speed-=125*dt;
  car.speed*=Math.pow(.985,dt*60); car.speed=Math.max(-75,Math.min(150,car.speed));
  const steer=(keys.has('ArrowLeft')?-1:0)+(keys.has('ArrowRight')?1:0);
  if(steer&&Math.abs(car.speed)>3) car.a+=steer*2.05*dt*(car.speed/110);
  car.x+=Math.sin(car.a)*car.speed*dt; car.y-=Math.cos(car.a)*car.speed*dt;
  if(obstacles.some(hitRect)||parked.some(i=>hitRect(lots[i]))){ Object.assign(car,old); car.speed*=-.18; }
  const lot=lots[target], inside=carCorners().every(p=>p.x>lot.x+5&&p.x<lot.x+lot.w-5&&p.y>lot.y+5&&p.y<lot.y+lot.h-5);
  if(inside&&Math.abs(car.speed)<8){ parkedHold+=dt; if(parkedHold>.7){ score++; scoreEl.textContent=score; newTarget(); } } else parkedHold=0;
  seconds=Math.max(0,Math.ceil((deadline-performance.now())/1000)); timeEl.textContent=seconds;
  if(seconds<=0){ running=false; titleEl.textContent=`Koniec! ${score} ${score===1?'punkt':'punktów'}`; copyEl.textContent=score<4?'Jeszcze jedna próba? Spokojne manewry i dobre ustawienie auta robią różnicę.':'Świetne parkowanie! Spróbuj pobić swój wynik.'; startBtn.textContent='Zagraj ponownie'; overlay.classList.remove('hidden'); }
}
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.roundRect(x,y,w,h,r); }
function drawLot(l,i){ ctx.save(); const active=i===target; ctx.strokeStyle=active?'#34d399':'#dbeafe77'; ctx.lineWidth=active?5:3; ctx.setLineDash(active?[10,7]:[]); roundRect(l.x,l.y,l.w,l.h,6); ctx.stroke(); if(active){ ctx.fillStyle='#10b98126'; ctx.fill(); ctx.fillStyle='#a7f3d0'; ctx.font='800 18px system-ui'; ctx.textAlign='center'; ctx.fillText('P',l.x+l.w/2,l.y+l.h/2+6); } ctx.restore(); }
function drawCar(c,color='#fbbf24'){
  ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(c.a); ctx.shadowColor='#0009'; ctx.shadowBlur=12; ctx.fillStyle=color; roundRect(-c.w/2,-c.h/2,c.w,c.h,9); ctx.fill(); ctx.shadowBlur=0; ctx.fillStyle='#172033'; roundRect(-c.w/2+5,-c.h/2+11,c.w-10,18,5); ctx.fill(); roundRect(-c.w/2+5,c.h/2-25,c.w-10,14,4); ctx.fill(); ctx.fillStyle='#fff8'; ctx.fillRect(-c.w/2+5,-c.h/2+4,7,3); ctx.fillRect(c.w/2-12,-c.h/2+4,7,3); ctx.restore();
}
function draw(){
  ctx.fillStyle='#26313d'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#ffffff08'; for(let x=0;x<W;x+=48) for(let y=0;y<H;y+=48) ctx.fillRect(x,y,2,2);
  ctx.fillStyle='#334155'; obstacles.forEach(o=>{roundRect(o.x,o.y,o.w,o.h,8);ctx.fill();});
  lots.forEach(drawLot); parked.forEach((i,n)=>{ const l=lots[i]; drawCar({x:l.x+l.w/2,y:l.y+l.h/2,a:0,w:34,h:64},['#60a5fa','#f472b6','#a78bfa','#fb7185'][n]); });
  ctx.strokeStyle='#f8fafc28'; ctx.lineWidth=3; ctx.setLineDash([18,18]); ctx.beginPath(); ctx.moveTo(110,300); ctx.lineTo(850,300); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle='#94a3b8'; ctx.font='700 13px system-ui'; ctx.textAlign='center'; ctx.fillText('WJAZD',480,584);
  drawCar(car);
  if(parkedHold>0){ ctx.strokeStyle='#6ee7b7'; ctx.lineWidth=6; ctx.beginPath(); ctx.arc(car.x,car.y,46,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,parkedHold/.7)); ctx.stroke(); }
}
function loop(now){ if(!running)return; const dt=Math.min(.033,(now-last)/1000); last=now; update(dt); draw(); requestAnimationFrame(loop); }
resetCar(); newTarget(); draw();
