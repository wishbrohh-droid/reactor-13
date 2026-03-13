// ============================================================
// REACTOR 13 — MAIN GAME SCRIPT
// Raycasting engine + narrative horror systems
// ============================================================

(function() {
'use strict';

// ===== AUDIO ENGINE =====
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let ctx = null;

function initAudio() {
  if (!ctx) ctx = new AudioCtx();
}

function playTone(freq, type, duration, vol=0.08, delay=0) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime + delay);
  g.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
  o.start(ctx.currentTime + delay);
  o.stop(ctx.currentTime + delay + duration + 0.05);
}

function playNoise(duration, vol=0.04, lowpass=800) {
  if (!ctx) return;
  const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass'; filt.frequency.value = lowpass;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  src.connect(filt); filt.connect(g); g.connect(ctx.destination);
  src.start(); src.stop(ctx.currentTime + duration);
}

function playDrone() {
  if (!ctx) return;
  [40, 41.5, 80].forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sawtooth'; o.frequency.value = f;
    g.gain.value = 0.015 - i * 0.004;
    o.start();
    setTimeout(() => { g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3); setTimeout(() => o.stop(), 3100); }, 8000 + Math.random() * 4000);
  });
}

function playCreak() {
  if (!ctx) return;
  playNoise(0.6 + Math.random() * 0.4, 0.06, 300 + Math.random() * 200);
  playTone(80 + Math.random() * 40, 'triangle', 0.8, 0.04);
}

function playDoor() {
  if (!ctx) return;
  playNoise(0.2, 0.12, 600);
  playTone(120, 'sawtooth', 0.3, 0.06);
}

function playHeartbeat() {
  if (!ctx) return;
  playTone(60, 'sine', 0.15, 0.1);
  setTimeout(() => playTone(55, 'sine', 0.12, 0.07), 150);
}

function playStaticBurst() {
  if (!ctx) return;
  playNoise(0.3, 0.15, 3000);
}

function playFootstep() {
  if (!ctx) return;
  playNoise(0.08, 0.05, 200 + Math.random() * 100);
}

function playEntitySound() {
  if (!ctx) return;
  // Low distorted growl
  [30, 45, 90].forEach(f => playTone(f, 'sawtooth', 1.5, 0.06));
  playNoise(1.5, 0.08, 200);
}

function playPickup() {
  if (!ctx) return;
  [440, 550, 660].forEach((f, i) => playTone(f, 'sine', 0.2, 0.06, i * 0.08));
}

// ===== GAME DATA =====

