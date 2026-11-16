/* "Shift Rally": the 3D race behind the daily quiz.
   Every right answer is a boost through the next gate; a wrong one is a spin-out while the others pass you.
   Original low-poly world (coast road, palms, dunes, skyline). Uses vendor/three.min.js (r128, MIT), loaded only when
   the quiz opens. If WebGL is missing or slow, the quiz simply runs without the race. */
(function(){
'use strict';
const SEG=40, OK_STEP=1.6, BAD_STEP=1.05, PACE=[1.45,1.3,1.15];
const reduce=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
let loading=null;
function load(){
  if(window.THREE) return Promise.resolve(true);
  if(loading) return loading;
  loading=new Promise(res=>{ const s=document.createElement('script'); s.src='vendor/three.min.js'; s.async=true;
    s.onload=()=>res(!!window.THREE); s.onerror=()=>{ loading=null; res(false); }; document.head.appendChild(s); });
  return loading;
}
function glOk(){ try{ const c=document.createElement('canvas'); return !!(window.WebGLRenderingContext&&(c.getContext('webgl')||c.getContext('experimental-webgl'))); }catch(e){ return false; } }

// ---------- small texture helpers (canvas → texture) ----------
function canvasTex(w,h,draw){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h); const t=new THREE.CanvasTexture(c); t.anisotropy=4; return t; }
function labelTex(text,bg,fg,rtl){ return canvasTex(512,128,(x,w,h)=>{ x.fillStyle=bg; const r=56; x.beginPath(); x.moveTo(r,8); x.arcTo(w-8,8,w-8,h-8,r); x.arcTo(w-8,h-8,8,h-8,r); x.arcTo(8,h-8,8,8,r); x.arcTo(8,8,w-8,8,r); x.fill();
  x.fillStyle=fg; x.font='800 64px Tahoma, "Segoe UI", Arial, sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.direction=rtl?'rtl':'ltr'; x.fillText(text,w/2,h/2+4,w-40); }); }
function glowTex(inner,outer){ return canvasTex(128,128,(x,w)=>{ const g=x.createRadialGradient(64,64,0,64,64,64); g.addColorStop(0,inner); g.addColorStop(1,outer); x.fillStyle=g; x.fillRect(0,0,w,w); }); }
function shadowTex(){ return glowTex('rgba(0,0,0,.55)','rgba(0,0,0,0)'); }

// ---------- the world ----------
function build(host,o){
  const night=!!o.night, W={o,host,night,cars:[],gates:[],fx:[],t:0,shake:0,fovKick:0,done:false,qi:0};
  const ren=new THREE.WebGLRenderer({antialias:(window.devicePixelRatio||1)<2,alpha:false,powerPreference:'high-performance'});
  ren.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75)); ren.outputEncoding=THREE.sRGBEncoding;
  ren.domElement.className='q3dc'; host.appendChild(ren.domElement); W.ren=ren;
  const sc=new THREE.Scene(); W.sc=sc;
  const skyTop=night?'#0B1430':'#5FA8E8', skyMid=night?'#1E2D5C':'#BFE0F7', skyLow=night?'#3A3F6E':'#FCE8C8';
  sc.background=canvasTex(4,256,(x,w,h)=>{ const g=x.createLinearGradient(0,0,0,h); g.addColorStop(0,skyTop); g.addColorStop(.55,skyMid); g.addColorStop(1,skyLow); x.fillStyle=g; x.fillRect(0,0,w,h); });
  sc.fog=new THREE.Fog(night?0x2A2F58:0xF3DDBD,90,night?380:460);
  const cam=new THREE.PerspectiveCamera(60,1,.5,900); W.cam=cam;
  sc.add(new THREE.HemisphereLight(night?0x6A7BD8:0xDFF1FF,night?0x2A1E3A:0xD9B27A,night?.75:1.05));
  const sun=new THREE.DirectionalLight(night?0x9FB4FF:0xFFF1D6,night?.45:1.1); sun.position.set(-40,80,30); sc.add(sun);

  const len=(o.n*OK_STEP+6)*SEG; W.len=len;
  // ground, sea and road
  const sand=new THREE.Mesh(new THREE.PlaneGeometry(260,len+400),new THREE.MeshLambertMaterial({color:night?0x6B5B70:0xE6C48E}));
  sand.rotation.x=-Math.PI/2; sand.position.set(40,-.02,-len/2+120); sc.add(sand);
  const sea=new THREE.Mesh(new THREE.PlaneGeometry(600,len+600),new THREE.MeshPhongMaterial({color:night?0x1B2E5E:0x2FA3C7,shininess:90,specular:night?0x556699:0xFFFFFF}));
  sea.rotation.x=-Math.PI/2; sea.position.set(-390,-.4,-len/2+120); sc.add(sea); W.sea=sea;
  const beach=new THREE.Mesh(new THREE.PlaneGeometry(14,len+400),new THREE.MeshLambertMaterial({color:night?0x8C7A86:0xF4DDB0}));
  beach.rotation.x=-Math.PI/2; beach.position.set(-96,0,-len/2+120); sc.add(beach);
  const road=new THREE.Mesh(new THREE.PlaneGeometry(15,len+400),new THREE.MeshLambertMaterial({color:night?0x23263A:0x3A3F4E}));
  road.rotation.x=-Math.PI/2; road.position.set(0,0,-len/2+120); sc.add(road);
  // lane dashes + kerbs (instanced)
  const dashG=new THREE.PlaneGeometry(.25,3), dashM=new THREE.MeshBasicMaterial({color:0xF7F3E8});
  const nD=Math.ceil((len+200)/8)*3, dashes=new THREE.InstancedMesh(dashG,dashM,nD), m4=new THREE.Matrix4(), q=new THREE.Quaternion(), e=new THREE.Euler(-Math.PI/2,0,0), v=new THREE.Vector3(), s1=new THREE.Vector3(1,1,1);
  q.setFromEuler(e); let k=0;
  for(let z=100;z>-len-100&&k<nD;z-=8) for(const x of [-3,0,3]){ if(k>=nD) break; m4.compose(v.set(x,.01,z),q,s1); dashes.setMatrixAt(k++,m4); }
  dashes.count=k; sc.add(dashes);
  const kerbG=new THREE.BoxGeometry(.7,.18,2), nK=Math.ceil((len+200)/2)*2, kerbs=new THREE.InstancedMesh(kerbG,new THREE.MeshLambertMaterial({color:0xffffff}),nK), col=new THREE.Color();
  k=0; let alt=0; for(let z=100;z>-len-100&&k<nK-1;z-=2,alt++) for(const x of [-7.8,7.8]){ m4.compose(v.set(x,.09,z),new THREE.Quaternion(),s1); kerbs.setMatrixAt(k,m4); kerbs.setColorAt(k,col.set(alt%2?0xE24B3B:0xF5F5F5)); k++; }
  kerbs.count=k; sc.add(kerbs);
  // palms (instanced trunks + leaves)
  const palmPos=[]; for(let z=60;z>-len-60;z-=11) { palmPos.push([-12-Math.random()*3,z+Math.random()*4]); palmPos.push([12+Math.random()*4,z-5+Math.random()*4]); }
  const trunkG=new THREE.CylinderGeometry(.22,.38,7,6); trunkG.translate(0,3.5,0);
  const trunks=new THREE.InstancedMesh(trunkG,new THREE.MeshLambertMaterial({color:night?0x5A4436:0x8A6440}),palmPos.length);
  const leafG=new THREE.ConeGeometry(.55,4.2,4,1); leafG.rotateZ(-Math.PI/2); leafG.translate(2.1,0,0); leafG.scale(1,.25,1);
  const leaves=new THREE.InstancedMesh(leafG,new THREE.MeshLambertMaterial({color:night?0x2E5A48:0x3FA05A}),palmPos.length*7);
  let li=0; palmPos.forEach((p,i)=>{ const h=.85+Math.random()*.4, tilt=(Math.random()-.5)*.18;
    m4.compose(v.set(p[0],0,p[1]),new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt,0,tilt)),new THREE.Vector3(1,h,1)); trunks.setMatrixAt(i,m4);
    for(let j=0;j<7;j++){ const a=j/7*Math.PI*2+Math.random()*.3; m4.compose(v.set(p[0]+tilt*7*h,7*h,p[1]-tilt*7*h),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,a,-.35-Math.random()*.25,'YXZ')),s1); leaves.setMatrixAt(li++,m4); } });
  sc.add(trunks,leaves);
  // dunes on the right, skyline far away on both sides
  const duneG=new THREE.SphereGeometry(1,10,6,0,Math.PI*2,0,Math.PI/2), duneM=new THREE.MeshLambertMaterial({color:night?0x7A6578:0xE0B77A});
  const nDune=Math.ceil(len/45)+4, dunes=new THREE.InstancedMesh(duneG,duneM,nDune);
  for(let i=0;i<nDune;i++){ m4.compose(v.set(55+Math.random()*60,-.5,60-i*45-Math.random()*20),new THREE.Quaternion(),new THREE.Vector3(14+Math.random()*16,4+Math.random()*7,10+Math.random()*12)); dunes.setMatrixAt(i,m4); }
  sc.add(dunes);
  const winTex=canvasTex(64,128,(x,w,h)=>{ x.fillStyle='#fff'; x.fillRect(0,0,w,h); for(let yy=6;yy<h-4;yy+=10) for(let xx=5;xx<w-4;xx+=10){ x.fillStyle=Math.random()<(night?.55:.15)?(night?'#FFD98A':'#9CC6E8'):(night?'#2A3350':'#C9D7E6'); x.fillRect(xx,yy,6,6); } });
  winTex.wrapS=winTex.wrapT=THREE.RepeatWrapping;
  const bG=new THREE.BoxGeometry(1,1,1); bG.translate(0,.5,0);
  const nB=Math.ceil(len/22)+8, towers=new THREE.InstancedMesh(bG,new THREE.MeshLambertMaterial({map:winTex,emissive:night?0xFFFFFF:0x000000,emissiveMap:night?winTex:null,emissiveIntensity:night?.55:0}),nB*2);
  const tint=night?[0x8C96C8,0x6F7DB8,0xA3A9D6]:[0xDCE6F0,0xBFD3E6,0xF2E6D8,0xA9C4DE];
  k=0; for(let i=0;i<nB;i++) for(const side of [-1,1]){ const x=side<0?-150-Math.random()*90:110+Math.random()*80, h=18+Math.random()*(Math.random()<.15?90:40);
    m4.compose(v.set(x,0,40-i*22-Math.random()*10),new THREE.Quaternion(),new THREE.Vector3(8+Math.random()*10,h,8+Math.random()*10)); towers.setMatrixAt(k,m4); towers.setColorAt(k,col.set(tint[k%tint.length])); k++; }
  sc.add(towers);
  // sun / moon glow, and stars at night
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(night?'rgba(235,240,255,1)':'rgba(255,250,220,1)',night?'rgba(120,140,255,0)':'rgba(255,200,120,0)'),fog:false,depthWrite:false}));
  glow.scale.set(night?50:90,night?50:90,1); W.glow=glow; sc.add(glow);
  if(night){ const pg=new THREE.BufferGeometry(), arr=[]; for(let i=0;i<500;i++){ const a=Math.random()*Math.PI*2, el=.15+Math.random()*1.2; arr.push(Math.cos(a)*600*Math.cos(el),Math.sin(el)*500,Math.sin(a)*600*Math.cos(el)); }
    pg.setAttribute('position',new THREE.Float32BufferAttribute(arr,3)); W.stars=new THREE.Points(pg,new THREE.PointsMaterial({color:0xffffff,size:1.6,sizeAttenuation:false,fog:false})); sc.add(W.stars);
    // street lamps
    const lampG=new THREE.CylinderGeometry(.08,.1,6,5); lampG.translate(0,3,0); const nL=Math.ceil(len/30)+4, lamps=new THREE.InstancedMesh(lampG,new THREE.MeshLambertMaterial({color:0x444A66}),nL*2);
    const lampGlow=glowTex('rgba(255,220,140,1)','rgba(255,180,80,0)'); k=0;
    for(let i=0;i<nL;i++) for(const x of [-8.8,8.8]){ const z=40-i*30; m4.compose(v.set(x,0,z),new THREE.Quaternion(),s1); lamps.setMatrixAt(k++,m4);
      const g=new THREE.Sprite(new THREE.SpriteMaterial({map:lampGlow,depthWrite:false,blending:THREE.AdditiveBlending})); g.scale.set(4,4,1); g.position.set(x*.9,6.1,z); sc.add(g); }
    sc.add(lamps); }
  // speed lines
  const sl=new THREE.InstancedMesh(new THREE.BoxGeometry(.04,.04,5),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false}),60); W.sl=sl; W.slP=[];
  for(let i=0;i<60;i++) W.slP.push([(Math.random()-.5)*16,.4+Math.random()*5,-Math.random()*40]);
  sc.add(sl);
  // the cars: you + three rivals
  const names=(o.rivals||[]).slice(0,3); while(names.length<3) names.push(['Rana','Mai','Salma'][names.length]);
  const colors=[0xF26B1D,0x2E8BC9,0x8E5BD6,0x2FB36B];
  W.cars.push(car(W,colors[0],1.5,true,o.me||'',o.av));
  [-4.5,-1.5,4.5].forEach((x,i)=>W.cars.push(car(W,colors[i+1],x,false,names[i])));
  W.cars.forEach((c,i)=>{ c.pos=0; c.target=0; c.pace=PACE[i-1]||0; c.z=i?(i%2?2.2:-1):0; });
  W.flame=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex('rgba(255,240,180,1)','rgba(255,90,20,0)'),depthWrite:false,blending:THREE.AdditiveBlending,transparent:true,opacity:0}));
  W.flame.scale.set(1.6,1.6,1); sc.add(W.flame);
  W.puffTex=glowTex('rgba(255,255,255,.9)','rgba(255,255,255,0)'); W.sparkTex=glowTex('rgba(255,255,255,1)','rgba(255,255,255,0)');
  // start line
  const start=new THREE.Mesh(new THREE.PlaneGeometry(15,1.6),new THREE.MeshBasicMaterial({map:checkerTex()})); start.rotation.x=-Math.PI/2; start.position.set(0,.02,-3); sc.add(start);
  W.hud=document.createElement('div'); W.hud.className='q3dhud'; host.appendChild(W.hud);
  return W;
}
function checkerTex(){ const t=canvasTex(64,16,(x)=>{ for(let i=0;i<16;i++) for(let j=0;j<4;j++){ x.fillStyle=(i+j)%2?'#111':'#fff'; x.fillRect(i*4,j*4,4,4); } }); t.magFilter=THREE.NearestFilter; return t; }

