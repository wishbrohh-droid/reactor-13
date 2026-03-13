// ====================================================
// REACTOR 13 — v3  |  Room-based 2D horror engine
// Optimized: canvas 2D only, no per-pixel loops
// ====================================================
(function(){
'use strict';

// ─────────────────────────────────────────────
// AUDIO
// ─────────────────────────────────────────────
var AC = window.AudioContext || window.webkitAudioContext;
var ac = null;
function initAudio(){ if(!ac) ac = new AC(); }

function tone(freq, type, dur, vol, delay){
  if(!ac) return;
  vol=vol||.07; delay=delay||0;
  var o=ac.createOscillator(), g=ac.createGain();
  o.connect(g); g.connect(ac.destination);
  o.type=type; o.frequency.value=freq;
  var t=ac.currentTime+delay;
  g.gain.setValueAtTime(0,t);
  g.gain.linearRampToValueAtTime(vol,t+.02);
  g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.start(t); o.stop(t+dur+.05);
}

function noise(dur, vol, lp){
  if(!ac) return;
  vol=vol||.04; lp=lp||900;
  var buf=ac.createBuffer(1,ac.sampleRate*dur,ac.sampleRate);
  var d=buf.getChannelData(0); for(var i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  var s=ac.createBufferSource(), f=ac.createBiquadFilter(), g=ac.createGain();
  s.buffer=buf; f.type='lowpass'; f.frequency.value=lp;
  g.gain.setValueAtTime(vol,ac.currentTime);
  g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+dur);
  s.connect(f); f.connect(g); g.connect(ac.destination);
  s.start(); s.stop(ac.currentTime+dur);
}

function playFootstep(){ noise(.07,.04,250+Math.random()*100); }
function playPickup(){ [440,550,660].forEach(function(f,i){ tone(f,'sine',.18,.05,i*.07); }); }
function playCreak(){ noise(.5+Math.random()*.3,.05,300); tone(70+Math.random()*30,'triangle',.6,.03); }
function playEntity(){ [30,45,90].forEach(function(f){ tone(f,'sawtooth',1.2,.05); }); noise(1.2,.06,180); }
function playStatic(){ noise(.25,.12,3500); }
function playHeartbeat(){ tone(58,'sine',.14,.09); setTimeout(function(){ tone(52,'sine',.11,.06); },140); }
function playDrone(){
  if(!ac) return;
  [38,40,79].forEach(function(f,i){
    var o=ac.createOscillator(), g=ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type='sawtooth'; o.frequency.value=f; g.gain.value=.013-i*.003;
    o.start();
    setTimeout(function(){ g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+3); setTimeout(function(){ o.stop(); },3100); },7000+Math.random()*4000);
  });
}
function playDoor(){ noise(.18,.1,600); tone(110,'sawtooth',.25,.05); }
function playPowerup(){
  [60,80,120,160,200].forEach(function(f,i){ tone(f,'sawtooth',.4,.06,i*.08); });
}

// ─────────────────────────────────────────────
// ROOM DEFINITIONS
// ─────────────────────────────────────────────
// Each room: id, name, sector, map (string grid), exits, objects, ambient color
// Map chars:
//   # wall   . floor   D door   E exit-trigger
//   T terminal/interactable  N note  G generator  K keycard  R reactor

var ROOMS = {
  entrance: {
    id:'entrance', name:'ENTRANCE HALL', sector:'SECTOR A',
    color:'#0a1a0c',
    map:[
      '####################',
      '#..................#',
      '#..................#',
      '#....####.####.....#',
      '#....#..........#..#',
      '#....#....T.....#..#',
      '#....#..........#..#',
      '#....############..#',
      '#..................#',
      '#......N...........#',
      '#..................#',
      '#....############..#',
      '#....#..........#..#',
      '#....#..........#..#',
      '#....#..........#..#',
      '#....############..#',
      '#..................#',
      '#..................#',
      '#.......D..........#',
      '####################'
    ],
    exits:{ D:'security' },
    objects:[
      { type:'note', x:7, y:9, id:'n_entrance_1', label:'READ NOTICE', used:false },
      { type:'terminal', x:8, y:5, id:'n_entrance_power', label:'RESTORE POWER', used:false, mission:'m1' }
    ],
    desc:'The facility entrance. Emergency lighting flickers. The main door ahead is sealed.'
  },
  security: {
    id:'security', name:'SECURITY CHECKPOINT', sector:'SECTOR A',
    color:'#0c1508',
    map:[
      '####################',
      '#..................#',
      '#...########.......#',
      '#...#......#.......#',
      '#...#..T...#.......#',
      '#...#......#..N....#',
      '#...########.......#',
      '#..................#',
      '#....D.............#',
      '#..................#',
      '###.################',
      '#..................#',
      '#......N...........#',
      '#..................#',
      '#....D.............#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '####################'
    ],
    exits:{ 'D8':'entrance', 'D14':'control' },
    objects:[
      { type:'note', x:10, y:5, id:'n_sec_1', label:'READ GUARD LOG', used:false },
      { type:'note', x:10, y:12, id:'n_sec_2', label:'EXAMINE POSTER', used:false },
      { type:'terminal', x:7, y:4, id:'n_sec_cam', label:'CHECK CAMERAS', used:false }
    ],
    desc:'Security checkpoint. Metal detector arches stand dark. A booth sits abandoned.'
  },
  control: {
    id:'control', name:'CONTROL ROOM', sector:'SECTOR B',
    color:'#080f0a',
    map:[
      '####################',
      '#..................#',
      '#..TTTT............#',
      '#..TTTT............#',
      '#..................#',
      '#..................#',
      '#...########.......#',
      '#...#......#...N...#',
      '#...#......#.......#',
      '#...#......#.......#',
      '#...########.......#',
      '#..................#',
      '#....D.............#',
      '#..................#',
      '#...D..............#',
      '#..................#',
      '#......N...........#',
      '#..................#',
      '#..................#',
      '####################'
    ],
    exits:{ 'D12':'security', 'D14':'maintenance' },
    objects:[
      { type:'terminal', x:3, y:2, id:'n_ctrl_log1', label:'READ LOG', used:false },
      { type:'terminal', x:4, y:2, id:'n_ctrl_log2', label:'READ LOG', used:false },
      { type:'terminal', x:3, y:3, id:'n_ctrl_log3', label:'READ LOG', used:false },
      { type:'terminal', x:4, y:3, id:'n_ctrl_status', label:'SYSTEM STATUS', used:false, mission:'m4' },
      { type:'note', x:14, y:7, id:'n_ctrl_note', label:'READ NOTE', used:false },
      { type:'note', x:10, y:16, id:'n_ctrl_memo', label:'READ MEMO', used:false }
    ],
    desc:'The main control room. Banks of monitors, most dark. Consoles blink with warning lights.',
    locked: true, lockNote: 'DOOR LOCKED — SECURITY KEYCARD REQUIRED'
  },
  maintenance: {
    id:'maintenance', name:'MAINTENANCE TUNNELS', sector:'SECTOR C',
    color:'#060c08',
    map:[
      '####################',
      '#..................#',
      '#.#####.....#####..#',
      '#.#...#.....#...#..#',
      '#.#.G.#.....#.G.#..#',
      '#.#...#.....#...#..#',
      '#.#####.....#####..#',
      '#..................#',
      '#..................#',
      '#....N.............#',
      '#..................#',
      '###.################',
      '#..................#',
      '#..................#',
      '#....D.............#',
      '#..................#',
      '#....D.............#',
      '#..................#',
      '#..................#',
      '####################'
    ],
    exits:{ 'D14':'control', 'D16':'storage' },
    objects:[
      { type:'generator', x:5, y:4, id:'gen_a', label:'ACTIVATE GENERATOR A', used:false, mission:'m3' },
      { type:'generator', x:13, y:4, id:'gen_b', label:'ACTIVATE GENERATOR B', used:false },
      { type:'note', x:8, y:9, id:'n_maint_1', label:'READ SAFETY NOTE', used:false }
    ],
    desc:'Low-ceilinged maintenance tunnels. Pipes line the walls. Two generator units sit cold and dark.'
  },
  storage: {
    id:'storage', name:'STORAGE ROOM', sector:'SECTOR B',
    color:'#0a0e07',
    map:[
      '####################',
      '#..................#',
      '#.####.....####....#',
      '#.#..#.....#..#....#',
      '#.#K.#.....#..#....#',
      '#.#..#.....#..#....#',
      '#.####.....####....#',
      '#..................#',
      '#....N.............#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#....D.............#',
      '#..................#',
      '#..................#',
      '#....N.............#',
      '#..................#',
      '#..................#',
      '#....D.............#',
      '####################'
    ],
    exits:{ 'D12':'maintenance', 'D18':'cooling' },
    objects:[
      { type:'keycard', x:4, y:4, id:'keycard_main', label:'TAKE KEYCARD', used:false, mission:'m2' },
      { type:'note', x:9, y:8, id:'n_stor_1', label:'READ INVENTORY', used:false },
      { type:'note', x:10, y:15, id:'n_stor_2', label:'READ MANIFEST', used:false }
    ],
    desc:'Storage room. Shelves toppled, crates scattered. Something was taken from here in a hurry.'
  },
  cooling: {
    id:'cooling', name:'REACTOR COOLING CHAMBER', sector:'SECTOR D',
    color:'#050a0a',
    map:[
      '####################',
      '#..................#',
      '#..................#',
      '#.##############...#',
      '#.#............#...#',
      '#.#............#...#',
      '#.#....N.......#...#',
      '#.#............#...#',
      '#.##############...#',
      '#..................#',
      '#....N.............#',
      '#..................#',
      '#..................#',
      '#..................#',
      '###.################',
      '#..................#',
      '#..................#',
      '#..................#',
      '#....D.............#',
      '####################'
    ],
    exits:{ 'D18':'storage', 'D-tunnel':'reactor' },
    tunnelExit: true,
    objects:[
      { type:'note', x:9, y:6, id:'n_cool_1', label:'READ WARNING', used:false },
      { type:'note', x:8, y:10, id:'n_cool_2', label:'READ FINAL LOG', used:false },
      { type:'terminal', x:9, y:17, id:'n_cool_tunnel', label:'OPEN TUNNEL HATCH', used:false, mission:'m5' }
    ],
    desc:'The cooling chamber. A massive empty coolant tank dominates the room. The air is cold and smells of metal.'
  },
  reactor: {
    id:'reactor', name:'UNDERGROUND REACTOR CORE', sector:'SECTOR D — RESTRICTED',
    color:'#0a0500',
    map:[
      '####################',
      '#..................#',
      '#..................#',
      '#...##########.....#',
      '#...#........#.....#',
      '#...#........#.....#',
      '#...#..RRRR..#.....#',
      '#...#..RRRR..#.....#',
      '#...#........#.....#',
      '#...#........#.....#',
      '#...##########.....#',
      '#..................#',
      '#....N.............#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '####################'
    ],
    exits:{},
    objects:[
      { type:'note', x:9, y:12, id:'n_react_1', label:'READ LAST ENTRY', used:false },
      { type:'reactor', x:7, y:6, id:'reactor_core', label:'APPROACH REACTOR', used:false, mission:'final' },
      { type:'reactor', x:8, y:6, id:'reactor_core2', label:'APPROACH REACTOR', used:false, mission:'final' },
      { type:'reactor', x:7, y:7, id:'reactor_core3', label:'APPROACH REACTOR', used:false, mission:'final' },
      { type:'reactor', x:8, y:7, id:'reactor_core4', label:'APPROACH REACTOR', used:false, mission:'final' }
    ],
    desc:'The reactor core. A deep hum fills the space. The core glows faintly red-orange. Something is inside it.'
  }
};

// ─────────────────────────────────────────────
// DOCUMENT DATABASE
// ─────────────────────────────────────────────
var DOCS = {
  n_entrance_1: {
    title:'FACILITY NOTICE — POSTED 1997.03.01',
    body:'ALL PERSONNEL MUST DISPLAY ID AT ALL TIMES.\n\nEXPERIMENT HELIX STAFF:\nReport to Sector D briefing at 07:00.\n\n<warn>UNAUTHORIZED ACCESS TO REACTOR LEVEL IS PROHIBITED.</warn>\n\nSecurity has been upgraded. Any breach of Reactor Level will\nbe treated as a classified incident under Ministry Order 77.\n\n<em>— Director G. Norin</em>'
  },
  n_entrance_power: {
    title:'ENTRANCE TERMINAL — POWER SYSTEM',
    body:'MAIN DOOR STATUS: LOCKED\n\nEmergency power has been routed to door control.\n\nRe-routing emergency circuit...\n...\n...\n<warn>WARNING: Backup power at 12%. Systems degraded.</warn>\n\nDoor unlocked. Proceed with caution.\n\nBattery reserve: insufficient for full facility lighting.\nFlashlight recommended beyond this point.\n\n<em>— System automated response</em>'
  },
  n_sec_1: {
    title:"GUARD LOG — OFFICER I. LEV — 1997.03.25",
    body:"Night shift. 02:00.\n\nHeard something in the lower corridor again. Third night running.\nTold Dr. Vaskov about it. He went pale and said it was 'pipe resonance.'\n\nIt wasn't pipe resonance.\n\n<warn>02:47 — Power fluctuation in Sector D. Cameras offline for 11 minutes.</warn>\n\nWhen they came back on, three staff members were gone from the lab feed.\nNo alarm was triggered. No door was opened.\n\nI'm filing an incident report in the morning.\n\n<em>— Lev, I.</em>"
  },
  n_sec_2: {
    title:"EMERGENCY EVACUATION PROCEDURES",
    body:'IN CASE OF CONTAINMENT BREACH:\n\n1. Sound alarm (Panel C3)\n2. All personnel to Sector A\n3. Seal Sector D bulkhead (code: 7741)\n4. Await extraction team\n\n<warn>DO NOT ATTEMPT TO CONTAIN THE ANOMALY YOURSELF.</warn>\n\nNOTE ADDED 1997.03.26:\nAlarm was sounded. Sector D bulkhead sealed.\nExtraction team was called.\n<warn>Extraction team was never sent.</warn>'
  },
  n_sec_cam: {
    title:'SECURITY SYSTEM — CAMERA REVIEW',
    body:'REVIEWING FOOTAGE: 1997.03.26 — 01:58 to 03:12\n\nCAM B-4: [INTACT]\n  02:11 — Dr. Mironova seen running toward stairwell.\n  02:14 — Camera turns to face wall. [CAUSE UNKNOWN]\n\nCAM D-1: [CORRUPTED]\n  02:17 — Brief image before corruption:\n  <warn>Something large moving through reactor chamber.</warn>\n  Shape does not match any known human or animal profile.\n\nCAM A-1: [INTACT]\n  02:58 — Director Norin exits through main door.\n  He does not look back.\n\nRemaining 11 staff: unaccounted for.'
  },
  n_ctrl_log1: {
    title:'EXPERIMENT LOG — DR. VASKOV — DAY 01',
    body:'EXPERIMENT HELIX — PHASE 1 INITIATED\n\n<em>We have done it. The theory holds.</em>\n\nBy exposing a focused electromagnetic seed to sustained\nnuclear radiation output, we have produced a stable\nself-organizing energy structure.\n\nThe organism — if we can call it that — is roughly 40cm across.\nIt pulses. It responds to light. It moves.\n\nPetrov says it is the greatest scientific discovery of the century.\nI am inclined to agree.\n\nPhase 2 begins tomorrow: controlled growth via reactor output increase.\n\n<em>— Dr. A. Vaskov</em>'
  },
  n_ctrl_log2: {
    title:'EXPERIMENT LOG — DR. VASKOV — DAY 14',
    body:'HELIX — PHASE 2 UPDATE\n\nThe organism has grown to 1.8 meters.\n\nIt is no longer responding predictably to our stimuli.\nWhere it once retracted from light, it now seems drawn to it.\nWhere it once ignored sound, it now turns toward sources.\n\n<warn>It appears to be learning.</warn>\n\nI requested a containment review. Denied. The board wants\ncontinued growth data.\n\nI am beginning to wonder if growth was ever the right goal.\n\nSomething this size, this aware — what does it want?\n\n<em>— Dr. A. Vaskov</em>'
  },
  n_ctrl_log3: {
    title:'EXPERIMENT LOG — DR. VASKOV — DAY 21',
    body:"<warn>FINAL EXPERIMENT LOG BEFORE INCIDENT</warn>\n\nThe organism is approximately 3 meters now. It fills the lower\nhalf of the reactor chamber.\n\nYesterday it did something that has kept me awake all night.\n\nDr. Mironova was conducting measurements. The organism...\nextended something toward her. Not a limb. More like a field.\nShe reported she could hear it — a frequency in her skull.\n\nShe said it sounded like words.\n\n<warn>She said it sounded like: 'I am alone.'</warn>\n\nI don't know what we've made. I don't think it knows either.\n\n<em>— Dr. A. Vaskov</em>"
  },
  n_ctrl_status: {
    title:'REACTOR 13 — SYSTEM STATUS TERMINAL',
    body:"FACILITY SYSTEMS — CURRENT STATUS\n\nREACTOR CORE: ONLINE (23% output — minimum containment threshold)\nCONTAINMENT FIELD: BREACHED\nLIFE SUPPORT: OFFLINE\nSECURITY: OFFLINE\nCOMMUNICATIONS: OFFLINE\n\nENTITY STATUS:\n  Designation: HELIX-VISITOR\n  Location: Reactor Core (confirmed)\n  Behavioral state: <warn>AGITATED — new biological signature detected</warn>\n  It knows you are here.\n\nSIGNAL BROADCAST: Active since 2024.11.04\n  Decoded content: 'I AM ALONE'\n\n<warn>CRITICAL: Reactor fuel depleting. Estimated shutdown: T-04:18:03</warn>\n  If reactor shuts down — entity expires.\n  If reactor restarted — entity survives indefinitely.\n\nYou must reach the reactor core."
  },
  n_ctrl_note: {
    title:"DR. MIRONOVA'S NOTES — HANDWRITTEN",
    body:"I can still hear it.\n\nEven up here on Level B, three floors above the reactor,\nI can hear it. Not with my ears.\nSomewhere behind my eyes.\n\n'I am alone.'\n\nOver and over.\n\nIt isn't threatening us. I don't think it ever was.\nI think it reached out to Lev because he was close.\nI think it turned the cameras to watch us because\nit was curious.\n\n<warn>We made something alive and left it in the dark.</warn>\n\nI'm going back down.\n\n<em>Y. Mironova</em>\n(Note found at security desk. She was never seen again.)"
  },
  n_ctrl_memo: {
    title:'MINISTRY OF SCIENCE — CLASSIFIED MEMO',
    body:'CLASSIFICATION: SIGMA-BLACK\n\nThe Reactor 13 Incident is formally designated a\nCONTAINMENT SUCCESS for public record purposes.\n\nThe organism cannot survive outside the facility\'s\nradiation field. The reactor provides its energy.\n\n<warn>THE REACTOR MUST NOT BE SHUT DOWN.</warn>\n\nShut down the reactor — the organism dies.\nKeep it running — the organism survives.\n\nThe facility is sealed. The signal is being monitored.\nDo not investigate. Do not engage.\n\n<warn>If this memo has been found, something has gone wrong.</warn>\n\n— Ministry Special Projects Division'
  },
  n_maint_1: {
    title:'MAINTENANCE LOG — TECHNICIAN BROV',
    body:'Job order: Generator B coolant flush.\n\nStrange job to get at 11pm. Supervisor said it was urgent.\nDidn\'t explain why.\n\nI was halfway through the flush when the lights went out.\nAll of them. Complete blackout, Sector C.\n\nI heard something moving in the dark.\nNot a person. Too smooth. Too quiet.\n\nI stayed very still for about four minutes.\n\nWhen emergency lighting came back, I was alone.\n\nI am writing this and going home.\n<warn>I am not coming back tomorrow.</warn>\n\n<em>— Brov, V.  (note: Technician Brov was found deceased\nin Corridor C the following morning — Incident Report)</em>'
  },
  n_stor_1: {
    title:'STORAGE INVENTORY — SECTOR B',
    body:'ITEM COUNT — LAST VERIFIED 1997.03.20\n\n- Emergency rations: 40 units (sealed)\n- Respirator masks: 12 units\n- Radiation suits: 4 units\n- Security keycards: 3 remaining\n  (2 issued to Director Norin, 1 in lockbox B-7)\n- Flashlights: 6 units\n- First aid kits: 8 units\n\n<warn>NOTE ADDED: Keycard from lockbox B-7 left in tray.\n  Director\'s keycards taken during evacuation.\n  One keycard remains. Use it wisely.</warn>'
  },
  n_stor_2: {
    title:'EVACUATION MANIFEST — 1997.03.26',
    body:'EVACUEES CONFIRMED:\n  1. Director G. Norin\n  2. Dr. E. Petrov\n  3. Technician K. Orlov\n  4. Security Cadet Yeva\n  5. Admin Staff (3 unnamed)\n\nEVACUEES NOT CONFIRMED:\n  - Dr. A. Vaskov: <warn>MISSING</warn>\n  - Dr. Y. Mironova: <warn>MISSING</warn>\n  - Officer I. Lev: <warn>MISSING</warn>\n  - Technician V. Brov: <warn>DECEASED</warn>\n  - Research Staff (6 unnamed): <warn>MISSING</warn>\n\n<warn>TOTAL UNACCOUNTED: 10 persons</warn>\n\nGovernment states: "All personnel successfully evacuated."\n\n<em>This manifest was never made public.</em>'
  },
  n_cool_1: {
    title:'COOLING SYSTEM WARNING — POSTED',
    body:'<warn>DANGER — RADIATION LEVELS ELEVATED BEYOND THIS POINT</warn>\n\nPersonnel must wear full radiation suits past this marker.\n\nCoolant system: OFFLINE since 1997.03.26\nCore temperature: UNKNOWN (sensors failed)\n\nDo not proceed without authorization from Level-4 clearance.\n\n<warn>If you are reading this without a radiation suit,\nturn back now.</warn>\n\nIf you are reading this after 1997:\n<warn>Turn back. There is nothing you can do for them.</warn>'
  },
  n_cool_2: {
    title:'FINAL RECORDING — DR. VASKOV',
    body:'[AUDIO TRANSCRIPT — DICTATED 1997.03.26 — 04:11]\n\nI am at the cooling chamber.\nMironova went down an hour ago. She hasn\'t come back.\nLev is gone.\n\nI can hear it clearly now. The frequency.\n\'I am alone.\'\n\nI think I understand it.\nWe built it a prison and called it a laboratory.\nWe fed it and measured it and never once asked\nif it wanted to exist this way.\n\n<warn>I\'m going to the core.\nI am going to try to communicate with it.\nIf I don\'t come back — someone should know:</warn>\n\nIt isn\'t a weapon. It\'s a child.\nA very large, very frightened, very alone child.\n\nTell them that, if you find this.\n\n<em>— Dr. Vaskov, A.  (Last known recording.)</em>'
  },
  n_cool_tunnel: {
    title:'TUNNEL HATCH — CONTROL PANEL',
    body:'TUNNEL HATCH B-4 — REACTOR LEVEL ACCESS\n\nThis hatch leads to the underground reactor core.\n\nStatus: SEALED\nRadiation level beyond hatch: ELEVATED\nLast accessed: 1997.03.26 04:18\n\nWARNING: Personnel have not returned from Reactor Level\nsince the incident.\n\n[Overriding safety lock...]\n[Safety lock overridden.]\n\n<warn>HATCH OPEN. Reactor Level is accessible.\nProceed to the reactor core.</warn>\n\nThe signal is strongest directly ahead.'
  },
  n_react_1: {
    title:'DR. MIRONOVA — SCRAWLED NOTE',
    body:"[Written on the wall in what appears to be a luminescent compound]\n\nIT IS BEAUTIFUL.\n\nI understand now. We were afraid because we didn't understand.\nVaskov was right. It only wanted to be acknowledged.\n\nIt showed me everything.\nThe experiment. The accident. Our fear.\nAnd what comes after.\n\n<warn>IT IS WAITING FOR YOU AT THE CORE.</warn>\n\nDon't be afraid.\nJust choose.\n\n<em>— Y. Mironova</em>\n(The note glows faintly. The handwriting is calm.)"
  }
};

// ─────────────────────────────────────────────
// MISSION SYSTEM
// ─────────────────────────────────────────────
var MISSIONS = [
  { id:'m1', title:'MISSION 1: ENTER THE FACILITY',    obj:'Restore power at the entrance terminal to open the main door.' },
  { id:'m2', title:'MISSION 2: ACCESS CONTROL ROOM',   obj:'Find the security keycard in the storage room.' },
  { id:'m3', title:'MISSION 3: RESTORE EMERGENCY POWER', obj:'Activate the backup generators in the maintenance tunnels.' },
  { id:'m4', title:'MISSION 4: DISCOVER THE EXPERIMENT', obj:'Read the experiment logs in the control room.' },
  { id:'m5', title:'MISSION 5: REACH THE REACTOR CORE', obj:'Travel through the tunnels to the reactor core.' },
  { id:'final', title:'MISSION 6: DECIDE THE FATE',    obj:'Approach the reactor core and make your choice.' }
];
var currentMission = 0;
var completedMissions = {};
var hasKeycard = false;
var genAPowered = false;
var genBPowered = false;

function missionActive(){ return MISSIONS[currentMission]; }
function advanceMission(id){
  var m = missionActive();
  if(m && m.id === id && !completedMissions[id]){
    completedMissions[id] = true;
    currentMission++;
    showMissionPopup(m.title + ' — COMPLETE', MISSIONS[currentMission] ? MISSIONS[currentMission].obj : '');
    updateHudMission();
  }
}
function updateHudMission(){
  var m = missionActive();
  var el = document.getElementById('hud-mission');
  if(m) el.textContent = '▶ ' + m.obj;
  else el.textContent = '▶ REACH THE REACTOR CORE';
}
function showMissionPopup(title, obj){
  var pop = document.getElementById('mission-popup');
  document.getElementById('mission-popup-text').textContent = title;
  pop.classList.remove('hidden');
  pop.style.animation = 'none';
  pop.offsetHeight;
  pop.style.animation = '';
  setTimeout(function(){ pop.classList.add('hidden'); }, 4500);
}

// ─────────────────────────────────────────────
// PLAYER & WORLD STATE
// ─────────────────────────────────────────────
var TILE = 32; // tile size in pixels
var player = { x:1.5, y:1.5, facing:0, flashlightOn:true, battery:100 };
var currentRoomId = 'entrance';
var keys = {};

// ─────────────────────────────────────────────
// CANVAS SETUP
// ─────────────────────────────────────────────
var gc, gctx, GW, GH;
// Offscreen for map (only redrawn when room changes)
var mapCanvas, mapCtx;
var mapDirty = true;

function initCanvas(){
  gc = document.getElementById('gc');
  gctx = gc.getContext('2d');
  mapCanvas = document.createElement('canvas');
  mapCtx = mapCanvas.getContext('2d');
  onResize();
  window.addEventListener('resize', onResize);
}

function onResize(){
  GW = gc.width  = gc.offsetWidth;
  GH = gc.height = gc.offsetHeight;
  mapCanvas.width  = GW;
  mapCanvas.height = GH;
  mapDirty = true;
}

// ─────────────────────────────────────────────
// RENDERING
// ─────────────────────────────────────────────
var flickerAlpha = 0;
var entityShowing = false;
var entityTimer = 0;

// Colors
var FLOOR_COLOR  = '#111a12';
var WALL_COLORS  = ['#1a2d1c','#162614','#1c2e1e','#131e15']; // slight variation
var DOOR_COLOR   = '#2a3020';
var OBJ_COLORS   = { note:'#8aaa60', terminal:'#20aa50', generator:'#aa8020', keycard:'#4488ff', reactor:'#ff4400', exit:'#335533' };

// Build pre-rendered map to offscreen canvas (done once per room entry)
function buildMapCache(){
  if(!mapDirty) return;
  mapDirty = false;
  var room = ROOMS[currentRoomId];
  var map  = room.map;
  var rows = map.length;
  var cols = map[0].length;

  // Center map in canvas
  var offX = Math.floor((GW - cols*TILE) / 2);
  var offY = Math.floor((GH - rows*TILE) / 2);

  mapCtx.clearRect(0,0,GW,GH);

  // Background fill
  mapCtx.fillStyle = room.color;
  mapCtx.fillRect(0,0,GW,GH);

  for(var row=0; row<rows; row++){
    for(var col=0; col<map[row].length; col++){
      var ch = map[row][col];
      var px = offX + col*TILE;
      var py = offY + row*TILE;

      if(ch === '#'){
        // Wall with slight noise variation
        var vi = (row*cols+col) % WALL_COLORS.length;
        mapCtx.fillStyle = WALL_COLORS[vi];
        mapCtx.fillRect(px,py,TILE,TILE);
        // Edge highlight
        mapCtx.fillStyle = 'rgba(255,255,255,0.03)';
        mapCtx.fillRect(px,py,TILE,2);
        mapCtx.fillRect(px,py,2,TILE);
        // Shadow
        mapCtx.fillStyle = 'rgba(0,0,0,0.25)';
        mapCtx.fillRect(px+TILE-2,py,2,TILE);
        mapCtx.fillRect(px,py+TILE-2,TILE,2);
      } else {
        // Floor
        mapCtx.fillStyle = FLOOR_COLOR;
        mapCtx.fillRect(px,py,TILE,TILE);
        // Subtle tile pattern
        if((row+col)%2===0){
          mapCtx.fillStyle = 'rgba(255,255,255,0.015)';
          mapCtx.fillRect(px,py,TILE,TILE);
        }
        // Floor cracks near walls (atmospheric)
        if(ch==='.'){
          var crackH = ((row*7+col*13) % 23);
          if(crackH === 0){
            mapCtx.strokeStyle = 'rgba(0,0,0,0.35)';
            mapCtx.lineWidth = 1;
            mapCtx.beginPath();
            mapCtx.moveTo(px+8, py+10);
            mapCtx.lineTo(px+18, py+20);
            mapCtx.stroke();
          }
        }
      }

      // Special tiles
      if(ch==='D'){
        mapCtx.fillStyle = DOOR_COLOR;
        mapCtx.fillRect(px+2,py+2,TILE-4,TILE-4);
        mapCtx.strokeStyle = '#334433';
        mapCtx.lineWidth = 1;
        mapCtx.strokeRect(px+4,py+4,TILE-8,TILE-8);
      }
      if(ch==='E'){
        mapCtx.fillStyle = OBJ_COLORS.exit;
        mapCtx.fillRect(px+2,py+2,TILE-4,TILE-4);
      }
      if(ch==='R'){
        // Reactor glow tile
        mapCtx.fillStyle = 'rgba(255,80,0,0.25)';
        mapCtx.fillRect(px,py,TILE,TILE);
        mapCtx.fillStyle = 'rgba(255,120,0,0.15)';
        mapCtx.beginPath();
        mapCtx.arc(px+TILE/2,py+TILE/2,TILE*0.6,0,Math.PI*2);
        mapCtx.fill();
      }
    }
  }

  // Draw objects on map
  var room2 = ROOMS[currentRoomId];
  room2.objects.forEach(function(obj){
    if(obj.used && obj.type !== 'reactor') return;
    var px2 = offX + obj.x*TILE;
    var py2 = offY + obj.y*TILE;
    var c = OBJ_COLORS[obj.type] || '#888';
    mapCtx.fillStyle = c;
    mapCtx.globalAlpha = 0.7;
    if(obj.type === 'keycard'){
      mapCtx.fillRect(px2+8,py2+10,TILE-16,TILE-20);
    } else if(obj.type === 'generator'){
      mapCtx.fillRect(px2+4,py2+4,TILE-8,TILE-8);
    } else if(obj.type === 'reactor'){
      // handled by R tiles
    } else {
      mapCtx.beginPath();
      mapCtx.arc(px2+TILE/2,py2+TILE/2,TILE/4,0,Math.PI*2);
      mapCtx.fill();
    }
    mapCtx.globalAlpha = 1;
  });
}

var glowPhase = 0;

function render(dt){
  glowPhase += dt * 2;

  buildMapCache();

  // Draw cached map
  gctx.drawImage(mapCanvas, 0, 0);

  var room = ROOMS[currentRoomId];
  var map  = room.map;
  var rows = map.length;
  var cols = map[0].length;
  var offX = Math.floor((GW - cols*TILE) / 2);
  var offY = Math.floor((GH - rows*TILE) / 2);

  // Animated reactor glow
  if(currentRoomId === 'reactor'){
    var glow = 0.12 + Math.sin(glowPhase)*0.06;
    gctx.fillStyle = 'rgba(255,80,0,' + glow + ')';
    gctx.fillRect(0,0,GW,GH);
  }

  // Animated object glow (pulse)
  var pulse = 0.5 + Math.sin(glowPhase*1.5)*0.3;
  room.objects.forEach(function(obj){
    if(obj.used && obj.type !== 'reactor') return;
    var px = offX + obj.x*TILE;
    var py = offY + obj.y*TILE;
    var c = OBJ_COLORS[obj.type] || '#888';
    // Glow aura
    if(obj.type !== 'reactor'){
      gctx.save();
      gctx.shadowBlur = 14;
      gctx.shadowColor = c;
      gctx.globalAlpha = pulse * 0.5;
      gctx.fillStyle = c;
      gctx.beginPath();
      gctx.arc(px+TILE/2, py+TILE/2, TILE/4, 0, Math.PI*2);
      gctx.fill();
      gctx.restore();
    }
  });

  // Player
  var pw = offX + player.x * TILE;
  var ph = offY + player.y * TILE;

  // Direction indicator
  var dx = Math.cos(player.facing), dy = Math.sin(player.facing);
  gctx.strokeStyle = 'rgba(0,200,60,0.5)';
  gctx.lineWidth = 2;
  gctx.beginPath();
  gctx.moveTo(pw, ph);
  gctx.lineTo(pw + dx*18, ph + dy*18);
  gctx.stroke();

  // Player body
  gctx.save();
  gctx.shadowBlur = 16;
  gctx.shadowColor = '#00ff41';
  gctx.fillStyle = '#00ff41';
  gctx.beginPath();
  gctx.arc(pw, ph, 8, 0, Math.PI*2);
  gctx.fill();
  // Direction dot
  gctx.fillStyle = '#fff';
  gctx.beginPath();
  gctx.arc(pw + dx*7, ph + dy*7, 3, 0, Math.PI*2);
  gctx.fill();
  gctx.restore();

  // Flashlight cone overlay
  var fl = document.getElementById('overlay-flashlight');
  fl.classList.toggle('off', !player.flashlightOn);
}

// ─────────────────────────────────────────────
// MOVEMENT & COLLISION
// ─────────────────────────────────────────────
var footTimer = 0;
var moved = false;

function isWalkable(tx, ty){
  var room = ROOMS[currentRoomId];
  var map = room.map;
  var rx = Math.floor(tx), ry = Math.floor(ty);
  if(ry < 0 || ry >= map.length || rx < 0 || rx >= map[0].length) return false;
  var ch = map[ry][rx];
  if(ch === '#') return false;
  if(ch === 'D') return false; // doors are walls unless triggered
  return true;
}

// Check if player steps on a door tile → room transition
function checkDoorTrigger(){
  var room = ROOMS[currentRoomId];
  var map = room.map;
  var px = Math.round(player.x), py = Math.round(player.y);
  // Look for door in adjacent tiles
  var checks = [
    {x:px, y:py}, {x:px-1,y:py},{x:px+1,y:py},{x:px,y:py-1},{x:px,y:py+1}
  ];
  for(var i=0;i<checks.length;i++){
    var c = checks[i];
    if(c.y < 0 || c.y >= map.length || c.x < 0 || c.x >= map[0].length) continue;
    var ch = map[c.y][c.x];
    if(ch === 'D'){
      // Find which door exit this is
      var exits = room.exits;
      // Try to match by row (D8, D14 etc)
      var rowKey = 'D' + c.y;
      var dest = exits[rowKey] || exits['D'];
      if(!dest) dest = exits['D' + c.y] || null;
      // Fallback: find any exit
      if(!dest){
        var keys2 = Object.keys(exits);
        if(keys2.length === 1) dest = exits[keys2[0]];
        else if(keys2.length >= 2){
          // Pick nearest key by comparing row number
          var bestKey = keys2[0];
          var bestDiff = 999;
          keys2.forEach(function(k){
            var kRow = parseInt(k.replace('D',''));
            var diff = Math.abs(kRow - c.y);
            if(diff < bestDiff){ bestDiff=diff; bestKey=k; }
          });
          dest = exits[bestKey];
        }
      }
      if(dest){
        // Check if door is locked
        if(dest === 'control' && ROOMS.control.locked && !hasKeycard){
          showInteractHint(ROOMS.control.lockNote);
          return;
        }
        changeRoom(dest);
        return;
      }
    }
    // Tunnel exit (cooling → reactor)
    if(room.tunnelExit && (player.x > 8 && player.x < 12) && player.y > 16){
      changeRoom('reactor');
      return;
    }
  }
}

function changeRoom(id){
  if(!ROOMS[id]) return;
  if(id === 'control' && ROOMS.control.locked && !hasKeycard) return;
  if(id === 'control') ROOMS.control.locked = false;
  playDoor();
  currentRoomId = id;
  var room = ROOMS[id];
  // Spawn player at safe entry position
  player.x = 2.5; player.y = 18.5;
  if(id === 'reactor') player.y = 17.5;
  if(id === 'entrance') { player.x = 10.5; player.y = 17.5; }
  mapDirty = true;
  document.getElementById('hud-room').textContent = room.sector + ' — ' + room.name;
  setTimeout(function(){ showNarrative(room.desc); }, 500);
}

function movePlayer(dt){
  var spd = 4.5 * dt; // tiles per second
  var rot = 2.2 * dt;
  moved = false;

  if(keys['ArrowLeft']  || keys['q'] || keys['Q']) player.facing -= rot;
  if(keys['ArrowRight'] || keys['e2']) player.facing += rot;

  var nx = player.x, ny = player.y;
  if(keys['w'] || keys['W'] || keys['ArrowUp']){
    nx += Math.cos(player.facing) * spd;
    ny += Math.sin(player.facing) * spd;
    moved = true;
  }
  if(keys['s'] || keys['S'] || keys['ArrowDown']){
    nx -= Math.cos(player.facing) * spd;
    ny -= Math.sin(player.facing) * spd;
    moved = true;
  }
  if(keys['a'] || keys['A']){
    nx += Math.cos(player.facing - Math.PI/2) * spd * 0.7;
    ny += Math.sin(player.facing - Math.PI/2) * spd * 0.7;
    moved = true;
  }
  if(keys['d'] || keys['D']){
    nx += Math.cos(player.facing + Math.PI/2) * spd * 0.7;
    ny += Math.sin(player.facing + Math.PI/2) * spd * 0.7;
    moved = true;
  }

  var margin = 0.3;
  if(isWalkable(nx, player.y)) player.x = nx;
  if(isWalkable(player.x, ny)) player.y = ny;

  if(moved){
    footTimer += dt;
    if(footTimer > 0.4){ playFootstep(); footTimer = 0; }
    checkDoorTrigger();
  }
}

// ─────────────────────────────────────────────
// INTERACTION
// ─────────────────────────────────────────────
var nearObject = null;
var gameState  = 'playing'; // playing | reading | choices | ended

function findNearObject(){
  var room = ROOMS[currentRoomId];
  var best = null, bestDist = 1.5;
  room.objects.forEach(function(obj){
    if(obj.used && obj.type !== 'reactor') return;
    if(obj.used && (obj.id === 'reactor_core2' || obj.id === 'reactor_core3' || obj.id === 'reactor_core4')) return;
    var dx = obj.x + 0.5 - player.x;
    var dy = obj.y + 0.5 - player.y;
    var dist = Math.sqrt(dx*dx+dy*dy);
    if(dist < bestDist){ bestDist=dist; best=obj; }
  });
  return best;
}

function interact(){
  if(gameState === 'reading'){ closeLog(); return; }
  if(!nearObject) return;
  var obj = nearObject;

  if(obj.type === 'note' || obj.type === 'terminal' || obj.type === 'keycard'){
    var doc = DOCS[obj.id];
    if(doc) openLog(doc.title, doc.body);
    playPickup();
    obj.used = true;
    mapDirty = true; // refresh objects drawn on map

    // Mission triggers
    if(obj.mission === 'm1'){
      ROOMS.security.locked = false; // power restored
      advanceMission('m1');
    }
    if(obj.mission === 'm2' || obj.type === 'keycard'){
      hasKeycard = true;
      ROOMS.control.locked = false;
      advanceMission('m2');
      showMissionPopup('KEYCARD OBTAINED', 'Control room is now accessible.');
    }
    if(obj.mission === 'm4') advanceMission('m4');
    if(obj.mission === 'm5'){
      // Open tunnel
      advanceMission('m5');
    }
    if(obj.id === 'n_ctrl_status') advanceMission('m4');

  } else if(obj.type === 'generator'){
    playPowerup();
    obj.used = true;
    mapDirty = true;
    if(obj.id === 'gen_a') genAPowered = true;
    if(obj.id === 'gen_b') genBPowered = true;
    openLog('GENERATOR — POWER RESTORED', 'Generator activated.\nEmergency power restored to this sector.\n\n<warn>WARNING: Power surge detected. Lights flickering.</warn>\n\nBackup systems online. Proceed to Control Room.');
    if(genAPowered || genBPowered) advanceMission('m3');
    setTimeout(function(){
      doFlicker(5);
    }, 800);

  } else if(obj.type === 'reactor'){
    // Final choice
    advanceMission('final');
    setTimeout(triggerFinalChoice, 500);
  }
}

// ─────────────────────────────────────────────
// LOG PANEL
// ─────────────────────────────────────────────
function openLog(title, body){
  gameState = 'reading';
  document.getElementById('log-title').textContent = title;
  var html = body
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/&lt;em&gt;/g,'<span class="em">').replace(/&lt;\/em&gt;/g,'</span>')
    .replace(/&lt;warn&gt;/g,'<span class="warn">').replace(/&lt;\/warn&gt;/g,'</span>');
  document.getElementById('log-body').innerHTML = html;
  document.getElementById('log-panel').classList.remove('hidden');
}
function closeLog(){
  document.getElementById('log-panel').classList.add('hidden');
  gameState = 'playing';
}

