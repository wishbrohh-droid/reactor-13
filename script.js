/* ═══════════════════════════════════════════════════════════════
   REACTOR-13  —  script.js
   Full Three.js first-person horror game
   Engine: Three.js r128
   Architecture: Scene graph rooms, AABB collision, entity AI,
                 Web Audio procedural sound, mission system
═══════════════════════════════════════════════════════════════ */

'use strict';

// ──────────────────────────────────────────────────────────────
// GLOBAL STATE
// ──────────────────────────────────────────────────────────────
const G = {
  // Three.js core
  renderer: null,
  scene:    null,
  camera:   null,
  clock:    new THREE.Clock(),

  // State flags
  running:    false,
  paused:     false,
  docOpen:    false,
  choiceOpen: false,
  gameOver:   false,

  // Pointer lock
  pointerLocked: false,

  // Input
  keys: {},
  mouse: { dx: 0, dy: 0 },
  pitch: 0, yaw: 0,

  // Player
  player: {
    pos:      new THREE.Vector3(2, 1.7, 2),
    vel:      new THREE.Vector3(),
    height:   1.7,
    radius:   0.35,
    speed:    4.5,
    sprint:   8.0,
    stamina:  100,
    maxStam:  100,
    flashOn:  true,
    battery:  100,
    maxBat:   100,
    currentRoom: 'entrance',
  },

  // Flashlight
  flashlight: null,

  // Lights per room
  roomLights: [],
  ambientLight: null,

  // Collision boxes (AABB): array of {min, max}
  colliders: [],

  // Interactables: { mesh, label, action, pos, range }
  interactables: [],

  // Entity (AI enemy)
  entity: {
    mesh:   null,
    pos:    new THREE.Vector3(0, 0.9, 0),
    vel:    new THREE.Vector3(),
    state:  'patrol',   // patrol | chase | retreat
    speed:  2.2,
    waypoints: [],
    wpIndex:   0,
    detectionRange: 9,
    chaseRange:     14,
    lastSeen:       0,
    scareTimer:     0,
    visible:        false,
  },

  // Horror event timers
  horror: {
    flickerTimer: 0, nextFlicker: 8 + Math.random() * 12,
    entityFlash:  0, nextFlash:   35 + Math.random() * 45,
    blackout:     0, nextBlackout:70 + Math.random() * 80,
    footstepTimer:0,
    ambientTimer: 0, nextAmbient: 15 + Math.random() * 20,
    scareShowing: false,
    staticTimer:  0,
  },

  // Missions
  mission: {
    current:   0,
    completed: {},
    powerRestored:   false,
    keycardFound:    false,
    generatorA:      false,
    generatorB:      false,
    logsRead:        0,
    reactorReached:  false,
  },

  // Signal bar count
  signalBars: 0,
};

// ──────────────────────────────────────────────────────────────
// MISSIONS DATA
// ──────────────────────────────────────────────────────────────
const MISSIONS = [
  { id: 'm1', title: 'MISSION 1: ENTER THE FACILITY',       obj: 'Restore power at the entrance terminal.' },
  { id: 'm2', title: 'MISSION 2: FIND THE SECURITY KEYCARD', obj: 'Locate the keycard in the Storage Room.' },
  { id: 'm3', title: 'MISSION 3: RESTORE EMERGENCY POWER',  obj: 'Activate both generators in the Generator Chamber.' },
  { id: 'm4', title: 'MISSION 4: ACCESS THE CONTROL ROOM',  obj: 'Read the experiment logs in the Control Room.' },
  { id: 'm5', title: 'MISSION 5: REACH THE REACTOR CORE',   obj: 'Travel through the tunnels to the Reactor Core.' },
  { id: 'final', title: 'MISSION 6: DECIDE THE FATE',       obj: 'Approach the reactor and choose its fate.' },
];

// ──────────────────────────────────────────────────────────────
// DOCUMENT DATABASE
// ──────────────────────────────────────────────────────────────
const DOCS = {
  entrance_notice: {
    title: 'FACILITY NOTICE — 1997.03.01',
    body: `ALL PERSONNEL — MANDATORY REMINDER

Access to Reactor Level requires Level-4 clearance.
Experiment HELIX staff report to Sector D at 07:00.

<warn>UNAUTHORIZED ACCESS WILL BE TREATED AS A BREACH
UNDER MINISTRY ORDER 77.</warn>

Security has been upgraded this week.
All corridor cameras are now active 24 hours.

If the alarm sounds: proceed to Sector A immediately.
Do not attempt to investigate the cause.

<em>— Director G. Norin</em>`,
  },
  entrance_terminal: {
    title: 'ENTRANCE POWER TERMINAL — SYSTEM LOG',
    body: `MAIN DOOR: LOCKED
Emergency power rerouted to door circuit.

Restoring circuit... please wait...
...
...
<warn>WARNING: Backup power at 12%. Facility degraded.</warn>

Door unlocked. You may proceed.
Recommend flashlight for all areas beyond Sector A.

Note: Life sign sensors detect one biological signature
in Sector A vicinity.

<em>— Automated system response</em>`,
  },
  security_log: {
    title: "SECURITY GUARD LOG — OFFICER LEV — 1997.03.25",
    body: `02:00 — Night shift. Third night of strange sounds.
Something is moving below. Not a person. Wrong sound.

Vaskov says it's pipe resonance. He won't look me in the eye.

<warn>02:47 — Power fluctuation, Sector D. Cameras down 11 minutes.</warn>

When they came back: three staff missing from the lab feed.
No alarm triggered. No door opened.

I'm filing an incident report at 06:00.

02:58 — One camera in B-corridor turned itself around.
Facing the wall now.

I am writing this in the security booth.
I have locked the door.

<em>— Lev, I.</em>`,
  },
  storage_manifest: {
    title: 'STORAGE MANIFEST — SECTOR B',
    body: `VERIFIED COUNT — 1997.03.20

- Emergency rations: 40 units
- Respirators: 12 units
- Radiation suits: 4 units (2 missing as of 03.24)
- Security keycards: 3 total
  2 issued to Director Norin
  <warn>1 remaining in lockbox B-7</warn>
- Flashlights: 6 units
- First aid kits: 8 units

NOTE APPENDED:
Keycard left in tray near Box B-7.
Director's keycards taken in evacuation.
One keycard remains. Use it to access the Control Room.`,
  },
  keycard_found: {
    title: 'SECURITY KEYCARD — FOUND',
    body: `SECURITY CLEARANCE KEYCARD
Level 3 — Control Room Access

This keycard was left behind in the evacuation.

<warn>CONTROL ROOM IS NOW ACCESSIBLE.</warn>

Note written on back (Dr. Mironova's handwriting):
"I left this for whoever comes next.
The logs in the control room will explain everything.
Vaskov's final recording is there too.
You need to understand what you're dealing with."

<em>— Y. Mironova</em>`,
  },
  gen_a_log: {
    title: 'GENERATOR A — MAINTENANCE LOG',
    body: `GENERATOR STATUS: OFFLINE
Last maintenance: 1997.03.15
Technician: Brov, V.

Power output when operational: 40kW
Sector coverage: B, C (Control Room, Corridor)

<warn>Fuel reserves at 34%. Generator can be restarted.</warn>

Activating...
...
Emergency power restored to Sectors B and C.

Flickering on startup is normal.
Do not be alarmed by the lights.

<em>— Automated response</em>`,
  },
  gen_b_log: {
    title: 'GENERATOR B — MAINTENANCE LOG',
    body: `GENERATOR STATUS: OFFLINE
Last maintenance: 1997.03.18
Technician: Brov, V.

Sector coverage: D (Reactor Level, Tunnels)

<warn>Fuel reserves at 28%. Generator can be restarted.</warn>

Activating...
...
<warn>WARNING: Power surge on restart. Sensor fault in Sector D.</warn>

Power restored. Reactor Level partially active.

Note: Technician Brov did not complete final maintenance entry.
He was found in Corridor C the following morning.
Cause of death: undetermined.

<em>— Automated response</em>`,
  },
  experiment_log1: {
    title: 'EXPERIMENT LOG — DR. VASKOV — DAY 01',
    body: `EXPERIMENT HELIX — PHASE 1

The theory holds. I can barely write this calmly.

By exposing a focused electromagnetic seed structure to sustained
nuclear output, we have created a self-organizing energy form.

It is roughly 40 centimeters across.
It pulses. It responds to light. It moves with apparent intent.

<em>Petrov calls it the greatest discovery of the century.
I think he is right.</em>

Phase 2 begins tomorrow: controlled growth via increased reactor output.
We will document everything.

<em>— Dr. A. Vaskov, Lead Researcher</em>`,
  },
  experiment_log2: {
    title: 'EXPERIMENT LOG — DR. VASKOV — DAY 14',
    body: `HELIX — PHASE 2 UPDATE

Growth rate exceeded projections. The organism is now 1.8 meters.

<warn>It is no longer responding predictably to stimuli.</warn>

It no longer retracts from light. It turns toward it.
It no longer ignores sound. It rotates toward the source.

Petrov says this is expected emergent behavior.
I requested a containment review. Denied.

I am beginning to keep a personal log.
If something goes wrong, I want there to be a record.

A record that tells the truth.

<em>— Dr. A. Vaskov</em>`,
  },
  experiment_log3: {
    title: 'DR. VASKOV — FINAL LOG ENTRY',
    body: `<warn>RECORDED 1997.03.26 — 04:11</warn>

I am at the cooling chamber. Mironova went down an hour ago.
She has not come back.
Lev is gone.

I can hear it now. Not with my ears.
A frequency behind my eyes.
It says the same thing, over and over:

          I AM ALONE.

I think I understand it now.
We made it a prison and called it a laboratory.
We fed it radiation and measured it and never once asked
whether it wanted to exist this way.

<warn>I'm going to the core.
I am going to try to communicate with it.
If I don't come back, whoever finds this should know:</warn>

It is not a weapon.
It is a child.
A very large, very frightened, very alone child.

Tell them that, if you find this.

<em>— Dr. Vaskov (Last known recording)</em>`,
  },
  mironova_note: {
    title: "DR. MIRONOVA'S NOTE — FOUND AT SECURITY DESK",
    body: `I can still hear it.

Three floors above the reactor, I can hear it.
Not with ears. Somewhere behind my eyes.

      I am alone.

Over and over.

It is not threatening us. I understand that now.
It reached out to Lev because he was nearby.
It turned the cameras to watch us because it was curious.

<warn>We made something alive and left it in the dark
and called it an experiment.</warn>

I am going back down.
I am going to sit with it.
I don't care what the protocol says.

<em>Y. Mironova
(Note found at desk. She was never seen again.)</em>`,
  },
  reactor_terminal: {
    title: 'REACTOR CORE — STATUS TERMINAL',
    body: `HELIX EXPERIMENT — CURRENT STATUS

ENTITY DESIGNATION: HELIX-VISITOR
LOCATION: Reactor Core (confirmed)
BEHAVIORAL STATE: <warn>AGITATED — new biological presence detected</warn>

REACTOR STATUS:
  Output: 23% (minimum containment threshold)
  <warn>Fuel: depleting — estimated shutdown T-04:18</warn>
  Containment field: BREACHED (Day 10,592)

SIGNAL BROADCAST:
  Active since November 2024
  Decoded content: "I AM ALONE"

NOTE:
  If reactor shuts down — entity expires.
  If reactor restarts — entity survives indefinitely.

<warn>IT KNOWS YOU ARE HERE.</warn>
<warn>CHOOSE CAREFULLY.</warn>`,
  },
};