function car(W,color,lane,me,name,av){
  const g=new THREE.Group(), paint=new THREE.MeshStandardMaterial({color,metalness:.35,roughness:.35});
  const prof=new THREE.Shape(); // side profile, front towards -z later
  prof.moveTo(-2.1,.35); prof.lineTo(2.1,.35); prof.lineTo(2.2,.8); prof.lineTo(1.9,1.0); prof.lineTo(.9,1.08); prof.lineTo(.35,1.62); prof.lineTo(-1.1,1.62); prof.lineTo(-1.75,1.12); prof.lineTo(-2.15,1.05); prof.lineTo(-2.2,.6); prof.lineTo(-2.1,.35);
  const body=new THREE.Mesh(new THREE.ExtrudeGeometry(prof,{depth:1.8,bevelEnabled:true,bevelSize:.08,bevelThickness:.08,bevelSegments:1}),paint);
  body.geometry.translate(0,0,-.9); body.rotation.y=Math.PI/2; g.add(body);
  const glass=new THREE.Shape(); glass.moveTo(.82,1.12); glass.lineTo(.32,1.56); glass.lineTo(-1.04,1.56); glass.lineTo(-1.6,1.14);
  const gm=new THREE.Mesh(new THREE.ExtrudeGeometry(glass,{depth:1.86,bevelEnabled:false}),new THREE.MeshStandardMaterial({color:0x1A2433,metalness:.6,roughness:.15}));
  gm.geometry.translate(0,0,-.93); gm.rotation.y=Math.PI/2; g.add(gm);
  const stripe=new THREE.Mesh(new THREE.BoxGeometry(.5,.02,4.3),new THREE.MeshBasicMaterial({color:0xffffff})); stripe.position.set(0,1.1,0); stripe.scale.set(1,1,.95); g.add(stripe);
  const wg=new THREE.CylinderGeometry(.42,.42,.34,12); wg.rotateZ(Math.PI/2); const wm=new THREE.MeshLambertMaterial({color:0x15171C}), hub=new THREE.MeshLambertMaterial({color:0xC9CED6});
  g.wheels=[]; [[-.95,1.35],[.95,1.35],[-.95,-1.35],[.95,-1.35]].forEach(([x,z])=>{ const w=new THREE.Group(); const t=new THREE.Mesh(wg,wm); const h=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.36,6).rotateZ(Math.PI/2),hub); w.add(t,h); w.position.set(x,.42,z); g.add(w); g.wheels.push(w); });
  const hl=new THREE.MeshBasicMaterial({color:0xFFF6D8}), tl=new THREE.MeshBasicMaterial({color:0xFF3B3B});
  [-.6,.6].forEach(x=>{ const a=new THREE.Mesh(new THREE.BoxGeometry(.38,.14,.05),hl); a.position.set(x,.82,-2.2); g.add(a); const b=new THREE.Mesh(new THREE.BoxGeometry(.38,.14,.05),tl); b.position.set(x,.88,2.24); g.add(b); });
  const spoiler=new THREE.Mesh(new THREE.BoxGeometry(1.9,.08,.4),paint); spoiler.position.set(0,1.35,2.05); g.add(spoiler);
  [-.7,.7].forEach(x=>{ const p=new THREE.Mesh(new THREE.BoxGeometry(.08,.3,.1),paint); p.position.set(x,1.2,2.05); g.add(p); });
  const sh=new THREE.Mesh(new THREE.PlaneGeometry(2.8,5.4),new THREE.MeshBasicMaterial({map:shadowTex(),transparent:true,depthWrite:false})); sh.rotation.x=-Math.PI/2; sh.position.y=.03; g.add(sh);
  if(W.night){ const beam=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex('rgba(255,245,210,.9)','rgba(255,245,210,0)'),depthWrite:false,blending:THREE.AdditiveBlending})); beam.scale.set(4,2,1); beam.position.set(0,.8,-2.8); g.add(beam); }
  // name tag (and your avatar)
  const tag=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTex(name||'',me?'#F26B1D':'rgba(14,24,40,.78)','#fff',/[؀-ۿ]/.test(name||'')),depthWrite:false,transparent:true}));
  tag.scale.set(2.6,.65,1); tag.position.set(0,me&&av?3.95:2.45,0); g.add(tag);
  if(me&&av){ new THREE.TextureLoader().load(av,t=>{ t.encoding=THREE.sRGBEncoding; const a=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthWrite:false,transparent:true})); a.scale.set(1.5,1.5,1); a.position.set(0,2.85,0); g.add(a); }); }
  if(!name) tag.visible=false;
  g.position.set(lane,0,0); g.lane=lane; g.me=me; g.spin=0; g.vel=0; W.sc.add(g); return g;
}

