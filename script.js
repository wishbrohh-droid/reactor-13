// ============================================================
// REACTOR 13 — MAIN GAME SCRIPT v2
// Mouse look + bright flashlight + textured walls
// ============================================================

(function() {
'use strict';

// ===== AUDIO ENGINE =====
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
}

function playTone(freq, type, duration, vol, delay) {
  vol = vol || 0.08; delay = delay || 0;
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.connect(g); g.connect(audioCtx.destination);
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, audioCtx.currentTime + delay);
  g.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + delay + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + delay + duration);
  o.start(audioCtx.currentTime + delay);
  o.stop(audioCtx.currentTime + delay + duration + 0.05);
}

function playNoise(duration, vol, lowpass) {
  vol = vol || 0.04; lowpass = lowpass || 800;
  if (!audioCtx) return;
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * duration, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const filt = audioCtx.createBiquadFilter();
  filt.type = 'lowpass'; filt.frequency.value = lowpass;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  src.connect(filt); filt.connect(g); g.connect(audioCtx.destination);
  src.start(); src.stop(audioCtx.currentTime + duration);
}

function playDrone() {
  if (!audioCtx) return;
  [40, 41.5, 80].forEach(function(f, i) {
    var o = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = 'sawtooth'; o.frequency.value = f;
    g.gain.value = 0.015 - i * 0.004;
    o.start();
    setTimeout(function() {
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 3);
      setTimeout(function() { o.stop(); }, 3100);
    }, 8000 + Math.random() * 4000);
  });
}

function playCreak() {
  if (!audioCtx) return;
  playNoise(0.6 + Math.random() * 0.4, 0.06, 300 + Math.random() * 200);
  playTone(80 + Math.random() * 40, 'triangle', 0.8, 0.04);
}
function playHeartbeat() {
  if (!audioCtx) return;
  playTone(60, 'sine', 0.15, 0.1);
  setTimeout(function() { playTone(55, 'sine', 0.12, 0.07); }, 150);
}
function playStaticBurst() { if (!audioCtx) return; playNoise(0.3, 0.15, 3000); }
function playFootstep() { if (!audioCtx) return; playNoise(0.08, 0.05, 200 + Math.random() * 100); }
function playEntitySound() {
  if (!audioCtx) return;
  [30, 45, 90].forEach(function(f) { playTone(f, 'sawtooth', 1.5, 0.06); });
  playNoise(1.5, 0.08, 200);
}
function playPickup() {
  if (!audioCtx) return;
  [440, 550, 660].forEach(function(f, i) { playTone(f, 'sine', 0.2, 0.06, i * 0.08); });
}

// ===== DOCUMENTS =====
var DOCUMENTS = {
  log_entry_1: {
    title: "LOG FILE — DR. VASKOV — 1997.03.12",
    text: "ENTRY 001 — Day 14 of Experiment HELIX\n\nThe organism is responding to the radiation output better than expected.\nIt has begun to show signs of autonomous movement within the containment field.\n\nDr. Petrov believes we are witnessing the birth of a new form of life —\none that feeds on electromagnetic radiation rather than chemical compounds.\n\nThe board has approved Phase 2. We move to direct energy infusion tomorrow.\n\n<em>— Dr. A. Vaskov, Lead Researcher</em>"
  },
  log_entry_2: {
    title: "LOG FILE — DR. VASKOV — 1997.03.19",
    text: "ENTRY 008 — Day 21 of Experiment HELIX\n\n<warn>WARNING: Containment field fluctuations detected at 23:40 hours.</warn>\n\nThe organism has grown. It now measures approximately 2 meters across.\nMore disturbing — it appears to be learning.\n\nIt began mimicking the electrical patterns of our monitoring equipment.\nPetrov called it 'beautiful'. I called it terrifying.\n\nWe should halt the experiment. I filed the paperwork.\nThe board <warn>rejected my request.</warn>\n\nThey don't understand what we've made here.\n\n<em>— Dr. A. Vaskov</em>"
  },
  log_entry_3: {
    title: "LOG FILE — DR. MIRONOVA — 1997.03.24",
    text: "PERSONAL RECORD — 24/03/1997\n\nVaskov won't stop talking about shutting it down.\nI think he's right, but I'm afraid to say it.\n\nThe organism — we started calling it 'the Visitor' — it watches us now.\nNot with eyes. It has no eyes. But we feel it tracking us\nthrough the cameras, through the sensors.\n\nLast night I heard something in the corridor.\nA wet, dragging sound that stopped outside my door.\n\nI checked the security footage.\n\n<warn>The camera in Corridor B-4 had been turned to face the wall.</warn>\n\nSomething did that.\n\n<em>— Dr. Y. Mironova</em>"
  },
  log_entry_4: {
    title: "INCIDENT REPORT — 1997.03.26 — 02:17",
    text: "<warn>CRITICAL — PRIORITY ALPHA</warn>\n\nContainment field collapsed at 02:17 local time.\nCause unknown. Backup systems failed to engage.\n\nPersonnel accounting:\n  - Dr. Vaskov: MISSING\n  - Dr. Mironova: MISSING\n  - Technician Brov: <warn>DECEASED</warn> (found in Corridor C)\n  - Security Officer Lev: MISSING\n  - 9 additional staff: MISSING\n\nThe Visitor is loose in the facility.\n\nReactor core temperature rising. Backup power holding.\nGovernment notified. Evacuation order issued.\n\n<warn>DO NOT RETURN TO FACILITY.</warn>\n\nFiled by: Facility Director G. Norin (last known status: EVACUATING)"
  },
  log_entry_5: {
    title: "ENCRYPTED MEMO — MINISTRY OF SCIENCE",
    text: "CLASSIFICATION: SIGMA-BLACK\n\nThe Reactor 13 incident is to be treated as a CONTAINMENT SUCCESS.\nPublic records will show a fuel rod failure with full evacuation.\n\nThe organism designated HELIX-VISITOR remains contained within\nthe facility structure. It cannot survive outside the radiation field\ngenerated by the active reactor.\n\n<warn>THE REACTOR MUST NOT BE SHUT DOWN.</warn>\n\nThe organism feeds on it. If the reactor goes offline,\nthe organism will exhaust its energy reserves and expire.\n\nHowever — initial models suggest it may attempt to prevent shutdown\nif it perceives the threat.\n\n<warn>Under no circumstances should any investigation team enter.</warn>\n\n— Ministry of Science, Special Projects Division"
  },
  terminal_log: {
    title: "REACTOR CORE TERMINAL — SYSTEM LOG",
    text: "HELIX EXPERIMENT — STATUS MONITOR\n\nENTITY STATUS: ACTIVE\nENERGY CONSUMPTION: 847% above nominal\nCONTAINMENT: <warn>BREACHED — DAY 10,592</warn>\nREACTOR OUTPUT: 23% capacity\n\nBEHAVIORAL LOG (auto-generated):\n  > Entity continues to monitor all facility systems\n  > Entity has disabled 3 cameras in past 24 hours\n  > Entity appears aware of new biological signatures in facility\n  > <warn>Entity behavior: AGITATED</warn>\n\nSIGNAL BROADCAST: Active since 2024.11.04\n  Contents decoded: Repeating pattern — 'I AM ALONE'\n\nSYSTEM NOTE: Reactor offline in T-04:22:11\n  (scheduled fuel depletion)\n\n<warn>IF REACTOR GOES OFFLINE — ENTITY EXPIRES</warn>\n<warn>IF REACTOR IS RESTARTED — ENTITY SURVIVES</warn>\n\nRecommendation: [CORRUPTED]"
  }
};