const DOCUMENTS = {
  log_entry_1: {
    title: "LOG FILE — DR. VASKOV — 1997.03.12",
    text: `ENTRY 001 — Day 14 of Experiment HELIX

The organism is responding to the radiation output better than expected.
It has begun to show signs of autonomous movement within the containment field.

Dr. Petrov believes we are witnessing the birth of a new form of life —
one that feeds on electromagnetic radiation rather than chemical compounds.

The board has approved Phase 2. We move to direct energy infusion tomorrow.

<em>— Dr. A. Vaskov, Lead Researcher</em>`
  },
  log_entry_2: {
    title: "LOG FILE — DR. VASKOV — 1997.03.19",
    text: `ENTRY 008 — Day 21 of Experiment HELIX

<warn>WARNING: Containment field fluctuations detected at 23:40 hours.</warn>

The organism has grown. It now measures approximately 2 meters across.
More disturbing — it appears to be learning.

It began mimicking the electrical patterns of our monitoring equipment.
Petrov called it "beautiful". I called it terrifying.

We should halt the experiment. I filed the paperwork.
The board <warn>rejected my request.</warn>

They don't understand what we've made here.

<em>— Dr. A. Vaskov</em>`
  },
  log_entry_3: {
    title: "LOG FILE — DR. MIRONOVA — 1997.03.24",
    text: `PERSONAL RECORD — 24/03/1997

Vaskov won't stop talking about shutting it down.
I think he's right, but I'm afraid to say it.

The organism — we started calling it "the Visitor" — it watches us now.
Not with eyes. It has no eyes. But we feel it tracking us
through the cameras, through the sensors.

Last night I heard something in the corridor.
A wet, dragging sound that stopped outside my door.

I checked the security footage.

<warn>The camera in Corridor B-4 had been turned to face the wall.</warn>

Something did that.

<em>— Dr. Y. Mironova</em>`
  },
  log_entry_4: {
    title: "INCIDENT REPORT — 1997.03.26 — 02:17",
    text: `<warn>CRITICAL — PRIORITY ALPHA</warn>

Containment field collapsed at 02:17 local time.
Cause unknown. Backup systems failed to engage.

Personnel accounting:
  - Dr. Vaskov: MISSING
  - Dr. Mironova: MISSING
  - Technician Brov: <warn>DECEASED</warn> (found in Corridor C)
  - Security Officer Lev: MISSING
  - 9 additional staff: MISSING

The Visitor is loose in the facility.

Reactor core temperature rising. Backup power holding.
Government notified. Evacuation order issued.

<warn>DO NOT RETURN TO FACILITY.</warn>

Filed by: Facility Director G. Norin (last known status: EVACUATING)`,
  },
  log_entry_5: {
    title: "ENCRYPTED MEMO — MINISTRY OF SCIENCE",
    text: `CLASSIFICATION: SIGMA-BLACK

The Reactor 13 incident is to be treated as a CONTAINMENT SUCCESS.
Public records will show a fuel rod failure with full evacuation.

The organism designated HELIX-VISITOR remains contained within
the facility structure. It cannot survive outside the radiation field
generated by the active reactor.

<warn>THE REACTOR MUST NOT BE SHUT DOWN.</warn>

The organism feeds on it. If the reactor goes offline,
the organism will exhaust its energy reserves and expire.

However — initial models suggest it may attempt to
prevent shutdown if it perceives the threat.

The facility is sealed. The signal it is broadcasting
appears to be an attempt to communicate. Or to call for help.

<warn>Under no circumstances should any investigation team enter.</warn>

— Ministry of Science, Special Projects Division`,
  },
  terminal_log: {
    title: "REACTOR CORE TERMINAL — SYSTEM LOG",
    text: `HELIX EXPERIMENT — STATUS MONITOR

ENTITY STATUS: ████ ACTIVE
ENERGY CONSUMPTION: 847% above nominal
CONTAINMENT: <warn>BREACHED — DAY 10,592</warn>
REACTOR OUTPUT: 23% capacity (minimum viable for containment)

BEHAVIORAL LOG (auto-generated):
  > Entity continues to monitor all facility systems
  > Entity has disabled 3 cameras in past 24 hours
  > Entity appears aware of new biological signatures in facility
  > <warn>Entity behavior: AGITATED</warn>

SIGNAL BROADCAST: Active since 2024.11.04
  Contents decoded: Repeating pattern — "I AM ALONE"

SYSTEM NOTE: Reactor offline in T-04:22:11
  (scheduled fuel depletion)

<warn>IF REACTOR GOES OFFLINE — ENTITY EXPIRES</warn>
<warn>IF REACTOR IS RESTARTED — ENTITY SURVIVES</warn>

Recommendation: ████████████ [CORRUPTED]`,
  }
};