// ─────────────────────────────────────────────
// NARRATIVE TOASTS
// ─────────────────────────────────────────────
var narQueue = [], narRunning = false;
function showNarrative(txt, delay){
  delay = delay || 0;
  narQueue.push({txt:txt, delay:delay});
  if(!narRunning) runNarQueue();
}
function runNarQueue(){
  if(!narQueue.length){ narRunning=false; return; }
  narRunning = true;
  var item = narQueue.shift();
  setTimeout(function(){
    // Use mission popup for brief atmospheric messages
    var pop = document.getElementById('mission-popup');
    document.getElementById('mission-popup-text').textContent = item.txt;
    document.getElementById('mission-popup').querySelector('.mission-tag').textContent = 'SECTOR LOG';
    pop.classList.remove('hidden');
    pop.style.animation='none'; pop.offsetHeight; pop.style.animation='';
    setTimeout(function(){
      pop.classList.add('hidden');
      document.getElementById('mission-popup').querySelector('.mission-tag').textContent = 'MISSION UPDATE';
      runNarQueue();
    }, 4500);
  }, item.delay);
}

function showInteractHint(txt){
  var hint = document.getElementById('interact-hint');
  document.getElementById('interact-label').textContent = txt || 'EXAMINE';
  hint.classList.remove('hidden');
}