function gate(W,z,num){
  const g=new THREE.Group(), m=new THREE.MeshLambertMaterial({color:0x14294B}), acc=new THREE.MeshBasicMaterial({color:0xF26B1D});
  [-8.4,8.4].forEach(x=>{ const p=new THREE.Mesh(new THREE.BoxGeometry(.7,6.4,.7),m); p.position.set(x,3.2,0); g.add(p); const c=new THREE.Mesh(new THREE.BoxGeometry(.8,.4,.8),acc); c.position.set(x,6.4,0); g.add(c); });
  const beam=new THREE.Mesh(new THREE.BoxGeometry(17.6,1.5,.5),m); beam.position.y=6.6; g.add(beam);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(5.2,1.3),new THREE.MeshBasicMaterial({map:labelTex(num,'#F26B1D','#fff',false),transparent:true})); sign.position.set(0,6.6,.27); g.add(sign);
  const lightM=new THREE.MeshBasicMaterial({color:0xFFD34D}); const strip=new THREE.Mesh(new THREE.BoxGeometry(17,.12,.1),lightM); strip.position.set(0,5.8,.27); g.add(strip); g.light=lightM;
  g.position.z=z; W.sc.add(g); W.gates.push(g); return g;
}
function finishGate(W,z,txt){
  const g=new THREE.Group(), tex=checkerTex(); tex.wrapS=THREE.RepeatWrapping; tex.repeat.set(4,1);
  const m=new THREE.MeshLambertMaterial({color:0xF5F5F5});
  [-8.6,8.6].forEach(x=>{ const p=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,8,8),m); p.position.set(x,4,0); g.add(p); });
  const beam=new THREE.Mesh(new THREE.BoxGeometry(18,1.8,.4),new THREE.MeshBasicMaterial({map:tex})); beam.position.y=8; g.add(beam);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(7,1.6),new THREE.MeshBasicMaterial({map:labelTex(txt,'#14294B','#fff',/[؀-ۿ]/.test(txt)),transparent:true})); sign.position.set(0,9.8,0); g.add(sign);
  const line=new THREE.Mesh(new THREE.PlaneGeometry(15,2),new THREE.MeshBasicMaterial({map:checkerTex()})); line.rotation.x=-Math.PI/2; line.position.y=.02; g.add(line);
  g.position.z=z; W.sc.add(g); W.finish=g; return g;
}
// particles: puffs (smoke), sparks (boost / gate), confetti (finish)
function burst(W,pos,kind,n){
  const tex=kind==='puff'?W.puffTex:W.sparkTex;
  const pal=kind==='conf'?[0xF26B1D,0x2E8BC9,0x58CC02,0xFFD34D,0xE24B8B,0xffffff]:kind==='ok'?[0x7DFF6A,0xFFE36B,0xffffff]:kind==='bad'?[0xFF5A5A,0xFFB0B0]:[0xD8D8D8];
  for(let i=0;i<n;i++){ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,color:pal[i%pal.length],transparent:true,depthWrite:false,blending:kind==='puff'?THREE.NormalBlending:THREE.AdditiveBlending}));
    const sz=kind==='puff'?1.2+Math.random():kind==='conf'?.35:.5; s.scale.set(sz,sz,1); s.position.copy(pos);
    const sp=kind==='conf'?9:kind==='puff'?2:7; s.v=new THREE.Vector3((Math.random()-.5)*sp,(kind==='puff'?.6:Math.random()*sp*.9)+(kind==='conf'?6:0),(Math.random()-.5)*sp);
    s.life=kind==='conf'?2.6:kind==='puff'?1.1:.8; s.age=0; s.kind=kind; s.sz=sz; W.sc.add(s); W.fx.push(s); }
}