// ===== MAP =====
var MAP = [
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
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

// Wall detail map: "mx,my" -> type
var WALL_DETAILS = {
  '3,3':'window','8,3':'window','11,3':'window','14,3':'window',
  '3,7':'window','16,7':'window','3,10':'window','16,10':'window',
  '6,3':'door','13,7':'door','5,14':'door','12,14':'door',
  '4,3':'panel','12,3':'panel','4,11':'panel','15,11':'panel','9,14':'panel',
  '7,7':'pipe','8,10':'pipe','11,14':'pipe',
  '3,4':'damage','8,7':'damage','11,10':'damage','16,13':'damage'
};

var INTERACTABLES = [
  { x:4,  y:4,  docId:'log_entry_1', label:'EXAMINE TERMINAL', used:false },
  { x:12, y:4,  docId:'log_entry_2', label:'READ NOTE',        used:false },
  { x:4,  y:11, docId:'log_entry_3', label:'PERSONAL JOURNAL', used:false },
  { x:15, y:11, docId:'log_entry_4', label:'INCIDENT REPORT',  used:false },
  { x:9,  y:15, docId:'log_entry_5', label:'ENCRYPTED MEMO',   used:false },
  { x:10, y:9,  docId:'terminal_log',label:'REACTOR TERMINAL', used:false, isTerminal:true }
];

function getZoneName(x, y) {
  if (y < 6)  return 'SECTOR A — RESEARCH WING';
  if (y < 12) return 'SECTOR B — CONTROL ROOM';
  if (y < 16) return 'SECTOR C — MAINTENANCE TUNNELS';
  return 'SECTOR D — REACTOR CORE';
}

// ===== PLAYER =====
var player = {
  x: 1.5, y: 1.5,
  angle: 0,
  moveSpeed: 0.04,
  flashlightOn: true,
  battery: 100
};

var mouseLocked = false;
var keys = {};

// ===== RAYCASTER =====
var FOV = Math.PI / 3;
var HALF_FOV = FOV / 2;
var MAX_DIST = 22;

var canvas, ctx2d, W, H;
var zBuffer;

function initCanvas() {
  canvas = document.getElementById('game-canvas');
  ctx2d = canvas.getContext('2d');
  doResize();
  window.addEventListener('resize', doResize);
}

function doResize() {
  W = canvas.width  = canvas.offsetWidth;
  H = canvas.height = canvas.offsetHeight;
  zBuffer = new Float32Array(W);
}

// ===== WALL TEXTURE =====
// Returns r,g,b array [0..255]
function getWallTexel(texX, brightness, side, detail) {
  var nx = Math.floor(texX * 64);
  var grain = ((nx * 17 + 91) % 37) / 37;
  var r = 55 + grain * 20;
  var g = 65 + grain * 18;
  var b = 50 + grain * 15;

  if (detail === 'window') {
    if (texX > 0.28 && texX < 0.72) {
      // Dark glass pane
      r = 18; g = 38; b = 45;
      // Window frame
      if (texX < 0.31 || texX > 0.69) { r = 80; g = 78; b = 68; }
      // Cracked glass lines
      if (Math.abs(texX - 0.5) < 0.01) { r = 10; g = 25; b = 30; }
    } else {
      // Wall beside window — slightly lighter (frame)
      r += 15; g += 12; b += 10;
    }
  } else if (detail === 'door') {
    // Metal door — warm gray, dented
    r = 58 + grain * 12; g = 55 + grain * 10; b = 48 + grain * 10;
    if (texX > 0.47 && texX < 0.53) { r *= 0.35; g *= 0.35; b *= 0.35; } // seam
    if (texX < 0.07 || texX > 0.93) { r = Math.min(255, r * 1.4); g = Math.min(255, g * 1.4); }
    // Handle
    if (texX > 0.56 && texX < 0.60) { r = 90; g = 88; b = 70; }
    // Dent / damage
    if (grain > 0.82) { r *= 0.55; g *= 0.55; b *= 0.55; }
  } else if (detail === 'panel') {
    r = 32 + grain * 14; g = 48 + grain * 14; b = 32 + grain * 10;
    // Panel lights
    if (texX > 0.18 && texX < 0.21) { r = 15;  g = 220; b = 60; }
    if (texX > 0.38 && texX < 0.41) { r = 220; g = 25;  b = 10; }
    if (texX > 0.58 && texX < 0.61) { r = 190; g = 150; b = 10; }
    if (texX > 0.78 && texX < 0.81) { r = 60;  g = 120; b = 220; }
    // Border
    if (texX < 0.05 || texX > 0.95) { r = 82; g = 88; b = 72; }
  } else if (detail === 'pipe') {
    r = 78 + grain * 16; g = 72 + grain * 12; b = 58 + grain * 10;
    if (texX < 0.08 || texX > 0.92) { r *= 0.65; g *= 0.65; b *= 0.65; }
    // Rust
    if (grain > 0.83) { r = 110 + grain * 35; g = 45; b = 18; }
    // Bolts
    if (Math.abs(texX - 0.15) < 0.015 || Math.abs(texX - 0.85) < 0.015) { r = 100; g = 96; b = 80; }
  } else if (detail === 'damage') {
    if (grain > 0.55) { r = 20; g = 16; b = 12; }
    else { r += (grain) * 25; g -= 8; b -= 12; }
    // Scorch marks
    if (grain > 0.75) { r = 30; g = 20; b = 15; }
  } else {
    // Regular wall — add subtle vertical variation (pipes, cracks)
    var vg = ((nx * 7 + 53) % 29) / 29;
    if (vg > 0.92) { r *= 0.7; g *= 0.7; b *= 0.7; } // thin crack
  }

  if (side === 1) { r *= 0.62; g *= 0.62; b *= 0.62; }

  r = Math.min(255, Math.max(0, Math.floor(r * brightness)));
  g = Math.min(255, Math.max(0, Math.floor(g * brightness)));
  b = Math.min(255, Math.max(0, Math.floor(b * brightness)));
  return [r, g, b];
}

function getFloorTexel(fx, fy, brightness) {
  var tx = fx - Math.floor(fx);
  var ty = fy - Math.floor(fy);
  var grain = ((Math.floor(fx * 4) * 13 + Math.floor(fy * 4) * 7 + 23) % 41) / 41;
  var r = 42 + grain * 14;
  var g = 50 + grain * 12;
  var b = 38 + grain * 10;
  // Tile lines
  if (tx < 0.035 || ty < 0.035) { r *= 0.45; g *= 0.45; b *= 0.45; }
  // Stains / debris
  var stain = ((Math.floor(fx * 2) * 31 + Math.floor(fy * 2) * 19) % 97) / 97;
  if (stain > 0.87) { r = 22; g = 17; b = 15; }
  r = Math.min(255, Math.max(0, Math.floor(r * brightness)));
  g = Math.min(255, Math.max(0, Math.floor(g * brightness)));
  b = Math.min(255, Math.max(0, Math.floor(b * brightness)));
  return [r, g, b];
}

function castRay(angle) {
  var cosA = Math.cos(angle);
  var sinA = Math.sin(angle);
  var mapX = Math.floor(player.x);
  var mapY = Math.floor(player.y);
  var deltaDistX = Math.abs(1 / cosA);
  var deltaDistY = Math.abs(1 / sinA);
  var stepX, stepY, sideDistX, sideDistY;
  if (cosA < 0) { stepX = -1; sideDistX = (player.x - mapX) * deltaDistX; }
  else           { stepX =  1; sideDistX = (mapX + 1 - player.x) * deltaDistX; }
  if (sinA < 0) { stepY = -1; sideDistY = (player.y - mapY) * deltaDistY; }
  else           { stepY =  1; sideDistY = (mapY + 1 - player.y) * deltaDistY; }

  var side = 0, hit = 0;
  for (var i = 0; i < MAX_DIST * 12 && !hit; i++) {
    if (sideDistX < sideDistY) { sideDistX += deltaDistX; mapX += stepX; side = 0; }
    else                       { sideDistY += deltaDistY; mapY += stepY; side = 1; }
    if (mapX < 0 || mapX >= MAP[0].length || mapY < 0 || mapY >= MAP.length) { hit = 1; break; }
    if (MAP[mapY][mapX] === 1) hit = 1;
  }

  var perpDist, wallX;
  if (side === 0) {
    perpDist = (mapX - player.x + (1 - stepX) / 2) / cosA;
    wallX = player.y + perpDist * sinA;
  } else {
    perpDist = (mapY - player.y + (1 - stepY) / 2) / sinA;
    wallX = player.x + perpDist * cosA;
  }
  wallX -= Math.floor(wallX);
  return { dist: Math.abs(perpDist), side: side, mapX: mapX, mapY: mapY, wallX: wallX };
}

var entityVisible = false;
var entityX = 10, entityY = 10;
var flickerFactor = 1.0;

function render() {
  if (!ctx2d) return;
  var imgData = ctx2d.createImageData(W, H);
  var px = imgData.data;
  var halfH = H * 0.5;

  for (var col = 0; col < W; col++) {
    var rayAngle = player.angle - HALF_FOV + (col / W) * FOV;
    var ray = castRay(rayAngle);
    var perpDist = Math.max(0.1, ray.dist * Math.cos(rayAngle - player.angle));
    zBuffer[col] = perpDist;

    var wallH = Math.min(H * 3, Math.floor(H / perpDist));
    var wallTop    = Math.max(0, Math.floor((H - wallH) / 2));
    var wallBottom = Math.min(H - 1, Math.floor((H + wallH) / 2));

    // Flashlight cone: wide soft beam centered on screen
    var centerFrac = 1.0 - Math.abs((col / W) - 0.5) * 2.0;
    centerFrac = Math.max(0, centerFrac);
    var distFalloff = Math.max(0, 1.0 - perpDist / 10.0);
    var cone = player.flashlightOn ? centerFrac * distFalloff : 0;
    var ambient = player.flashlightOn ? 0.28 : 0.05;
    var wallBright = Math.min(2.5, (ambient + cone * 1.8)) * flickerFactor;

    var detail = WALL_DETAILS[ray.mapX + ',' + ray.mapY] || null;

    // WALL
    for (var row = wallTop; row <= wallBottom; row++) {
      var t = getWallTexel(ray.wallX, wallBright, ray.side, detail);
      var idx = (row * W + col) * 4;
      px[idx]   = t[0];
      px[idx+1] = t[1];
      px[idx+2] = t[2];
      px[idx+3] = 255;
    }

    // CEILING
    for (var row = 0; row < wallTop; row++) {
      var cBright = Math.max(0, (0.12 + cone * 0.35) * flickerFactor);
      var cv = Math.floor((28 + Math.random() * 3) * cBright);
      var cidx = (row * W + col) * 4;
      px[cidx]   = Math.floor(cv * 0.7);
      px[cidx+1] = cv;
      px[cidx+2] = Math.floor(cv * 0.6);
      px[cidx+3] = 255;
    }

    // FLOOR
    for (var row = wallBottom + 1; row < H; row++) {
      var rowC = row - halfH;
      if (rowC <= 0) { var fidx = (row * W + col)*4; px[fidx+3]=255; continue; }
      var floorDist = halfH / rowC;
      var floorBright = Math.max(0, (0.14 + cone * 0.5 * Math.max(0, 1 - floorDist / 8)) * flickerFactor);
      var fx = player.x + floorDist * Math.cos(rayAngle);
      var fy = player.y + floorDist * Math.sin(rayAngle);
      var f = getFloorTexel(fx, fy, floorBright);
      var fidx = (row * W + col) * 4;
      px[fidx]   = f[0];
      px[fidx+1] = f[1];
      px[fidx+2] = f[2];
      px[fidx+3] = 255;
    }
  }

  ctx2d.putImageData(imgData, 0, 0);

  // Sprites
  INTERACTABLES.forEach(function(obj) {
    if (!obj.used) drawSprite(obj.x + 0.5, obj.y + 0.5, 6, '#00ff88', 0.9, false);
  });
  if (entityVisible) {
    drawSprite(entityX + 0.5, entityY + 0.5, 18, '#cc1100', 0.85, true);
  }
}

function drawSprite(wx, wy, size, color, alpha, tall) {
  var dx = wx - player.x;
  var dy = wy - player.y;
  var dist = Math.sqrt(dx*dx + dy*dy);
  if (dist > 10 || dist < 0.3) return;

  var ca = Math.cos(player.angle);
  var sa = Math.sin(player.angle);
  var invDet = 1.0 / (ca * Math.sin(player.angle + Math.PI/2) - sa * Math.cos(player.angle + Math.PI/2));
  var transformX = invDet * (Math.sin(player.angle + Math.PI/2) * dx - Math.cos(player.angle + Math.PI/2) * dy);
  var transformY = invDet * (-sa * dx + ca * dy);
  if (transformY <= 0.2) return;

  var screenX = Math.floor((W / 2) * (1 + transformX / transformY));
  var spriteH = Math.abs(Math.floor(H / transformY));
  var spriteW = tall ? Math.floor(spriteH / 3) : Math.floor(spriteH * 0.5);
  var startY  = Math.floor((H - spriteH) / 2);
  var startX  = screenX - Math.floor(spriteW / 2);

  ctx2d.save();
  ctx2d.globalAlpha = alpha * Math.min(1, 3.5 / dist);
  ctx2d.shadowBlur = 22;
  ctx2d.shadowColor = color;

  if (tall) {
    ctx2d.fillStyle = '#000';
    ctx2d.fillRect(startX, startY + Math.floor(spriteH * 0.1), spriteW, Math.floor(spriteH * 0.8));
    ctx2d.fillStyle = color;
    ctx2d.shadowBlur = 30;
    ctx2d.fillRect(startX - 2, startY + Math.floor(spriteH * 0.1), 3, Math.floor(spriteH * 0.8));
    ctx2d.fillRect(startX + spriteW, startY + Math.floor(spriteH * 0.1), 3, Math.floor(spriteH * 0.8));
  } else {
    ctx2d.fillStyle = color;
    ctx2d.beginPath();
    ctx2d.arc(screenX, Math.floor(H / 2), Math.max(2, size / transformY), 0, Math.PI * 2);
    ctx2d.fill();
  }
  ctx2d.restore();
}

// ===== MOVEMENT =====
var footstepTimer = 0;
var moved = false;

function move(dt) {
  if (gameState !== 'playing') return;
  var nx = player.x, ny = player.y;
  var spd = player.moveSpeed * dt * 60;
  var rot = 0.038 * dt * 60;
  moved = false;

  if (keys['ArrowLeft']  || keys['q'] || keys['Q']) player.angle -= rot;
  if (keys['ArrowRight'] || keys['ArrowRight']) player.angle += rot;

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

  if (MAP[Math.floor(ny)] && MAP[Math.floor(ny)][Math.floor(nx)] !== 1) {
    if (MAP[Math.floor(player.y)] && MAP[Math.floor(player.y)][Math.floor(nx)] !== 1) player.x = nx;
    if (MAP[Math.floor(ny)]       && MAP[Math.floor(ny)][Math.floor(player.x)] !== 1) player.y = ny;
  }

  if (moved) {
    footstepTimer += dt;
    if (footstepTimer > 0.38) { playFootstep(); footstepTimer = 0; }
  }
}

// ===== MOUSE LOOK =====
function setupMouseLook() {
  canvas.addEventListener('click', function() {
    if (!mouseLocked && gameState === 'playing') canvas.requestPointerLock();
  });

  document.addEventListener('pointerlockchange', function() {
    mouseLocked = document.pointerLockElement === canvas;
    document.getElementById('controls-hint').innerHTML = mouseLocked
      ? 'WASD — MOVE &nbsp;|&nbsp; MOUSE — AIM &nbsp;|&nbsp; E — INTERACT &nbsp;|&nbsp; F — FLASHLIGHT &nbsp;|&nbsp; ESC — UNLOCK'
      : '<span style="color:#ffaa00">[ CLICK GAME WINDOW TO CAPTURE MOUSE ]</span> &nbsp;|&nbsp; WASD — MOVE &nbsp;|&nbsp; E — INTERACT &nbsp;|&nbsp; F — LIGHT';
  });

  document.addEventListener('mousemove', function(e) {
    if (!mouseLocked || gameState !== 'playing') return;
    player.angle += e.movementX * 0.0028;
  });
}

// ===== INTERACTABLE DETECTION =====
function getNearbyInteractable() {
  for (var i = 0; i < INTERACTABLES.length; i++) {
    var obj = INTERACTABLES[i];
    if (obj.used) continue;
    var dx = obj.x + 0.5 - player.x;
    var dy = obj.y + 0.5 - player.y;
    if (Math.sqrt(dx*dx + dy*dy) < 1.3) return obj;
  }
  return null;
}

// ===== GAME STATE =====
var gameState = 'playing';
var logsRead = {};
var logsReadCount = 0;
var TOTAL_DOCS = INTERACTABLES.length;

// ===== HUD =====
function updateHUD() {
  document.getElementById('location-name').textContent = getZoneName(player.x, player.y);

  if (player.flashlightOn && moved) player.battery = Math.max(0, player.battery - 0.005);
  else if (player.flashlightOn)     player.battery = Math.max(0, player.battery - 0.001);

  var fill = document.getElementById('battery-fill');
  fill.style.width = player.battery + '%';
  if (player.battery < 30) { fill.style.background = '#ffaa00'; fill.style.boxShadow = '0 0 6px #ffaa00'; }
  if (player.battery < 10) { fill.style.background = '#ff2200'; fill.style.boxShadow = '0 0 6px #ff2200'; }
  if (player.battery <= 0) { player.flashlightOn = false; }

  var bars = document.querySelectorAll('.bar');
  var active = Math.floor((logsReadCount / TOTAL_DOCS) * 4);
  bars.forEach(function(b, i) { b.classList.toggle('active', i < active); });

  document.getElementById('flashlight-overlay').classList.toggle('off', !player.flashlightOn);
}

// ===== HORROR EVENTS =====
var flickerTimer = 0, nextFlickerIn  = 8 + Math.random() * 15;
var entityTimer  = 0, nextEntityIn   = 30 + Math.random() * 40;
var monitorTimer = 0, nextMonitorIn  = 20 + Math.random() * 30;
var bloodLevel   = 0;

function runHorrorEvents(dt) {
  flickerTimer += dt;
  if (flickerTimer > nextFlickerIn) {
    triggerFlicker(); flickerTimer = 0;
    nextFlickerIn = 6 + Math.random() * 20;
  }
  entityTimer += dt;
  if (entityTimer > nextEntityIn && logsReadCount >= 2) {
    triggerEntityFlash(); entityTimer = 0;
    nextEntityIn = 25 + Math.random() * 40;
  }
  monitorTimer += dt;
  if (monitorTimer > nextMonitorIn && logsReadCount >= 1) {
    triggerSecurityMonitor(); monitorTimer = 0;
    nextMonitorIn = 20 + Math.random() * 35;
  }
  var targetBlood = (logsReadCount / TOTAL_DOCS) * 0.5;
  bloodLevel += (targetBlood - bloodLevel) * dt * 0.5;
  document.getElementById('blood-vignette').style.opacity = bloodLevel;

  if (logsReadCount >= 3) {
    entityVisible = true;
    var eA = Math.random() * Math.PI * 2;
    var newEX = entityX + Math.cos(eA) * 0.012;
    var newEY = entityY + Math.sin(eA) * 0.012;
    if (MAP[Math.floor(newEY)] && MAP[Math.floor(newEY)][Math.floor(newEX)] !== 1) {
      entityX = newEX; entityY = newEY;
    }
  }
}

function triggerFlicker() {
  playCreak();
  var pattern = [0.1, 0.9, 0.05, 1.0, 0.2, 0.9, 1.0];
  var i = 0;
  function step() {
    if (i >= pattern.length) { flickerFactor = 1.0; return; }
    flickerFactor = pattern[i++];
    setTimeout(step, 55 + Math.random() * 45);
  }
  step();
}

function triggerEntityFlash() {
  playEntitySound(); triggerFlicker();
  setTimeout(function() {
    var flash = document.getElementById('entity-flash');
    var sil   = document.getElementById('entity-silhouette');
    flash.classList.remove('hidden');
    sil.style.animation = 'none'; sil.offsetHeight; sil.style.animation = '';
    playHeartbeat();
    setTimeout(function() { flash.classList.add('hidden'); }, 2200);
  }, 200);
}

var MONITOR_MSGS = [
  '[NO SIGNAL]\n...\nMOVEMENT DETECTED\nSECTOR B-4\n[FEED LOST]',
  'ENTITY: ACTIVE\nENERGY: MAXIMUM\nTHREAT: EXTREME',
  '...I SEE YOU...',
  'CORRIDOR C — LIVE\n[FEED CORRUPTED]\nNON-HUMAN SHAPE DETECTED',
  'IT KNOWS\nYOU\'RE HERE'
];

function triggerSecurityMonitor() {
  playStaticBurst();
  document.getElementById('monitor-content').textContent = MONITOR_MSGS[Math.floor(Math.random() * MONITOR_MSGS.length)];
  var mon = document.getElementById('security-monitor');
  mon.classList.remove('hidden');
  setTimeout(function() { mon.classList.add('hidden'); }, 3500 + Math.random() * 1000);
}

// ===== NARRATIVE =====
var narrativeQueue = [], narrativeRunning = false;
function showNarrative(text, delay) {
  delay = delay || 0;
  narrativeQueue.push({ text: text, delay: delay });
  if (!narrativeRunning) processNarrative();
}
function processNarrative() {
  if (!narrativeQueue.length) { narrativeRunning = false; return; }
  narrativeRunning = true;
  var item = narrativeQueue.shift();
  setTimeout(function() {
    var overlay = document.getElementById('narrative-overlay');
    var el = document.getElementById('narrative-text');
    el.textContent = item.text;
    el.style.animation = 'none'; el.offsetHeight; el.style.animation = '';
    overlay.classList.remove('hidden');
    setTimeout(function() { overlay.classList.add('hidden'); processNarrative(); }, 4300);
  }, item.delay);
}

// ===== DOCUMENT READER =====
function openDocument(docId) {
  if (!DOCUMENTS[docId]) return;
  gameState = 'reading';
  var doc = DOCUMENTS[docId];
  document.getElementById('doc-title').textContent = doc.title;
  var html = doc.text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/&lt;em&gt;/g,'<span class="doc-em">').replace(/&lt;\/em&gt;/g,'</span>')
    .replace(/&lt;warn&gt;/g,'<span class="doc-warn">').replace(/&lt;\/warn&gt;/g,'</span>');
  document.getElementById('doc-content').innerHTML = html;
  document.getElementById('doc-reader').classList.remove('hidden');
  playPickup();

  if (!logsRead[docId]) {
    logsRead[docId] = true;
    logsReadCount++;
    var narratives = {
      log_entry_1: 'The experiment began with hope. Someone wanted to create life from radiation.',
      log_entry_2: 'The organism was learning. And the scientists refused to stop.',
      log_entry_3: 'It was watching them. Through the cameras. Through the walls.',
      log_entry_4: 'They all disappeared. In a single night.',
      log_entry_5: 'The reactor keeps it alive. Shut it down — and the Visitor dies.',
      terminal_log: 'You understand now. The signal was not a call for help. It was a warning.'
    };
    if (narratives[docId]) {
      document.getElementById('doc-close').addEventListener('click', function once() {
        showNarrative(narratives[docId], 500);
        document.getElementById('doc-close').removeEventListener('click', once);
      });
    }
    if (docId === 'terminal_log') {
      document.getElementById('doc-close').addEventListener('click', function once2() {
        setTimeout(triggerEnding, 3000);
        document.getElementById('doc-close').removeEventListener('click', once2);
      });
    }
  }
  if (document.pointerLockElement) document.exitPointerLock();
}