// ===== MAP DESIGN (0=wall, 1=floor, 2=door, 3=interactable) =====
// 20x20 tile map
const MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,1,1,1,0,1,1,0,0,1,1,0,1,1,1,0,0,1],
  [1,0,0,1,0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,1,0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,1],
  [1,0,0,1,1,0,1,1,1,0,0,1,1,1,0,1,1,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,1,1,0,1,1,0,0,0,0,1,1,0,1,1,0,0,1],
  [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
  [1,0,0,1,1,0,1,1,0,0,0,0,1,1,0,1,1,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,1,1,1,0,1,1,0,0,1,1,0,1,1,1,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

// Interactable objects: { x, y, docId, label, used }
const INTERACTABLES = [
  { x: 4, y: 4, docId: 'log_entry_1', label: 'EXAMINE TERMINAL', used: false },
  { x: 12, y: 4, docId: 'log_entry_2', label: 'READ NOTE', used: false },
  { x: 4, y: 11, docId: 'log_entry_3', label: 'PERSONAL JOURNAL', used: false },
  { x: 15, y: 11, docId: 'log_entry_4', label: 'INCIDENT REPORT', used: false },
  { x: 9, y: 15, docId: 'log_entry_5', label: 'ENCRYPTED MEMO', used: false },
  { x: 10, y: 9,  docId: 'terminal_log', label: 'REACTOR TERMINAL', used: false, isTerminal: true },
];

// Zone names
function getZoneName(x, y) {
  if (y < 6) return 'SECTOR A — RESEARCH WING';
  if (y < 12) return 'SECTOR B — CONTROL ROOM';
  if (y < 16) return 'SECTOR C — MAINTENANCE TUNNELS';
  return 'SECTOR D — REACTOR CORE';
}

// ===== PLAYER STATE =====
const player = {
  x: 1.5, y: 1.5,
  angle: 0,
  moveSpeed: 0.04,
  rotSpeed: 0.035,
  flashlightOn: true,
  battery: 100,
};

// Key state
const keys = {};

// ===== RAYCASTER =====
const TILE = 1;
const FOV = Math.PI / 3; // 60 degrees
const HALF_FOV = FOV / 2;
const MAX_DIST = 20;

let canvas, ctx2d, W, H;

function initCanvas() {
  canvas = document.getElementById('game-canvas');
  ctx2d = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  W = canvas.width = canvas.offsetWidth;
  H = canvas.height = canvas.offsetHeight;
}

// Wall colors (varied for atmosphere)
function getWallColor(dist, side, mapVal) {
  let r = 0, g = 30, b = 5;
  if (mapVal === 1) { r=5; g=20; b=3; }
  // Darken by distance
  const shade = Math.max(0, 1 - dist / MAX_DIST);
  r = Math.floor(r * shade);
  g = Math.floor(g * shade + 15 * shade);
  b = Math.floor(b * shade);
  if (side === 1) { r=Math.floor(r*0.7); g=Math.floor(g*0.7); b=Math.floor(b*0.7); }
  return `rgb(${r},${g},${b})`;
}

function castRay(angle) {
  let rayX = player.x;
  let rayY = player.y;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  let mapX = Math.floor(rayX);
  let mapY = Math.floor(rayY);

  const deltaDistX = Math.abs(1 / cosA);
  const deltaDistY = Math.abs(1 / sinA);

  let stepX, stepY, sideDistX, sideDistY;

  if (cosA < 0) { stepX = -1; sideDistX = (rayX - mapX) * deltaDistX; }
  else { stepX = 1; sideDistX = (mapX + 1 - rayX) * deltaDistX; }
  if (sinA < 0) { stepY = -1; sideDistY = (rayY - mapY) * deltaDistY; }
  else { stepY = 1; sideDistY = (mapY + 1 - rayY) * deltaDistY; }

  let side = 0;
  let dist = 0;
  let hit = 0;

  for (let i = 0; i < MAX_DIST * 10 && !hit; i++) {
    if (sideDistX < sideDistY) { sideDistX += deltaDistX; mapX += stepX; side = 0; }
    else { sideDistY += deltaDistY; mapY += stepY; side = 1; }
    if (mapX < 0 || mapX >= MAP[0].length || mapY < 0 || mapY >= MAP.length) { hit = 1; break; }
    if (MAP[mapY][mapX] === 1) hit = 1;
  }

  if (side === 0) dist = (mapX - rayX + (1 - stepX) / 2) / cosA;
  else dist = (mapY - rayY + (1 - stepY) / 2) / sinA;

  return { dist: Math.abs(dist), side, mapX, mapY };
}

let entityVisible = false;
let entityX = 10, entityY = 10; // Entity position in map

function render() {
  if (!ctx2d) return;

  // Sky
  const skyGrad = ctx2d.createLinearGradient(0, 0, 0, H / 2);
  skyGrad.addColorStop(0, '#000500');
  skyGrad.addColorStop(1, '#010a02');
  ctx2d.fillStyle = skyGrad;
  ctx2d.fillRect(0, 0, W, H / 2);

  // Floor
  const floorGrad = ctx2d.createLinearGradient(0, H / 2, 0, H);
  floorGrad.addColorStop(0, '#010a02');
  floorGrad.addColorStop(1, '#000300');
  ctx2d.fillStyle = floorGrad;
  ctx2d.fillRect(0, H / 2, W, H / 2);

  // Cast rays
  const numRays = Math.floor(W / 2);
  for (let col = 0; col < numRays; col++) {
    const rayAngle = player.angle - HALF_FOV + (col / numRays) * FOV;
    const ray = castRay(rayAngle);
    const perpDist = ray.dist * Math.cos(rayAngle - player.angle);

    const wallH = Math.min(H, Math.floor(H / (perpDist || 0.01)));
    const top = Math.floor((H - wallH) / 2);

    const color = getWallColor(perpDist, ray.side, MAP[ray.mapY]?.[ray.mapX]);
    ctx2d.fillStyle = color;
    ctx2d.fillRect(col * 2, top, 2, wallH);

    // Floor/ceiling glow for close walls
    if (perpDist < 3) {
      ctx2d.fillStyle = `rgba(0, ${Math.floor(40 * (1 - perpDist / 3))}, 10, 0.15)`;
      ctx2d.fillRect(col * 2, top, 2, wallH);
    }
  }

  // Draw interactables as glowing dots in world space
  INTERACTABLES.forEach(obj => {
    if (obj.used) return;
    drawSprite(obj.x + 0.5, obj.y + 0.5, 5, '#00ff41', 0.7);
  });

  // Draw entity
  if (entityVisible) {
    drawSprite(entityX + 0.5, entityY + 0.5, 20, '#ff2200', 0.9, true);
  }

  // Flashlight beam draw hint
  if (!player.flashlightOn) {
    ctx2d.fillStyle = 'rgba(0,0,0,0.6)';
    ctx2d.fillRect(0, 0, W, H);
  }
}

function drawSprite(wx, wy, size, color, alpha, tall=false) {
  const dx = wx - player.x;
  const dy = wy - player.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > 10) return;

  // Transform to camera space
  const invDet = 1.0 / (Math.cos(player.angle) * Math.sin(player.angle + Math.PI / 2) -
                        Math.sin(player.angle) * Math.cos(player.angle + Math.PI / 2));

  const transformX = invDet * (Math.sin(player.angle + Math.PI / 2) * dx - Math.cos(player.angle + Math.PI / 2) * dy);
  const transformY = invDet * (-Math.sin(player.angle) * dx + Math.cos(player.angle) * dy);

  if (transformY <= 0.1) return; // behind player

  const spriteScreenX = Math.floor((W / 2) * (1 + transformX / transformY));
  const spriteH = Math.abs(Math.floor(H / transformY));
  const spriteW = tall ? Math.floor(spriteH / 2.5) : spriteH;

  const startX = spriteScreenX - spriteW / 2;
  const startY = (H - spriteH) / 2;

  ctx2d.save();
  ctx2d.globalAlpha = alpha * Math.min(1, 5 / dist);
  if (tall) {
    // Entity silhouette
    ctx2d.fillStyle = '#000000';
    ctx2d.fillRect(startX, startY, spriteW, spriteH);
    ctx2d.fillStyle = color;
    ctx2d.shadowBlur = 20;
    ctx2d.shadowColor = color;
    ctx2d.fillRect(startX + 1, startY + 1, spriteW - 2, 3);
    ctx2d.fillRect(startX + 1, startY + spriteH - 4, spriteW - 2, 3);
  } else {
    ctx2d.fillStyle = color;
    ctx2d.shadowBlur = 15;
    ctx2d.shadowColor = color;
    ctx2d.beginPath();
    ctx2d.arc(spriteScreenX, H / 2, size / transformY, 0, Math.PI * 2);
    ctx2d.fill();
  }
  ctx2d.restore();
}

// ===== MOVEMENT =====
let footstepTimer = 0;
let moved = false;

function move(dt) {
  let nx = player.x, ny = player.y;
  const spd = player.moveSpeed * dt * 60;
  const rot = player.rotSpeed * dt * 60;
  moved = false;

  if (keys['ArrowLeft'] || keys['a'] || keys['A']) { player.angle -= rot; }
  if (keys['ArrowRight'] || keys['d'] || keys['D']) { player.angle += rot; }

  if (keys['ArrowUp'] || keys['w'] || keys['W']) {
    nx += Math.cos(player.angle) * spd;
    ny += Math.sin(player.angle) * spd;
    moved = true;
  }
  if (keys['ArrowDown'] || keys['s'] || keys['S']) {
    nx -= Math.cos(player.angle) * spd;
    ny -= Math.sin(player.angle) * spd;
    moved = true;
  }

  const margin = 0.25;
  if (MAP[Math.floor(ny)]?.[Math.floor(nx)] !== 1) {
    if (MAP[Math.floor(player.y)]?.[Math.floor(nx)] !== 1) player.x = nx;
    if (MAP[Math.floor(ny)]?.[Math.floor(player.x)] !== 1) player.y = ny;
  }

  if (moved) {
    footstepTimer += dt;
    if (footstepTimer > 0.4) {
      playFootstep();
      footstepTimer = 0;
    }
  }
}

// ===== INTERACTABLE DETECTION =====
function getNearbyInteractable() {
  const px = Math.floor(player.x), py = Math.floor(player.y);
  for (const obj of INTERACTABLES) {
    if (obj.used) continue;
    const dist = Math.abs(obj.x - player.x) + Math.abs(obj.y - player.y);
    if (dist < 1.2) return obj;
  }
  return null;
}

// ===== GAME STATE =====
let gameState = 'playing'; // playing | reading | choices | ended
let docsFound = 0;
const TOTAL_DOCS = INTERACTABLES.length;

let logsRead = new Set();

// ===== HUD UPDATES =====
function updateHUD() {
  document.getElementById('location-name').textContent = getZoneName(player.x, player.y);

  // Battery
  if (player.flashlightOn && moved) {
    player.battery = Math.max(0, player.battery - 0.005);
  } else if (player.flashlightOn) {
    player.battery = Math.max(0, player.battery - 0.001);
  }
  const fill = document.getElementById('battery-fill');
  fill.style.width = player.battery + '%';
  if (player.battery < 30) {
    fill.style.background = '#ffaa00';
    fill.style.boxShadow = '0 0 6px #ffaa00';
  }
  if (player.battery < 10) {
    fill.style.background = '#ff2200';
    fill.style.boxShadow = '0 0 6px #ff2200';
  }
  if (player.battery === 0) {
    player.flashlightOn = false;
  }

  // Signal (based on docs found)
  const bars = document.querySelectorAll('.bar');
  const activeCount = Math.floor((logsRead.size / TOTAL_DOCS) * 4);
  bars.forEach((b, i) => {
    b.classList.toggle('active', i < activeCount);
  });

  // Flashlight overlay
  const fo = document.getElementById('flashlight-overlay');
  if (player.flashlightOn) {
    fo.classList.remove('off');
  } else {
    fo.classList.add('off');
  }
}

// ===== HORROR EVENTS =====
let flickerTimer = 0;
let nextFlickerIn = 8 + Math.random() * 15;
let entityFlashTimer = 0;
let nextEntityIn = 30 + Math.random() * 40;
let monitorTimer = 0;
let nextMonitorIn = 20 + Math.random() * 30;
let staticTimer = 0;
let staticActive = false;
let bloodVignetteLevel = 0;

function runHorrorEvents(dt, elapsed) {
  // Flicker
  flickerTimer += dt;
  if (flickerTimer > nextFlickerIn) {
    triggerFlicker();
    flickerTimer = 0;
    nextFlickerIn = 6 + Math.random() * 20;
  }

  // Entity appearance
  entityFlashTimer += dt;
  if (entityFlashTimer > nextEntityIn && logsRead.size >= 2) {
    triggerEntityFlash();
    entityFlashTimer = 0;
    nextEntityIn = 25 + Math.random() * 40;
  }

  // Security monitor
  monitorTimer += dt;
  if (monitorTimer > nextMonitorIn && logsRead.size >= 1) {
    triggerSecurityMonitor();
    monitorTimer = 0;
    nextMonitorIn = 20 + Math.random() * 35;
  }

  // Blood vignette based on docs found
  const targetVignette = logsRead.size / TOTAL_DOCS;
  bloodVignetteLevel += (targetVignette * 0.5 - bloodVignetteLevel) * dt * 0.5;
  document.getElementById('blood-vignette').style.opacity = bloodVignetteLevel;

  // Entity in 3D world: wander
  if (logsRead.size >= 3) {
    entityVisible = true;
    // Drift entity
    const eAngle = Math.random() * Math.PI * 2;
    const newEX = entityX + Math.cos(eAngle) * 0.005;
    const newEY = entityY + Math.sin(eAngle) * 0.005;
    if (MAP[Math.floor(newEY)]?.[Math.floor(newEX)] !== 1) {
      entityX = newEX; entityY = newEY;
    }
  }
}

function triggerFlicker() {
  const overlay = document.getElementById('flicker-overlay');
  overlay.style.opacity = '1';
  playCreak();
  setTimeout(() => { overlay.style.opacity = '0'; }, 80);
  setTimeout(() => { overlay.style.opacity = '0.7'; }, 160);
  setTimeout(() => { overlay.style.opacity = '0'; }, 220);
}

function triggerEntityFlash() {
  playEntitySound();
  triggerFlicker();

  setTimeout(() => {
    const flash = document.getElementById('entity-flash');
    const sil = document.getElementById('entity-silhouette');
    flash.classList.remove('hidden');
    // Reflow to reset animation
    sil.style.animation = 'none';
    sil.offsetHeight;
    sil.style.animation = '';

    playHeartbeat();
    setTimeout(() => {
      flash.classList.add('hidden');
    }, 2200);
  }, 200);
}

const monitorMessages = [
  `[NO SIGNAL]
...
...
MOVEMENT DETECTED
SECTOR B-4
[FEED LOST]`,
  `SUBJECT: ████████
STATUS: ACTIVE
ENERGY OUTPUT: ████
THREAT LEVEL: EXTREME`,
  `...I SEE YOU...`,
  `RECORDING STARTED 02:41
[STATIC]
SOMETHING IN THE HALL
[STATIC]
IT KNOWS YOU'RE HERE`,
  `CORRIDOR C — LIVE
[FEED CORRUPTED]
[FEED CORRUPTED]
SHAPE DETECTED — NON-HUMAN
[FEED LOST]`,
];

function triggerSecurityMonitor() {
  playStaticBurst();
  const mon = document.getElementById('security-monitor');
  const content = document.getElementById('monitor-content');
  const msg = monitorMessages[Math.floor(Math.random() * monitorMessages.length)];
  content.textContent = msg;
  mon.classList.remove('hidden');
  setTimeout(() => mon.classList.add('hidden'), 3500 + Math.random() * 1000);
}

// ===== NARRATIVE MESSAGES =====
let narrativeQueue = [];
let narrativeShowing = false;

function showNarrative(text, delay=0) {
  narrativeQueue.push({ text, delay });
  if (!narrativeShowing) processNarrativeQueue();
}

function processNarrativeQueue() {
  if (!narrativeQueue.length) { narrativeShowing = false; return; }
  narrativeShowing = true;
  const { text, delay } = narrativeQueue.shift();
  setTimeout(() => {
    const el = document.getElementById('narrative-text');
    const overlay = document.getElementById('narrative-overlay');
    overlay.classList.remove('hidden');
    el.textContent = text;
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = 'narrativefade 4s forwards';
    setTimeout(() => {
      overlay.classList.add('hidden');
      processNarrativeQueue();
    }, 4200);
  }, delay);
}

// ===== DOCUMENT READING =====
function openDocument(docId) {
  if (!DOCUMENTS[docId]) return;
  gameState = 'reading';
  const doc = DOCUMENTS[docId];

  document.getElementById('doc-title').textContent = doc.title;
  const body = document.getElementById('doc-content');

  // Parse simple markup
  let html = doc.text
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Restore our tags
    .replace(/&lt;em&gt;/g, '<span class="doc-em">').replace(/&lt;\/em&gt;/g, '</span>')
    .replace(/&lt;warn&gt;/g, '<span class="doc-warn">').replace(/&lt;\/warn&gt;/g, '</span>');
  body.innerHTML = html;

  document.getElementById('doc-reader').classList.remove('hidden');
  playPickup();

  if (!logsRead.has(docId)) {
    logsRead.add(docId);
    docsFound++;

    // Narrative after reading
    const narratives = {
      log_entry_1: "The experiment began with hope. Someone wanted to create life from radiation.",
      log_entry_2: "The organism was learning. And the scientists refused to stop.",
      log_entry_3: "It was watching them. Through the cameras. Through the walls.",
      log_entry_4: "They all disappeared. In a single night. Only one report was ever filed.",
      log_entry_5: "The reactor keeps it alive. If it dies — or if you restart what was stopped...",
      terminal_log: "You understand now. The signal was not a call for help. It was a warning.",
    };

    if (narratives[docId]) {
      document.getElementById('doc-close').addEventListener('click', () => {
        showNarrative(narratives[docId], 500);
      }, { once: true });
    }

    // Check if terminal found (trigger ending)
    if (docId === 'terminal_log') {
      document.getElementById('doc-close').addEventListener('click', () => {
        setTimeout(triggerEnding, 3000);
      }, { once: true });
    }
  }
}

function closeDocument() {
  document.getElementById('doc-reader').classList.add('hidden');
  gameState = 'playing';
}

// ===== ENDING =====
function triggerEnding() {
  gameState = 'choices';
  triggerFlicker();
  playEntitySound();
  setTimeout(() => {
    const panel = document.getElementById('choices-panel');
    panel.classList.remove('hidden');

    document.getElementById('choices-text').textContent =
      'You stand before the reactor control panel.\nThe Visitor stirs in the darkness behind you.\n\nWhat do you do?';

    const btns = document.getElementById('choices-btns');
    btns.innerHTML = '';

    const opt1 = document.createElement('button');
    opt1.className = 'choice-btn';
    opt1.innerHTML = '[ INITIATE EMERGENCY SHUTDOWN ]\nKill the reactor. Destroy the Visitor. End the signal forever.';
    opt1.addEventListener('click', () => endGame('shutdown'));

    const opt2 = document.createElement('button');
    opt2.className = 'choice-btn';
    opt2.innerHTML = '[ RESTART REACTOR CYCLE ]\nRestore full power. The Visitor survives. The signal continues.';
    opt2.addEventListener('click', () => endGame('restart'));

    const opt3 = document.createElement('button');
    opt3.className = 'choice-btn';
    opt3.innerHTML = '[ DO NOTHING — LEAVE ]\nWalk away. Let time decide what dies here.';
    opt3.addEventListener('click', () => endGame('leave'));

    btns.appendChild(opt1);
    btns.appendChild(opt2);
    btns.appendChild(opt3);
  }, 1000);
}

const ENDINGS = {
  shutdown: {
    title: 'SILENCE',
    text: `You enter the emergency shutdown sequence.

The reactor hums, shudders — and dies.

The lights go out. You hear something in the dark.
A long, falling sound, like a breath being let out for the last time.

Then: nothing.

You make your way out in total darkness, following the wall with your hands.
Behind you, Reactor 13 is quiet for the first time in almost thirty years.

The Visitor is gone.

You file a report recommending permanent decommissioning.
The Ministry of Science seals the file under SIGMA-BLACK.

Three months later, you wake from a dream you cannot remember.
Your skin is warm. The room smells faintly of something electric.

You are probably fine.`,
    credits: 'ENDING: THE LAST BREATH'
  },
  restart: {
    title: 'CONTINUATION',
    text: `You feed new fuel rods into the reactor core.

The lights return. Somewhere in the facility, something moves.

It does not approach you. It has learned patience.

You leave Reactor 13 exactly as you found it.
The signal resumes broadcasting the moment you cross the perimeter.

You never tell anyone what you saw.
You are never entirely sure it was real.

Months later, a second investigation team is sent.
They too leave with no conclusive findings.

The reactor runs. The Visitor endures.

The signal is still broadcasting today.

<em>I AM ALONE</em>`,
    credits: 'ENDING: THE SIGNAL PERSISTS'
  },
  leave: {
    title: 'DECAY',
    text: `You turn away from the console and walk out.

The reactor will exhaust its fuel in approximately four hours.
When it does, whatever has been living inside Reactor 13
will have nothing left to feed on.

You drive away as dawn breaks.

The facility falls silent on its own schedule.

No one ever returns. The building is demolished in 2029.
Construction workers report strange dreams for several weeks.

A small monument is placed at the site.
The inscription reads only:

<em>"THEY TRIED TO UNDERSTAND."</em>

Whether that was admirable or foolish —
no one can say.`,
    credits: 'ENDING: THE NATURAL END'
  }
};

function endGame(endingId) {
  stopLoop = true;
  const ending = ENDINGS[endingId];

  const endScreen = document.getElementById('ending-screen');
  document.getElementById('ending-title').textContent = ending.title;

  // Parse simple markup
  let html = ending.text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/&lt;em&gt;/g, '<em>').replace(/&lt;\/em&gt;/g, '</em>');
  document.getElementById('ending-text').innerHTML = html;
  document.getElementById('ending-credits').textContent = ending.credits;

  document.getElementById('choices-panel').classList.add('hidden');
  document.getElementById('game-screen').classList.add('hidden');
  endScreen.classList.remove('hidden');
  endScreen.classList.add('active');

  playDrone();
}

