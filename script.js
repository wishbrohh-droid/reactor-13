/* ═══════════════════════════════════════════════════════════
   HOLLOW HOUSE  —  script.js
   Three.js first-person horror game
   Faithful recreation of the Blender horror scene:
     5 indoor rooms + full outdoor yard
     Dead trees, fence, gravestones, well, moon, flickering lights
     Story: You investigate the cursed Hollow House (1887)
═══════════════════════════════════════════════════════════ */
'use strict';

// ─────────────────────────────────────────────────────────
//  GLOBAL STATE
// ─────────────────────────────────────────────────────────
const G = {
  renderer: null, scene: null, camera: null,
  clock: new THREE.Clock(),
  running:false, paused:false, docOpen:false, choiceOpen:false, ended:false,
  locked:false,
  keys:{}, yaw:Math.PI, pitch:0,

  player:{
    pos: new THREE.Vector3(0,-3.8,-14),
    height:1.75, radius:0.32,
    speed:4.2, sprintSpeed:8.0,
    stamina:100, battery:100,
    flashOn:true,
    room:'outside',
  },

  flashlight:null,
  colliders:[],
  interactables:[],

  // flickering lights registry
  flickers:[],

  // ghost/entity
  ghost:{
    mesh:null,
    pos: new THREE.Vector3(-8,0.9,4),
    state:'patrol', speed:1.8, chaseSpeed:3.5,
    waypoints:[],
    wpIdx:0,
    scareTimer:0,
    detRange:8, chaseRange:13,
  },

  // Horror timers
  horror:{
    flicker:0, nextFlicker:7+Math.random()*10,
    entityShow:0, nextEntity:40+Math.random()*50,
    blackout:0, nextBlackout:65+Math.random()*90,
    ambient:0, nextAmbient:14+Math.random()*18,
    scareShowing:false,
  },

  // Story / mission
  story:{
    current:0,
    found:{},
    gotKey:false,
    frontDoorOpen:false,
    basementOpen:false,
    allNotesRead:false,
    reactorSeen:false,
  },

  elapsed:0,
};

// ─────────────────────────────────────────────────────────
//  STORY MISSIONS
// ─────────────────────────────────────────────────────────
const OBJECTIVES = [
  'Find a way inside the abandoned house.',
  'Explore the house. Something is wrong here.',
  'Read the family journals. Learn what happened.',
  'Find the basement entrance — something is down there.',
  'Go to the basement furnace. Make your choice.',
];

const DOCS = {
  front_gate:{
    title:'PROPERTY NOTICE — COUNTY SHERIFF  1994',
    body:`THIS PROPERTY HAS BEEN CONDEMNED
BY ORDER OF WILLOW COUNTY SHERIFF'S DEPARTMENT

REASON: Structural instability. Suspected criminal activity.
Last Resident: Eleanor Marsh (MISSING since October 12, 1993)

<warn>DO NOT ENTER — TRESPASSERS WILL BE PROSECUTED</warn>

NOTE APPENDED BY DEPUTY R. COLE:
"We found seventeen journals inside. Family records going back to
1887. Sent them to evidence. But nobody wanted to read them.

I read two pages. That was enough.
The things Eleanor wrote about the last few weeks...

<em>Whatever lives in that house, it isn't human anymore.</em>

I put the spare key under the porch flowerpot.
I don't ever want to go back."`,
  },
  gravestone_1:{
    title:'GRAVESTONE — THOMAS MARSH  1849–1891',
    body:`HERE LIES THOMAS MARSH
BELOVED FATHER, FAITHFUL SERVANT

"HE GAVE EVERYTHING TO THIS HOUSE"

<warn>Scratched into the base:</warn>
"He didn't give it willingly."`,
  },
  gravestone_2:{
    title:'GRAVESTONE — CHILDREN OF THE MARSH FAMILY',
    body:`ANNA MARSH  1878–1889
EDGAR MARSH  1880–1889
RUTH MARSH   1883–1889

<warn>DIED ON THE SAME NIGHT — NOVEMBER 3, 1889</warn>

No cause of death was ever recorded.
The coroner refused to continue his examination.

<em>Local newspaper, 1889:
"The Marsh children were found in the cellar.
Their expressions suggested not fear, but wonder —
as though they had seen something beautiful."</em>`,
  },
  well_note:{
    title:'NOTE — FOUND TIED TO WELL ROPE',
    body:`Do not drink from the well.

I know it looks clean. It isn't.

My dog drank from it six months ago.
He stopped barking. Started watching the house.
Started scratching at the cellar door.

Then one morning he was just... gone.
I found him in the cellar three days later.
Sitting very still.
Watching the furnace.

<warn>Something comes up through the water.
Something from below the house.
It has been here since before the house was built.</warn>

— E.M.`,
  },
  porch_key:{
    title:'SPARE KEY — FOUND UNDER FLOWERPOT',
    body:`An old iron key, tarnished almost black.
There is a piece of cloth tied around it.

Written on the cloth in faded ink:

"To whoever comes next —
The front door opens with this.
The house will let you in.
<warn>Getting out is the part it objects to.</warn>

The journals are in the living room and bedroom.
Read all of them before you go to the basement.
You need to understand what you're dealing with.

Do not look directly at the well.
Do not use the upstairs bathroom mirror.
Do not stand still for more than a minute.

— R. Cole (Deputy, Willow County)"`,
  },
  hallway_journal:{
    title:"ELEANOR'S JOURNAL — ENTRY 1  Sept 2, 1993",
    body:`Moved into the old Marsh house today.
Got it for almost nothing — the estate has been trying to sell
it for years. Nobody wanted it.

I can see why it might put people off.
The wallpaper has these strange dark stains that look almost like
handprints. But they're too high up on the walls to be handprints.

The basement door was nailed shut when I arrived.
I had the hardware store come and remove the boards.
The man who did it wouldn't go down the stairs.
He said he could hear something breathing.

<em>I went down myself. It was just the furnace.</em>

Still. There's a smell down there I can't identify.
Sweet and wrong. Like something sleeping.`,
  },
  living_journal:{
    title:"ELEANOR'S JOURNAL — ENTRY 7  Sept 18, 1993",
    body:`The dreams have started.

Every night now — I'm standing in the cellar and the furnace
door is open and there is light inside it. Not fire light.
Something paler. Something that breathes.

In the dream I always walk toward it.
I always want to.

<warn>Last night I woke up at the top of the basement stairs.
Both feet on the first step. Going down.
I don't remember getting up.</warn>

I've started locking my bedroom door from the inside.

The neighbors say the previous owner (a Mr. Calloway, 1971–1988)
used to talk about the house being "grateful."
He thought it chose him.
He died in the basement. Natural causes, they said.

<em>Natural causes. In the basement. Alone.
At 3 in the morning.</em>`,
  },
  kitchen_note:{
    title:'NOTE ON KITCHEN TABLE — UNDATED',
    body:`(Written in a hurry — ink smeared, paper torn)

It showed me the others. The ones before me.
Thomas. The children. Mr. Calloway. All of them.
It shows you what it did to them like it's proud.

It doesn't hurt them. It just...

<warn>absorbs them.</warn>

They become part of it. Part of the house.
You can hear them sometimes in the walls.
Especially at night.
Especially near the basement door.

I can hear Anna singing. She's been singing for over a hundred years.

I think the house is offering me the same thing.
It's very patient.
It's been here since before anyone built on this land.
It will be here after the last wall crumbles.

<em>I am going to burn it down.
Tomorrow morning. When the light is good and I am brave.
I'm going to burn it all down.</em>

(The note ends here. Eleanor was reported missing
two weeks after this was written.)`,
  },
  bedroom_journal:{
    title:"ELEANOR'S JOURNAL — FINAL ENTRY  Oct 11, 1993",
    body:`I understand now.

The house isn't evil. Not the way evil is supposed to be.
It's just... hungry. And very, very alone.

It was here before the trees. Before the road.
Before the county. Before the name for this land.

It made itself into a house because houses attract people.
People give it warmth. Give it company.
Give it <warn>something to keep.</warn>

I tried to leave yesterday.
Got as far as the front gate.

My feet stopped.

I stood there for I don't know how long.
The gate was right there.
Three more steps.
I couldn't take them.

I came back inside and made tea and sat in the living room
and the house was so <em>warm</em> and quiet and I thought —

Maybe it's not so terrible to stay.
Maybe being kept isn't the worst thing.

<warn>I'm going to the basement now.</warn>

I want to see the light again.`,
  },
  basement_furnace:{
    title:'THE HOLLOW FURNACE — WHAT YOU FEEL STANDING HERE',
    body:`The furnace is still burning.

It has been burning for 136 years.
No fuel. No pipes. Just burning.

The light inside is not fire. It's something older.

You can feel the house around you like a held breath.
Waiting.

You can hear them in the walls:
<em>Anna's song. Edgar's laughter. Ruth's footsteps.
Thomas, still working. Eleanor, still humming.
And Calloway — sitting very still, watching.</em>

The house has been here longer than the town.
Longer than the road.
Longer than the oldest grave in this yard.

It does not want to hurt you.

<warn>It just wants you to stay.</warn>

The furnace door is open.
The light is very beautiful.

You have the accelerant canister from the shelf.
You have a match.

What do you do?`,
  },
};