// ──────────────────────────────────────────────────────────────
// AUDIO ENGINE
// ──────────────────────────────────────────────────────────────
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
  }
}

function playTone(freq, type, dur, vol, delay) {
  if (!audioCtx) return;
  vol = vol || 0.07; delay = delay || 0;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.connect(g); g.connect(audioCtx.destination);
  o.type = type; o.frequency.value = freq;
  const t = audioCtx.currentTime + delay;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.05);
}

function playNoise(dur, vol, lp) {
  if (!audioCtx) return;
  vol = vol || 0.04; lp = lp || 900;
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const filt = audioCtx.createBiquadFilter();
  filt.type = 'lowpass'; filt.frequency.value = lp;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
  src.connect(filt); filt.connect(g); g.connect(audioCtx.destination);
  src.start(); src.stop(audioCtx.currentTime + dur);
}

function sndFootstep() { playNoise(0.07, 0.04, 200 + Math.random() * 120); }
function sndPickup()   { [440,550,660].forEach((f,i) => playTone(f,'sine',0.18,0.05,i*0.07)); }
function sndCreak()    { playNoise(0.5+Math.random()*0.4, 0.06, 280+Math.random()*200); playTone(65+Math.random()*35,'triangle',0.7,0.03); }
function sndEntity()   { [28,42,85].forEach(f => playTone(f,'sawtooth',1.4,0.05)); playNoise(1.4,0.07,170); }
function sndStatic()   { playNoise(0.28, 0.13, 3800); }
function sndHeartbeat(){ playTone(56,'sine',0.14,0.09); setTimeout(() => playTone(50,'sine',0.11,0.06), 145); }
function sndPowerup()  { [50,75,110,160,200].forEach((f,i) => playTone(f,'sawtooth',0.45,0.06,i*0.09)); }
function sndDoor()     { playNoise(0.2, 0.1, 700); playTone(115,'sawtooth',0.28,0.05); }
function sndDrone()    {
  if (!audioCtx) return;
  [38,40,78].forEach((f,i) => {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = 'sawtooth'; o.frequency.value = f;
    g.gain.value = 0.012 - i*0.003;
    o.start();
    setTimeout(() => {
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime+3);
      setTimeout(() => o.stop(), 3100);
    }, 6500 + Math.random()*4000);
  });
}

// ──────────────────────────────────────────────────────────────
// THREE.JS INIT
// ──────────────────────────────────────────────────────────────
function initThree() {
  const canvas = document.getElementById('game-canvas');

  G.renderer = new THREE.WebGLRenderer({
    canvas, antialias: false, powerPreference: 'low-power'
  });
  G.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  G.renderer.setSize(window.innerWidth, window.innerHeight);
  G.renderer.shadowMap.enabled = false; // off for performance
  G.renderer.setClearColor(0x000000);

  G.scene = new THREE.Scene();
  G.scene.fog = new THREE.FogExp2(0x000000, 0.065);

  G.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 60);
  G.camera.position.copy(G.player.pos);

  window.addEventListener('resize', () => {
    G.renderer.setSize(window.innerWidth, window.innerHeight);
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
  });
}

// ──────────────────────────────────────────────────────────────
// MATERIAL HELPERS
// ──────────────────────────────────────────────────────────────
const MAT = {
  wall:    () => new THREE.MeshLambertMaterial({ color: 0x1a2a1c }),
  wallDark:() => new THREE.MeshLambertMaterial({ color: 0x0e1a10 }),
  floor:   () => new THREE.MeshLambertMaterial({ color: 0x111811 }),
  ceil:    () => new THREE.MeshLambertMaterial({ color: 0x0d150e }),
  metal:   () => new THREE.MeshLambertMaterial({ color: 0x2a3028 }),
  door:    () => new THREE.MeshLambertMaterial({ color: 0x243020 }),
  pipe:    () => new THREE.MeshLambertMaterial({ color: 0x2e2c1a }),
  glow:    (c)=> new THREE.MeshBasicMaterial({ color: c }),
  dim:     (c)=> new THREE.MeshLambertMaterial({ color: c }),
};

function box(w,h,d, mat, x,y,z) {
  const geo = new THREE.BoxGeometry(w,h,d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x,y,z);
  G.scene.add(mesh);
  return mesh;
}

function addCollider(x,y,z, w,d) {
  const half = { x: w/2, z: d/2 };
  G.colliders.push({
    min: new THREE.Vector3(x - half.x, -10, z - half.z),
    max: new THREE.Vector3(x + half.x,  10, z + half.z),
  });
}

function addInteractable(mesh, label, pos, range, action) {
  G.interactables.push({ mesh, label, pos: pos.clone(), range: range || 2.2, action });
}

function pointLight(color, intensity, dist, x, y, z) {
  const l = new THREE.PointLight(color, intensity, dist);
  l.position.set(x, y, z);
  G.scene.add(l);
  G.roomLights.push(l);
  return l;
}

// ──────────────────────────────────────────────────────────────
// MAP BUILDER — 8 ROOMS
// ──────────────────────────────────────────────────────────────

// Layout overview (X-Z plane, Y=up):
//  Entrance Hall (0,0)
//  Security Checkpoint (20,0)
//  Storage Room (40,0)
//  Control Room (40,20)
//  Generator Chamber (20,20)
//  Maintenance Tunnel (0,20)-(0,40)
//  Reactor Cooling Room (20,40)
//  Underground Reactor Core (40,40)
// Corridors link them

function buildRoom(x, z, w, d, name) {
  const floorY  = 0;
  const wallH   = 3.5;
  const wallHH  = wallH / 2;
  const ceilY   = wallH;

  // Floor
  const floorMesh = box(w, 0.1, d, MAT.floor(), x, floorY, z);
  // Ceiling
  const ceilMesh  = box(w, 0.1, d, MAT.ceil(),  x, ceilY, z);

  // North wall
  box(w, wallH, 0.2, MAT.wall(), x, wallHH, z - d/2);
  addCollider(x, 0, z - d/2, w + 0.4, 0.4);
  // South wall
  box(w, wallH, 0.2, MAT.wall(), x, wallHH, z + d/2);
  addCollider(x, 0, z + d/2, w + 0.4, 0.4);
  // West wall
  box(0.2, wallH, d, MAT.wall(), x - w/2, wallHH, z);
  addCollider(x - w/2, 0, z, 0.4, d + 0.4);
  // East wall
  box(0.2, wallH, d, MAT.wall(), x + w/2, wallHH, z);
  addCollider(x + w/2, 0, z, 0.4, d + 0.4);

  return { x, z, w, d, name };
}

function buildDoorway(x, z, axis, wallX, wallZ) {
  // axis: 'x' = doorway on north/south wall, 'z' = east/west
  const wallH = 3.5;
  const doorH = 2.5;
  const doorW = 1.8;
  const fillH = wallH - doorH;

  if (axis === 'z') {
    // Door in east/west wall — fill top
    box(0.2, fillH, doorW, MAT.wall(), wallX, doorH + fillH/2, wallZ);
    // Side pillars
    const sideW = 1.0;
    box(0.2, wallH, sideW, MAT.wall(), wallX, wallH/2, wallZ - doorW/2 - sideW/2);
    box(0.2, wallH, sideW, MAT.wall(), wallX, wallH/2, wallZ + doorW/2 + sideW/2);
  } else {
    // Door in north/south wall — fill top
    box(doorW, fillH, 0.2, MAT.wall(), wallX, doorH + fillH/2, wallZ);
    const sideW = 1.0;
    box(sideW, wallH, 0.2, MAT.wall(), wallX - doorW/2 - sideW/2, wallH/2, wallZ);
    box(sideW, wallH, 0.2, MAT.wall(), wallX + doorW/2 + sideW/2, wallH/2, wallZ);
  }

  // Door frame glow strip
  const geoFrame = new THREE.BoxGeometry(axis==='z'?0.05:doorW+0.1, 0.08, axis==='z'?doorW+0.1:0.05);
  const matFrame = new THREE.MeshBasicMaterial({ color: 0x004410 });
  const frame = new THREE.Mesh(geoFrame, matFrame);
  frame.position.set(wallX, doorH, wallZ);
  G.scene.add(frame);
}