// ===== BOOT SEQUENCE =====
const BOOT_LINES = [
  { text: '> INITIALIZING SYSTEM...', delay: 300, type: '' },
  { text: '> CLEARANCE LEVEL: ALPHA-7 GRANTED', delay: 700, type: '' },
  { text: '> LOADING FACILITY MAP... PARTIAL DATA', delay: 1200, type: 'log-warn' },
  { text: '> GEIGER COUNTER: ONLINE', delay: 1700, type: '' },
  { text: '> FLASHLIGHT CHARGE: 100%', delay: 2100, type: '' },
  { text: '> RADIO SIGNAL SOURCE: REACTOR CORE', delay: 2500, type: 'log-warn' },
  { text: '> WARNING: LAST MAINTENANCE — 10,592 DAYS AGO', delay: 3000, type: 'log-warn' },
  { text: '> WARNING: LIFE SIGNS DETECTED INSIDE FACILITY', delay: 3500, type: 'log-err' },
  { text: '> RECOMMENDATION: ABORT MISSION', delay: 4000, type: 'log-err' },
  { text: '> ORDER OVERRIDE: INVESTIGATE ANYWAY', delay: 4400, type: '' },
  { text: '> GOOD LUCK, AGENT.', delay: 5000, type: '' },
];

function runBootSequence() {
  const log = document.getElementById('boot-log');
  BOOT_LINES.forEach(({ text, delay, type }) => {
    setTimeout(() => {
      const line = document.createElement('div');
      line.className = 'log-line ' + type;
      line.textContent = text;
      log.appendChild(line);
      log.scrollTop = log.scrollHeight;
    }, delay);
  });

  setTimeout(() => {
    document.getElementById('start-btn').classList.remove('hidden');
  }, 5400);
}