// ─────────────────────────────────────────────
// HORROR EVENTS
// ─────────────────────────────────────────────
var horrorTimer    = 0, nextHorror    = 12 + Math.random()*15;
var entityTimer2   = 0, nextEntity    = 35 + Math.random()*40;
var blackoutTimer  = 0, nextBlackout  = 60 + Math.random()*60;
var flickerDirty   = false;

function runHorror(dt){
  horrorTimer += dt;
  if(horrorTimer > nextHorror){
    horrorTimer = 0; nextHorror = 8 + Math.random()*18;
    doFlicker(2 + Math.floor(Math.random()*3));
    playCreak();
  }

  entityTimer2 += dt;
  if(entityTimer2 > nextEntity && completedMissions['m3']){
    entityTimer2 = 0; nextEntity = 28 + Math.random()*40;
    doEntityScare();
  }

  blackoutTimer += dt;
  if(blackoutTimer > nextBlackout && completedMissions['m1']){
    blackoutTimer = 0; nextBlackout = 50 + Math.random()*70;
    doBlackout();
  }
}

function doFlicker(count){
  var od = document.getElementById('overlay-flicker');
  var i = 0;
  function step(){
    if(i >= count*2){ od.style.opacity='0'; return; }
    od.style.opacity = (i%2===0) ? (0.5+Math.random()*0.4).toString() : '0';
    i++;
    setTimeout(step, 40+Math.random()*60);
  }
  step();
}