function buildCorridor(x1, z1, x2, z2, width) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.sqrt(dx*dx + dz*dz);
  const cx = (x1+x2)/2, cz = (z1+z2)/2;
  const angle = Math.atan2(dz, dx);
  const wallH = 3.5, wallHH = wallH/2;

  // Floor & ceiling
  const geo = new THREE.BoxGeometry(len, 0.1, width);
  const floorMesh = new THREE.Mesh(geo, MAT.floor());
  floorMesh.position.set(cx, 0, cz);
  floorMesh.rotation.y = -angle;
  G.scene.add(floorMesh);

  const ceilMesh = new THREE.Mesh(geo.clone(), MAT.ceil());
  ceilMesh.position.set(cx, wallH, cz);
  ceilMesh.rotation.y = -angle;
  G.scene.add(ceilMesh);

  // Walls along corridor sides
  const wGeo = new THREE.BoxGeometry(len, wallH, 0.2);
  const sinA = Math.sin(angle), cosA = Math.cos(angle);
  const hw = width/2;

  const w1 = new THREE.Mesh(wGeo, MAT.wall());
  w1.position.set(cx + sinA*hw, wallHH, cz - cosA*hw);
  w1.rotation.y = -angle;
  G.scene.add(w1);

  const w2 = new THREE.Mesh(wGeo.clone(), MAT.wall());
  w2.position.set(cx - sinA*hw, wallHH, cz + cosA*hw);
  w2.rotation.y = -angle;
  G.scene.add(w2);

  // Corridor colliders along sides
  if (Math.abs(dx) > Math.abs(dz)) {
    addCollider(cx, 0, cz - hw, len, 0.4);
    addCollider(cx, 0, cz + hw, len, 0.4);
  } else {
    addCollider(cx - hw, 0, cz, 0.4, len);
    addCollider(cx + hw, 0, cz, 0.4, len);
  }
}

// ──────────────────────────────────────────────────────────────
// ROOM: ENTRANCE HALL (center 5, 5)
// ──────────────────────────────────────────────────────────────
function buildEntrance() {
  buildRoom(5, 5, 14, 14, 'entrance');
  pointLight(0x103810, 0.6, 12, 5, 3, 5);

  // Entrance terminal (power restore)
  const termGeo = new THREE.BoxGeometry(0.8, 1.4, 0.3);
  const term = new THREE.Mesh(termGeo, MAT.metal());
  term.position.set(2, 0.7, 1);
  G.scene.add(term);
  // Screen glow
  const screenGeo = new THREE.BoxGeometry(0.55, 0.4, 0.05);
  const screen = new THREE.Mesh(screenGeo, new THREE.MeshBasicMaterial({ color: 0x00aa30 }));
  screen.position.set(2, 1.0, 1.16);
  G.scene.add(screen);
  addInteractable(term, 'RESTORE POWER', new THREE.Vector3(2, 0.7, 1), 2.2, () => {
    openDoc('entrance_terminal', () => {
      if (!G.mission.powerRestored) {
        G.mission.powerRestored = true;
        completeMission('m1');
        sndPowerup();
        flickerLights(6);
      }
    });
  });

  // Desk and notice
  const desk = box(1.8, 0.75, 0.8, MAT.metal(), 8, 0.375, 9.5);
  const noteGeo = new THREE.BoxGeometry(0.3, 0.02, 0.4);
  const note = new THREE.Mesh(noteGeo, MAT.dim(0x8aaa60));
  note.position.set(7.5, 0.77, 9.5);
  G.scene.add(note);
  addInteractable(note, 'READ NOTICE', new THREE.Vector3(7.5, 0.77, 9.5), 2.0, () => {
    openDoc('entrance_notice');
  });

  // Broken chairs
  box(0.6, 0.5, 0.6, MAT.metal(), 9, 0.25, 3);
  box(0.6, 0.5, 0.6, MAT.metal(), 10.5, 0.1, 3.5);

  // Pipes on wall
  const pipeGeo = new THREE.CylinderGeometry(0.06, 0.06, 12, 5);
  const pipe = new THREE.Mesh(pipeGeo, MAT.pipe());
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(5, 3.1, -1.8);
  G.scene.add(pipe);

  // Flickering ceiling fixture
  const fixtureGeo = new THREE.BoxGeometry(0.4, 0.08, 1.0);
  const fixture = new THREE.Mesh(fixtureGeo, new THREE.MeshBasicMaterial({ color: 0x335533 }));
  fixture.position.set(5, 3.42, 5);
  G.scene.add(fixture);

  // Door to Security (east)
  buildDoorway(12, 5, 'z', 12, 5);
}

// ──────────────────────────────────────────────────────────────
// ROOM: SECURITY CHECKPOINT (center 25, 5)
// ──────────────────────────────────────────────────────────────
function buildSecurity() {
  buildRoom(25, 5, 14, 14, 'security');
  pointLight(0x0a2210, 0.5, 12, 25, 3, 5);

  // Security booth
  box(4, 1.0, 2, MAT.metal(), 23, 0.5, 2);
  box(4, 1.8, 0.15, MAT.metal(), 23, 0.9, 1.1); // front glass/window
  box(4, 0.05, 2, MAT.metal(), 23, 1.8, 2);

  // Guard log on counter
  const logNote = box(0.25, 0.02, 0.35, MAT.dim(0x7a9a55), 22, 1.02, 2.4);
  addInteractable(logNote, 'READ GUARD LOG', new THREE.Vector3(22, 1.0, 2.4), 2.2, () => {
    openDoc('security_log');
  });

  // Metal detector arches (decorative)
  for (let i = 0; i < 2; i++) {
    const archGeo = new THREE.TorusGeometry(1.0, 0.07, 6, 12, Math.PI);
    const arch = new THREE.Mesh(archGeo, MAT.metal());
    arch.rotation.x = Math.PI / 2;
    arch.position.set(25 + (i === 0 ? -1 : 1), 1.0, 8);
    G.scene.add(arch);
  }

  // Crates
  box(0.8, 0.8, 0.8, MAT.metal(), 28, 0.4, 2);
  box(0.8, 0.8, 0.8, MAT.metal(), 28.9, 0.4, 2.8);
  box(0.8, 1.6, 0.8, MAT.metal(), 28, 1.2, 2);

  // Mironova note (found here)
  const miroNote = box(0.25, 0.02, 0.35, MAT.dim(0x7a9a55), 27, 0.77, 11);
  addInteractable(miroNote, "READ DR. MIRONOVA'S NOTE", new THREE.Vector3(27, 0.77, 11), 2.2, () => {
    openDoc('mironova_note');
  });

  // Corridor connects east (to Storage) — door east wall
  buildDoorway(32, 5, 'z', 32, 5);
  // Corridor connects south (to Generator Chamber) — door south wall
  buildDoorway(25, 12, 'x', 25, 12);
}

// ──────────────────────────────────────────────────────────────
// ROOM: STORAGE ROOM (center 45, 5)
// ──────────────────────────────────────────────────────────────
function buildStorage() {
  buildRoom(45, 5, 14, 14, 'storage');
  pointLight(0x0a1a08, 0.45, 10, 45, 3, 5);

  // Shelving units
  for (let r = 0; r < 3; r++) {
    for (let s = 0; s < 3; s++) {
      box(3.5, 0.06, 0.5, MAT.metal(), 43, 0.5 + s * 0.9, 1.5 + r * 0.05);
    }
    box(0.06, 2.8, 0.5, MAT.metal(), 41.3, 1.4, 1.5 + r * 0.05);
    box(0.06, 2.8, 0.5, MAT.metal(), 44.7, 1.4, 1.5 + r * 0.05);
    addCollider(43, 0, 1.5 + r * 0.05, 3.6, 0.6);
  }

  // Scattered crates
  box(0.8,0.8,0.8, MAT.metal(), 48, 0.4, 3);
  box(0.8,0.8,0.8, MAT.metal(), 49, 0.4, 4);
  box(1.2,1.2,1.2, MAT.metal(), 48.5, 0.6, 5);
  box(0.8,0.8,0.8, MAT.metal(), 48, 1.2, 3);

  // Lockbox B-7 with keycard
  const lockboxGeo = new THREE.BoxGeometry(0.5, 0.35, 0.4);
  const lockbox = new THREE.Mesh(lockboxGeo, MAT.metal());
  lockbox.position.set(47, 0.77, 9);
  G.scene.add(lockbox);
  addCollider(47, 0, 9, 0.6, 0.5);

  // Keycard on top of lockbox
  const cardGeo = new THREE.BoxGeometry(0.22, 0.02, 0.35);
  const card = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ color: 0x3366ff }));
  card.position.set(47, 0.97, 9);
  G.scene.add(card);
  addInteractable(card, 'TAKE KEYCARD', new THREE.Vector3(47, 0.97, 9), 2.0, () => {
    if (!G.mission.keycardFound) {
      G.mission.keycardFound = true;
      sndPickup();
      openDoc('keycard_found', () => {
        completeMission('m2');
        showNotify('KEYCARD OBTAINED', 'Control Room is now accessible.');
        card.visible = false;
      });
    }
  });

  // Manifest
  const manifest = box(0.25, 0.02, 0.35, MAT.dim(0x7a9a55), 44, 0.77, 9.5);
  addInteractable(manifest, 'READ MANIFEST', new THREE.Vector3(44, 0.77, 9.5), 2.2, () => {
    openDoc('storage_manifest');
  });

  // Door west back to Security
  buildDoorway(32, 5, 'z', 38, 5);
  // Door south to Control Room
  buildDoorway(45, 12, 'x', 45, 12);
}