// ---------- animation ----------
function frame(W,dt){
  W.t+=dt; const me=W.cars[0], rm=reduce();
  W.cars.forEach((c,i)=>{ const goal=c.target*SEG; const d=goal-c.pos; c.vel+=(d*3.2-c.vel*2.6)*dt; c.pos+=c.vel*dt; // spring towards the goal
    const creep=W.done||c.target>=(c.cap||0)?0:.9*dt; c.pos+=creep; c.target+=creep/SEG;
    c.position.z=-c.pos+c.z; c.position.x+=((c.lane+(i?Math.sin(W.t*.7+i)*.25:0))-c.position.x)*Math.min(1,dt*3);
    const speed=Math.abs(c.vel)+6; c.wheels.forEach(w=>w.rotation.x-=speed*dt*.9);
    c.position.y=Math.abs(Math.sin(W.t*18+i))*.03*Math.min(1,speed/20);
    if(c.spin>0){ const a=Math.min(c.spin,dt*7.5); c.rotation.y+=a; c.spin-=a; if(c.spin<=0) c.rotation.y=0; }
    else c.rotation.z=-Math.max(-.06,Math.min(.06,(c.lane-c.position.x)*.05)); });
  // flame behind you while boosting
  const boost=Math.max(0,me.vel-14)/30; W.flame.material.opacity=Math.min(1,boost*1.4); W.flame.position.set(me.position.x,.75,me.position.z+2.6); W.flame.scale.setScalar(1.2+boost*1.8+Math.sin(W.t*40)*.15);
  if(boost>.25&&Math.random()<.5) burst(W,new THREE.Vector3(me.position.x+(Math.random()-.5)*.8,.6,me.position.z+2.6),'ok',1);
  // camera
  const cam=W.cam, mode=W.mode||'race';
  if(mode==='intro'){ const a=W.t*.25; cam.position.set(me.position.x+Math.sin(a)*13,5+Math.sin(W.t*.4)*.8,me.position.z+Math.cos(a)*13); cam.lookAt(me.position.x-1,1.2,me.position.z-1); }
  else if(mode==='finish'){ const a=-.9+Math.min(1,W.ft/3)*1.6; W.ft+=dt; cam.position.lerp(new THREE.Vector3(me.position.x+Math.sin(a)*12,3.6,me.position.z+Math.cos(a)*12),Math.min(1,dt*2)); cam.lookAt(me.position.x,1.4,me.position.z); }
  else { const tgt=new THREE.Vector3(me.position.x*.6,4.4,me.position.z+10.5-boost*2.5); cam.position.lerp(tgt,Math.min(1,dt*4)); cam.lookAt(me.position.x*.7,1.2,me.position.z-9); }
  if(W.shake>0&&!rm){ cam.position.x+=(Math.random()-.5)*W.shake; cam.position.y+=(Math.random()-.5)*W.shake; W.shake=Math.max(0,W.shake-dt*1.6); }
  const fov=60+boost*16+W.fovKick; if(Math.abs(cam.fov-fov)>.05){ cam.fov+=(fov-cam.fov)*Math.min(1,dt*5); cam.updateProjectionMatrix(); } W.fovKick=Math.max(0,W.fovKick-dt*20);
  W.glow.position.set(cam.position.x-120,W.night?120:70,cam.position.z-420); if(W.stars) W.stars.position.set(cam.position.x,0,cam.position.z);
  // speed lines
  const m4=new THREE.Matrix4(), q=new THREE.Quaternion(), s1=new THREE.Vector3(1,1,1);
  W.sl.material.opacity=rm?0:Math.min(.55,boost*.9);
  if(W.sl.material.opacity>0.01) W.slP.forEach((p,i)=>{ p[2]+=dt*(60+boost*90); if(p[2]>14) p[2]-=50; m4.compose(new THREE.Vector3(me.position.x+p[0],p[1],me.position.z+p[2]-30),q,s1); W.sl.setMatrixAt(i,m4); });
  W.sl.instanceMatrix.needsUpdate=true;
  // gates you drove through light up
  W.gates.forEach(g=>{ if(!g.passed&&me.position.z<g.position.z-1&&g.res!==undefined){ g.passed=true; g.light.color.set(g.res?0x58CC02:0xFF4D4D); burst(W,new THREE.Vector3(0,5.8,g.position.z),g.res?'ok':'bad',g.res?40:16); if(g.res) W.fovKick=6; } });
  // particles
  for(let i=W.fx.length-1;i>=0;i--){ const p=W.fx[i]; p.age+=dt; if(p.age>=p.life){ W.sc.remove(p); p.material.dispose(); W.fx.splice(i,1); continue; }
    p.v.y-=(p.kind==='conf'?6:p.kind==='puff'?-.6:9)*dt; if(p.kind==='conf'){ p.v.x*=.985; p.v.z*=.985; } p.position.addScaledVector(p.v,dt);
    const k=p.age/p.life; p.material.opacity=1-k; if(p.kind==='puff') p.scale.setScalar(p.sz*(1+k*2.4)); }
  // sea shimmer
  W.sea.material.shininess=80+Math.sin(W.t*.8)*20;
  hud(W);
}
function place(W){ const me=W.cars[0]; return 1+W.cars.slice(1).filter(c=>c.target>me.target+1e-6).length; }
function hud(W){ if(!W.hud) return; W.hud.style.display=W.mode==='intro'?'none':''; const p=place(W); if(W._p===p&&W._q===W.qi) return; W._p=p; W._q=W.qi;
  const L=W.o.lang==='en'; W.hud.innerHTML=`<span class="q3dpos p${p}">${['🥇','🥈','🥉','4️⃣'][p-1]} ${L?['1st','2nd','3rd','4th'][p-1]:['الأول','التاني','التالت','الرابع'][p-1]}</span>`; }