// ─────────────────────────────────────────────────────────
//  AUDIO
// ─────────────────────────────────────────────────────────
let ac = null;
function initAudio(){ if(!ac){ const AC=window.AudioContext||window.webkitAudioContext; ac=new AC(); } }
function tone(f,t,d,v,delay){ if(!ac)return; v=v||.07;delay=delay||0; const o=ac.createOscillator(),g=ac.createGain(); o.connect(g);g.connect(ac.destination); o.type=t;o.frequency.value=f; const T=ac.currentTime+delay; g.gain.setValueAtTime(0,T);g.gain.linearRampToValueAtTime(v,T+.02);g.gain.exponentialRampToValueAtTime(.0001,T+d); o.start(T);o.stop(T+d+.05); }
function noise(d,v,lp){ if(!ac)return; v=v||.04;lp=lp||900; const buf=ac.createBuffer(1,ac.sampleRate*d,ac.sampleRate),data=buf.getChannelData(0); for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1; const s=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain(); s.buffer=buf;f.type='lowpass';f.frequency.value=lp; g.gain.setValueAtTime(v,ac.currentTime);g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+d); s.connect(f);f.connect(g);g.connect(ac.destination);s.start();s.stop(ac.currentTime+d); }
function sndStep()  { noise(.07,.04,180+Math.random()*80); }
function sndPickup(){ [440,550,660].forEach((f,i)=>tone(f,'sine',.17,.05,i*.07)); }
function sndCreak() { noise(.6+Math.random()*.3,.06,260+Math.random()*180); tone(60+Math.random()*30,'triangle',.65,.03); }
function sndGhost() { [25,38,80].forEach(f=>tone(f,'sawtooth',1.3,.05)); noise(1.3,.07,160); }
function sndDoor()  { noise(.18,.09,650); tone(110,'sawtooth',.25,.05); }
function sndHeart() { tone(55,'sine',.14,.09); setTimeout(()=>tone(49,'sine',.11,.06),140); }
function sndStatic(){ noise(.25,.12,3500); }
function sndWind()  { noise(2,.03,120+Math.random()*80); }
function sndDrone() {
  if(!ac)return;
  [36,38,74].forEach((f,i)=>{
    const o=ac.createOscillator(),g=ac.createGain();
    o.connect(g);g.connect(ac.destination);
    o.type='sawtooth';o.frequency.value=f;g.gain.value=.011-i*.003;
    o.start();
    setTimeout(()=>{ g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+3); setTimeout(()=>o.stop(),3100); },6000+Math.random()*4000);
  });
}

// ─────────────────────────────────────────────────────────
//  THREE.JS INIT
// ─────────────────────────────────────────────────────────
function initThree(){
  const canvas = document.getElementById('gc');
  G.renderer = new THREE.WebGLRenderer({ canvas, antialias:false, powerPreference:'low-power' });
  G.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
  G.renderer.setSize(window.innerWidth, window.innerHeight);
  G.renderer.setClearColor(0x000000);

  G.scene = new THREE.Scene();
  G.scene.fog = new THREE.FogExp2(0x010305, 0.055);

  G.camera = new THREE.PerspectiveCamera(72, window.innerWidth/window.innerHeight, 0.1, 80);
  G.camera.position.copy(G.player.pos).setY(G.player.height);

  window.addEventListener('resize',()=>{
    G.renderer.setSize(window.innerWidth,window.innerHeight);
    G.camera.aspect=window.innerWidth/window.innerHeight;
    G.camera.updateProjectionMatrix();
  });
}

// ─────────────────────────────────────────────────────────
//  MATERIAL HELPERS
// ─────────────────────────────────────────────────────────
const M = {
  wall:   ()=>new THREE.MeshLambertMaterial({color:0x0d1510}),
  wallMid:()=>new THREE.MeshLambertMaterial({color:0x151e14}),
  wallGrn:()=>new THREE.MeshLambertMaterial({color:0x0a120a}),
  wallBase:()=>new THREE.MeshLambertMaterial({color:0x050508}),
  floor:  ()=>new THREE.MeshLambertMaterial({color:0x0e1208}),
  ceil:   ()=>new THREE.MeshLambertMaterial({color:0x090d07}),
  wood:   ()=>new THREE.MeshLambertMaterial({color:0x1e1008}),
  metal:  ()=>new THREE.MeshLambertMaterial({color:0x2a2820}),
  stone:  ()=>new THREE.MeshLambertMaterial({color:0x2d2c28}),
  bark:   ()=>new THREE.MeshLambertMaterial({color:0x0d0b07}),
  ground: ()=>new THREE.MeshLambertMaterial({color:0x060604}),
  rust:   ()=>new THREE.MeshLambertMaterial({color:0x3a1a08}),
  slab:   ()=>new THREE.MeshLambertMaterial({color:0x1a1a18}),
  red:    ()=>new THREE.MeshBasicMaterial({color:0x180000}),
  glow:   (c)=>new THREE.MeshBasicMaterial({color:c}),
  dim:    (c)=>new THREE.MeshLambertMaterial({color:c}),
};