function doEntityScare(){
  playEntity();
  doFlicker(4);
  setTimeout(function(){
    playHeartbeat();
    var s = document.getElementById('entity-scare');
    var shape = document.getElementById('entity-shape');
    s.classList.remove('hidden');
    shape.style.animation = 'none'; shape.offsetHeight; shape.style.animation = '';
    setTimeout(function(){ s.classList.add('hidden'); }, 2300);
  }, 300);
}

function doBlackout(){
  playStatic();
  var od = document.getElementById('overlay-dark');
  od.style.opacity = '1'; od.style.transition = 'opacity 0.1s';
  setTimeout(function(){
    od.style.transition = 'opacity 2s';
    od.style.opacity = '0';
  }, 800 + Math.random()*600);
}

// ─────────────────────────────────────────────
// BATTERY
// ─────────────────────────────────────────────
function updateBattery(dt){
  if(player.flashlightOn){
    player.battery = Math.max(0, player.battery - (moved ? 0.3 : 0.08) * dt);
    if(player.battery <= 0) player.flashlightOn = false;
  }
  var fill = document.getElementById('battery-fill');
  fill.style.width = player.battery + '%';
  if(player.battery < 30){ fill.style.background='#ffaa00'; fill.style.boxShadow='0 0 5px #ffaa00'; }
  if(player.battery < 10){ fill.style.background='#ff2200'; fill.style.boxShadow='0 0 5px #ff2200'; }
  if(player.battery > 30){ fill.style.background='var(--green)'; fill.style.boxShadow='0 0 5px var(--green)'; }
}