// ──────────────────────────────────────────────────────────────
// ROOM: CONTROL ROOM (center 45, 25)
// ──────────────────────────────────────────────────────────────
function buildControlRoom() {
  buildRoom(45, 25, 14, 14, 'control');
  // Starts dark — generators needed
  const ctrlLight = pointLight(0x0a1808, 0.3, 12, 45, 3, 25);
  ctrlLight.userData.room = 'control';

  // Banks of monitors
  for (let i = 0; i < 4; i++) {
    box(1.0, 0.7, 0.5, MAT.metal(), 40 + i * 1.2, 1.0, 19.5);
    // Screen
    const scrGeo = new THREE.BoxGeometry(0.75, 0.5, 0.05);
    const scrMat = new THREE.MeshBasicMaterial({ color: i === 2 ? 0x003300 : 0x010a02 });
    const scr = new THREE.Mesh(scrGeo, scrMat);
    scr.position.set(40 + i * 1.2, 1.2, 19.28);
    G.scene.add(scr);
  }
  addCollider(42.2, 0, 19.5, 6, 0.6);

  // Main command console
  box(5, 0.9, 1.2, MAT.metal(), 45, 0.45, 22);
  addCollider(45, 0, 22, 5.2, 1.3);
  for (let i = 0; i < 5; i++) {
    const btnGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.08, 6);
    const btn = new THREE.Mesh(btnGeo, new THREE.MeshBasicMaterial({ color: i%2===0?0x00aa20:0xaa2000 }));
    btn.position.set(42.5 + i * 1.1, 0.92, 22);
    G.scene.add(btn);
  }

  // Log terminals — 3 separate docs
  const logPositions = [
    { pos: new THREE.Vector3(43, 1.0, 30), doc: 'experiment_log1', label: 'READ LOG — VASKOV DAY 01' },
    { pos: new THREE.Vector3(45, 1.0, 30), doc: 'experiment_log2', label: 'READ LOG — VASKOV DAY 14' },
    { pos: new THREE.Vector3(47, 1.0, 30), doc: 'experiment_log3', label: 'READ FINAL LOG — VASKOV' },
  ];
  logPositions.forEach(lp => {
    const t = box(0.8, 1.2, 0.3, MAT.metal(), lp.pos.x, 0.6, lp.pos.z);
    const s = box(0.55, 0.38, 0.05, new THREE.MeshBasicMaterial({ color: 0x002200 }), lp.pos.x, 0.95, lp.pos.z + 0.18);
    addInteractable(t, lp.label, lp.pos, 2.2, () => {
      openDoc(lp.doc, () => {
        G.mission.logsRead++;
        if (G.mission.logsRead >= 3) completeMission('m4');
      });
    });
  });
  addCollider(45, 0, 30, 6, 0.5);

  // Locked door note (shows if no keycard)
  // Connection: door north back to Storage
  buildDoorway(45, 18, 'x', 45, 18);
  // Door west to Generator Chamber
  buildDoorway(38, 25, 'z', 38, 25);
}

// ──────────────────────────────────────────────────────────────
// ROOM: GENERATOR CHAMBER (center 25, 25)
// ──────────────────────────────────────────────────────────────
function buildGeneratorChamber() {
  buildRoom(25, 25, 14, 14, 'generator');
  pointLight(0x100c04, 0.4, 10, 25, 3, 25);

  // Generator A
  const genA = box(2.0, 1.4, 1.0, MAT.metal(), 20, 0.7, 20);
  // Exhaust pipes
  const exGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.5, 6);
  const exA = new THREE.Mesh(exGeo, MAT.pipe());
  exA.position.set(20, 1.95, 20); G.scene.add(exA);
  // Control panel on gen
  const panA = box(0.5, 0.35, 0.05, new THREE.MeshBasicMaterial({ color: 0x001a00 }), 20, 0.9, 19.52);
  addCollider(20, 0, 20, 2.2, 1.2);
  addInteractable(genA, 'ACTIVATE GENERATOR A', new THREE.Vector3(20, 0.7, 20), 2.5, () => {
    if (!G.mission.generatorA) {
      G.mission.generatorA = true;
      sndPowerup();
      flickerLights(8);
      openDoc('gen_a_log', () => {
        panA.material = new THREE.MeshBasicMaterial({ color: 0x00aa30 });
        if (G.mission.generatorA && G.mission.generatorB) completeMission('m3');
        else showNotify('GENERATOR A ONLINE', 'Activate Generator B as well.');
      });
    } else {
      showNotify('GENERATOR A', 'Already online.');
    }
  });

  // Generator B
  const genB = box(2.0, 1.4, 1.0, MAT.metal(), 30, 0.7, 20);
  const exB = new THREE.Mesh(exGeo.clone(), MAT.pipe());
  exB.position.set(30, 1.95, 20); G.scene.add(exB);
  const panB = box(0.5, 0.35, 0.05, new THREE.MeshBasicMaterial({ color: 0x001a00 }), 30, 0.9, 19.52);
  addCollider(30, 0, 20, 2.2, 1.2);
  addInteractable(genB, 'ACTIVATE GENERATOR B', new THREE.Vector3(30, 0.7, 20), 2.5, () => {
    if (!G.mission.generatorB) {
      G.mission.generatorB = true;
      sndPowerup();
      flickerLights(10);
      openDoc('gen_b_log', () => {
        panB.material = new THREE.MeshBasicMaterial({ color: 0x00aa30 });
        if (G.mission.generatorA && G.mission.generatorB) completeMission('m3');
        else showNotify('GENERATOR B ONLINE', 'Activate Generator A as well.');
      });
    } else {
      showNotify('GENERATOR B', 'Already online.');
    }
  });

  // Pipes and machinery clutter
  const longPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 14, 6), MAT.pipe());
  longPipe.rotation.z = Math.PI / 2;
  longPipe.position.set(25, 2.9, 24); G.scene.add(longPipe);

  box(1, 0.8, 1, MAT.metal(), 27, 0.4, 30);
  box(0.6,1.2,0.6, MAT.metal(), 23, 0.6, 29);

  // Door east to Control Room
  buildDoorway(32, 25, 'z', 32, 25);
  // Door north to Security
  buildDoorway(25, 18, 'x', 25, 18);
  // Door west to Maintenance Tunnel
  buildDoorway(18, 25, 'z', 18, 25);
}

// ──────────────────────────────────────────────────────────────
// ROOM: MAINTENANCE TUNNEL (long, center 5, 30)
// ──────────────────────────────────────────────────────────────
function buildMaintenanceTunnel() {
  // Long narrow tunnel
  buildRoom(5, 32, 6, 28, 'maintenance');
  pointLight(0x080e08, 0.35, 8, 5, 3, 32);

  // Pipes everywhere
  for (let i = 0; i < 5; i++) {
    const pg = new THREE.CylinderGeometry(0.06, 0.06, 5.6, 5);
    const pm = new THREE.Mesh(pg, MAT.pipe());
    pm.rotation.z = Math.PI / 2;
    pm.position.set(5, 2.4 + (i%2)*0.5, 22 + i*4);
    G.scene.add(pm);
  }

  // Valve wheel
  const valveGeo = new THREE.TorusGeometry(0.3, 0.05, 6, 10);
  const valve = new THREE.Mesh(valveGeo, MAT.metal());
  valve.position.set(7.5, 1.6, 28);
  valve.rotation.y = 0.4;
  G.scene.add(valve);
  addInteractable(valve, 'EXAMINE VALVE', new THREE.Vector3(7.5, 1.6, 28), 2.0, () => {
    showNotify('EMERGENCY VALVE', 'Already open. Coolant has been drained.');
  });

  // Electrical box
  box(0.6, 0.8, 0.2, MAT.metal(), 2.6, 1.4, 35);
  addCollider(2.6, 0, 35, 0.7, 0.3);

  // Some broken wall sections
  box(0.8, 1.5, 0.15, MAT.dim(0x0e1a10), 7.5, 0.75, 40);

  // Creepy handwritten note on wall
  const wallNote = box(0.25, 0.35, 0.02, MAT.dim(0x7a9a55), 7.4, 1.5, 26);
  addInteractable(wallNote, 'READ WARNING', new THREE.Vector3(7.4, 1.5, 26), 2.0, () => {
    openDoc('gen_b_log');
  });

  // Door east to Generator Chamber
  buildDoorway(8, 25, 'z', 8, 25);
  // Door south to Reactor Cooling Room — opening at bottom
  buildDoorway(5, 46, 'x', 5, 46);
}