function closeDocument() {
  document.getElementById('doc-reader').classList.add('hidden');
  gameState = 'playing';
}

// ===== ENDINGS =====
function triggerEnding() {
  gameState = 'choices';
  triggerFlicker(); playEntitySound();
  setTimeout(function() {
    var panel = document.getElementById('choices-panel');
    panel.classList.remove('hidden');
    document.getElementById('choices-text').textContent =
      'You stand before the reactor control panel.\nThe Visitor stirs in the darkness behind you.\n\nWhat do you do?';
    var btns = document.getElementById('choices-btns');
    btns.innerHTML = '';
    [
      { id:'shutdown', label:'[ INITIATE EMERGENCY SHUTDOWN ]', sub:'Kill the reactor. Destroy the Visitor. End the signal forever.' },
      { id:'restart',  label:'[ RESTART REACTOR CYCLE ]',        sub:'Restore full power. The Visitor survives. The signal continues.' },
      { id:'leave',    label:'[ DO NOTHING — LEAVE ]',           sub:'Walk away. Let time decide what dies here.' }
    ].forEach(function(o) {
      var btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.innerHTML = o.label + '\n' + o.sub;
      btn.addEventListener('click', function() { endGame(o.id); });
      btns.appendChild(btn);
    });
  }, 1000);
}