function box(w,h,d,mat,x,y,z,rx,ry,rz){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);
  if(rx)m.rotation.x=rx; if(ry)m.rotation.y=ry; if(rz)m.rotation.z=rz;
  G.scene.add(m); return m;
}
function cyl(rt,rb,h,seg,mat,x,y,z,rx,ry){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat);
  m.position.set(x,y,z);
  if(rx)m.rotation.x=rx; if(ry)m.rotation.y=ry;
  G.scene.add(m); return m;
}
function addCol(x,z,w,d){ G.colliders.push({ minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2 }); }
function addIA(pos,label,range,action){ G.interactables.push({pos:pos.clone(),label,range:range||2.2,action}); }
function ptLight(color,intensity,dist,x,y,z,name){
  const l=new THREE.PointLight(color,intensity,dist);
  l.position.set(x,y,z);
  G.scene.add(l);
  if(name) l.name=name;
  return l;
}

// ─────────────────────────────────────────────────────────
//  ROOM BUILDER  (matches Blender make_room — inside-out box)
// ─────────────────────────────────────────────────────────
function makeRoom(ox,oy,oz,w,d,h,wallMat,addFloor,addCeil){
  // ox,oy,oz = corner of room (Blender-style)
  const cx=ox+w/2, cy=oy+d/2, cz=oz+h/2;
  // floor
  if(addFloor!==false) box(w,0.12,d,M.floor(),cx,oz,cy);
  // ceiling
  if(addCeil!==false)  box(w,0.12,d,M.ceil(), cx,oz+h,cy);
  // walls (no normals flip needed — we position camera inside)
  box(w,h,0.18,wallMat,cx,oz+h/2,oy);        // north
  box(w,h,0.18,wallMat,cx,oz+h/2,oy+d);      // south
  box(0.18,h,d,wallMat,ox,oz+h/2,cy);        // west
  box(0.18,h,d,wallMat,ox+w,oz+h/2,cy);      // east
  // colliders
  addCol(cx,oy,  w+.4,.3);   // N
  addCol(cx,oy+d,w+.4,.3);   // S
  addCol(ox,  cy,.3,d+.4);   // W
  addCol(ox+w,cy,.3,d+.4);   // E
}

// doorway cutout = door frame props (no real boolean — decorative trim)
function doorframe(x,y,z,axis){ // axis 'x'=north/south wall, 'z'=east/west
  const trimMat=M.wood();
  if(axis==='x'){
    box(1.15,0.1,0.18,trimMat,x,y+2.25,z);
    box(0.1,2.3,0.18,trimMat,x-0.575,y+1.15,z);
    box(0.1,2.3,0.18,trimMat,x+0.575,y+1.15,z);
  } else {
    box(0.18,0.1,1.15,trimMat,x,y+2.25,z);
    box(0.18,2.3,0.1,trimMat,x,y+1.15,z-0.575);
    box(0.18,2.3,0.1,trimMat,x,y+1.15,z+0.575);
  }
}

// ─────────────────────────────────────────────────────────
//  OUTDOOR SCENE  (matches Blender outdoor functions)
// ─────────────────────────────────────────────────────────
function buildOutdoor(){
  // Ground plane (size=80)
  box(80,0.12,80,M.ground(),0,-0.06,0);

  // Gravel path: start_x=0, start_y=-4, length=14 → ~12 slabs going south
  for(let i=0;i<12;i++){
    const sx=0+(Math.random()-.5)*.3;
    const sz=-4-i*1.2+(Math.random()-.5)*.1;
    box(.95+Math.random()*.2,.08,.58+Math.random()*.1,M.slab(),sx,.04,sz,0,(Math.random()-.5)*.08,0);
  }

  // Dead trees (matches tree_positions array from Blender script)
  const treePts=[
    [-18,-8],[-22,2],[-20,12],
    [16,-6],[20,4],[18,14],
    [-12,-14],[8,-16],[0,-20],
    [-25,-2],[24,-2],
  ];
  treePts.forEach(([tx,tz],i)=>{
    const h=3.5+Math.random()*2.5;
    // Trunk
    cyl(.12,.18,h,5,M.bark(),tx,h/2,tz,(Math.random()-.5)*.18,0);
    // Branches
    const nb=3+Math.floor(Math.random()*3);
    for(let b=0;b<nb;b++){
      const bl=.8+Math.random()*1.5;
      const bAngle=Math.random()*Math.PI*2;
      const bTilt=.5+Math.random()*.8;
      const bx=tx+(Math.random()-.5)*.4;
      const bz=tz+(Math.random()-.5)*.4;
      const by=h*(.5+Math.random()*.4);
      const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.04,.07,bl,4),M.bark());
      mesh.position.set(bx,by,bz);
      mesh.rotation.x=bTilt*Math.sin(bAngle);
      mesh.rotation.z=bTilt*Math.cos(bAngle);
      G.scene.add(mesh);
    }
  });

  // Fence posts: x from -14 to 14, z=-12
  const fenceXs=[-14,-10,-6,-2,2,6,10,14];
  fenceXs.forEach(fx=>{
    const tilt=(Math.random()-.5)*.14;
    box(.16,.18,.16,M.rust(),fx,.82,-12,0,0,tilt);
    cyl(.07,.07,1.55,4,M.rust(),fx,.77,-12,0,0,tilt);
  });
  // Rails
  for(let i=0;i<fenceXs.length-1;i++){
    const mx=(fenceXs[i]+fenceXs[i+1])/2;
    const len=fenceXs[i+1]-fenceXs[i];
    box(len,.08,.08,M.rust(),mx,.9,-12);
    box(len,.08,.08,M.rust(),mx,1.3,-12);
  }
  addCol(0,-12,30,.4);  // fence collision line

  // Gravestones (grave_spots from Blender)
  const graves=[
    [-16,2,-12],[-18,6,8],[-14,8,15],[-20,-2,-5],[-15,12,20]
  ];
  graves.forEach(([gx,gy,gz],i)=>{
    const tilt=(Math.random()-.5)*.18;
    box(.5,.08,.16,M.stone(),gx,.08,gz,tilt,0,0);
    box(.5,.8,.16,M.stone(),gx,.5,gz,tilt,(Math.random()-.5)*.35,0);
    // interact on first two
    if(i<2){
      addIA(new THREE.Vector3(gx,.5,gz),i===0?'READ GRAVESTONE':'READ GRAVESTONE',1.8,
        ()=>openDoc(i===0?'gravestone_1':'gravestone_2'));
    }
  });

  // Well at (14,6,0) — Blender: radius=0.6, height=0.8
  const wellX=14,wellZ=6;
  cyl(.62,.62,.8,8,M.stone(),wellX,.4,wellZ);
  // Roof posts
  [[-0.5,-0.5],[0.5,-0.5]].forEach(([dx,dz])=>{
    cyl(.06,.06,1.2,5,M.wood(),wellX+dx,1.2,wellZ+dz);
  });
  box(.12,.12,1.2,M.wood(),wellX,1.8,wellZ+.5);
  box(.12,.12,1.2,M.wood(),wellX,1.8,wellZ-.5);
  box(1.1,.12,.12,M.wood(),wellX,1.85,wellZ);
  addCol(wellX,wellZ,1.4,1.4);
  // Interactable
  addIA(new THREE.Vector3(wellX,.4,wellZ),'READ NOTE ON WELL',2.2,()=>openDoc('well_note'));

  // Front gate area — gate posts
  box(.15,2.2,.15,M.stone(),-1.5,1.1,-12);
  box(.15,2.2,.15,M.stone(),1.5,1.1,-12);
  box(3,.12,.15,M.rust(),0,2.1,-12);
}