// ──────────────────────────────────────────────────────────────
// ROOM: REACTOR COOLING ROOM (center 25, 50)
// ──────────────────────────────────────────────────────────────
function buildCoolingRoom() {
  buildRoom(25, 52, 18, 16, 'cooling');
  pointLight(0x040c0c, 0.4, 14, 25, 3, 52);

  // Massive coolant tank
  const tankGeo = new THREE.CylinderGeometry(3.0, 3.0, 3.5, 10);
  const tank = new THREE.Mesh(tankGeo, MAT.metal());
  tank.position.set(25, 1.75, 52);
  G.scene.add(tank);
  addCollider(25, 0, 52, 7, 7);

  // Coolant pipes coming from tank
  const angles = [0, Math.PI/2, Math.PI, 3*Math.PI/2];
  angles.forEach(a => {
    const pipeG = new THREE.CylinderGeometry(0.12, 0.12, 3.5, 6);
    const pipeM = new THREE.Mesh(pipeG, MAT.pipe());
    pipeM.rotation.z = Math.PI / 2;
    pipeM.rotation.y = a;
    pipeM.position.set(25 + Math.cos(a)*5.0, 1.5, 52 + Math.sin(a)*5.0);
    G.scene.add(pipeM);
  });

  // Warning sign on tank
  const warnGeo = new THREE.BoxGeometry(1.0, 0.6, 0.05);
  const warnMesh = new THREE.Mesh(warnGeo, new THREE.MeshBasicMaterial({ color: 0xaa5500 }));
  warnMesh.position.set(25, 2.2, 49.05);
  G.scene.add(warnMesh);
  addInteractable(warnMesh, 'READ WARNING SIGN', new THREE.Vector3(25, 2.2, 49.05), 2.2, () => {
    openDoc('mironova_note');
  });

  // Control terminal by east wall
  const ctTerm = box(0.8, 1.3, 0.3, MAT.metal(), 32, 0.65, 52);
  const ctScr = box(0.55, 0.4, 0.04, new THREE.MeshBasicMaterial({ color: 0x001a02 }), 32, 0.95, 51.87);
  addInteractable(ctTerm, 'ACCESS TERMINAL', new THREE.Vector3(32, 0.65, 52), 2.2, () => {
    openDoc('reactor_terminal', () => {
      if (!G.mission.reactorReached) completeMission('m5');
    });
  });

  // Corridor to underground reactor
  buildDoorway(25, 60, 'x', 25, 60);

  // Door north to Maintenance Tunnel
  buildDoorway(5, 46, 'x', 5, 46);
  // Door east to Underground Reactor (using Storage approach)
  buildDoorway(32, 52, 'z', 32, 52);
}

// ──────────────────────────────────────────────────────────────
// ROOM: UNDERGROUND REACTOR CORE (center 45, 52)
// ──────────────────────────────────────────────────────────────
function buildReactorCore() {
  buildRoom(45, 52, 16, 16, 'reactor');
  // Red/orange ambient light
  pointLight(0x3a0a00, 0.7, 16, 45, 3, 52);
  pointLight(0x220500, 0.4,  8, 45, 0.5, 52);

  // Reactor housing — central column
  const reactGeo = new THREE.CylinderGeometry(2.0, 2.5, 4.0, 12);
  const reactMat = new THREE.MeshLambertMaterial({ color: 0x1a0800 });
  const reactCore = new THREE.Mesh(reactGeo, reactMat);
  reactCore.position.set(45, 2.0, 52);
  G.scene.add(reactCore);
  addCollider(45, 0, 52, 5.5, 5.5);

  // Inner glow
  const glowGeo = new THREE.CylinderGeometry(1.3, 1.5, 3.8, 10);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  glowMesh.position.set(45, 2.0, 52);
  glowMesh.userData.isReactorGlow = true;
  G.scene.add(glowMesh);

  // Pulsing point light at core
  const coreLight = new THREE.PointLight(0xff3300, 1.5, 18);
  coreLight.position.set(45, 2, 52);
  coreLight.userData.isReactorLight = true;
  G.scene.add(coreLight);
  G.roomLights.push(coreLight);

  // Approach terminals
  const termPos = [
    new THREE.Vector3(42, 0.7, 46),
    new THREE.Vector3(48, 0.7, 46),
  ];
  termPos.forEach((tp, i) => {
    const t = box(0.7, 1.2, 0.3, MAT.metal(), tp.x, 0.6, tp.z);
    const s = box(0.5, 0.35, 0.04, new THREE.MeshBasicMaterial({ color: 0x220000 }), tp.x, 0.9, tp.z + 0.17);
    addInteractable(t, 'APPROACH REACTOR CORE', tp, 2.2, () => {
      if (!G.mission.reactorReached) {
        G.mission.reactorReached = true;
        completeMission('m5');
      }
      openDoc('reactor_terminal', () => {
        setTimeout(() => triggerFinalChoice(), 800);
      });
    });
  });

  // Catwalks
  box(8, 0.1, 0.6, MAT.metal(), 45, 0.15, 47.5);
  box(8, 0.1, 0.6, MAT.metal(), 45, 0.15, 56.5);
  box(0.6, 0.1, 9, MAT.metal(), 40.5, 0.15, 52);
  box(0.6, 0.1, 9, MAT.metal(), 49.5, 0.15, 52);

  // Warning stripes
  for (let i = 0; i < 6; i++) {
    const stripe = box(0.3, 0.02, 2, new THREE.MeshBasicMaterial({ color: i%2===0?0xaa5500:0x111111 }), 40 + i, 0.06, 44);
    stripe.rotation.y = 0.3;
  }

  // Door west back to Cooling Room
  buildDoorway(37, 52, 'z', 38, 52);

  // Railing segments
  for (let i = 0; i < 4; i++) {
    const railGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 5);
    const rail = new THREE.Mesh(railGeo, MAT.metal());
    rail.position.set(40.5 + i*2.5, 0.6, 47.5);
    G.scene.add(rail);
  }
}

// ──────────────────────────────────────────────────────────────
// CORRIDORS
// ──────────────────────────────────────────────────────────────
function buildCorridors() {
  // Entrance → Security
  buildCorridor(12, 5, 18, 5, 3.5);
  pointLight(0x061206, 0.3, 6, 15, 2.5, 5);

  // Security → Storage
  buildCorridor(32, 5, 38, 5, 3.5);
  pointLight(0x061206, 0.3, 6, 35, 2.5, 5);

  // Security → Generator Chamber (south)
  buildCorridor(25, 12, 25, 18, 3.5);
  pointLight(0x061206, 0.25, 6, 25, 2.5, 15);

  // Storage → Control Room (south)
  buildCorridor(45, 12, 45, 18, 3.5);
  pointLight(0x061206, 0.25, 6, 45, 2.5, 15);

  // Generator → Control Room (east)
  buildCorridor(32, 25, 38, 25, 3.5);
  pointLight(0x061206, 0.25, 6, 35, 2.5, 25);

  // Generator → Maintenance Tunnel (west)
  buildCorridor(8, 25, 18, 25, 3.5);
  pointLight(0x061206, 0.2, 5, 12, 2.5, 25);

  // Maintenance Tunnel → Cooling Room (south)
  buildCorridor(5, 46, 5, 46, 3.5);
  buildCorridor(5, 46, 20, 52, 3.0);
  pointLight(0x040808, 0.2, 5, 12, 2.5, 48);

  // Cooling Room → Reactor Core (east)
  buildCorridor(32, 52, 38, 52, 3.5);
  pointLight(0x100400, 0.3, 6, 35, 2.5, 52);
}

// ──────────────────────────────────────────────────────────────
// ENTITY (SHADOW CREATURE)
// ──────────────────────────────────────────────────────────────
function buildEntity() {
  const E = G.entity;

  // Entity mesh — dark humanoid silhouette
  const group = new THREE.Group();

  // Body
  const bodyGeo = new THREE.BoxGeometry(0.5, 1.3, 0.25);
  const bodyMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.65;
  group.add(body);

  // Head
  const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.25);
  const head = new THREE.Mesh(headGeo, bodyMat);
  head.position.y = 1.5;
  group.add(head);

  // Arms
  [-0.4, 0.4].forEach(side => {
    const armGeo = new THREE.BoxGeometry(0.15, 0.9, 0.15);
    const arm = new THREE.Mesh(armGeo, bodyMat);
    arm.position.set(side, 0.7, 0);
    group.add(arm);
  });

  // Legs
  [-0.15, 0.15].forEach(side => {
    const legGeo = new THREE.BoxGeometry(0.18, 0.9, 0.18);
    const leg = new THREE.Mesh(legGeo, bodyMat);
    leg.position.set(side, -0.05, 0);
    group.add(leg);
  });

  // Red eye glow
  const eyeGeo = new THREE.SphereGeometry(0.05, 4, 4);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  [-0.08, 0.08].forEach(side => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side, 1.52, 0.14);
    group.add(eye);
  });

  group.position.copy(E.pos);
  group.visible = false;
  G.scene.add(group);
  E.mesh = group;

  // Entity aura light (subtle)
  const aura = new THREE.PointLight(0x330000, 0, 4);
  group.add(aura);
  E.auraLight = aura;

  // Waypoints scattered through facility
  E.waypoints = [
    new THREE.Vector3(5, 0.9, 5),
    new THREE.Vector3(25, 0.9, 5),
    new THREE.Vector3(45, 0.9, 5),
    new THREE.Vector3(25, 0.9, 25),
    new THREE.Vector3(5, 0.9, 32),
    new THREE.Vector3(25, 0.9, 52),
    new THREE.Vector3(45, 0.9, 52),
    new THREE.Vector3(45, 0.9, 25),
  ];
  E.pos.copy(E.waypoints[0]);
}