// ─────────────────────────────────────────────
// FINAL CHOICE
// ─────────────────────────────────────────────
function triggerFinalChoice(){
  gameState = 'choices';
  doEntityScare();
  setTimeout(function(){
    var panel = document.getElementById('choice-panel');
    panel.classList.remove('hidden');
    document.getElementById('choice-text').textContent = 'You stand at the reactor core.\n\nThe Visitor is here. You can feel it.\n\n"I AM ALONE."\n\nWhat do you do?';
    var btns = document.getElementById('choice-btns');
    btns.innerHTML = '';
    [
      {id:'shutdown', label:'[ INITIATE EMERGENCY SHUTDOWN ]', sub:'Kill the reactor. The Visitor will expire. The signal ends forever.'},
      {id:'restart',  label:'[ RESTART REACTOR CYCLE ]',       sub:'Restore full power. The Visitor survives. The signal continues.'},
      {id:'stay',     label:'[ STAY WITH IT ]',                sub:'You sit down in the reactor chamber. You listen to it. You are no longer alone.'}
    ].forEach(function(o){
      var b = document.createElement('button');
      b.className='cbtn'; b.innerHTML=o.label+'\n<span style="color:var(--textdim);font-size:.7em">'+o.sub+'</span>';
      b.addEventListener('click',function(){ endGame(o.id); });
      btns.appendChild(b);
    });
  }, 1500);
}