// ===== MAIN LOOP =====
let stopLoop = false;
let lastTime = 0;

function gameLoop(timestamp) {
  if (stopLoop) return;
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  if (gameState === 'playing') {
    move(dt);
    runHorrorEvents(dt, timestamp / 1000);
    updateHUD();
    render();

    // Check nearby interactable
    const near = getNearbyInteractable();
    const prompt = document.getElementById('interact-prompt');
    if (near) {
      prompt.classList.remove('hidden');
      document.getElementById('interact-text').textContent = `[ E ] ${near.label}`;
    } else {
      prompt.classList.add('hidden');
    }
  }

  requestAnimationFrame(gameLoop);
}

// ===== INITIALIZATION =====
function startGame() {
  initAudio();
  playDrone();

  document.getElementById('boot-screen').classList.remove('active');
  document.getElementById('boot-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  document.getElementById('game-screen').classList.add('active');

  initCanvas();
  gameState = 'playing';
  stopLoop = false;

  // Opening narration
  setTimeout(() => showNarrative('1997. A catastrophic experiment. No survivors.'), 1000);
  setTimeout(() => showNarrative('2026. The signal returns. You are sent to investigate.'), 5500);
  setTimeout(() => showNarrative('Find out what happened to the researchers. Get out alive.'), 10000);

  setTimeout(() => {
    triggerFlicker();
    playCreak();
  }, 3000);

  requestAnimationFrame((t) => { lastTime = t; requestAnimationFrame(gameLoop); });
}

function restartGame() {
  // Reset state
  player.x = 1.5; player.y = 1.5; player.angle = 0;
  player.flashlightOn = true; player.battery = 100;
  logsRead.clear(); docsFound = 0;
  INTERACTABLES.forEach(i => i.used = false);
  gameState = 'playing'; stopLoop = false;
  entityVisible = false; entityX = 10; entityY = 10;
  bloodVignetteLevel = 0;
  flickerTimer = 0; entityFlashTimer = 0; monitorTimer = 0;
  nextFlickerIn = 8 + Math.random() * 15;
  nextEntityIn = 30 + Math.random() * 40;
  nextMonitorIn = 20 + Math.random() * 30;

  document.getElementById('battery-fill').style.width = '100%';
  document.getElementById('battery-fill').style.background = 'var(--green)';
  document.getElementById('battery-fill').style.boxShadow = '0 0 6px var(--green)';
  document.getElementById('blood-vignette').style.opacity = '0';
  document.getElementById('flashlight-overlay').classList.remove('off');
  document.getElementById('entity-flash').classList.add('hidden');
  document.getElementById('security-monitor').classList.add('hidden');
  document.getElementById('doc-reader').classList.add('hidden');
  document.getElementById('choices-panel').classList.add('hidden');
  document.getElementById('narrative-overlay').classList.add('hidden');
  document.getElementById('interact-prompt').classList.add('hidden');

  document.getElementById('ending-screen').classList.remove('active');
  document.getElementById('ending-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  document.getElementById('game-screen').classList.add('active');

  resize();

  setTimeout(() => showNarrative('The facility is still here. So is what lives inside.'), 1000);
  requestAnimationFrame((t) => { lastTime = t; requestAnimationFrame(gameLoop); });
}

// ===== EVENT LISTENERS =====
window.addEventListener('keydown', (e) => {
  keys[e.key] = true;

  if (e.key === 'f' || e.key === 'F') {
    if (player.battery > 0) {
      player.flashlightOn = !player.flashlightOn;
      initAudio();
    }
  }

  if (e.key === 'e' || e.key === 'E') {
    if (gameState === 'reading') {
      closeDocument();
      return;
    }
    if (gameState === 'playing') {
      const near = getNearbyInteractable();
      if (near) {
        openDocument(near.docId);
        near.used = true;
      }
    }
  }

  if (e.key === 'Escape' && gameState === 'reading') {
    closeDocument();
  }

  // Any key starts audio
  initAudio();
});

window.addEventListener('keyup', (e) => { keys[e.key] = false; });

document.addEventListener('DOMContentLoaded', () => {
  runBootSequence();

  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('restart-btn').addEventListener('click', restartGame);
  document.getElementById('doc-close').addEventListener('click', closeDocument);
});

})();