// ──────────────────────────────────────────────────────────────
// AMBIENT SCENE DETAILS
// ──────────────────────────────────────────────────────────────
function buildAmbientDetails() {
  // Global ambient light — very dim
  G.ambientLight = new THREE.AmbientLight(0x030a04, 0.8);
  G.scene.add(G.ambientLight);

  // Scattered debris boxes across floor
  const debrisPositions = [
    [8,0,8], [22,0,3], [38,0,8], [27,0,12], [42,0,22],
    [20,0,28], [8,0,35], [28,0,55], [40,0,48],
  ];
  debrisPositions.forEach(([x,y,z]) => {
    const s = 0.2 + Math.random() * 0.5;
    box(s, s*0.6, s, MAT.dim(0x101410), x, s*0.3, z);
  });

  // Overhead pipes across corridors
  const pipeRun = new THREE.CylinderGeometry(0.05, 0.05, 18, 5);
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(pipeRun, MAT.pipe());
    p.rotation.z = Math.PI/2;
    p.position.set(25, 3.0, 5 + i*12);
    G.scene.add(p);
  }

  // Reactor glow particles (simple bright boxes)
  for (let i = 0; i < 8; i++) {
    const a = (i/8) * Math.PI*2;
    const sparks = box(0.07, 0.07, 0.07,
      new THREE.MeshBasicMaterial({ color: 0xff5500 }),
      45 + Math.cos(a)*2.8, 1.5 + Math.random()*1.5, 52 + Math.sin(a)*2.8
    );
    sparks.userData.spark = true;
    sparks.userData.angle = a;
    sparks.userData.speed = 0.3 + Math.random()*0.5;
  }
}

// ──────────────────────────────────────────────────────────────
// FLASHLIGHT
// ──────────────────────────────────────────────────────────────
function buildFlashlight() {
  G.flashlight = new THREE.SpotLight(0xc8ffd4, 1.8, 22, Math.PI/8, 0.3, 1.8);
  G.flashlight.position.set(0, 0, 0);
  G.flashlight.target.position.set(0, 0, -1);
  G.camera.add(G.flashlight);
  G.camera.add(G.flashlight.target);
  G.scene.add(G.camera);
}

// ──────────────────────────────────────────────────────────────
// BUILD FULL WORLD
// ──────────────────────────────────────────────────────────────
function buildWorld() {
  buildEntrance();
  buildSecurity();
  buildStorage();
  buildControlRoom();
  buildGeneratorChamber();
  buildMaintenanceTunnel();
  buildCoolingRoom();
  buildReactorCore();
  buildCorridors();
  buildAmbientDetails();
  buildEntity();
  buildFlashlight();
}

// ──────────────────────────────────────────────────────────────
// COLLISION DETECTION
// ──────────────────────────────────────────────────────────────
function checkCollision(newPos) {
  const r = G.player.radius;
  for (let i = 0; i < G.colliders.length; i++) {
    const c = G.colliders[i];
    if (
      newPos.x + r > c.min.x && newPos.x - r < c.max.x &&
      newPos.z + r > c.min.z && newPos.z - r < c.max.z
    ) return true;
  }
  return false;
}

function resolveCollision(desired) {
  const cur = G.player.pos;
  // Try X
  const tryX = new THREE.Vector3(desired.x, cur.y, cur.z);
  if (!checkCollision(tryX)) { cur.x = desired.x; }
  // Try Z
  const tryZ = new THREE.Vector3(cur.x, cur.y, desired.z);
  if (!checkCollision(tryZ)) { cur.z = desired.z; }
}

// ──────────────────────────────────────────────────────────────
// PLAYER UPDATE
// ──────────────────────────────────────────────────────────────
let lastFootstep = 0;
let headBob = 0, headBobAmp = 0;

function updatePlayer(dt) {
  const p = G.player;
  const speed = (G.keys['ShiftLeft'] || G.keys['ShiftRight']) && p.stamina > 0
    ? p.sprint : p.speed;

  const moving = G.keys['KeyW'] || G.keys['KeyS'] || G.keys['KeyA'] || G.keys['KeyD'] ||
                 G.keys['ArrowUp'] || G.keys['ArrowDown'];

  // Stamina
  if ((G.keys['ShiftLeft'] || G.keys['ShiftRight']) && moving && p.stamina > 0) {
    p.stamina = Math.max(0, p.stamina - 25 * dt);
  } else {
    p.stamina = Math.min(p.maxStam, p.stamina + 8 * dt);
  }
  document.getElementById('sta-fill').style.width = (p.stamina / p.maxStam * 100) + '%';
  if (p.stamina < 20) document.getElementById('sta-fill').style.background = '#aa4400';
  else document.getElementById('sta-fill').style.background = '';

  // Movement vectors from yaw
  const fwd = new THREE.Vector3(-Math.sin(G.yaw), 0, -Math.cos(G.yaw));
  const rgt = new THREE.Vector3(Math.cos(G.yaw), 0, -Math.sin(G.yaw));
  const move = new THREE.Vector3();

  if (G.keys['KeyW'] || G.keys['ArrowUp'])    move.addScaledVector(fwd, speed * dt);
  if (G.keys['KeyS'] || G.keys['ArrowDown'])  move.addScaledVector(fwd, -speed * dt);
  if (G.keys['KeyA'])                          move.addScaledVector(rgt, -speed * dt);
  if (G.keys['KeyD'])                          move.addScaledVector(rgt,  speed * dt);

  if (move.lengthSq() > 0) {
    const desired = p.pos.clone().add(move);
    resolveCollision(desired);

    // Footsteps
    lastFootstep += dt;
    if (lastFootstep > (speed > p.speed ? 0.28 : 0.42)) {
      sndFootstep();
      lastFootstep = 0;
    }

    // Head bob
    headBob += dt * (speed > p.speed ? 9 : 6);
    headBobAmp = Math.min(headBobAmp + dt * 4, 0.06);
  } else {
    headBobAmp = Math.max(headBobAmp - dt * 5, 0);
  }

  // Battery
  if (p.flashOn) {
    p.battery = Math.max(0, p.battery - (moving ? 0.18 : 0.06) * dt);
    if (p.battery <= 0) { p.flashOn = false; p.battery = 0; }
  }
  const batPct = Math.round(p.battery);
  document.getElementById('bat-pct').textContent = batPct + '%';
  document.getElementById('bat-fill').style.width = batPct + '%';
  if (batPct < 25) {
    document.getElementById('bat-fill').style.background = '#ff2200';
    document.getElementById('bat-fill').style.boxShadow = '0 0 5px #ff2200';
  } else if (batPct < 50) {
    document.getElementById('bat-fill').style.background = '#ffaa00';
  }

  // Apply to camera
  const bobY = Math.sin(headBob) * headBobAmp;
  G.camera.position.set(
    p.pos.x,
    p.pos.y + bobY,
    p.pos.z
  );
  G.camera.rotation.order = 'YXZ';
  G.camera.rotation.y = G.yaw;
  G.camera.rotation.x = G.pitch;

  G.flashlight.visible = p.flashOn;

  // Room detection (rough zone by X/Z)
  detectCurrentRoom();
}

function detectCurrentRoom() {
  const pos = G.player.pos;
  let room = 'unknown';
  if (pos.x < 15 && pos.z < 15) room = 'entrance';
  else if (pos.x >= 15 && pos.x < 35 && pos.z < 15) room = 'security';
  else if (pos.x >= 35 && pos.z < 15) room = 'storage';
  else if (pos.x >= 35 && pos.z >= 15 && pos.z < 35) room = 'control';
  else if (pos.x >= 15 && pos.x < 35 && pos.z >= 15 && pos.z < 35) room = 'generator';
  else if (pos.x < 15 && pos.z >= 15) room = 'maintenance';
  else if (pos.z >= 35 && pos.x < 35) room = 'cooling';
  else if (pos.z >= 35 && pos.x >= 35) room = 'reactor';

  if (room !== G.player.currentRoom) {
    G.player.currentRoom = room;
    const names = {
      entrance: 'SECTOR A — ENTRANCE HALL',
      security: 'SECTOR A — SECURITY CHECKPOINT',
      storage:  'SECTOR B — STORAGE ROOM',
      control:  'SECTOR B — CONTROL ROOM',
      generator:'SECTOR C — GENERATOR CHAMBER',
      maintenance:'SECTOR C — MAINTENANCE TUNNEL',
      cooling:  'SECTOR D — REACTOR COOLING ROOM',
      reactor:  'SECTOR D — UNDERGROUND REACTOR CORE',
      unknown:  'SECTOR UNKNOWN',
    };
    document.getElementById('hud-location-text').textContent = names[room] || 'SECTOR UNKNOWN';
    sndDoor();
  }
}