var ENDINGS = {
  shutdown: {
    title: 'SILENCE',
    text: 'You enter the emergency shutdown sequence.\n\nThe reactor hums, shudders — and dies.\n\nThe lights go out. You hear something in the dark.\nA long, falling sound, like a breath being let out for the last time.\n\nThen: nothing.\n\nYou make your way out in total darkness, following the wall with your hands.\nBehind you, Reactor 13 is quiet for the first time in almost thirty years.\n\nThe Visitor is gone.\n\nThree months later, you wake from a dream you cannot remember.\nYour skin is warm. The room smells faintly of something electric.\n\nYou are probably fine.',
    credits: 'ENDING: THE LAST BREATH'
  },
  restart: {
    title: 'CONTINUATION',
    text: 'You feed new fuel rods into the reactor core.\n\nThe lights return. Somewhere in the facility, something moves.\n\nIt does not approach you. It has learned patience.\n\nYou leave Reactor 13 exactly as you found it.\nThe signal resumes broadcasting the moment you cross the perimeter.\n\nYou never tell anyone what you saw.\n\nMonths later, a second team is sent.\nThey too leave with no conclusive findings.\n\nThe reactor runs. The Visitor endures.\n\nThe signal is still broadcasting today.\n\n          I AM ALONE',
    credits: 'ENDING: THE SIGNAL PERSISTS'
  },
  leave: {
    title: 'DECAY',
    text: 'You turn away from the console and walk out.\n\nThe reactor will exhaust its fuel in approximately four hours.\nWhen it does, whatever lives inside Reactor 13 will have nothing left to feed on.\n\nYou drive away as dawn breaks.\n\nThe facility falls silent on its own schedule.\n\nNo one ever returns. The building is demolished in 2029.\nConstruction workers report strange dreams for several weeks.\n\nA small monument is placed at the site.\nThe inscription reads:\n\n          "THEY TRIED TO UNDERSTAND."',
    credits: 'ENDING: THE NATURAL END'
  }
};