// ─────────────────────────────────────────────────────────
//  HOUSE EXTERIOR
// ─────────────────────────────────────────────────────────
function buildHouseExterior(){
  // House sits at roughly (-11..-4, 0..6) for living/kitchen on Blender coords
  // In our scene X,Z — house spans approx X:-11..10, Z:-1..8
  // Exterior walls (thick slabs seen from outside)
  const extMat = M.dim(0x0f1410);
  // Front face
  box(22,.18,11,extMat,-.5,-.06,4.5);   // roof base (flat roof for simplicity)
  box(22,6,.25,extMat,-.5,3,-1.3);   // front wall
  box(.25,6,11,extMat,-11.3,3,4.5);  // left wall
  box(.25,6,11,extMat, 10.3,3,4.5);  // right wall
  box(22,6,.25,extMat, -.5,3,10.3);  // back wall
  box(22,.25,11,extMat,-.5,6.1,4.5); // roof
  // Porch roof
  box(4,.18,2.5,extMat,0,3,-3.5);
  box(.15,3,.15,M.wood(),-1.8,1.5,-4.5);
  box(.15,3,.15,M.wood(), 1.8,1.5,-4.5);
  // Front door opening (visual gap — we allow walking through)
  addIA(new THREE.Vector3(0,0,-1.5),'[ FRONT DOOR — LOCKED ]',2.0,()=>{
    if(!G.story.gotKey){
      showNote('Front door is locked. Look for a key.');
    } else if(!G.story.frontDoorOpen){
      G.story.frontDoorOpen=true;
      sndDoor();
      showNote('Door unlocked. The house lets you in.');
      setObjective(1);
    }
  });
}

// ─────────────────────────────────────────────────────────
//  INDOOR ROOMS  (matches Blender 5-room layout)
//  Hallway:   x:-3..3,   z:-1.5..1.5, h=3
//  Living:    x:-11..-3, z:1.5..7.5,  h=3
//  Kitchen:   x:-3..3,   z:1.5..6.5,  h=3
//  Bedroom:   x:3..10,   z:1.5..6.5,  h=3
//  Basement:  x:-4..4,   z:8..14,     y:-2.5..-2.5+2.5
// ─────────────────────────────────────────────────────────
function buildIndoor(){
  // ── HALLWAY ──
  makeRoom(-3,  -1.5, 0,  6,  3,  3.0, M.wall());
  ptLight(0xffdd88,15,8, 0,2.7,0,'Hallway_Bulb');
  G.flickers.push({name:'Hallway_Bulb',base:15,chance:.35});
  // Hallway props: umbrella stand, coat hooks
  cyl(.12,.15,.9,5,M.dim(0x1a120a),-2.5,.45,-1.2);
  box(.08,.06,.08,M.metal(),-2.5,.94,-1.2);
  addIA(new THREE.Vector3(0,.5,-1.4),'READ JOURNAL',2.0,()=>openDoc('hallway_journal'));

  // ── LIVING ROOM ──
  makeRoom(-11, 1.5, 0, 8, 6, 3.0, M.wallMid());
  ptLight(0xff5e12,8,10, -8,0.8,4.5,'Living_Lamp');
  G.flickers.push({name:'Living_Lamp',base:8,chance:.25});
  // Broken chairs (Blender: (-8,4,0.3) and (-9,5.5,0.3))
  addBrokenChair(-8,0.3,4);
  addBrokenChair(-9,0.3,5.5);
  // Fireplace
  box(1.4,.12,0.8,M.stone(),-10.3,0,3);
  box(1.4,1.5,.18,M.stone(),-10.3,.75,2.65);
  box(1.4,.18,0.8,M.stone(),-10.3,1.45,3);
  ptLight(0xff3300,6,4, -10.3,0.5,3,'Fireplace');
  // Journal on mantle
  box(.22,.03,.3,M.dim(0x6a8a50),-10.3,1.52,2.9);
  addIA(new THREE.Vector3(-10.3,1.52,2.9),'READ JOURNAL',1.8,()=>openDoc('living_journal'));

  // ── KITCHEN ──
  makeRoom(-3, 1.5, 0, 6, 5, 3.0, M.wallGrn());
  ptLight(0xb3ffb3,20,10, 0,2.8,4,'Kitchen_Fluoro');
  G.flickers.push({name:'Kitchen_Fluoro',base:20,chance:.28});
  // Counter
  box(5.5,.85,1,M.metal(),-0.3,.425,6.2);
  addCol(-0.3,6.2,5.7,1.1);
  // Sink
  box(.8,.1,.6,M.dim(0x202820),-2,.87,6.2);
  cyl(.04,.04,.3,5,M.metal(),-2,.72,6.25,.5,0);
  // Note on table
  const kitTable=box(1.2,.72,0.8,M.wood(),1,0.36,5);
  box(.22,.03,.3,M.dim(0x6a8a50),1,.75,5);
  addIA(new THREE.Vector3(1,.75,5),'READ NOTE',1.8,()=>openDoc('kitchen_note'));

  // ── BEDROOM ──
  makeRoom(3, 1.5, 0, 7, 5, 3.0, M.wall());
  ptLight(0x4d66ff,3,8, 6,2.5,4,'Bedroom_Moon');
  // Bed (Blender: (6,4,0.2))
  addBedFrame(6,0.2,4);
  // Vanity
  box(1,.72,.5,M.wood(),8.5,.36,2);
  box(.9,.55,.05,M.dim(0x181c18),8.5,1.05,1.78); // mirror
  box(.22,.03,.3,M.dim(0x6a8a50),8.5,.74,2);
  addIA(new THREE.Vector3(8.5,.74,2),'READ JOURNAL',1.8,()=>openDoc('bedroom_journal'));
  // Meat hooks (Blender: (-1,11,0) and (1,10.5,0) → our z-coord)
  addHook(-1,3.0,6);
  addHook(1,3.0,5.6);

  // ── BASEMENT ──
  makeRoom(-4, 8.0, -2.5, 8, 6, 2.5, M.wallBase());
  ptLight(0xff0808,25,12, 0,-0.5,11,'Basement_Red');
  G.flickers.push({name:'Basement_Red',base:25,chance:.18});
  // Furnace
  box(1.4,1.5,0.9,M.dim(0x100808), 0,-.75,13.2);
  box(1.0,0.9,0.05,M.glow(0x3a0000),0,-.5,12.77); // door
  box(0.7,0.7,0.04,M.glow(0xff2200),0,-.5,12.75); // inner glow
  ptLight(0xff2200,30,8, 0,-.4,12.8,'Furnace_Glow');
  G.flickers.push({name:'Furnace_Glow',base:30,chance:.12});
  // Shelves
  box(3,.06,0.5,M.metal(),-2.5,0.5,8.6);
  box(3,.06,0.5,M.metal(),-2.5,-.3,8.6);
  // Fuel canister on shelf
  cyl(.12,.12,.4,6,M.dim(0x204020),-3,-.09,8.6);
  addIA(new THREE.Vector3(0,-.5,13.2),'APPROACH FURNACE',2.5,()=>{
    if(G.story.basementOpen){
      openDoc('basement_furnace',()=>setTimeout(triggerFinalChoice,800));
    } else {
      showNote('The furnace burns with unnatural light.');
    }
  });
  // Basement staircase — collider passage
  // Stairs from z≈8 down to y=-2.5
  for(let s=0;s<8;s++){
    box(2,.12,0.5,M.floor(),0,-s*.3+0,7.5+s*.45,-.1,0,0);
  }
}