// ──────────────────────────────────────────────────────────────
// ENTITY AI
// ──────────────────────────────────────────────────────────────
function updateEntity(dt) {
  const E = G.entity;
  if (!E.mesh) return;

  const playerPos = G.player.pos;
  const distToPlayer = E.pos.distanceTo(playerPos);

  // State machine
  switch (E.state) {
    case 'patrol':
      // Walk toward current waypoint
      const wp = E.waypoints[E.wpIndex];
      const toWp = new THREE.Vector3().subVectors(wp, E.pos);
      toWp.y = 0;
      const wpDist = toWp.length();

      if (wpDist < 0.8) {
        E.wpIndex = (E.wpIndex + 1) % E.waypoints.length;
      } else {
        toWp.normalize();
        E.pos.addScaledVector(toWp, E.speed * dt);
      }

      // Detect player
      if (distToPlayer < E.detectionRange) {
        // Check if player is in entity's rough view
        const toPlayer = new THREE.Vector3().subVectors(playerPos, E.pos).normalize();
        const fwd = new THREE.Vector3().subVectors(E.waypoints[E.wpIndex], E.pos).normalize();
        const dot = fwd.dot(toPlayer);
        if (dot > 0.3 || distToPlayer < 5) {
          E.state = 'chase';
          E.lastSeen = 0;
        }
      }
      E.mesh.visible = distToPlayer < 18 && G.player.flashOn;
      break;

    case 'chase':
      E.lastSeen += dt;
      const toPlayer2 = new THREE.Vector3().subVectors(playerPos, E.pos);
      toPlayer2.y = 0;
      const d2 = toPlayer2.length();

      if (d2 > 0.8) {
        toPlayer2.normalize();
        E.pos.addScaledVector(toPlayer2, E.speed * 1.8 * dt);
      }

      // Jumpscare if too close
      if (d2 < 1.8 && E.scareTimer <= 0) {
        triggerEntityScare();
        E.scareTimer = 12;
        E.state = 'retreat';
      }

      if (E.lastSeen > 6) E.state = 'patrol';

      E.mesh.visible = distToPlayer < 22;
      E.auraLight.intensity = Math.max(0, 0.6 - d2 * 0.04);
      break;

    case 'retreat':
      E.scareTimer -= dt;
      // Move away from player
      const away = new THREE.Vector3().subVectors(E.pos, playerPos).normalize();
      E.pos.addScaledVector(away, E.speed * 1.2 * dt);

      if (E.scareTimer <= 0) {
        E.state = 'patrol';
        E.mesh.visible = false;
      }
      break;
  }

  // Clamp Y
  E.pos.y = 0.9;
  E.mesh.position.copy(E.pos);

  // Face direction of movement
  if (E.state === 'chase') {
    const lookTarget = new THREE.Vector3().subVectors(playerPos, E.pos);
    E.mesh.rotation.y = Math.atan2(lookTarget.x, lookTarget.z);
  }

  // Update aura
  if (E.state !== 'chase') {
    E.auraLight.intensity = Math.max(0, E.auraLight.intensity - dt * 0.5);
  }

  // Occasionally show entity in flashlight beam (atmosphere)
  if (G.player.flashOn && distToPlayer < 15 && E.state === 'patrol') {
    const cam = G.camera.getWorldDirection(new THREE.Vector3());
    const toE = new THREE.Vector3().subVectors(E.pos, playerPos).normalize();
    if (cam.dot(toE) > 0.85) {
      E.mesh.visible = true;
    }
  }
}

// ──────────────────────────────────────────────────────────────
// HORROR EVENTS
// ──────────────────────────────────────────────────────────────
function flickerLights(count) {
  const fl = document.getElementById('overlay-flicker');
  let i = 0;
  const step = () => {
    if (i >= count * 2) { fl.style.opacity = '0'; return; }
    fl.style.opacity = i % 2 === 0 ? (0.4 + Math.random() * 0.5).toString() : '0';
    i++;
    setTimeout(step, 40 + Math.random() * 60);
  };
  step();
  // Also dim actual lights briefly
  G.roomLights.forEach(l => {
    if (!l.userData.isReactorLight) {
      const orig = l.intensity;
      l.intensity *= 0.3;
      setTimeout(() => { l.intensity = orig; }, 180);
    }
  });
}

function triggerEntityScare() {
  sndEntity(); sndHeartbeat();
  flickerLights(5);
  const scare = document.getElementById('entity-scare');
  const face  = document.getElementById('entity-face');
  scare.classList.remove('hidden');
  face.style.animation = 'none'; face.offsetHeight; face.style.animation = '';
  setTimeout(() => scare.classList.add('hidden'), 2400);
}

function doBlackout() {
  sndStatic();
  const bd = document.getElementById('overlay-blackout');
  bd.style.opacity = '1';
  setTimeout(() => { bd.style.transition = 'opacity 1.5s'; bd.style.opacity = '0'; }, 700 + Math.random() * 600);
  bd.style.transition = 'opacity 0.05s';
}

function updateHorror(dt) {
  const h = G.horror;

  h.flickerTimer += dt;
  if (h.flickerTimer > h.nextFlicker) {
    flickerLights(2 + Math.floor(Math.random() * 3));
    sndCreak();
    h.flickerTimer = 0;
    h.nextFlicker = 6 + Math.random() * 18;
  }

  h.entityFlash += dt;
  if (h.entityFlash > h.nextFlash && G.mission.current >= 2) {
    triggerEntityScare();
    h.entityFlash = 0;
    h.nextFlash = 30 + Math.random() * 45;
  }

  h.blackout += dt;
  if (h.blackout > h.nextBlackout && G.mission.current >= 1) {
    doBlackout();
    h.blackout = 0;
    h.nextBlackout = 55 + Math.random() * 80;
  }

  h.ambientTimer += dt;
  if (h.ambientTimer > h.nextAmbient) {
    sndCreak();
    h.ambientTimer = 0;
    h.nextAmbient = 12 + Math.random() * 22;
  }

  // Blood vignette based on proximity to entity
  const distE = G.player.pos.distanceTo(G.entity.pos);
  const bloodLevel = Math.max(0, 1 - distE / 12) * 0.5;
  document.getElementById('overlay-blood').style.opacity = bloodLevel.toString();

  // Static when entity is very close
  const staticOverlay = document.getElementById('overlay-static');
  if (distE < 6) {
    staticOverlay.classList.remove('hidden');
    staticOverlay.style.opacity = Math.min(0.22, (6 - distE) / 6 * 0.22).toString();
  } else {
    staticOverlay.classList.add('hidden');
  }
}

// ──────────────────────────────────────────────────────────────
// INTERACTABLE CHECK
// ──────────────────────────────────────────────────────────────
let currentInteractable = null;

function updateInteractables() {
  const pos = G.player.pos;
  let nearest = null, nearestDist = 999;

  for (let i = 0; i < G.interactables.length; i++) {
    const obj = G.interactables[i];
    const dist = pos.distanceTo(obj.pos);
    if (dist < obj.range && dist < nearestDist) {
      nearestDist = dist;
      nearest = obj;
    }
  }

  currentInteractable = nearest;
  const prompt = document.getElementById('interact-prompt');
  if (nearest) {
    prompt.classList.remove('hidden');
    document.getElementById('interact-label').textContent = nearest.label;
  } else {
    prompt.classList.add('hidden');
  }
}

// ──────────────────────────────────────────────────────────────
// ANIMATED SCENE OBJECTS
// ──────────────────────────────────────────────────────────────
function updateAnimations(dt, elapsed) {
  // Reactor sparks orbit
  G.scene.traverse(child => {
    if (child.userData.spark) {
      child.userData.angle += child.userData.speed * dt;
      child.position.x = 45 + Math.cos(child.userData.angle) * 2.8;
      child.position.z = 52 + Math.sin(child.userData.angle) * 2.8;
      child.position.y = 1.5 + Math.sin(elapsed * 2 + child.userData.angle * 3) * 0.4;
    }
    if (child.userData.isReactorGlow) {
      const pulse = 0.7 + Math.sin(elapsed * 2.5) * 0.3;
      child.material.color.setRGB(pulse, pulse * 0.27, 0);
    }
    if (child.userData.isReactorLight) {
      child.intensity = 1.2 + Math.sin(elapsed * 2.5) * 0.5;
    }
  });

  // Signal bars update
  const bars = 1 + Math.floor((G.mission.current / MISSIONS.length) * 4);
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById('sb' + i);
    if (el) el.classList.toggle('active', i <= bars);
  }
}

// ──────────────────────────────────────────────────────────────
// MISSION SYSTEM
// ──────────────────────────────────────────────────────────────
function completeMission(id) {
  if (G.mission.completed[id]) return;
  G.mission.completed[id] = true;

  const mi = MISSIONS.findIndex(m => m.id === id);
  if (mi >= G.mission.current) {
    G.mission.current = mi + 1;
  }

  const next = MISSIONS[G.mission.current];
  showNotify(
    MISSIONS[mi].title + ' — COMPLETE',
    next ? next.obj : 'Reach the reactor core.'
  );

  const missionEl = document.getElementById('mission-text');
  if (next) missionEl.textContent = next.obj;
  else missionEl.textContent = 'Reach the reactor core. Make your choice.';
}

function showNotify(title, obj) {
  const el = document.getElementById('mission-notify');
  document.getElementById('mn-title-text').textContent = title;
  document.getElementById('mn-obj-text').textContent = obj || '';
  el.classList.remove('hidden');
  el.style.animation = 'none'; el.offsetHeight; el.style.animation = '';
  setTimeout(() => el.classList.add('hidden'), 5200);
}

// ──────────────────────────────────────────────────────────────
// DOCUMENT READER
// ──────────────────────────────────────────────────────────────
function openDoc(docId, onClose) {
  const doc = DOCS[docId];
  if (!doc) return;

  G.docOpen = true;
  if (G.pointerLocked) document.exitPointerLock();

  document.getElementById('doc-title-text').textContent = doc.title;

  // Parse markup
  let html = doc.body
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/&lt;em&gt;/g,'<span class="em">').replace(/&lt;\/em&gt;/g,'</span>')
    .replace(/&lt;warn&gt;/g,'<span class="warn">').replace(/&lt;\/warn&gt;/g,'</span>');
  document.getElementById('doc-body-text').innerHTML = html;

  const reader = document.getElementById('doc-reader');
  reader.classList.remove('hidden');
  sndPickup();

  const btn = document.getElementById('btn-doc-close');
  const closeHandler = () => {
    reader.classList.add('hidden');
    G.docOpen = false;
    btn.removeEventListener('click', closeHandler);
    if (onClose) onClose();
  };
  btn.addEventListener('click', closeHandler);
  G._currentDocClose = closeHandler;
}