var ENDINGS = {
  shutdown: {
    title:'SILENCE',
    text:'You enter the emergency shutdown sequence.\n\nThe hum dies. The glow fades.\nSomewhere deep in the reactor, something lets go.\n\nYou heard it only once, at the very end.\nA sound not quite a voice:\n\n          I understand.\n\nThe facility is quiet for the first time in thirty years.\n\nYou file a report. The Ministry seals the building.\nThe investigation is closed.\n\nSometimes, late at night, you feel warm.\nThe room smells faintly electric.\n\nYou are probably fine.',
    tag:'ENDING: THE LAST BREATH'
  },
  restart: {
    title:'CONTINUATION',
    text:'You restore the reactor cycle.\nNew fuel. Full power.\n\nThe glow intensifies. The hum grows deep.\nSomething in the core settles — satisfied.\n\nYou leave Reactor 13 exactly as you found it.\nThe signal resumes broadcasting the moment you cross the perimeter.\n\nYou never tell anyone what you saw.\n\nA second team is sent the following year.\nThey also leave. No conclusive findings.\n\nThe reactor runs.\nThe Visitor endures.\n\nThe signal is still broadcasting today.\n\n          I AM ALONE.',
    tag:'ENDING: THE SIGNAL PERSISTS'
  },
  stay: {
    title:'TOGETHER',
    text:'You sit down on the floor of the reactor core.\n\nThe frequency fills your skull — not painful now. Warm.\nYou close your eyes.\n\n"I am alone."\n\nYou say: "Not anymore."\n\nThe glow brightens.\n\nWhen the second investigation team arrives three months later,\nthe reactor is still running.\n\nThey find your equipment near the entrance.\nThey find your notes. Your flashlight.\n\nThey do not find you.\n\nBut the signal has changed.\n\nNow it broadcasts two frequencies, intertwined.\n\n          WE ARE HERE.',
    tag:'ENDING: THE JOINING'
  }
};