// ================= World 2: "Get the clinic ready" =================
// An empty, dusty reception full of boxes. Every right answer unpacks one piece into place (desk, sign, lights,
// sofa, plants...) and the room gets brighter; a wrong answer leaves that box where it is. Original low-poly room.
function mat(c,o){ return new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.6,metalness:.05},o||{})); }
function box(w,h,d,m,x,y,z){ const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); b.position.set(x||0,y||0,z||0); return b; }
function cyl(rt,rb,h,m,x,y,z,seg){ const c=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg||14),m); c.position.set(x||0,y||0,z||0); return c; }
function marbleTex(){ const t=canvasTex(512,512,(x,w,h)=>{ x.fillStyle='#EEF0F3'; x.fillRect(0,0,w,h); x.strokeStyle='rgba(150,160,175,.25)';
  for(let i=0;i<26;i++){ x.lineWidth=.6+Math.random()*1.6; x.beginPath(); let px=Math.random()*w, py=Math.random()*h; x.moveTo(px,py); for(let k=0;k<8;k++){ px+=(Math.random()-.3)*70; py+=(Math.random()-.5)*50; x.lineTo(px,py); } x.stroke(); }
  x.strokeStyle='rgba(120,130,150,.35)'; x.lineWidth=2; for(let g=0;g<=w;g+=128){ x.beginPath(); x.moveTo(g,0); x.lineTo(g,h); x.stroke(); x.beginPath(); x.moveTo(0,g); x.lineTo(w,g); x.stroke(); } });
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(4,3); return t; }
function screenTex(lang){ return canvasTex(512,288,(x,w,h)=>{ const g=x.createLinearGradient(0,0,w,h); g.addColorStop(0,'#1F5A8C'); g.addColorStop(1,'#2E8BC9'); x.fillStyle=g; x.fillRect(0,0,w,h);
  x.fillStyle='rgba(255,255,255,.12)'; for(let i=0;i<6;i++){ x.beginPath(); x.arc(Math.random()*w,Math.random()*h,30+Math.random()*60,0,7); x.fill(); }
  x.fillStyle='#fff'; x.textAlign='center'; x.font='800 54px Tahoma, Arial'; x.direction=lang==='en'?'ltr':'rtl'; x.fillText(lang==='en'?'Welcome':'أهلاً بيك',w/2,h/2); x.font='600 26px Tahoma, Arial'; x.fillText(lang==='en'?'Free consultation every day':'استشارة مجانية كل يوم',w/2,h/2+50); }); }
function artTex(a,b){ return canvasTex(128,160,(x,w,h)=>{ x.fillStyle='#FAF6EF'; x.fillRect(0,0,w,h); x.fillStyle=a; x.beginPath(); x.arc(w*.4,h*.45,34,0,7); x.fill(); x.fillStyle=b; x.beginPath(); x.ellipse(w*.62,h*.6,28,44,.5,0,7); x.fill(); }); }