function closeDoc() {
  if (!G.docOpen) return;
  const reader = document.getElementById('doc-reader');
  reader.classList.add('hidden');
  G.docOpen = false;
  if (G._currentDocClose) {
    G._currentDocClose();
    G._currentDocClose = null;
  }
}

// ──────────────────────────────────────────────────────────────
// FINAL CHOICE
// ──────────────────────────────────────────────────────────────
function triggerFinalChoice() {
  G.choiceOpen = true;
  if (G.pointerLocked) document.exitPointerLock();
  const panel = document.getElementById('choice-panel');
  panel.classList.remove('hidden');
  sndEntity();
  flickerLights(8);
}

const ENDINGS = {
  shutdown: {
    title: 'SILENCE',
    radColor: '#00ff41',
    text: `You initiate the emergency shutdown sequence.

The hum dies. The glow fades.
Deep in the reactor, something lets go of a breath
it had been holding for almost thirty years.

You heard it only once, at the very end.
A sound not quite a voice:

          I understand.

The facility falls dark and quiet.

You file your report. The Ministry seals the building.
The investigation is closed. No further signals detected.

Sometimes, late at night, you wake from a dream.
The room smells faintly of something electric.
Your skin is warm.

You are probably fine.`,
    tag: 'ENDING: THE LAST BREATH',
  },
  restart: {
    title: 'CONTINUATION',
    radColor: '#ff2200',
    text: `You feed new fuel rods into the reactor cycle.
Full power restored.

The glow intensifies. The hum grows deep and satisfied.
Something in the core expands — relieved.

You leave Reactor-13 as you found it.
The signal resumes broadcasting the moment you cross the perimeter.

You never tell anyone what you saw.
You are never entirely sure it was real.

A second investigation team is sent the following year.
They too leave with no conclusive findings.

The reactor runs.
The entity endures.

The signal is still broadcasting today.

          I AM ALONE.`,
    tag: 'ENDING: THE SIGNAL PERSISTS',
  },
};

function endGame(type) {
  const e = ENDINGS[type];
  G.gameOver = true;
  G.running = false;

  document.getElementById('choice-panel').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');

  const endRad = document.getElementById('end-rad');
  endRad.style.color = e.radColor;
  endRad.style.textShadow = `0 0 20px ${e.radColor}`;
  document.getElementById('end-title').textContent = e.title;
  document.getElementById('end-title').style.color = e.radColor;
  document.getElementById('end-text').textContent = e.text;
  document.getElementById('end-tag').textContent = e.tag;

  const endScreen = document.getElementById('screen-end');
  endScreen.classList.remove('hidden');
  endScreen.classList.add('active');

  if (document.pointerLockElement) document.exitPointerLock();
  sndDrone();
}

// ──────────────────────────────────────────────────────────────
// INPUT
// ──────────────────────────────────────────────────────────────
function setupInput() {
  window.addEventListener('keydown', e => {
    G.keys[e.code] = true;
    initAudio();

    if (G.gameOver) return;

    if (e.code === 'KeyF') {
      if (G.player.battery > 0) G.player.flashOn = !G.player.flashOn;
    }

    if (e.code === 'KeyE') {
      if (G.docOpen) { closeDoc(); return; }
      if (G.choiceOpen) return;
      if (G.paused) return;
      if (currentInteractable) {
        currentInteractable.action();
      }
    }

    if (e.code === 'Escape') {
      if (G.docOpen) { closeDoc(); return; }
      if (G.choiceOpen) return;
      togglePause();
    }
  });

  window.addEventListener('keyup', e => { delete G.keys[e.code]; });

  // Mouse look via pointer lock
  document.addEventListener('mousemove', e => {
    if (!G.pointerLocked || G.docOpen || G.paused || G.choiceOpen) return;
    G.yaw   -= e.movementX * 0.0022;
    G.pitch -= e.movementY * 0.0022;
    G.pitch  = Math.max(-Math.PI/2.2, Math.min(Math.PI/2.2, G.pitch));
  });

  document.addEventListener('pointerlockchange', () => {
    G.pointerLocked = document.pointerLockElement === document.getElementById('game-canvas');
    const pscreen = document.getElementById('screen-pointer');
    if (G.pointerLocked) {
      pscreen.classList.add('hidden');
      G.paused = false;
    } else if (G.running && !G.gameOver && !G.docOpen && !G.choiceOpen) {
      pscreen.classList.remove('hidden');
      pscreen.classList.add('active');
    }
  });

  document.getElementById('screen-pointer').addEventListener('click', () => {
    document.getElementById('game-canvas').requestPointerLock();
    document.getElementById('screen-pointer').classList.remove('active');
    document.getElementById('screen-pointer').classList.add('hidden');
  });

  document.getElementById('game-canvas').addEventListener('click', () => {
    if (!G.pointerLocked && G.running && !G.docOpen && !G.choiceOpen && !G.paused) {
      document.getElementById('game-canvas').requestPointerLock();
    }
  });

  // Choice buttons
  document.getElementById('btn-shutdown').addEventListener('click', () => endGame('shutdown'));
  document.getElementById('btn-restart').addEventListener('click',  () => endGame('restart'));

  // Pause/Resume
  document.getElementById('btn-resume').addEventListener('click', () => togglePause());

  // Play again
  document.getElementById('btn-play-again').addEventListener('click', () => {
    location.reload();
  });
}

function togglePause() {
  if (G.gameOver) return;
  G.paused = !G.paused;
  const pauseScreen = document.getElementById('screen-pause');
  if (G.paused) {
    pauseScreen.classList.remove('hidden');
    pauseScreen.classList.add('active');
    if (document.pointerLockElement) document.exitPointerLock();
  } else {
    pauseScreen.classList.remove('active');
    pauseScreen.classList.add('hidden');
    document.getElementById('game-canvas').requestPointerLock();
  }
}

// ──────────────────────────────────────────────────────────────
// BOOT SEQUENCE
// ──────────────────────────────────────────────────────────────
const BOOT_LINES = [
  { text: '> INITIALIZING INVESTIGATION UNIT...',            delay: 300,  cls: '' },
  { text: '> CLEARANCE LEVEL: ALPHA-7 CONFIRMED',           delay: 700,  cls: '' },
  { text: '> LOADING FACILITY SCHEMATICS... PARTIAL DATA',  delay: 1200, cls: 'blw' },
  { text: '> GEIGER COUNTER: ONLINE',                       delay: 1700, cls: '' },
  { text: '> NIGHT VISION: STANDBY',                        delay: 2100, cls: '' },
  { text: '> FLASHLIGHT CHARGE: 100%',                      delay: 2500, cls: '' },
  { text: '> SIGNAL ORIGIN: REACTOR CORE — SECTOR D',       delay: 3000, cls: 'blw' },
  { text: '> LAST MAINTENANCE: 10,592 DAYS AGO',            delay: 3500, cls: 'blw' },
  { text: '> WARNING: ANOMALOUS LIFE SIGNS DETECTED',       delay: 4000, cls: 'ble' },
  { text: '> RECOMMENDATION: ABORT MISSION',                delay: 4500, cls: 'ble' },
  { text: '> OVERRIDE ACTIVE: PROCEED WITH INVESTIGATION',  delay: 5000, cls: '' },
  { text: '> GOOD LUCK, AGENT.',                            delay: 5500, cls: '' },
];

function runBoot() {
  const log = document.getElementById('boot-log');
  BOOT_LINES.forEach(({ text, delay, cls }) => {
    setTimeout(() => {
      const line = document.createElement('div');
      line.className = 'bl ' + cls;
      line.textContent = text;
      log.appendChild(line);
      log.scrollTop = log.scrollHeight;
    }, delay);
  });
  setTimeout(() => {
    document.getElementById('btn-start').classList.remove('hidden');
  }, 6000);
}

// ──────────────────────────────────────────────────────────────
// MAIN GAME LOOP
// ──────────────────────────────────────────────────────────────
let elapsed = 0;

function gameLoop() {
  if (!G.running) return;
  requestAnimationFrame(gameLoop);

  const dt = Math.min(G.clock.getDelta(), 0.06);
  elapsed += dt;

  if (!G.paused && !G.docOpen && !G.choiceOpen && !G.gameOver) {
    updatePlayer(dt);
    updateEntity(dt);
    updateHorror(dt);
    updateInteractables();
    updateAnimations(dt, elapsed);
    G.mouse.dx = 0;
    G.mouse.dy = 0;
  }

  G.renderer.render(G.scene, G.camera);
}

// ──────────────────────────────────────────────────────────────
// GAME START
// ──────────────────────────────────────────────────────────────
function startGame() {
  initAudio();

  // Hide title, show HUD
  document.getElementById('screen-title').classList.remove('active');
  document.getElementById('screen-title').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');

  // Show pointer lock prompt
  const pscreen = document.getElementById('screen-pointer');
  pscreen.classList.remove('hidden');
  pscreen.classList.add('active');

  // Init Three.js
  initThree();
  buildWorld();
  setupInput();

  // Set initial mission text
  document.getElementById('mission-text').textContent = MISSIONS[0].obj;
  document.getElementById('hud-location-text').textContent = 'SECTOR A — ENTRANCE HALL';

  // Start loop
  G.running = true;
  G.clock.start();
  sndDrone();
  gameLoop();

  // Spawn entity a bit after start
  setTimeout(() => {
    G.entity.pos.set(25, 0.9, 5);
  }, 10000);
}

// ──────────────────────────────────────────────────────────────
// DOM READY
// ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  runBoot();
  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-play-again').addEventListener('click', () => location.reload());
});