function endGame(id) {
  stopLoop = true;
  var e = ENDINGS[id];
  document.getElementById('ending-title').textContent = e.title;
  document.getElementById('ending-text').textContent  = e.text;
  document.getElementById('ending-credits').textContent = e.credits;
  document.getElementById('choices-panel').classList.add('hidden');
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('ending-screen').classList.remove('hidden');
  document.getElementById('ending-screen').classList.add('active');
  if (document.pointerLockElement) document.exitPointerLock();
  playDrone();
}

// ===== BOOT =====
var BOOT_LINES = [
  { text:'> INITIALIZING SYSTEM...',                         delay:300,  type:'' },
  { text:'> CLEARANCE LEVEL: ALPHA-7 GRANTED',               delay:700,  type:'' },
  { text:'> LOADING FACILITY MAP... PARTIAL DATA',           delay:1200, type:'log-warn' },
  { text:'> GEIGER COUNTER: ONLINE',                         delay:1700, type:'' },
  { text:'> FLASHLIGHT CHARGE: 100%',                        delay:2100, type:'' },
  { text:'> RADIO SIGNAL SOURCE: REACTOR CORE',              delay:2500, type:'log-warn' },
  { text:'> WARNING: LAST MAINTENANCE — 10,592 DAYS AGO',    delay:3000, type:'log-warn' },
  { text:'> WARNING: LIFE SIGNS DETECTED INSIDE FACILITY',   delay:3500, type:'log-err' },
  { text:'> RECOMMENDATION: ABORT MISSION',                  delay:4000, type:'log-err' },
  { text:'> ORDER OVERRIDE: INVESTIGATE ANYWAY',             delay:4400, type:'' },
  { text:'> GOOD LUCK, AGENT.',                              delay:5000, type:'' }
];