// The pieces, in the order they arrive. Each returns a Group placed at its spot (y = 0 is the floor).
const CLINIC_PIECES=[
 ['desk',W=>{ const g=new THREE.Group(), white=mat(0xF7F7F5), wood=mat(0xB98A5E,{roughness:.45}), orange=mat(0xF26B1D,{emissive:0xF26B1D,emissiveIntensity:.25});
   g.add(box(6,1.1,1.2,white,0,.55,0), box(6.3,.12,1.5,wood,0,1.16,0), box(6,.12,.05,orange,0,.7,.63), box(1.6,1.1,2.4,white,-2.2,.55,-1.2));
   return [g,0,0,1.2]; }],
 ['sign',W=>{ const g=new THREE.Group(); g.add(box(7,2.4,.2,mat(0x14294B),0,0,0));
   const s=new THREE.Mesh(new THREE.PlaneGeometry(6.4,1.6),new THREE.MeshBasicMaterial({map:labelTex(W.o.lang==='en'?'H&P Medical Center':'مركز H&P الطبي','rgba(0,0,0,0)','#FFFFFF',W.o.lang!=='en'),transparent:true})); s.position.z=.11; g.add(s);
   const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:W.glowT,color:0x7FC4FF,transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending})); glow.scale.set(10,4.5,1); glow.position.z=.05; g.add(glow);
   return [g,0,3.3,-5.85]; }],
 ['lights',W=>{ const g=new THREE.Group(), m=mat(0x222428), bulb=new THREE.MeshBasicMaterial({color:0xFFE9B8});
   [-3,0,3].forEach(x=>{ g.add(cyl(.02,.02,1.6,m,x,5.2,0,4)); const sh=new THREE.Mesh(new THREE.ConeGeometry(.55,.6,18,1,true),mat(0xF26B1D,{side:THREE.DoubleSide})); sh.position.set(x,4.15,0); g.add(sh);
     const b=new THREE.Mesh(new THREE.SphereGeometry(.18,10,8),bulb); b.position.set(x,3.95,0); g.add(b);
     const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:W.glowT,color:0xFFD38A,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending})); gl.scale.set(2.6,2.6,1); gl.position.set(x,3.8,0); g.add(gl); });
   const pl=new THREE.PointLight(0xFFD9A0,0,16,1.6); pl.position.set(0,3.6,0); g.add(pl); g.userData.light=pl;
   return [g,0,0,1.2]; }],
 ['sofa',W=>{ const g=new THREE.Group(), f=mat(0x2E8BC9,{roughness:.9}), leg=mat(0x333333);
   g.add(box(4,.55,1.5,f,0,.55,0), box(4,1.1,.4,f,0,1.05,-.55), box(.4,.8,1.5,f,-1.9,.75,0), box(.4,.8,1.5,f,1.9,.75,0));
   [-1.1,1.1].forEach(x=>{ const c=box(1.7,.25,1.1,mat(0x3B9BD8,{roughness:.95}),x,.92,.1); g.add(c); });
   [[-1.8,-.6],[1.8,-.6],[-1.8,.6],[1.8,.6]].forEach(([x,z])=>g.add(cyl(.06,.06,.3,leg,x,.15,z,6)));
   g.rotation.y=Math.PI/2; return [g,-6.2,0,1.6]; }],
 ['plants',W=>{ const g=new THREE.Group(); [[-7,-4.8],[7,-4.8]].forEach(([x,z])=>{ const p=new THREE.Group(); p.add(cyl(.55,.42,1.1,mat(0xF4EDE2),0,.55,0));
   const leaf=mat(0x3FA05A,{roughness:.8}); for(let i=0;i<9;i++){ const l=new THREE.Mesh(new THREE.SphereGeometry(.5,8,6),leaf); l.scale.set(.5,1.4,.25); const a=i/9*Math.PI*2; l.position.set(Math.cos(a)*.35,1.6+Math.random()*.6,Math.sin(a)*.35); l.rotation.set(Math.sin(a)*.5,a,Math.cos(a)*.5); p.add(l); }
   p.position.set(x,0,z); g.add(p); }); return [g,0,0,0]; }],
 ['tv',W=>{ const g=new THREE.Group(); g.add(box(3.6,2.1,.12,mat(0x111111,{roughness:.3}),0,0,0)); const s=new THREE.Mesh(new THREE.PlaneGeometry(3.4,1.9),new THREE.MeshBasicMaterial({map:screenTex(W.o.lang)})); s.position.z=.07; g.add(s);
   g.rotation.y=-Math.PI/2; return [g,7.85,2.9,-1.5]; }],
 ['table',W=>{ const g=new THREE.Group(), wood=mat(0xB98A5E,{roughness:.45}); g.add(cyl(.9,.9,.1,wood,0,.6,0,24), cyl(.08,.12,.55,mat(0x222222),0,.3,0,8));
   g.add(box(.6,.04,.8,mat(0xF26B1D),-.2,.67,.1), box(.6,.04,.8,mat(0x2E8BC9),.15,.71,-.1)); return [g,-4.2,0,1.6]; }],
 ['chairs',W=>{ const g=new THREE.Group(); [-1.3,1.3].forEach(x=>{ const f=mat(0xF26B1D,{roughness:.9}); const c=new THREE.Group(); c.add(box(1.2,.5,1.1,f,0,.5,0), box(1.2,.9,.25,f,0,1,-.45), box(.2,.6,1.1,f,-.6,.7,0), box(.2,.6,1.1,f,.6,.7,0)); c.position.x=x; c.rotation.y=Math.PI; g.add(c); });
   return [g,-4.2,0,3.6]; }],
 ['rug',W=>{ const t=canvasTex(256,256,(x,w,h)=>{ x.fillStyle='#E8DCC8'; x.fillRect(0,0,w,h); x.strokeStyle='#14294B'; x.lineWidth=10; x.strokeRect(14,14,w-28,h-28); x.strokeStyle='#F26B1D'; x.lineWidth=4; x.strokeRect(34,34,w-68,h-68); });
   const r=new THREE.Mesh(new THREE.PlaneGeometry(4.6,3.6),new THREE.MeshStandardMaterial({map:t,roughness:1})); r.rotation.x=-Math.PI/2; r.position.y=.015; const g=new THREE.Group(); g.add(r); return [g,-4.4,0,2.2]; }],
 ['flowers',W=>{ const g=new THREE.Group(); g.add(cyl(.18,.12,.5,mat(0xFFFFFF,{roughness:.2}),0,.25,0)); const cols=[0xE24B8B,0xFFD34D,0xF26B1D,0xFFFFFF];
   for(let i=0;i<7;i++){ const s=cyl(.015,.015,.6,mat(0x3FA05A),(Math.random()-.5)*.2,.7,(Math.random()-.5)*.2,4); g.add(s); const b=new THREE.Mesh(new THREE.SphereGeometry(.11,8,6),mat(cols[i%4])); b.position.set(s.position.x*2,1.02+Math.random()*.1,s.position.z*2); g.add(b); }
   return [g,2.2,1.22,1.1]; }],
 ['art',W=>{ const g=new THREE.Group(); [[-1.2,0x2E8BC9,0xF26B1D],[1.2,0xF26B1D,0x14294B]].forEach(([x,a,b])=>{ g.add(box(1.7,2.1,.08,mat(0xB98A5E),x,0,0)); const p=new THREE.Mesh(new THREE.PlaneGeometry(1.45,1.85),new THREE.MeshBasicMaterial({map:artTex('#'+a.toString(16).padStart(6,'0'),'#'+b.toString(16).padStart(6,'0'))})); p.position.set(x,0,.05); g.add(p); });
   g.rotation.y=Math.PI/2; return [g,-7.85,2.9,-1]; }],
 ['monitor',W=>{ const g=new THREE.Group(); g.add(box(1.2,.75,.06,mat(0x111111,{roughness:.3}),0,.55,0), box(.1,.3,.1,mat(0x444444),0,.15,0), box(.5,.04,.35,mat(0x444444),0,.02,0));
   const s=new THREE.Mesh(new THREE.PlaneGeometry(1.1,.65),new THREE.MeshBasicMaterial({color:0x7FC4FF})); s.position.set(0,.55,.035); g.add(s); g.rotation.y=Math.PI; return [g,-.8,1.22,.9]; }],
 ['shelf',W=>{ const g=new THREE.Group(), wood=mat(0xF7F7F5); g.add(box(2.6,3.2,.5,wood,0,1.6,0)); [0.7,1.6,2.5].forEach(y=>{ g.add(box(2.4,.06,.45,mat(0xB98A5E),0,y,.02));
   for(let i=0;i<5;i++){ const c=[0xF4EDE2,0x2E8BC9,0xF26B1D,0xE24B8B,0x14294B][(i+y*3|0)%5]; g.add(cyl(.12,.12,.4,mat(c,{roughness:.3}),-.95+i*.47,y+.23,.05,10)); } });
   return [g,4.6,0,-5.5]; }],
 ['water',W=>{ const g=new THREE.Group(); g.add(box(.7,1.3,.6,mat(0xF7F7F5),0,.65,0)); const bt=cyl(.28,.28,.75,new THREE.MeshStandardMaterial({color:0x7FC4FF,transparent:true,opacity:.6,roughness:.1}),0,1.7,0,16); g.add(bt);
   return [g,6.8,0,2.6]; }],
 ['balloons',W=>{ const g=new THREE.Group(), cols=[0xF26B1D,0x2E8BC9,0xFFFFFF,0xFFD34D,0xE24B8B];
   for(let i=0;i<7;i++){ const b=new THREE.Mesh(new THREE.SphereGeometry(.38,14,10),mat(cols[i%5],{roughness:.25})); b.scale.y=1.2; b.position.set((i-3)*.55,3.4+Math.sin(i*1.7)*.35,0); g.add(b); g.add(cyl(.008,.008,2.2,mat(0xdddddd),(i-3)*.2,2.2,0,3)); }
   return [g,3.2,0,1.6]; }]
];
// daily (5) gets the big pieces; monthly (15) gets all of them
const CLINIC_ORDER=['desk','sign','lights','sofa','plants','tv','table','chairs','rug','flowers','art','monitor','shelf','water','balloons'];