// ─────────────────────────────────────────────────────────
//  PROPS
// ─────────────────────────────────────────────────────────
function addBrokenChair(x,y,z){
  box(.8,.05,.8,M.wood(),x,y,z,0,0,.26);
  cyl(.04,.04,.4,4,M.wood(),x+.15,y-.18,z+.15);
  cyl(.04,.04,.15,4,M.wood(),x-.2,y-.07,z-.2,0,0,.9);
}
function addBedFrame(x,y,z){
  box(2,.1,4,M.wood(),x,y,z);
  box(2,1.2,.15,M.wood(),x,y+.6,z-2.05); // headboard
  box(2,.6,.15,M.wood(),x,y+.3,z+2.05);  // footboard
  [[-0.9,-1.9],[0.9,-1.9],[-0.9,1.9],[0.9,1.9]].forEach(([dx,dz])=>{
    cyl(.06,.06,.25+y,4,M.wood(),x+dx,(.25+y)/2-.05,z+dz);
  });
  box(1.85,.25,3.5,M.dim(0x1a150e),x,y+.18,z); // mattress
}
function addHook(x,y,z){
  cyl(.025,.025,.55,6,M.metal(),x,y-.28,z,.7,0);
  cyl(.025,.025,.18,6,M.metal(),x,y-.28+.2,z,.7,Math.PI,0);
}

// ─────────────────────────────────────────────────────────
//  MOON LIGHT  (Blender: sun lamp, cold blue, nearly horizontal)
// ─────────────────────────────────────────────────────────
function buildLighting(){
  // Ambient — very dim
  G.scene.add(new THREE.AmbientLight(0x020408, 0.7));

  // Moon — directional at low angle (Blender: loc 20,-20,30; rot 15°,-45°)
  const moon = new THREE.DirectionalLight(0x7080b0, 0.18);
  moon.position.set(20,-20,30);
  moon.target.position.set(0,0,0);
  G.scene.add(moon); G.scene.add(moon.target);

  // Porch lantern (0,-2,2.8 → our coords: flickering orange)
  ptLight(0xff8c1a,12,8, 0,2.8,-2,'Porch_Lantern');
  G.flickers.push({name:'Porch_Lantern',base:12,chance:.22});

  // Well glow — eerie green
  ptLight(0x33cc44,6,5, 14,0.5,6,'Well_Glow');

  // Flashlight
  G.flashlight = new THREE.SpotLight(0xd8ffd8,1.8,20,Math.PI/9,.3,1.7);
  G.flashlight.target.position.set(0,0,-1);
  G.camera.add(G.flashlight);
  G.camera.add(G.flashlight.target);
  G.scene.add(G.camera);
}

// ─────────────────────────────────────────────────────────
//  KEY ITEM SETUP
// ─────────────────────────────────────────────────────────
function buildKeyItems(){
  // Spare key under porch flowerpot (0,-1.5,-4.5)
  // Flower pot
  cyl(.2,.15,.3,7,M.dim(0x5a3015),0,.15,-4.5);
  // Key glow
  box(.14,.03,.05,M.glow(0xaa8800),0,.32,-4.5);
  addIA(new THREE.Vector3(0,.32,-4.5),'TAKE KEY (UNDER FLOWERPOT)',1.8,()=>{
    if(!G.story.gotKey){
      G.story.gotKey=true;
      sndPickup();
      openDoc('porch_key',()=>{
        showNote('Front door key obtained.');
        setObjective(0);
      });
    } else {
      showNote('Already taken.');
    }
  });

  // Notice on front gate post
  box(.28,.02,.4,M.dim(0x6a8a50),-1.5,1.2,-12.2);
  addIA(new THREE.Vector3(-1.5,1.2,-12.2),'READ GATE NOTICE',1.8,()=>openDoc('front_gate'));

  // Basement trapdoor in kitchen floor
  box(1,0.06,1,M.dim(0x1a1008),-1,0.04,6.8);
  addIA(new THREE.Vector3(-1,.04,6.8),'OPEN TRAPDOOR TO BASEMENT',1.8,()=>{
    if(!G.story.basementOpen){
      G.story.basementOpen=true;
      sndDoor();
      showNote('Basement hatch opened. Cold air rises from below.');
      setObjective(4);
    }
  });
}

// ─────────────────────────────────────────────────────────
//  GHOST ENTITY
// ─────────────────────────────────────────────────────────
function buildGhost(){
  const g=G.ghost;
  const grp=new THREE.Group();

  const bodyM=new THREE.MeshBasicMaterial({color:0x040408,transparent:true,opacity:.85});
  // body
  grp.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(.4,1.2,.22),bodyM),{position:{x:0,y:.6,z:0}}));
  // head
  grp.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(.3,.32,.22),bodyM),{position:{x:0,y:1.4,z:0}}));
  // arms
  [-0.35,0.35].forEach(sx=>{
    const arm=new THREE.Mesh(new THREE.BoxGeometry(.14,.8,.14),bodyM);
    arm.position.set(sx,.65,0); grp.add(arm);
  });

  const eyeMat=new THREE.MeshBasicMaterial({color:0xff0000});
  [-0.07,0.07].forEach(ex=>{
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.045,4,4),eyeMat);
    eye.position.set(ex,1.42,.12); grp.add(eye);
  });

  const aura=new THREE.PointLight(0x220000,0,3);
  grp.add(aura); g.aura=aura;

  grp.position.copy(g.pos);
  grp.visible=false;
  G.scene.add(grp);
  g.mesh=grp;

  g.waypoints=[
    new THREE.Vector3(-1,-0,-14), new THREE.Vector3(0,0,-5),
    new THREE.Vector3(-8,0,4),   new THREE.Vector3(-5,0,7),
    new THREE.Vector3(0,-.5,11), new THREE.Vector3(14,0,6),
    new THREE.Vector3(5,0,2),    new THREE.Vector3(-14,0,-2),
  ];
}