function endGame(id){
  gameState = 'ended';
  stopLoop = true;
  var e = ENDINGS[id];
  document.getElementById('end-title').textContent = e.title;
  document.getElementById('end-text').textContent = e.text;
  document.getElementById('end-tag').textContent = e.tag;
  document.getElementById('choice-panel').classList.add('hidden');
  document.getElementById('screen-game').classList.add('hidden');
  document.getElementById('screen-end').classList.remove('hidden');
  document.getElementById('screen-end').classList.add('active');
  playDrone();
}

// ─────────────────────────────────────────────
// BOOT SEQUENCE
// ─────────────────────────────────────────────
var BOOT = [
  {txt:'> INITIALIZING SYSTEM...',                       t:300,  c:''},
  {txt:'> CLEARANCE: ALPHA-7 GRANTED',                   t:700,  c:''},
  {txt:'> FACILITY MAP: PARTIAL DATA ONLY',              t:1200, c:'bl-w'},
  {txt:'> GEIGER COUNTER: ONLINE',                       t:1700, c:''},
  {txt:'> FLASHLIGHT: 100%',                             t:2100, c:''},
  {txt:'> SIGNAL ORIGIN: REACTOR CORE — SECTOR D',       t:2600, c:'bl-w'},
  {txt:'> LAST MAINTENANCE: 10,592 DAYS AGO',            t:3100, c:'bl-w'},
  {txt:'> ANOMALOUS LIFE SIGNS DETECTED INSIDE FACILITY',t:3600, c:'bl-e'},
  {txt:'> RECOMMENDATION: ABORT',                        t:4100, c:'bl-e'},
  {txt:'> OVERRIDE: INVESTIGATE',                        t:4500, c:''},
  {txt:'> GOOD LUCK, AGENT.',                            t:5000, c:''}
];