function buildClinic(host,o){
  const W={o,host,world:'clinic',fx:[],t:0,qi:-1,pieces:[],built:0,shake:0};
  const ren=new THREE.WebGLRenderer({antialias:(window.devicePixelRatio||1)<2}); ren.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75)); ren.outputEncoding=THREE.sRGBEncoding;
  ren.domElement.className='q3dc'; host.appendChild(ren.domElement); W.ren=ren;
  const sc=new THREE.Scene(); W.sc=sc; sc.background=new THREE.Color(0x1A2433); sc.fog=new THREE.Fog(0x1A2433,22,40);
  W.cam=new THREE.PerspectiveCamera(55,1,.1,100);
  W.hemi=new THREE.HemisphereLight(0xDDEBFF,0x7A6A58,.25); sc.add(W.hemi);
  W.sun=new THREE.DirectionalLight(0xFFF1D6,.25); W.sun.position.set(-6,10,8); sc.add(W.sun);
  W.glowT=glowTex('rgba(255,255,255,1)','rgba(255,255,255,0)'); W.puffTex=glowTex('rgba(255,255,255,.9)','rgba(255,255,255,0)'); W.sparkTex=W.glowT;
  // the room: marble floor, three walls, a window strip with the city, ceiling
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(16,12),new THREE.MeshStandardMaterial({map:marbleTex(),roughness:.35,metalness:.1})); floor.rotation.x=-Math.PI/2; floor.position.z=0; sc.add(floor); W.floor=floor;
  W.wallM=mat(0xBFC4CC,{roughness:.9}); const back=box(16,6,.2,W.wallM,0,3,-6); const left=box(.2,6,12,W.wallM,-8,3,0); const right=box(.2,6,12,W.wallM,8,3,0); sc.add(back,left,right);
  const ceil=box(16,.2,12,mat(0xE6E6E6),0,6,0); sc.add(ceil);
  const strip=box(16,.18,.24,mat(0xF26B1D,{emissive:0xF26B1D,emissiveIntensity:.2}),0,.09,-5.88); sc.add(strip);
  const win=new THREE.Mesh(new THREE.PlaneGeometry(3,2.4),new THREE.MeshBasicMaterial({map:canvasTex(256,160,(x,w,h)=>{ const g=x.createLinearGradient(0,0,0,h); g.addColorStop(0,'#7FC4F0'); g.addColorStop(1,'#FCE8C8'); x.fillStyle=g; x.fillRect(0,0,w,h);
    for(let i=0;i<14;i++){ const bw=10+Math.random()*16, bh=30+Math.random()*90; x.fillStyle=['#C9D7E6','#A9C4DE','#E2E8EF'][i%3]; x.fillRect(i*19,h-bh,bw,bh); } x.strokeStyle='#fff'; x.lineWidth=6; x.strokeRect(0,0,w,h); x.beginPath(); x.moveTo(w/2,0); x.lineTo(w/2,h); x.stroke(); })}));
  win.position.set(-5.7,3.2,-5.89); sc.add(win);
  // boxes and dust where every piece will go
  const cardboard=mat(0xC49A6C,{roughness:.95}), tape=mat(0xE8D7B5);
  const order=CLINIC_ORDER.slice(0,Math.min(o.n,CLINIC_ORDER.length));
  while(order.length<o.n) order.push(CLINIC_ORDER[order.length%CLINIC_ORDER.length]+'#'+order.length);
  order.forEach((id,i)=>{ const def=CLINIC_PIECES.find(p=>p[0]===id.split('#')[0]); const made=def[1](W), g=made[0]; g.position.set(made[1],made[2],made[3]); g.visible=false; sc.add(g);
    const bx=new THREE.Group(), s=.8+Math.random()*.5; bx.add(box(1.2*s,.9*s,1*s,cardboard,0,.45*s,0), box(1.22*s,.06,.25,tape,0,.9*s+.01,0));
    const lab=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTex(String(i+1),'#14294B','#fff',false),depthWrite:false,transparent:true})); lab.scale.set(.9,.24,1); lab.position.y=.9*s+.45; bx.add(lab);
    const fx=Math.max(-6.5,Math.min(6.5,made[1]+(Math.random()-.5)*1.2)), fz=Math.max(-4.5,Math.min(4.5,made[3]+(Math.random()-.5)*1.2+(made[2]>2?2.5:0)));
    bx.position.set(fx,0,fz); bx.rotation.y=(Math.random()-.5)*.8; sc.add(bx);
    W.pieces.push({id,g,bx,state:0,t:0}); });
  // floating dust
  const dg=new THREE.BufferGeometry(), arr=[]; for(let i=0;i<260;i++) arr.push((Math.random()-.5)*15,Math.random()*5.5,(Math.random()-.5)*11);
  dg.setAttribute('position',new THREE.Float32BufferAttribute(arr,3)); W.dust=new THREE.Points(dg,new THREE.PointsMaterial({color:0xD8CFC0,size:.05,transparent:true,opacity:.7,depthWrite:false})); sc.add(W.dust);
  W.hud=document.createElement('div'); W.hud.className='q3dhud'; host.appendChild(W.hud);
  W.focus=new THREE.Vector3(0,1.5,-1); W.camT=new THREE.Vector3(0,4.3,10.5);
  return W;
}
function clinicReady(W){ return W.pieces.filter(p=>p.state===1).length; }
function frameClinic(W,dt){
  W.t+=dt; const rm=reduce(), r=clinicReady(W)/W.pieces.length;
  // the room comes alive as it fills: light, colour, less dust
  const lit=.3+r*.45; W.hemi.intensity+=(lit-W.hemi.intensity)*Math.min(1,dt*2); W.sun.intensity+=(.3+r*.4-W.sun.intensity)*Math.min(1,dt*2);
  W.wallM.color.lerp(new THREE.Color(0xAEB4BE).lerp(new THREE.Color(0xE9E1D5),r),Math.min(1,dt));
  W.sc.background.lerp(new THREE.Color(0x1A2433).lerp(new THREE.Color(0x2A3A55),r),Math.min(1,dt));
  W.dust.material.opacity=.7*(1-r)+.05; W.dust.rotation.y+=dt*.02; W.dust.position.y=Math.sin(W.t*.3)*.15;
  W.pieces.forEach(p=>{ p.t+=dt;
    if(p.state===1){ const k=Math.min(1,p.t/.7), e=k<1?1+Math.sin(k*Math.PI)*.25*(1-k):1; p.g.visible=true; p.g.scale.setScalar(Math.max(.01,(rm?1:k)*e)); p.g.position.y=p.y0+(1-k)*(rm?0:1.6);
      if(p.bx.visible){ p.bx.scale.multiplyScalar(Math.max(0,1-dt*6)); if(p.bx.scale.x<.05) p.bx.visible=false; }
      if(p.g.userData.light) p.g.userData.light.intensity=Math.min(1.6,k*1.6); }
    else if(p.state===0&&W.pieces[W.qi]===p&&W.mode==='play'){ p.bx.position.y=Math.abs(Math.sin(W.t*4))*.18; }
    else if(p.state===-1){ p.bx.position.y=0;  p.bx.rotation.z=p.t<.6?Math.sin(p.t*40)*.08*(1-p.t/.6):0; } });
  // camera: slow sway, leans towards the piece being placed, tours the room at the end
  const cam=W.cam;
  if(W.mode==='intro'){ const a=Math.sin(W.t*.25)*.5; W.camT.set(Math.sin(a)*9,4.6,Math.cos(a)*9+1.5); W.focus.set(0,1.4,-1.5); }
  else if(W.mode==='finish'){ const a=-.7+Math.min(1.4,W.ft*.35); W.ft+=dt; W.camT.set(Math.sin(a)*8.5,3.8,Math.cos(a)*8+1); W.focus.set(0,1.6,-1.5); }
  else { const p=W.pieces[W.qi]; const tgt=p&&p.state===1&&p.t<2.2?p.g.position:null;
    if(tgt){ W.focus.lerp(new THREE.Vector3(tgt.x,Math.max(1,tgt.y+.6),tgt.z),Math.min(1,dt*3)); W.camT.lerp(new THREE.Vector3(tgt.x*.5,3.6,Math.min(9.5,tgt.z+7.5)),Math.min(1,dt*2)); }
    else { W.focus.lerp(new THREE.Vector3(Math.sin(W.t*.2)*.6,1.5,-1.4),Math.min(1,dt*1.5)); W.camT.lerp(new THREE.Vector3(Math.sin(W.t*.15)*1.6,4.4,10.2),Math.min(1,dt*1.5)); } }
  const nar=cam.aspect<1, fv=nar?76:56; if(Math.abs(cam.fov-fv)>.1){ cam.fov=fv; cam.updateProjectionMatrix(); } if(nar) W.camT.z-=1.2;
  cam.position.lerp(W.camT,Math.min(1,dt*2.5)); cam.lookAt(W.focus); if(nar) W.camT.z+=1.2;
  if(W.shake>0&&!rm){ cam.position.x+=(Math.random()-.5)*W.shake*.5; W.shake=Math.max(0,W.shake-dt*1.5); }
  for(let i=W.fx.length-1;i>=0;i--){ const p=W.fx[i]; p.age+=dt; if(p.age>=p.life){ W.sc.remove(p); p.material.dispose(); W.fx.splice(i,1); continue; }
    p.v.y-=(p.kind==='conf'?5:p.kind==='puff'?-.4:7)*dt; p.position.addScaledVector(p.v,dt); const k=p.age/p.life; p.material.opacity=1-k; if(p.kind==='puff') p.scale.setScalar(p.sz*(1+k*2)); }
  if(W.hud){ W.hud.style.display=W.mode==='intro'?'none':''; const n=clinicReady(W), L=W.o.lang==='en'; if(W._n!==n){ W._n=n; W.hud.innerHTML=`<span class="q3dpos ${n===W.pieces.length?'p1':''}">🏥 ${n}/${W.pieces.length} ${L?'ready':'جاهز'}</span>`; } }
}
const CLINIC={
  question(i){ W.mode='play'; W.qi=i; },
  answer(ok){ const p=W.pieces[W.qi]; if(!p) return; p.t=0;
    if(ok){ p.state=1; p.y0=p.g.position.y; burst(W,new THREE.Vector3(p.bx.position.x,.8,p.bx.position.z),'puff',8); setTimeout(()=>W&&burst(W,new THREE.Vector3(p.g.position.x,p.y0+1,p.g.position.z),'ok',36),350); }
    else { p.state=-1; W.shake=.5; burst(W,new THREE.Vector3(p.bx.position.x,1,p.bx.position.z),'bad',10); } },
  finish(){ W.mode='finish'; W.ft=0; const n=clinicReady(W), all=n===W.pieces.length;
    setTimeout(()=>{ if(!W) return; for(let i=0;i<4;i++) setTimeout(()=>W&&burst(W,new THREE.Vector3((Math.random()-.5)*8,4.5,(Math.random()-.5)*4),'conf',all?70:35),i*350); },900); return 0; },
  summary(){ return {world:'clinic',built:clinicReady(W),total:W.pieces.length}; }
};