// ─────────────────────────────────────────────────────────
//  BUILD FULL WORLD
// ─────────────────────────────────────────────────────────
function buildWorld(){
  buildOutdoor();
  buildHouseExterior();
  buildIndoor();
  buildLighting();
  buildKeyItems();
  buildGhost();
}

// ─────────────────────────────────────────────────────────
//  COLLISION
// ─────────────────────────────────────────────────────────
function collides(pos){
  const r=G.player.radius;
  for(let i=0;i<G.colliders.length;i++){
    const c=G.colliders[i];
    if(pos.x+r>c.minX&&pos.x-r<c.maxX&&pos.z+r>c.minZ&&pos.z-r<c.maxZ)return true;
  }
  return false;
}
function tryMove(pos){
  const cur=G.player.pos;
  const tx=new THREE.Vector3(pos.x,cur.y,cur.z);
  if(!collides(tx))cur.x=pos.x;
  const tz=new THREE.Vector3(cur.x,cur.y,pos.z);
  if(!collides(tz))cur.z=pos.z;
  // crude indoor Y: basement below z>8
  if(cur.z>8 && cur.z<14) cur.y=Math.max(-1.0,cur.y);
  else cur.y=0;
}

// ─────────────────────────────────────────────────────────
//  PLAYER UPDATE
// ─────────────────────────────────────────────────────────
let lastStep=0, headBob=0, headBobAmp=0;

function updatePlayer(dt){
  const p=G.player;
  const sprint=(G.keys['ShiftLeft']||G.keys['ShiftRight'])&&p.stamina>0;
  const speed=sprint?p.sprintSpeed:p.speed;

  const mv=G.keys['KeyW']||G.keys['KeyS']||G.keys['KeyA']||G.keys['KeyD']||
           G.keys['ArrowUp']||G.keys['ArrowDown'];
  if(sprint&&mv) p.stamina=Math.max(0,p.stamina-22*dt);
  else p.stamina=Math.min(100,p.stamina+7*dt);

  const fwd=new THREE.Vector3(-Math.sin(G.yaw),0,-Math.cos(G.yaw));
  const rgt=new THREE.Vector3(Math.cos(G.yaw),0,-Math.sin(G.yaw));
  const move=new THREE.Vector3();
  if(G.keys['KeyW']||G.keys['ArrowUp'])   move.addScaledVector(fwd,speed*dt);
  if(G.keys['KeyS']||G.keys['ArrowDown']) move.addScaledVector(fwd,-speed*dt);
  if(G.keys['KeyA']) move.addScaledVector(rgt,-speed*dt);
  if(G.keys['KeyD']) move.addScaledVector(rgt, speed*dt);

  if(move.lengthSq()>0){
    tryMove(p.pos.clone().add(move));
    lastStep+=dt;
    if(lastStep>.4){ sndStep();lastStep=0; }
    headBob+=dt*(sprint?9:6);
    headBobAmp=Math.min(headBobAmp+dt*4,.055);
  } else {
    headBobAmp=Math.max(headBobAmp-dt*4.5,0);
  }

  if(p.flashOn){
    p.battery=Math.max(0,p.battery-(mv?.2:.07)*dt);
    if(p.battery<=0)p.flashOn=false;
  }

  const bob=Math.sin(headBob)*headBobAmp;
  G.camera.position.set(p.pos.x,p.pos.y+p.height+bob,p.pos.z);
  G.camera.rotation.order='YXZ';
  G.camera.rotation.y=G.yaw;
  G.camera.rotation.x=G.pitch;
  G.flashlight.visible=p.flashOn;

  // Battery HUD
  const bp=Math.round(p.battery);
  document.getElementById('bat-num').textContent=bp+'%';
  const bi=document.getElementById('bat-inner');
  bi.style.width=bp+'%';
  bi.style.background=bp<25?'#ff2200':bp<50?'#ffaa00':'';

  // Room label
  const rx=p.pos.x,rz=p.pos.z,ry=p.pos.y;
  let room='OUTSIDE';
  if(rz>-1.5&&rz<1.5&&rx>-3&&rx<3)          room='HALLWAY';
  else if(rz>1.5&&rz<7.5&&rx>-11&&rx<-3)     room='LIVING ROOM';
  else if(rz>1.5&&rz<6.5&&rx>-3&&rx<3)       room='KITCHEN';
  else if(rz>1.5&&rz<6.5&&rx>3&&rx<10)       room='BEDROOM';
  else if(rz>8&&rz<14&&ry<-0.5)              room='BASEMENT';
  if(room!==p.room){
    p.room=room;
    document.getElementById('room-label').textContent=room;
    sndDoor();
  }
}

// ─────────────────────────────────────────────────────────
//  GHOST AI
// ─────────────────────────────────────────────────────────
function updateGhost(dt){
  const g=G.ghost;
  if(!g.mesh)return;
  const pp=G.player.pos, gp=g.pos;
  const dist=gp.distanceTo(pp);

  switch(g.state){
    case 'patrol':{
      const wp=g.waypoints[g.wpIdx];
      const toWp=new THREE.Vector3().subVectors(wp,gp); toWp.y=0;
      if(toWp.length()<0.8) g.wpIdx=(g.wpIdx+1)%g.waypoints.length;
      else { toWp.normalize(); gp.addScaledVector(toWp,g.speed*dt); }
      if(dist<g.detRange) g.state='chase';
      g.mesh.visible=dist<20&&G.player.flashOn;
      break;
    }
    case 'chase':{
      const toP=new THREE.Vector3().subVectors(pp,gp); toP.y=0;
      if(toP.length()>0.8){ toP.normalize(); gp.addScaledVector(toP,g.chaseSpeed*dt); }
      if(dist<1.6&&g.scareTimer<=0){ triggerScare(); g.scareTimer=14; g.state='retreat'; }
      if(dist>g.chaseRange) g.state='patrol';
      g.mesh.visible=dist<25;
      g.aura.intensity=Math.max(0,.6-dist*.045);
      break;
    }
    case 'retreat':{
      g.scareTimer-=dt;
      const away=new THREE.Vector3().subVectors(gp,pp).normalize();
      gp.addScaledVector(away,g.speed*1.3*dt);
      if(g.scareTimer<=0){ g.state='patrol'; g.mesh.visible=false; }
      break;
    }
  }
  gp.y=G.player.pos.y; // match player Y roughly
  g.mesh.position.copy(gp);
  if(g.state==='chase'){
    const look=new THREE.Vector3().subVectors(pp,gp);
    g.mesh.rotation.y=Math.atan2(look.x,look.z);
  }

  // Blood vignette
  const bv=Math.max(0,1-dist/10)*.5;
  document.getElementById('ov-blood').style.opacity=bv.toString();
  // Static
  const st=document.getElementById('ov-static');
  if(dist<5){ st.classList.remove('hidden'); st.style.opacity=Math.min(.2,(5-dist)/5*.2).toString(); }
  else st.classList.add('hidden');
}