function runBootSequence() {
  var log = document.getElementById('boot-log');
  BOOT_LINES.forEach(function(item) {
    setTimeout(function() {
      var line = document.createElement('div');
      line.className = 'log-line ' + item.type;
      line.textContent = item.text;
      log.appendChild(line);
      log.scrollTop = log.scrollHeight;
    }, item.delay);
  });
  setTimeout(function() { document.getElementById('start-btn').classList.remove('hidden'); }, 5400);
}

// ===== MAIN LOOP =====
var stopLoop = false, lastTime = 0;

function gameLoop(ts) {
  if (stopLoop) return;
  var dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  if (gameState === 'playing') {
    move(dt);
    runHorrorEvents(dt);
    updateHUD();
    render();
    var near = getNearbyInteractable();
    var prompt = document.getElementById('interact-prompt');
    if (near) {
      prompt.classList.remove('hidden');
      document.getElementById('interact-text').textContent = '[ E ] ' + near.label;
    } else {
      prompt.classList.add('hidden');
    }
  }
  requestAnimationFrame(gameLoop);
}

// ===== INIT =====
function startGame() {
  initAudio(); playDrone();
  document.getElementById('boot-screen').classList.remove('active');
  document.getElementById('boot-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  document.getElementById('game-screen').classList.add('active');
  initCanvas(); setupMouseLook();
  gameState = 'playing'; stopLoop = false;
  setTimeout(function() { showNarrative('1997. A catastrophic experiment. No survivors.'); }, 1000);
  setTimeout(function() { showNarrative('2026. The signal returns. You are sent to investigate.'); }, 5500);
  setTimeout(function() { showNarrative('Click the game window to enable mouse look.'); }, 10000);
  setTimeout(function() { triggerFlicker(); playCreak(); }, 3000);
  requestAnimationFrame(function(t) { lastTime = t; requestAnimationFrame(gameLoop); });
}

function restartGame() {
  player.x = 1.5; player.y = 1.5; player.angle = 0;
  player.flashlightOn = true; player.battery = 100;
  logsRead = {}; logsReadCount = 0;
  INTERACTABLES.forEach(function(i) { i.used = false; });
  gameState = 'playing'; stopLoop = false;
  entityVisible = false; entityX = 10; entityY = 10;
  bloodLevel = 0; flickerFactor = 1.0;
  flickerTimer = entityTimer = monitorTimer = 0;
  nextFlickerIn = 8 + Math.random() * 15;
  nextEntityIn  = 30 + Math.random() * 40;
  nextMonitorIn = 20 + Math.random() * 30;

  var fill = document.getElementById('battery-fill');
  fill.style.width = '100%'; fill.style.background = 'var(--green)'; fill.style.boxShadow = '0 0 6px var(--green)';
  ['blood-vignette','flashlight-overlay'].forEach(function(id) {
    var el = document.getElementById(id);
    if (id === 'blood-vignette') el.style.opacity = '0';
    if (id === 'flashlight-overlay') el.classList.remove('off');
  });
  ['entity-flash','security-monitor','doc-reader','choices-panel','narrative-overlay','interact-prompt'].forEach(function(id) {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById('ending-screen').classList.remove('active');
  document.getElementById('ending-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  document.getElementById('game-screen').classList.add('active');
  doResize();
  setTimeout(function() { showNarrative('The facility is still here. So is what lives inside.'); }, 1000);
  requestAnimationFrame(function(t) { lastTime = t; requestAnimationFrame(gameLoop); });
}

window.addEventListener('keydown', function(e) {
  keys[e.key] = true;
  initAudio();
  if ((e.key === 'f' || e.key === 'F') && gameState === 'playing' && player.battery > 0) {
    player.flashlightOn = !player.flashlightOn;
  }
  if (e.key === 'e' || e.key === 'E') {
    if (gameState === 'reading') { closeDocument(); return; }
    if (gameState === 'playing') {
      var near = getNearbyInteractable();
      if (near) { openDocument(near.docId); near.used = true; }
    }
  }
  if (e.key === 'Escape') {
    if (gameState === 'reading') closeDocument();
    if (mouseLocked) document.exitPointerLock();
  }
});
window.addEventListener('keyup', function(e) { delete keys[e.key]; });

document.addEventListener('DOMContentLoaded', function() {
  runBootSequence();
  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('restart-btn').addEventListener('click', restartGame);
  document.getElementById('doc-close').addEventListener('click', closeDocument);
});

})();