// ---------- public API ----------
let W=null, raf=0, last=0, ro=null;
function loop(t){ raf=requestAnimationFrame(loop); if(!W) return; const dt=Math.min(.05,(t-(last||t))/1000); last=t; if(document.hidden) return;
  if(W.world==='clinic') frameClinic(W,dt); else frame(W,dt); W.ren.render(W.sc,W.cam); }
function size(){ if(!W) return; const r=W.host.getBoundingClientRect(); const w=Math.max(1,r.width), h=Math.max(1,r.height); W.ren.setSize(w,h,false); W.cam.aspect=w/h; W.cam.updateProjectionMatrix(); }
const API={
  // host: element to draw in; o: {world:'race'|'clinic', n, night, rivals:[names], me, av, lang}
  async mount(host,o){ API.unmount(); if(!host||!glOk()) return false; const ok=await load(); if(!ok||!host.isConnected) return false;
    try{ W=o.world==='clinic'?buildClinic(host,o):build(host,o); }catch(e){ console.warn('quiz3d',e); API.unmount(); return false; }
    W.mode='intro'; size(); ro=window.ResizeObserver?new ResizeObserver(size):null; if(ro) ro.observe(host); else window.addEventListener('resize',size);
    last=0; raf=requestAnimationFrame(loop); host.classList.add('on'); return true; },
  ready(){ return !!W; },
  // a new question: put its gate ahead of you
  question(i){ if(!W) return; if(W.world==='clinic') return CLINIC.question(i); W.mode='race'; W.qi=i; W.cars.forEach(c=>{ c.cap=c.target+.55; }); if(!W.gates[i]) gate(W,-(W.cars[0].target+1)*SEG,(W.o.lang==='en'?'Q ':'س ')+(i+1)); },
  answer(ok){ if(!W) return; if(W.world==='clinic') return CLINIC.answer(ok); const me=W.cars[0], g=W.gates[W.qi]; if(g) g.res=!!ok;
    W.cars.forEach(c=>{ c.cap=0; }); me.target+=ok?OK_STEP:BAD_STEP; W.cars.slice(1).forEach(c=>{ c.target+=c.pace*(.94+Math.random()*.12); });
    if(ok){ me.vel+=26; W.fovKick=4; } else { me.spin=Math.PI*2; W.shake=.6; for(let i=0;i<10;i++) setTimeout(()=>W&&burst(W,new THREE.Vector3(me.position.x,.5,me.position.z+1.5),'puff',2),i*60); } },
  place(){ return W&&W.world!=='clinic'?place(W):0; },
  summary(){ return !W?null:W.world==='clinic'?CLINIC.summary():{world:'race',place:place(W)}; },
  // all cars roll over the finish line in their final order
  finish(txt){ if(!W) return 0; if(W.world==='clinic') return CLINIC.finish(); const p=place(W), lead=Math.max(...W.cars.map(c=>c.target)); finishGate(W,-(lead+.9)*SEG,txt||'FINISH');
    W.cars.forEach(c=>{ c.target+=1.6; }); W.done=true; W.mode='finish'; W.ft=0;
    setTimeout(()=>{ if(!W) return; const me=W.cars[0]; for(let i=0;i<4;i++) setTimeout(()=>W&&burst(W,new THREE.Vector3(me.position.x+(Math.random()-.5)*8,6+Math.random()*3,me.position.z-2),'conf',p===1?70:40),i*350); },1300);
    return p; },
  unmount(){ cancelAnimationFrame(raf); raf=0; if(ro){ ro.disconnect(); ro=null; } window.removeEventListener('resize',size);
    if(W){ try{ W.sc.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{ if(m.map) m.map.dispose(); m.dispose(); }); } }); W.ren.dispose(); if(W.ren.forceContextLoss) W.ren.forceContextLoss(); }catch(e){}
      if(W.ren.domElement.parentNode) W.ren.domElement.remove(); if(W.hud&&W.hud.parentNode) W.hud.remove(); if(W.host) W.host.classList.remove('on'); }
    W=null; }
};
window.QZ3D=API;
})();