// ─────────────────────────────────────────────────────────
//  FLICKER SYSTEM  (animate_flicker from Blender)
// ─────────────────────────────────────────────────────────
function updateFlickers(dt){
  G.horror.flicker+=dt;
  if(G.horror.flicker>G.horror.nextFlicker){
    G.horror.flicker=0;
    G.horror.nextFlicker=5+Math.random()*14;
    doFlicker(2+Math.floor(Math.random()*4));
    sndCreak();
  }
}

function doFlicker(count){
  const fl=document.getElementById('ov-flicker');
  let i=0;
  // Also flicker Three.js lights
  G.scene.traverse(obj=>{
    if(obj.isLight&&!obj.isDirectionalLight&&obj.name){
      const orig=obj.intensity;
      obj.userData._origIntensity=orig;
      obj.intensity*=0.2;
      setTimeout(()=>{ if(obj.userData._origIntensity!==undefined) obj.intensity=obj.userData._origIntensity; },200);
    }
  });
  const step=()=>{
    if(i>=count*2){ fl.style.opacity='0'; return; }
    fl.style.opacity=i%2===0?(0.35+Math.random()*.45).toString():'0';
    i++; setTimeout(step,38+Math.random()*55);
  };
  step();
}

function triggerScare(){
  sndGhost(); sndHeart();
  doFlicker(6);
  const s=document.getElementById('scare');
  const f=document.getElementById('scare-face');
  s.classList.remove('hidden');
  f.style.animation='none'; f.offsetHeight; f.style.animation='';
  setTimeout(()=>s.classList.add('hidden'),2500);
}

function doBlackout(){
  sndStatic();
  const bd=document.getElementById('ov-dark');
  bd.style.opacity='1';
  bd.style.transition='opacity .08s';
  setTimeout(()=>{ bd.style.transition='opacity 1.6s'; bd.style.opacity='0'; },600+Math.random()*500);
}

function updateHorror(dt){
  updateFlickers(dt);

  G.horror.entityShow+=dt;
  if(G.horror.entityShow>G.horror.nextEntity&&G.story.current>=1){
    G.horror.entityShow=0;
    G.horror.nextEntity=30+Math.random()*45;
    triggerScare();
  }

  G.horror.blackout+=dt;
  if(G.horror.blackout>G.horror.nextBlackout){
    G.horror.blackout=0;
    G.horror.nextBlackout=55+Math.random()*85;
    doBlackout();
  }

  G.horror.ambient+=dt;
  if(G.horror.ambient>G.horror.nextAmbient){
    G.horror.ambient=0;
    G.horror.nextAmbient=10+Math.random()*20;
    sndWind();
  }
}

// ─────────────────────────────────────────────────────────
//  INTERACTABLE DETECTION
// ─────────────────────────────────────────────────────────
let nearIA=null;

function updateInteractables(){
  const pos=G.player.pos;
  let best=null,bestD=999;
  for(let i=0;i<G.interactables.length;i++){
    const ia=G.interactables[i];
    const d=pos.distanceTo(ia.pos);
    if(d<ia.range&&d<bestD){ bestD=d; best=ia; }
  }
  nearIA=best;
  const h=document.getElementById('interact-hint');
  if(best){ h.classList.remove('hidden'); document.getElementById('ih-label').textContent=best.label; }
  else h.classList.add('hidden');
}

// ─────────────────────────────────────────────────────────
//  ANIMATED ELEMENTS
// ─────────────────────────────────────────────────────────
function updateAnimations(dt){
  // Furnace glow pulse
  G.scene.traverse(obj=>{
    if(obj.isLight&&obj.name==='Furnace_Glow'){
      obj.intensity=28+Math.sin(G.elapsed*3)*5;
    }
    if(obj.isLight&&obj.name==='Well_Glow'){
      obj.intensity=5+Math.sin(G.elapsed*1.3)*1.5;
    }
  });
}

// ─────────────────────────────────────────────────────────
//  OBJECTIVE / MISSION
// ─────────────────────────────────────────────────────────
function setObjective(idx){
  G.story.current=Math.max(G.story.current,idx);
  document.getElementById('obj-text').textContent=OBJECTIVES[Math.min(idx,OBJECTIVES.length-1)];
  showNote(OBJECTIVES[Math.min(idx,OBJECTIVES.length-1)]);
}

// ─────────────────────────────────────────────────────────
//  DOC READER
// ─────────────────────────────────────────────────────────
let _docCb=null;
function openDoc(id,cb){
  const d=DOCS[id]; if(!d)return;
  G.docOpen=true;
  if(G.locked)document.exitPointerLock();
  document.getElementById('doc-title').textContent=d.title;
  let html=d.body.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/&lt;em&gt;/g,'<span class="em">').replace(/&lt;\/em&gt;/g,'</span>')
    .replace(/&lt;warn&gt;/g,'<span class="warn">').replace(/&lt;\/warn&gt;/g,'</span>');
  document.getElementById('doc-body').innerHTML=html;
  document.getElementById('doc-panel').classList.remove('hidden');
  sndPickup();
  _docCb=cb||null;

  // Mission progression from reading
  const prog={'hallway_journal':1,'living_journal':2,'kitchen_note':2,'bedroom_journal':3};
  if(prog[id]&&prog[id]>G.story.current) setObjective(prog[id]);
}
function closeDoc(){
  if(!G.docOpen)return;
  document.getElementById('doc-panel').classList.add('hidden');
  G.docOpen=false;
  if(_docCb){_docCb();_docCb=null;}
}

// ─────────────────────────────────────────────────────────
//  NOTE POPUP
// ─────────────────────────────────────────────────────────
function showNote(txt){
  const el=document.getElementById('note-popup');
  document.getElementById('np-text').textContent=txt;
  el.classList.remove('hidden');
  el.style.animation='none'; el.offsetHeight; el.style.animation='';
  setTimeout(()=>el.classList.add('hidden'),5200);
}

// ─────────────────────────────────────────────────────────
//  FINAL CHOICE
// ─────────────────────────────────────────────────────────
function triggerFinalChoice(){
  G.choiceOpen=true;
  if(G.locked)document.exitPointerLock();
  document.getElementById('choice-panel').classList.remove('hidden');
  doFlicker(10); sndGhost();
}

const ENDINGS={
  burn:{
    icon:'🔥', title:'ASHES',
    text:`You douse the furnace with the accelerant.
The match catches.

The fire spreads faster than it should —
the house feeds it, draws it upward, pulls it into the walls.
You run.

The front door opens easily now.
As though the house is surprised.
As though it didn't think you could.

You reach the front gate.
You don't look back.

Behind you, the Hollow House burns.
In the firelight you can see shapes in the smoke —
Thomas, Anna, Edgar, Ruth, Eleanor —
all of them rising.

Not screaming.

<em>Smiling.</em>

They were waiting a long time for someone to let them go.`,
    tag:'ENDING: THE LAST FIRE',
  },
  stay:{
    icon:'💀', title:'KEPT',
    text:`You step toward the light.

It is very warm.
It is the warmest thing you have ever felt.

The house sighs around you —
a breath held for a century, finally released.

You understand now why Eleanor stayed.
Why Calloway stayed.
Why Thomas never sold the land when he had the chance.

The warmth is complete.
The loneliness is gone.
You are not afraid.

<em>You are home.</em>

Somewhere, far above, the porch lantern flickers on.
The house is occupied again.
The gravestones in the yard have a new family.

The county will get a report in a few weeks.
Another missing person.
The house will be investigated.
Someone will come.

<warn>The house will be ready.</warn>`,
    tag:'ENDING: HOLLOW KEPT',
  },
};