function runBoot(){
  var log = document.getElementById('boot-log');
  BOOT.forEach(function(item){
    setTimeout(function(){
      var line = document.createElement('div');
      line.className = 'bl ' + item.c;
      line.textContent = item.txt;
      log.appendChild(line);
      log.scrollTop = log.scrollHeight;
    }, item.t);
  });
  setTimeout(function(){ document.getElementById('btn-start').classList.remove('hidden'); }, 5400);
}

// ─────────────────────────────────────────────
// MAIN LOOP — throttled to 30fps max for low-end
// ─────────────────────────────────────────────
var stopLoop = false;
var lastTime = 0;
var FPS_CAP = 1/30; // minimum 30ms between frames

function loop(ts){
  if(stopLoop) return;
  requestAnimationFrame(loop);

  var dt = Math.min((ts - lastTime) / 1000, 0.08);
  if(dt < FPS_CAP * 0.5) return; // skip if too fast (cap at 60fps)
  lastTime = ts;

  if(gameState === 'playing'){
    movePlayer(dt);
    runHorror(dt);
    updateBattery(dt);

    // Nearby object detection
    nearObject = findNearObject();
    var hint = document.getElementById('interact-hint');
    if(nearObject){
      hint.classList.remove('hidden');
      document.getElementById('interact-label').textContent = nearObject.label;
    } else {
      hint.classList.add('hidden');
    }
  }

  render(dt);
}

// ─────────────────────────────────────────────
// GAME START / RESET
// ─────────────────────────────────────────────
function startGame(){
  initAudio(); playDrone();
  document.getElementById('screen-boot').classList.remove('active');
  document.getElementById('screen-boot').classList.add('hidden');
  document.getElementById('screen-game').classList.remove('hidden');
  document.getElementById('screen-game').classList.add('active');
  initCanvas();
  currentRoomId = 'entrance';
  player.x = 10.5; player.y = 17.5; player.facing = -Math.PI/2;
  document.getElementById('hud-room').textContent = 'SECTOR A — ENTRANCE HALL';
  updateHudMission();
  gameState = 'playing'; stopLoop = false;
  setTimeout(function(){ showNarrative('1997. A catastrophic experiment. No survivors reported.'); }, 1200);
  setTimeout(function(){ showNarrative('2026. A strange signal begins. You are sent to investigate.'); }, 6000);
  setTimeout(function(){ playCreak(); doFlicker(3); }, 2500);
  requestAnimationFrame(function(ts){ lastTime=ts; requestAnimationFrame(loop); });
}

function resetGame(){
  // Reset all state
  stopLoop = true;
  currentMission = 0; completedMissions = {};
  hasKeycard = false; genAPowered = false; genBPowered = false;
  player.x=10.5; player.y=17.5; player.facing=-Math.PI/2;
  player.flashlightOn=true; player.battery=100;
  ROOMS.control.locked = true;
  // Reset all object used states
  Object.keys(ROOMS).forEach(function(rk){
    ROOMS[rk].objects.forEach(function(o){ o.used=false; });
  });
  mapDirty = true;
  gameState='playing';
  document.getElementById('screen-end').classList.remove('active');
  document.getElementById('screen-end').classList.add('hidden');
  document.getElementById('screen-game').classList.remove('hidden');
  document.getElementById('screen-game').classList.add('active');
  document.getElementById('battery-fill').style.width='100%';
  document.getElementById('battery-fill').style.background='var(--green)';
  document.getElementById('log-panel').classList.add('hidden');
  document.getElementById('choice-panel').classList.add('hidden');
  document.getElementById('entity-scare').classList.add('hidden');
  document.getElementById('overlay-dark').style.opacity='0';
  document.getElementById('overlay-flicker').style.opacity='0';
  currentRoomId = 'entrance';
  document.getElementById('hud-room').textContent='SECTOR A — ENTRANCE HALL';
  updateHudMission();
  horrorTimer=entityTimer2=blackoutTimer=0;
  nextHorror=12+Math.random()*15; nextEntity=35+Math.random()*40; nextBlackout=60+Math.random()*60;
  onResize();
  stopLoop = false;
  setTimeout(function(){ showNarrative('The facility is still here. So is what lives inside.'); }, 1000);
  requestAnimationFrame(function(ts){ lastTime=ts; requestAnimationFrame(loop); });
}

// ─────────────────────────────────────────────
// INPUT
// ─────────────────────────────────────────────
window.addEventListener('keydown', function(e){
  keys[e.key] = true;
  initAudio();

  if(e.key==='f'||e.key==='F'){
    if(player.battery>0) player.flashlightOn = !player.flashlightOn;
  }
  if(e.key==='e'||e.key==='E'){
    if(gameState==='reading'){ closeLog(); return; }
    if(gameState==='playing') interact();
  }
  if(e.key==='Escape'&&gameState==='reading') closeLog();
  if(e.key==='ArrowRight') keys['e2']=true;
  if(e.key==='ArrowLeft')  keys['q']=true;
});

window.addEventListener('keyup', function(e){
  delete keys[e.key];
  if(e.key==='ArrowRight') delete keys['e2'];
  if(e.key==='ArrowLeft')  delete keys['q'];
});

document.addEventListener('DOMContentLoaded', function(){
  runBoot();
  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-restart').addEventListener('click', resetGame);
  document.getElementById('btn-close-log').addEventListener('click', closeLog);
});

})();