function endGame(type){
  G.ended=true; G.running=false;
  const e=ENDINGS[type];
  document.getElementById('choice-panel').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('end-icon').textContent=e.icon;
  document.getElementById('end-title').textContent=e.title;
  document.getElementById('end-title').style.color=type==='burn'?'#ff6600':'#00ff41';
  document.getElementById('end-text').textContent=e.text;
  document.getElementById('end-tag').textContent=e.tag;
  const es=document.getElementById('screen-end');
  es.classList.remove('hidden'); es.classList.add('active');
  if(document.pointerLockElement)document.exitPointerLock();
  sndDrone();
}

// ─────────────────────────────────────────────────────────
//  INPUT
// ─────────────────────────────────────────────────────────
function setupInput(){
  window.addEventListener('keydown',e=>{
    G.keys[e.code]=true; initAudio();
    if(G.ended)return;
    if(e.code==='KeyF'&&G.player.battery>0) G.player.flashOn=!G.player.flashOn;
    if(e.code==='KeyE'){
      if(G.docOpen){closeDoc();return;}
      if(G.choiceOpen)return;
      if(G.paused)return;
      if(nearIA)nearIA.action();
    }
    if(e.code==='Escape'){
      if(G.docOpen){closeDoc();return;}
      if(G.choiceOpen)return;
      togglePause();
    }
  });
  window.addEventListener('keyup',e=>delete G.keys[e.code]);

  document.addEventListener('mousemove',e=>{
    if(!G.locked||G.docOpen||G.paused||G.choiceOpen)return;
    G.yaw-=e.movementX*.0022;
    G.pitch=Math.max(-1.35,Math.min(1.35,G.pitch-e.movementY*.0022));
  });

  document.addEventListener('pointerlockchange',()=>{
    G.locked=document.pointerLockElement===document.getElementById('gc');
    const ls=document.getElementById('screen-lock');
    if(G.locked){ ls.classList.add('hidden'); ls.classList.remove('active'); G.paused=false; }
    else if(G.running&&!G.ended&&!G.docOpen&&!G.choiceOpen){
      ls.classList.remove('hidden'); ls.classList.add('active');
    }
  });

  document.getElementById('screen-lock').addEventListener('click',()=>{
    document.getElementById('gc').requestPointerLock();
  });
  document.getElementById('gc').addEventListener('click',()=>{
    if(!G.locked&&G.running&&!G.docOpen&&!G.choiceOpen&&!G.paused)
      document.getElementById('gc').requestPointerLock();
  });

  document.getElementById('btn-burn').addEventListener('click',()=>endGame('burn'));
  document.getElementById('btn-stay').addEventListener('click',()=>endGame('stay'));
  document.getElementById('btn-resume').addEventListener('click',togglePause);
  document.getElementById('doc-close').addEventListener('click',closeDoc);
  document.getElementById('btn-again').addEventListener('click',()=>location.reload());
}

function togglePause(){
  if(G.ended)return;
  G.paused=!G.paused;
  const ps=document.getElementById('screen-pause');
  if(G.paused){
    ps.classList.remove('hidden'); ps.classList.add('active');
    if(document.pointerLockElement)document.exitPointerLock();
  } else {
    ps.classList.remove('active'); ps.classList.add('hidden');
    document.getElementById('gc').requestPointerLock();
  }
}

// ─────────────────────────────────────────────────────────
//  BOOT LOG
// ─────────────────────────────────────────────────────────
const BOOT=[
  {t:'> LOADING CASE FILE: HOLLOW HOUSE...',           d:300,  c:''},
  {t:'> ADDRESS: 17 MARSH ROAD, WILLOW COUNTY',        d:700,  c:''},
  {t:'> BUILT: 1887  —  CONDEMNED: 1994',              d:1200, c:'blw'},
  {t:'> LAST RESIDENT: ELEANOR MARSH (MISSING)',       d:1700, c:'blw'},
  {t:'> MISSING PERSONS FILED: 6 SINCE 1889',          d:2200, c:'ble'},
  {t:'> WARNING: STRUCTURAL INSTABILITY',              d:2700, c:'blw'},
  {t:'> WARNING: UNKNOWN ENERGY READINGS IN BASEMENT', d:3200, c:'ble'},
  {t:'> RECOMMENDATION: DO NOT ENTER',                 d:3700, c:'ble'},
  {t:'> OVERRIDE: INVESTIGATION REQUIRED',             d:4200, c:''},
  {t:'> EQUIPMENT: FLASHLIGHT (BATTERY 100%)',         d:4700, c:''},
  {t:'> OBJECTIVE: DETERMINE FATE OF ELEANOR MARSH',   d:5200, c:''},
  {t:'> GOOD LUCK. YOU WILL NEED IT.',                 d:5700, c:''},
];

function runBoot(){
  const log=document.getElementById('boot-log');
  BOOT.forEach(({t,d,c})=>setTimeout(()=>{
    const line=document.createElement('div');
    line.className='bl '+c; line.textContent=t;
    log.appendChild(line); log.scrollTop=log.scrollHeight;
  },d));
  setTimeout(()=>document.getElementById('btn-start').classList.remove('hidden'),6200);
}

// ─────────────────────────────────────────────────────────
//  GAME LOOP
// ─────────────────────────────────────────────────────────
function loop(){
  if(!G.running)return;
  requestAnimationFrame(loop);
  const dt=Math.min(G.clock.getDelta(),.06);
  G.elapsed+=dt;
  if(!G.paused&&!G.docOpen&&!G.choiceOpen&&!G.ended){
    updatePlayer(dt);
    updateGhost(dt);
    updateHorror(dt);
    updateInteractables();
    updateAnimations(dt);
  }
  G.renderer.render(G.scene,G.camera);
}

// ─────────────────────────────────────────────────────────
//  START
// ─────────────────────────────────────────────────────────
function startGame(){
  initAudio(); sndDrone();
  document.getElementById('screen-title').classList.remove('active');
  document.getElementById('screen-title').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  const ls=document.getElementById('screen-lock');
  ls.classList.remove('hidden'); ls.classList.add('active');

  initThree(); buildWorld(); setupInput();

  document.getElementById('obj-text').textContent=OBJECTIVES[0];
  G.running=true; G.clock.start();

  setTimeout(()=>{ sndCreak(); doFlicker(3); },2000);
  setTimeout(()=>showNote('Something about this place feels wrong.'),3000);

  // Entity arrives after delay
  setTimeout(()=>{ G.ghost.pos.set(-14,0,-2); },12000);

  loop();
}

document.addEventListener('DOMContentLoaded',()=>{
  runBoot();
  document.getElementById('btn-start').addEventListener('click',startGame);
});
