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
  const th=o.theme||(o.night?'night':'coast'), night=th==='night', desert=th==='desert', rain=th==='rain', W={o,host,night,desert,rain,cars:[],gates:[],fx:[],t:0,shake:0,fovKick:0,done:false,qi:0};
  const ren=new THREE.WebGLRenderer({antialias:(window.devicePixelRatio||1)<2,alpha:false,powerPreference:'high-performance'});
  ren.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75)); ren.outputEncoding=THREE.sRGBEncoding;
  ren.domElement.className='q3dc'; host.appendChild(ren.domElement); W.ren=ren;
  const sc=new THREE.Scene(); W.sc=sc;
  const skyTop=night?'#0B1430':desert?'#3E4E8C':rain?'#59626F':'#5FA8E8', skyMid=night?'#1E2D5C':desert?'#E07A5A':rain?'#8C95A0':'#BFE0F7', skyLow=night?'#3A3F6E':desert?'#FFC67A':rain?'#B9BEC4':'#FCE8C8';
  sc.background=canvasTex(4,256,(x,w,h)=>{ const g=x.createLinearGradient(0,0,0,h); g.addColorStop(0,skyTop); g.addColorStop(.55,skyMid); g.addColorStop(1,skyLow); x.fillStyle=g; x.fillRect(0,0,w,h); });
  sc.fog=new THREE.Fog(night?0x2A2F58:desert?0xF2A877:rain?0x9AA2AB:0xF3DDBD,rain?40:90,night?380:rain?260:460);
  const cam=new THREE.PerspectiveCamera(60,1,.5,900); W.cam=cam;
  sc.add(new THREE.HemisphereLight(night?0x6A7BD8:0xDFF1FF,night?0x2A1E3A:0xD9B27A,night?.75:1.05));
  const sun=new THREE.DirectionalLight(night?0x9FB4FF:0xFFF1D6,night?.45:1.1); sun.position.set(-40,80,30); sc.add(sun);

  const len=(o.n*OK_STEP+6)*SEG; W.len=len;
  // ground, sea and road
  const sand=new THREE.Mesh(new THREE.PlaneGeometry(260,len+400),new THREE.MeshLambertMaterial({color:night?0x6B5B70:desert?0xE0A060:rain?0x7E8B6A:0xE6C48E}));
  sand.rotation.x=-Math.PI/2; sand.position.set(40,-.02,-len/2+120); sc.add(sand);
  const sea=new THREE.Mesh(new THREE.PlaneGeometry(600,len+600),new THREE.MeshPhongMaterial({color:night?0x1B2E5E:0x2FA3C7,shininess:90,specular:night?0x556699:0xFFFFFF}));
  sea.rotation.x=-Math.PI/2; sea.position.set(-390,-.4,-len/2+120); sc.add(sea); W.sea=sea; if(desert){ sea.material.color.set(0xD99456); sea.material.shininess=0; sea.material.specular.set(0x000000); }
  const beach=new THREE.Mesh(new THREE.PlaneGeometry(14,len+400),new THREE.MeshLambertMaterial({color:night?0x8C7A86:0xF4DDB0}));
  beach.rotation.x=-Math.PI/2; beach.position.set(-96,0,-len/2+120); sc.add(beach); if(desert) beach.visible=false;
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
  if(desert){ const d2=new THREE.InstancedMesh(duneG,duneM,nDune); for(let i=0;i<nDune;i++){ m4.compose(v.set(-40-Math.random()*70,-.5,60-i*45-Math.random()*20),new THREE.Quaternion(),new THREE.Vector3(16+Math.random()*18,5+Math.random()*9,12+Math.random()*12)); d2.setMatrixAt(i,m4); } sc.add(d2); duneM.color.set(0xE8A868); }
  if(rain){ const rg=new THREE.BufferGeometry(), ra=[]; for(let i=0;i<700;i++){ const x=(Math.random()-.5)*40, y=Math.random()*20, z=(Math.random()-.5)*60; ra.push(x,y,z,x+.05,y-.9,z+.3); }
    rg.setAttribute('position',new THREE.Float32BufferAttribute(ra,3)); W.rainL=new THREE.LineSegments(rg,new THREE.LineBasicMaterial({color:0xDDE6F0,transparent:true,opacity:.45})); sc.add(W.rainL); road.material.color.set(0x2E323C); }
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
  const boost=Math.max(0,me.vel-14)/30; engineSet(Math.abs(me.vel)+8); W.flame.material.opacity=Math.min(1,boost*1.4); W.flame.position.set(me.position.x,.75,me.position.z+2.6); W.flame.scale.setScalar(1.2+boost*1.8+Math.sin(W.t*40)*.15);
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
  if(!W.desert) W.sea.material.shininess=80+Math.sin(W.t*.8)*20;
  if(W.rainL){ W.rainL.position.set(me.position.x,0,me.position.z-8); W.rainL.position.y=-((W.t*22)%20)+10; }
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
     const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:W.glowT,color:0xFFD38A,transparent:true,opacity:.45,depthWrite:false,blending:THREE.AdditiveBlending})); gl.scale.set(2,2,1); gl.position.set(x,3.8,0); g.add(gl); });
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

// ================= Original characters =================
// "Misho": a chubby orange cat in a navy apron who sweeps and tidies. "Zizi": a small lavender mouse in a striped
// scarf who runs through and knocks things over when an answer is wrong. "Laila": a girl in hijab who is cold at first
// and gets happier with every fix in the home world. All original designs.
function eye(x,y,z,s){ const g=new THREE.Group(); const w=new THREE.Mesh(new THREE.SphereGeometry(.11*s,10,8),new THREE.MeshBasicMaterial({color:0xffffff})); w.scale.z=.5; g.add(w);
  const p=new THREE.Mesh(new THREE.SphereGeometry(.065*s,10,8),new THREE.MeshBasicMaterial({color:0x1A1A1A})); p.position.z=.04*s; g.add(p);
  const h=new THREE.Mesh(new THREE.SphereGeometry(.02*s,6,6),new THREE.MeshBasicMaterial({color:0xffffff})); h.position.set(.02*s,.025*s,.075*s); g.add(h); g.position.set(x,y,z); return g; }
function smile(r,m){ const t=new THREE.Mesh(new THREE.TorusGeometry(r,r*.18,6,14,Math.PI),m); t.rotation.z=Math.PI; return t; }
function makeMisho(){
  const g=new THREE.Group(), fur=mat(0xF39A3D,{roughness:.85}), cream=mat(0xFFE7C2,{roughness:.9}), navy=mat(0x14294B), pink=mat(0xF49AB0), dark=new THREE.MeshBasicMaterial({color:0x2A1A12});
  const body=new THREE.Mesh(new THREE.SphereGeometry(.62,16,12),fur); body.scale.set(1,1.15,.9); body.position.y=.78; g.add(body);
  const belly=new THREE.Mesh(new THREE.SphereGeometry(.45,14,10),cream); belly.scale.set(1,1.1,.6); belly.position.set(0,.72,.36); g.add(belly);
  const apron=box(.8,.62,.06,navy,0,.68,.5); g.add(apron); g.add(box(.26,.16,.04,mat(0xF26B1D),0,.6,.54));
  const head=new THREE.Group(); head.position.y=1.72; g.add(head);
  const hd=new THREE.Mesh(new THREE.SphereGeometry(.55,18,14),fur); hd.scale.set(1.12,.95,.95); head.add(hd);
  const muzzle=new THREE.Mesh(new THREE.SphereGeometry(.26,12,10),cream); muzzle.scale.set(1.3,.8,.7); muzzle.position.set(0,-.14,.42); head.add(muzzle);
  const nose=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),pink); nose.position.set(0,-.06,.6); head.add(nose);
  head.add(eye(-.2,.08,.46,1.2), eye(.2,.08,.46,1.2)); const mouth=smile(.09,dark); mouth.position.set(0,-.2,.6); head.add(mouth);
  [-1,1].forEach(s=>{ const ear=new THREE.Mesh(new THREE.ConeGeometry(.2,.38,4),fur); ear.position.set(.34*s,.5,0); ear.rotation.z=-.35*s; head.add(ear);
    const inner=new THREE.Mesh(new THREE.ConeGeometry(.11,.22,4),pink); inner.position.set(.34*s,.47,.06); inner.rotation.z=-.35*s; head.add(inner);
    for(let k=0;k<2;k++){ const wsk=box(.34,.012,.012,dark,.38*s,-.12-k*.06,.5); wsk.rotation.z=(k?-.12:.12)*s; head.add(wsk); } });
  const legs=[]; [-.28,.28].forEach(x=>{ const l=new THREE.Mesh(new THREE.SphereGeometry(.2,10,8),fur); l.scale.set(1,.7,1.3); l.position.set(x,.14,.1); g.add(l); legs.push(l); });
  const arms=[]; [-1,1].forEach(s=>{ const a=new THREE.Group(); a.position.set(.58*s,1.05,.1); const m=new THREE.Mesh((THREE.CapsuleGeometry?new THREE.CapsuleGeometry(.12,.4,4,8):new THREE.CylinderGeometry(.12,.12,.6,8)),fur); m.position.y=-.25; a.add(m); g.add(a); arms.push(a); });
  const tailC=new THREE.CatmullRomCurve3([new THREE.Vector3(0,.4,-.5),new THREE.Vector3(.3,.6,-.85),new THREE.Vector3(.2,1.2,-.95),new THREE.Vector3(.45,1.45,-.8)]);
  const tail=new THREE.Mesh(new THREE.TubeGeometry(tailC,16,.09,8),fur); g.add(tail);
  // broom in the right paw
  const broom=new THREE.Group(); broom.add(cyl(.035,.035,1.7,mat(0xB98A5E),0,.2,0,6)); const br=new THREE.Mesh(new THREE.ConeGeometry(.28,.45,10),mat(0xE8C35A,{roughness:1})); br.position.y=-.75; br.rotation.x=Math.PI; br.scale.z=.45; broom.add(br);
  broom.position.set(0,-.45,.15); broom.rotation.x=.3; arms[1].add(broom);
  g.scale.setScalar(.9);
  const C={g,head,arms,legs,tail,body,broom,state:'idle',t:0,tx:0,tz:0,face:0,cb:null};
  C.walkTo=(x,z,cb)=>{ C.tx=x; C.tz=z; C.state='walk'; C.cb=cb; };
  C.sweep=(dur,cb)=>{ C.state='sweep'; C.t=0; C.dur=dur; C.cb=cb; };
  C.cheer=()=>{ C.state='cheer'; C.t=0; }; C.shrug=()=>{ C.state='shrug'; C.t=0; };
  C.update=(W,dt)=>{ C.t+=dt; const T=W.t; C.head.rotation.z=Math.sin(T*1.3)*.05; C.tail.rotation.y=Math.sin(T*2)*.25; C.body.scale.y=1.15+Math.sin(T*2.4)*.02;
    C.arms[0].rotation.x=0; C.arms[1].rotation.z=0;
    if(C.state==='walk'){ const dx=C.tx-g.position.x, dz=C.tz-g.position.z, d=Math.hypot(dx,dz); const sp=3.2*dt;
      g.rotation.y+=((Math.atan2(dx,dz))-g.rotation.y)*Math.min(1,dt*8); if(d<=sp){ g.position.x=C.tx; g.position.z=C.tz; C.state='idle'; const cb=C.cb; C.cb=null; if(cb) cb(); }
      else { g.position.x+=dx/d*sp; g.position.z+=dz/d*sp; } g.position.y=Math.abs(Math.sin(T*12))*.12; C.legs.forEach((l,i)=>l.position.z=.1+Math.sin(T*12+i*Math.PI)*.15); C.arms[0].rotation.x=Math.sin(T*12)*.5; }
    else if(C.state==='sweep'){ const s=Math.sin(C.t*9); C.arms[1].rotation.z=s*.6; C.arms[1].rotation.x=-.6; C.broom.rotation.z=s*.4; g.position.y=Math.abs(s)*.04;
      if(Math.random()<.25) burst(W,new THREE.Vector3(g.position.x+Math.sin(g.rotation.y)*.9+s*.4,.2,g.position.z+Math.cos(g.rotation.y)*.9),'puff',1);
      if(C.t>=C.dur){ C.state='idle'; const cb=C.cb; C.cb=null; if(cb) cb(); } }
    else if(C.state==='cheer'){ g.position.y=Math.max(0,Math.sin(C.t*7))*.5*(C.t<1.4?1:0); C.arms[0].rotation.z=-2.4; C.arms[1].rotation.z=2.4; if(C.t>1.6) C.state='idle'; }
    else if(C.state==='shrug'){ C.head.rotation.x=Math.sin(C.t*3)*.15; C.arms[0].rotation.z=-.9; C.arms[1].rotation.z=.9; g.position.y=0; if(C.t>1.4) C.state='idle'; }
    else { g.position.y=0; g.rotation.y+=((C.face||0)-g.rotation.y)*Math.min(1,dt*3); }
  };
  return C;
}
function makeZizi(){
  const g=new THREE.Group(), fur=mat(0xB9A7D6,{roughness:.85}), pink=mat(0xF7A8C4), dark=new THREE.MeshBasicMaterial({color:0x222222});
  const body=new THREE.Mesh(new THREE.SphereGeometry(.32,14,10),fur); body.scale.set(.9,.8,1.3); body.position.y=.3; g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.24,14,10),fur); head.position.set(0,.5,.38); g.add(head);
  [-1,1].forEach(s=>{ const e=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.03,16),pink); e.rotation.x=Math.PI/2; e.position.set(.2*s,.74,.3); g.add(e); });
  g.add(eye(-.09,.56,.58,.7), eye(.09,.56,.58,.7)); const n=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),pink); n.position.set(0,.47,.62); g.add(n);
  const sc=new THREE.Mesh(new THREE.TorusGeometry(.2,.06,6,14),mat(0xF26B1D)); sc.rotation.x=Math.PI/2; sc.position.set(0,.4,.3); g.add(sc);
  const tc=new THREE.CatmullRomCurve3([new THREE.Vector3(0,.25,-.38),new THREE.Vector3(0,.35,-.8),new THREE.Vector3(.2,.55,-1)]); g.add(new THREE.Mesh(new THREE.TubeGeometry(tc,10,.025,5),pink));
  g.visible=false;
  const Z={g,state:'off',t:0};
  Z.run=(x0,z0,x1,z1,cb,atT,hit)=>{ Z.state='run'; Z.t=0; Z.a=[x0,z0]; Z.b=[x1,z1]; Z.cb=cb; Z.hitT=atT; Z.hit=hit; Z.hitDone=false; g.visible=true; g.rotation.y=Math.atan2(x1-x0,z1-z0); };
  Z.update=(W,dt)=>{ if(Z.state!=='run') return; Z.t+=dt; const k=Math.min(1,Z.t/1.3); g.position.set(Z.a[0]+(Z.b[0]-Z.a[0])*k,Math.abs(Math.sin(Z.t*22))*.1,Z.a[1]+(Z.b[1]-Z.a[1])*k);
    if(!Z.hitDone&&k>=Z.hitT){ Z.hitDone=true; if(Z.hit) Z.hit(); } if(k>=1){ Z.state='off'; g.visible=false; if(Z.cb) Z.cb(); } };
  return Z;
}
function makeLaila(){
  const g=new THREE.Group(), abaya=mat(0x2C3E66,{roughness:.9}), hij=mat(0xD98CA0,{roughness:.9}), skin=mat(0xF1C7A4,{roughness:.8}), dark=new THREE.MeshBasicMaterial({color:0x2A1A12});
  const body=new THREE.Mesh(new THREE.ConeGeometry(.62,1.5,16),abaya); body.position.y=.75; g.add(body);
  const head=new THREE.Group(); head.position.y=1.78; g.add(head);
  const hd=new THREE.Mesh(new THREE.SphereGeometry(.42,18,14),hij); head.add(hd);
  const face=new THREE.Mesh(new THREE.SphereGeometry(.3,16,12),skin); face.scale.set(1,1.12,.7); face.position.set(0,-.03,.24); head.add(face);
  const drape=new THREE.Mesh(new THREE.ConeGeometry(.55,.6,16,1,true),hij); drape.position.y=-.42; head.add(drape);
  head.add(eye(-.11,.03,.42,.85), eye(.11,.03,.42,.85));
  const mouth=smile(.07,dark); mouth.position.set(0,-.15,.45); head.add(mouth);
  const cheeks=[-1,1].map(s=>{ const c=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),new THREE.MeshBasicMaterial({color:0xF07A8C,transparent:true,opacity:0})); c.position.set(.17*s,-.09,.42); head.add(c); return c; });
  const arms=[-1,1].map(s=>{ const a=new THREE.Group(); a.position.set(.36*s,1.35,0); const m=new THREE.Mesh(new THREE.CylinderGeometry(.1,.12,.7,8),abaya); m.position.y=-.3; a.add(m);
    const h=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),skin); h.position.y=-.68; a.add(h); g.add(a); return a; });
  const L={g,head,arms,mouth,cheeks,mood:0,state:'idle',t:0};
  L.happy=()=>{ L.state='jump'; L.t=0; }; L.cold=()=>{ L.state='shiver'; L.t=0; };
  L.update=(W,dt)=>{ L.t+=dt; const T=W.t, m=L.mood, cold=1-m;
    L.mouth.rotation.z=m>.45?Math.PI:0; L.mouth.position.y=m>.45?-.15:-.2; L.cheeks.forEach(c=>c.material.opacity=Math.min(.8,m));
    const hug=Math.max(0,1-m*1.6); // arms hugged in front while cold
    L.arms.forEach((a,i)=>{ const s=i?1:-1; a.rotation.x=-1.2*hug; a.rotation.z=s*(.15+.9*hug*0)+(i?-1:1)*hug*.6; });
    let jx=0; if(cold>.25) jx=Math.sin(T*55)*.018*cold;
    if(L.state==='jump'){ g.position.y=Math.max(0,Math.sin(L.t*8))*.45; L.arms[0].rotation.z=-2.5; L.arms[1].rotation.z=2.5; L.arms.forEach(a=>a.rotation.x=0); if(L.t>1.5) L.state='idle'; }
    else if(L.state==='shiver'){ jx=Math.sin(T*70)*.05; g.position.y=0; if(L.t>1.5) L.state='idle'; }
    else g.position.y=0;
    g.position.x=L.x0+jx; L.head.rotation.z=Math.sin(T*1.1)*.05*(1+m); };
  return L;
}

// ---------- more pieces: treatment room, Laila's cold room, building her house, the garden ----------
function woodTex(c1,c2){ const t=canvasTex(256,256,(x,w,h)=>{ for(let i=0;i<8;i++){ x.fillStyle=i%2?c1:c2; x.fillRect(0,i*32,w,32); x.strokeStyle='rgba(0,0,0,.12)'; x.strokeRect(0,i*32,w,32);
  for(let k=0;k<5;k++){ x.strokeStyle='rgba(80,40,10,.12)'; x.beginPath(); x.moveTo(Math.random()*w,i*32+Math.random()*32); x.lineTo(Math.random()*w,i*32+Math.random()*32); x.stroke(); } x.fillStyle='rgba(0,0,0,.15)'; x.fillRect((i*97)%w,i*32,2,32); } });
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(3,3); return t; }
function grassTex(){ const t=canvasTex(256,256,(x,w,h)=>{ x.fillStyle='#6DBE5A'; x.fillRect(0,0,w,h); for(let i=0;i<900;i++){ x.fillStyle=['#5DAE4C','#7FCC6A','#4E9C40'][i%3]; x.fillRect(Math.random()*w,Math.random()*h,2,5); } });
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(10,10); return t; }
function glowSprite(W,color,sx,sy,op){ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:W.glowT,color,transparent:true,opacity:op==null?.8:op,depthWrite:false,blending:THREE.AdditiveBlending})); s.scale.set(sx,sy||sx,1); return s; }
const SPA_PIECES=[
 ['bed',W=>{ const g=new THREE.Group(); g.add(box(2.2,.7,4.4,mat(0xF7F7F5),0,.35,0), box(2.1,.25,4.2,mat(0xC9B3E6,{roughness:.9}),0,.82,0), box(1.4,.18,.7,mat(0xFFFFFF,{roughness:.9}),0,1.02,-1.6)); return [g,-2.5,0,-1]; }],
 ['laser',W=>{ const g=new THREE.Group(), w=mat(0xF7F7F5,{roughness:.3}); g.add(box(1.1,1.6,.9,w,0,.8,0), box(1,.7,.08,mat(0x111111),0,1.9,.1)); const s=new THREE.Mesh(new THREE.PlaneGeometry(.9,.6),new THREE.MeshBasicMaterial({color:0x7FC4FF})); s.position.set(0,1.9,.15); g.add(s);
   const arm=cyl(.05,.05,1.4,mat(0x777777),.5,2.1,.2,6); arm.rotation.z=-.6; g.add(arm); g.add(cyl(.12,.08,.4,w,1,2.6,.2,10)); g.add(glowSprite(W,0x9FD8FF,1.2)); g.children[g.children.length-1].position.set(0,1.9,.3); return [g,.6,0,-2.6]; }],
 ['mirror',W=>{ const g=new THREE.Group(); g.add(box(2,3,.1,mat(0xD7B46A,{metalness:.6,roughness:.3}),0,0,0)); const m=new THREE.Mesh(new THREE.PlaneGeometry(1.8,2.8),new THREE.MeshStandardMaterial({color:0xCFE3F2,metalness:.9,roughness:.08})); m.position.z=.06; g.add(m); g.rotation.y=-Math.PI/2; return [g,7.85,2.8,0]; }],
 ['lights',CLINIC_PIECES.find(p=>p[0]==='lights')[1]],
 ['plants',CLINIC_PIECES.find(p=>p[0]==='plants')[1]],
 ['towels',W=>{ const g=new THREE.Group(); g.add(box(2.2,2.4,.6,mat(0xF7F7F5),0,1.2,0)); [0.6,1.4].forEach(y=>[0,1,2].forEach(i=>g.add(box(.6,.3,.5,mat([0xC9B3E6,0xFFFFFF,0xF4C6D6][i]),-.7+i*.7,y+.17,.03)))); return [g,4.6,0,-5.5]; }],
 ['candles',W=>{ const g=new THREE.Group(); [-.3,0,.3].forEach((x,i)=>{ g.add(cyl(.08,.08,.3+i*.1,mat(0xFFF6E6),x,.15+i*.05,0,10)); const f=glowSprite(W,0xFFC46B,.5); f.position.set(x,.38+i*.1,0); g.add(f); }); return [g,4.6,2.42,-5.2]; }],
 ['stool',W=>{ const g=new THREE.Group(); g.add(cyl(.4,.4,.15,mat(0xC9B3E6),0,.7,0,16), cyl(.05,.05,.65,mat(0x888888),0,.33,0,6), cyl(.35,.35,.04,mat(0x888888),0,.02,0,12)); return [g,-.4,0,1]; }],
 ['rug',CLINIC_PIECES.find(p=>p[0]==='rug')[1]],
 ['art',CLINIC_PIECES.find(p=>p[0]==='art')[1]],
 ['divider',W=>{ const g=new THREE.Group(); [-1,0,1].forEach(i=>{ const p=box(1,2.6,.06,mat(0xEDE3F5,{roughness:.9}),i*1,1.3,0); p.rotation.y=i*.35; g.add(p); }); return [g,-6,0,2.5]; }],
 ['diffuser',W=>{ const g=new THREE.Group(); g.add(cyl(.18,.25,.5,mat(0xFFFFFF,{roughness:.2}),0,.25,0,12)); g.userData.steam=true; return [g,2.2,0,-4.6]; }],
 ['water',CLINIC_PIECES.find(p=>p[0]==='water')[1]],
 ['flowers',W=>{ const f=CLINIC_PIECES.find(p=>p[0]==='flowers')[1](W); return [f[0],4.2,2.42,-5.3]; }],
 ['balloons',CLINIC_PIECES.find(p=>p[0]==='balloons')[1]]
];
const SPA_ORDER=['bed','laser','mirror','lights','plants','towels','candles','stool','rug','art','divider','diffuser','water','flowers','balloons'];

const HOME_PIECES=[
 ['window',W=>{ const g=new THREE.Group(), fr=mat(0xF2F2F2); g.add(box(3.2,.15,.2,fr,0,1.2,0), box(3.2,.15,.2,fr,0,-1.2,0), box(.15,2.5,.2,fr,-1.55,0,0), box(.15,2.5,.2,fr,1.55,0,0), box(.08,2.4,.15,fr,0,0,0));
   const gl=new THREE.Mesh(new THREE.PlaneGeometry(3,2.3),new THREE.MeshStandardMaterial({color:0xCDE8F7,transparent:true,opacity:.35,metalness:.5,roughness:.05})); g.add(gl); g.userData.window=true; return [g,0,3.2,-5.86]; }],
 ['heater',W=>{ const g=new THREE.Group(), st=mat(0x9C5B3B,{roughness:.9}), dk=mat(0x2A1E18); g.add(box(2.6,2.2,.8,st,0,1.1,0), box(1.6,1.2,.3,dk,0,.75,.3), box(3,.2,1,mat(0x6E3E28),0,2.25,0));
   const fire=new THREE.Group(); fire.position.set(0,.5,.38); for(let i=0;i<5;i++){ const f=new THREE.Mesh(new THREE.ConeGeometry(.16+Math.random()*.08,.6+Math.random()*.3,6),new THREE.MeshBasicMaterial({color:[0xFFB32B,0xFF6A1F,0xFFD84D][i%3]})); f.position.set(-.45+i*.22,.2,0); fire.add(f); } g.add(fire); g.userData.fire=fire;
   const gl=glowSprite(W,0xFF9A3C,3.4,2.6,.9); gl.position.set(0,.9,.6); g.add(gl); const pl=new THREE.PointLight(0xFF9A3C,0,14,1.5); pl.position.set(0,1.2,1.5); g.add(pl); g.userData.light=pl; g.rotation.y=Math.PI/2; return [g,-7.5,0,-1]; }],
 ['rug',W=>{ const t=canvasTex(256,256,(x,w,h)=>{ x.fillStyle='#C2503A'; x.fillRect(0,0,w,h); x.strokeStyle='#F2C14E'; x.lineWidth=12; x.strokeRect(16,16,w-32,h-32); for(let i=0;i<6;i++){ x.fillStyle='#F2C14E'; x.beginPath(); x.arc(w/2,h/2,90-i*15,0,7); x.strokeStyle=i%2?'#F2C14E':'#2C3E66'; x.lineWidth=6; x.stroke(); } });
   const r=new THREE.Mesh(new THREE.PlaneGeometry(5,3.6),new THREE.MeshStandardMaterial({map:t,roughness:1})); r.rotation.x=-Math.PI/2; r.position.y=.015; const g=new THREE.Group(); g.add(r); return [g,-3,0,1.2]; }],
 ['bed',W=>{ const g=new THREE.Group(), wd=mat(0xB98A5E); g.add(box(3,.5,4.6,wd,0,.25,0), box(2.9,.45,4.4,mat(0xFFFFFF,{roughness:.9}),0,.72,0), box(3,1.6,.2,wd,0,.8,-2.3), box(2.92,.12,2.8,mat(0x8EC5E8,{roughness:.95}),0,.98,.7), box(1.3,.25,.7,mat(0xFFF4E0),-.65,1.05,-1.7), box(1.3,.25,.7,mat(0xFFF4E0),.65,1.05,-1.7)); return [g,4.8,0,-3.3]; }],
 ['lamp',W=>{ const g=new THREE.Group(); g.add(box(.9,.8,.7,mat(0xB98A5E),0,.4,0), cyl(.06,.1,.6,mat(0x444444),0,1.1,0,8)); const sh=new THREE.Mesh(new THREE.ConeGeometry(.4,.5,16,1,true),mat(0xFFE2A8,{side:THREE.DoubleSide,emissive:0xFFC46B,emissiveIntensity:.5})); sh.position.y=1.55; g.add(sh);
   const gl=glowSprite(W,0xFFD38A,2.2); gl.position.y=1.5; g.add(gl); const pl=new THREE.PointLight(0xFFD38A,0,9,1.6); pl.position.y=1.6; g.add(pl); g.userData.light=pl; return [g,2.6,0,-4.8]; }],
 ['curtains',W=>{ const g=new THREE.Group(), c=mat(0xD98CA0,{roughness:1}); [-2.1,2.1].forEach(x=>{ const p=box(1,3.4,.12,c,x,0,0); g.add(p); }); g.add(cyl(.05,.05,5.4,mat(0x8A6440),0,1.75,0,6).rotateZ(Math.PI/2)); return [g,0,3.2,-5.7]; }],
 ['tea',W=>{ const g=new THREE.Group(), wd=mat(0xB98A5E); g.add(cyl(.7,.7,.08,wd,0,.55,0,20), cyl(.07,.07,.55,wd,0,.27,0,8), cyl(.13,.1,.22,mat(0xFFFFFF),0,.7,0,12)); g.userData.steam=true; return [g,-2.2,0,1.6]; }],
 ['plant',W=>{ const f=CLINIC_PIECES.find(p=>p[0]==='plants')[1](W)[0]; f.children[1].visible=false; return [f,-.8,0,0]; }],
 ['picture',W=>{ const g=new THREE.Group(); g.add(box(2,1.5,.08,mat(0xB98A5E),0,0,0)); const p=new THREE.Mesh(new THREE.PlaneGeometry(1.8,1.3),new THREE.MeshBasicMaterial({map:canvasTex(180,130,(x,w,h)=>{ const gr=x.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#8EC5E8'); gr.addColorStop(1,'#F9E3B5'); x.fillStyle=gr; x.fillRect(0,0,w,h); x.fillStyle='#5DAE4C'; x.beginPath(); x.ellipse(60,h,90,40,0,0,7); x.fill(); x.fillStyle='#F2C14E'; x.beginPath(); x.arc(140,35,16,0,7); x.fill(); })})); p.position.z=.05; g.add(p); g.rotation.y=-Math.PI/2; return [g,7.85,3,1.5]; }],
 ['books',W=>{ const g=new THREE.Group(); g.add(box(2.2,2.8,.5,mat(0xB98A5E),0,1.4,0)); [.6,1.4,2.2].forEach(y=>{ for(let i=0;i<7;i++) g.add(box(.2,.55,.35,mat([0xC2503A,0x2C3E66,0xF2C14E,0x5DAE4C,0xD98CA0][(i+y*2|0)%5]),-.8+i*.26,y+.28,.05)); }); return [g,-4.6,0,-5.5]; }],
 ['cushions',W=>{ const g=new THREE.Group(); [0xF2C14E,0x2C3E66,0xD98CA0].forEach((c,i)=>{ const s=new THREE.Mesh(new THREE.SphereGeometry(.4,10,8),mat(c,{roughness:1})); s.scale.set(1,.55,1); s.position.set(i*.8-.8,.22,0); g.add(s); }); return [g,-3,0,2.4]; }],
 ['fairy',W=>{ const g=new THREE.Group(); for(let i=0;i<14;i++){ const x=-6.5+i*1, y=5.2-Math.sin(i/13*Math.PI)*.6; const b=glowSprite(W,[0xFFD38A,0xFF9AB8,0x9FD8FF][i%3],.6,.6,.9); b.position.set(x,y,0); g.add(b); } return [g,0,0,-5.6]; }],
 ['slippers',W=>{ const g=new THREE.Group(); [-.25,.25].forEach(x=>{ const s=new THREE.Mesh(new THREE.SphereGeometry(.22,10,8),mat(0xF4C6D6,{roughness:1})); s.scale.set(.7,.4,1.4); s.position.set(x,.08,0); g.add(s); }); return [g,3.4,0,-.4]; }],
 ['clock',W=>{ const g=new THREE.Group(); g.add(cyl(.6,.6,.1,mat(0xFFFFFF),0,0,0,24).rotateX(Math.PI/2)); g.add(box(.05,.4,.03,mat(0x222222),0,.15,.07), box(.3,.05,.03,mat(0x222222),.12,0,.07)); return [g,4,4.2,-5.88]; }],
 ['kitty',W=>{ const m=makeMisho(); m.g.scale.setScalar(.55); m.g.rotation.y=.6; m.g.userData.cat=m; return [m.g,-5.4,0,.2]; }]
];
const HOME_ORDER=['window','heater','rug','bed','lamp','curtains','tea','plant','picture','books','cushions','fairy','slippers','clock','kitty'];

const BUILD_PIECES=[
 ['base',W=>{ const g=new THREE.Group(); g.add(box(7.4,.4,6,mat(0xBDB6A8),0,.2,0)); return [g,0,0,-2]; }],
 ['walls',W=>{ const g=new THREE.Group(), w=mat(0xF4E3C8,{roughness:.9}); g.add(box(7,3.6,.3,w,0,2.2,-2.85), box(.3,3.6,5.7,w,-3.35,2.2,0), box(.3,3.6,5.7,w,3.35,2.2,0), box(2.3,3.6,.3,w,-2.35,2.2,2.85), box(2.3,3.6,.3,w,2.35,2.2,2.85), box(2.4,1,.3,w,0,3.5,2.85)); return [g,0,0,-2]; }],
 ['roof',W=>{ const r=new THREE.Mesh(new THREE.ConeGeometry(5.6,2.6,4),mat(0xC2503A,{roughness:.8})); r.rotation.y=Math.PI/4; r.scale.set(1.05,1,.85); r.position.y=5.3; const g=new THREE.Group(); g.add(r); return [g,0,0,-2]; }],
 ['door',W=>{ const g=new THREE.Group(); g.add(box(1.4,2.6,.14,mat(0x8A4B2C),0,1.7,0)); const k=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),mat(0xF2C14E,{metalness:.8,roughness:.2})); k.position.set(.45,1.6,.1); g.add(k); return [g,0,0,.9]; }],
 ['windows',W=>{ const g=new THREE.Group(); [-2.3,2.3].forEach(x=>{ g.add(box(1.3,1.2,.1,mat(0xFFFFFF),x,2.4,0)); const gl=new THREE.Mesh(new THREE.PlaneGeometry(1.1,1),new THREE.MeshStandardMaterial({color:0xFFE2A8,emissive:0xFFC46B,emissiveIntensity:.6})); gl.position.set(x,2.4,.06); g.add(gl); g.add(box(1.5,.1,.3,mat(0xFFFFFF),x,1.75,.1)); }); return [g,0,0,.92]; }],
 ['chimney',W=>{ const g=new THREE.Group(); g.add(box(.7,1.6,.7,mat(0x9C5B3B),0,0,0)); g.userData.steam=true; return [g,1.6,5.6,-2.6]; }],
 ['path',W=>{ const g=new THREE.Group(); for(let i=0;i<6;i++){ const s=cyl(.42,.42,.08,mat(0xD8D2C4),Math.sin(i)*.2,.04,i*.9,10); s.scale.z=.8; g.add(s); } return [g,0,0,1.5]; }],
 ['fence',W=>{ const g=new THREE.Group(), w=mat(0xFFFFFF); for(let i=-9;i<=9;i++){ if(Math.abs(i)<2) continue; g.add(box(.18,1,.12,w,i*.6,.5,0)); } g.add(box(10.8,.1,.08,w,0,.75,0)); return [g,0,0,6.8]; }],
 ['tree',W=>{ const g=new THREE.Group(); g.add(cyl(.22,.32,2.4,mat(0x8A6440),0,1.2,0,8)); [[0,3,0,1.5],[.7,2.6,.3,1.1],[-.7,2.7,-.2,1.1]].forEach(([x,y,z,r])=>{ const s=new THREE.Mesh(new THREE.IcosahedronGeometry(r,0),mat(0x4E9C40,{roughness:.8})); s.position.set(x,y,z); g.add(s); }); return [g,-6,0,1]; }],
 ['flowers',W=>{ const g=new THREE.Group(); for(let i=0;i<16;i++){ const x=-3+(i%8)*.8, z=(i<8?0:.5); g.add(cyl(.015,.015,.4,mat(0x3FA05A),x,.2,z,4)); const b=new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),mat([0xE24B8B,0xFFD34D,0xFFFFFF,0xF26B1D][i%4])); b.position.set(x,.42,z); g.add(b); } return [g,0,0,1.6]; }],
 ['lamp',W=>{ const g=new THREE.Group(); g.add(cyl(.08,.1,3.2,mat(0x2C3E66),0,1.6,0,8), box(.5,.5,.5,mat(0x2C3E66),0,3.35,0)); const gl=glowSprite(W,0xFFD38A,2.4); gl.position.y=3.3; g.add(gl); const pl=new THREE.PointLight(0xFFD38A,0,10,1.6); pl.position.y=3.2; g.add(pl); g.userData.light=pl; return [g,4.4,0,4.2]; }],
 ['mailbox',W=>{ const g=new THREE.Group(); g.add(cyl(.05,.05,1.1,mat(0x8A6440),0,.55,0,6), box(.5,.4,.7,mat(0x2E8BC9),0,1.2,0), box(.05,.25,.12,mat(0xC2503A),.28,1.35,.2)); return [g,2,0,6.4]; }],
 ['bench',W=>{ const g=new THREE.Group(), w=mat(0xB98A5E); g.add(box(2.2,.1,.6,w,0,.6,0), box(2.2,.5,.08,w,0,.95,-.28), box(.1,.6,.5,mat(0x444444),-.95,.3,0), box(.1,.6,.5,mat(0x444444),.95,.3,0)); g.rotation.y=-Math.PI/2; return [g,6,0,1]; }],
 ['lights',W=>{ const g=new THREE.Group(); for(let i=0;i<12;i++){ const b=glowSprite(W,[0xFFD38A,0xFF9AB8,0x9FD8FF][i%3],.55,.55,.9); b.position.set(-3.3+i*.6,4-Math.sin(i/11*Math.PI)*.35,0); g.add(b); } return [g,0,0,1.05]; }],
 ['kitty',W=>{ const m=makeMisho(); m.g.scale.setScalar(.6); m.g.rotation.y=-.4; m.g.userData.cat=m; return [m.g,-2.4,0,3.4]; }]
];
const BUILD_ORDER=['base','walls','roof','door','windows','chimney','path','fence','tree','flowers','lamp','mailbox','bench','lights','kitty'];
const GARDEN_PIECES=[
 ['tree',W=>{ const t=BUILD_PIECES.find(p=>p[0]==='tree')[1](W); return [t[0],-6,0,2]; }],
 ['flowers',W=>{ const t=BUILD_PIECES.find(p=>p[0]==='flowers')[1](W); return [t[0],0,0,2.2]; }],
 ['swing',W=>{ const g=new THREE.Group(), wd=mat(0x8A6440); g.add(box(.15,3,.15,wd,-1,1.5,0), box(.15,3,.15,wd,1,1.5,0), box(2.3,.15,.15,wd,0,3,0)); const seat=new THREE.Group(); seat.add(box(.04,1.8,.04,mat(0x999999),-.4,-.9,0), box(.04,1.8,.04,mat(0x999999),.4,-.9,0), box(1,.08,.4,mat(0xC2503A),0,-1.8,0)); seat.position.y=3; g.add(seat); g.userData.swing=seat; return [g,5.6,0,2]; }],
 ['fountain',W=>{ const g=new THREE.Group(); g.add(cyl(1.1,1.2,.5,mat(0xD8D2C4),0,.25,0,20)); const wtr=cyl(1,1,.05,new THREE.MeshStandardMaterial({color:0x6FC3E8,metalness:.3,roughness:.1}),0,.48,0,20); g.add(wtr, cyl(.15,.2,1.2,mat(0xD8D2C4),0,.9,0,10)); g.userData.steam='water'; return [g,-2.6,0,4.6]; }],
 ['lights',W=>{ const t=BUILD_PIECES.find(p=>p[0]==='lights')[1](W); return [t[0],0,0,1.05]; }],
 ['bench',W=>{ const t=BUILD_PIECES.find(p=>p[0]==='bench')[1](W); return [t[0],6.2,0,4.8]; }],
 ['picnic',W=>{ const t=canvasTex(64,64,(x,w,h)=>{ for(let i=0;i<8;i++) for(let j=0;j<8;j++){ x.fillStyle=(i+j)%2?'#E24B4B':'#FFFFFF'; x.fillRect(i*8,j*8,8,8); } }); const r=new THREE.Mesh(new THREE.PlaneGeometry(2.4,2),new THREE.MeshStandardMaterial({map:t})); r.rotation.x=-Math.PI/2; r.position.y=.02; const g=new THREE.Group(); g.add(r, cyl(.25,.2,.3,mat(0xB98A5E),.4,.15,.2,10)); return [g,2.2,0,4.6]; }],
 ['birdhouse',W=>{ const g=new THREE.Group(); g.add(cyl(.05,.05,2,mat(0x8A6440),0,1,0,6), box(.6,.6,.6,mat(0x2E8BC9),0,2.2,0)); const r=new THREE.Mesh(new THREE.ConeGeometry(.55,.45,4),mat(0xC2503A)); r.position.y=2.75; r.rotation.y=Math.PI/4; g.add(r); return [g,-4,0,5.6]; }],
 ['pond',W=>{ const p=new THREE.Mesh(new THREE.CircleGeometry(1.4,24),new THREE.MeshStandardMaterial({color:0x3FA3D8,metalness:.3,roughness:.1})); p.rotation.x=-Math.PI/2; p.position.y=.03; const g=new THREE.Group(); g.add(p); for(let i=0;i<3;i++){ const l=new THREE.Mesh(new THREE.CircleGeometry(.25,10),mat(0x3FA05A)); l.rotation.x=-Math.PI/2; l.position.set(-.6+i*.5,.05,.3*(i-1)); g.add(l); } return [g,4,0,6.2]; }],
 ['lamp',W=>{ const t=BUILD_PIECES.find(p=>p[0]==='lamp')[1](W); return [t[0],-7,0,5]; }],
 ['hedge',W=>{ const g=new THREE.Group(); for(let i=0;i<6;i++){ const s=new THREE.Mesh(new THREE.IcosahedronGeometry(.6,0),mat(0x4E9C40)); s.position.set(-7+i*1.1,.5,7); g.add(s); } for(let i=0;i<6;i++){ const s=new THREE.Mesh(new THREE.IcosahedronGeometry(.6,0),mat(0x5DAE4C)); s.position.set(1.6+i*1.1,.5,7); g.add(s); } return [g,0,0,0]; }],
 ['balloons',CLINIC_PIECES.find(p=>p[0]==='balloons')[1]],
 ['table',W=>{ const t=CLINIC_PIECES.find(p=>p[0]==='table')[1](W); return [t[0],-1,0,6]; }],
 ['mailbox',W=>{ const t=BUILD_PIECES.find(p=>p[0]==='mailbox')[1](W); return [t[0],2,0,7.3]; }],
 ['kitty',W=>{ const m=makeMisho(); m.g.scale.setScalar(.6); m.g.rotation.y=.3; m.g.userData.cat=m; return [m.g,1.2,0,3.6]; }]
];
const GARDEN_ORDER=['tree','flowers','swing','fountain','lights','bench','picnic','birdhouse','pond','lamp','hedge','balloons','table','mailbox','kitty'];

// ---------- the scenes ----------
const SCENES={
  clinic:{env:'room',pieces:CLINIC_PIECES,order:CLINIC_ORDER,floor:'marble',wall:[0xAEB4BE,0xE9E1D5],bg:[0x1A2433,0x2A3A55],cast:'misho',boxes:true,music:'clinic',win:'city'},
  spa:{env:'room',pieces:SPA_PIECES,order:SPA_ORDER,floor:'woodL',wall:[0xA49EB0,0xEFE3F4],bg:[0x1E1A2C,0x3A2E52],cast:'misho',boxes:true,music:'clinic',win:'city'},
  home:{env:'room',pieces:HOME_PIECES,order:HOME_ORDER,floor:'wood',wall:[0x7E8FA8,0xF1DCC2],bg:[0x0E1A30,0x3A2A22],cast:'laila',cold:true,music:'home',win:'snow'},
  build:{env:'out',pieces:BUILD_PIECES,order:BUILD_ORDER,sky:[['#2A3A66','#7A6FA0','#E8A27A'],['#5FA8E8','#BFE0F7','#FCE8C8']],cast:'laila',music:'home',ghost:true},
  garden:{env:'out',pieces:GARDEN_PIECES,order:GARDEN_ORDER,sky:[['#5FA8E8','#BFE0F7','#FCE8C8'],['#4C9BE0','#A8D8F5','#FFE6B8']],cast:'laila',music:'clinic',ghost:true,house:true}
};
function skyTex(c){ return canvasTex(4,256,(x,w,h)=>{ const g=x.createLinearGradient(0,0,0,h); g.addColorStop(0,c[0]); g.addColorStop(.55,c[1]); g.addColorStop(1,c[2]); x.fillStyle=g; x.fillRect(0,0,w,h); }); }
function buildScene(host,o){
  const cfg=SCENES[o.world]||SCENES.clinic, W={o,host,world:o.world,cfg,fx:[],t:0,qi:-1,pieces:[],shake:0,steam:[]};
  const ren=new THREE.WebGLRenderer({antialias:(window.devicePixelRatio||1)<2}); ren.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75)); ren.outputEncoding=THREE.sRGBEncoding;
  ren.domElement.className='q3dc'; host.appendChild(ren.domElement); W.ren=ren;
  const sc=new THREE.Scene(); W.sc=sc; W.cam=new THREE.PerspectiveCamera(55,1,.1,200);
  W.glowT=glowTex('rgba(255,255,255,1)','rgba(255,255,255,0)'); W.puffTex=glowTex('rgba(255,255,255,.9)','rgba(255,255,255,0)'); W.sparkTex=W.glowT;
  W.hemi=new THREE.HemisphereLight(0xDDEBFF,0x7A6A58,.3); sc.add(W.hemi); W.sun=new THREE.DirectionalLight(0xFFF1D6,.3); W.sun.position.set(-6,10,8); sc.add(W.sun);
  if(cfg.env==='room'){
    sc.background=new THREE.Color(cfg.bg[0]); sc.fog=new THREE.Fog(cfg.bg[0],22,40);
    const fm=cfg.floor==='marble'?new THREE.MeshStandardMaterial({map:marbleTex(),roughness:.35,metalness:.1}):new THREE.MeshStandardMaterial({map:cfg.floor==='woodL'?woodTex('#E8D6BE','#DCC6AA'):woodTex('#A9774E','#986A44'),roughness:.7});
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(16,12),fm); floor.rotation.x=-Math.PI/2; sc.add(floor);
    W.wallM=mat(cfg.wall[0],{roughness:.9}); sc.add(box(16,6,.2,W.wallM,0,3,-6), box(.2,6,12,W.wallM,-8,3,0), box(.2,6,12,W.wallM,8,3,0), box(16,.2,12,mat(0xE6E6E6),0,6,0));
    sc.add(box(16,.18,.24,mat(cfg.cold?0xD98CA0:0xF26B1D),0,.09,-5.88));
    if(cfg.win==='city'){ const win=new THREE.Mesh(new THREE.PlaneGeometry(3,2.4),new THREE.MeshBasicMaterial({map:canvasTex(256,160,(x,w,h)=>{ const g=x.createLinearGradient(0,0,0,h); g.addColorStop(0,'#7FC4F0'); g.addColorStop(1,'#FCE8C8'); x.fillStyle=g; x.fillRect(0,0,w,h);
      for(let i=0;i<14;i++){ const bw=10+Math.random()*16, bh=30+Math.random()*90; x.fillStyle=['#C9D7E6','#A9C4DE','#E2E8EF'][i%3]; x.fillRect(i*19,h-bh,bw,bh); } x.strokeStyle='#fff'; x.lineWidth=6; x.strokeRect(0,0,w,h); x.beginPath(); x.moveTo(w/2,0); x.lineTo(w/2,h); x.stroke(); })}));
      win.position.set(-5.7,3.2,-5.89); sc.add(win); }
    if(cfg.win==='snow'){ // a broken window: night snow outside, boards across the hole
      const out=new THREE.Mesh(new THREE.PlaneGeometry(3,2.3),new THREE.MeshBasicMaterial({map:canvasTex(200,150,(x,w,h)=>{ x.fillStyle='#1B2A4A'; x.fillRect(0,0,w,h); x.fillStyle='#E8F0FA'; x.fillRect(0,h-30,w,30); for(let i=0;i<70;i++){ x.globalAlpha=.8; x.beginPath(); x.arc(Math.random()*w,Math.random()*h,1+Math.random()*2,0,7); x.fill(); } })}));
      out.position.set(0,3.2,-5.89); sc.add(out); W.boards=new THREE.Group(); [[.4,.3],[-.35,-.25]].forEach(([y,r])=>{ const b=box(3.4,.28,.08,mat(0x8A6440),0,y,0); b.rotation.z=r; W.boards.add(b); }); W.boards.position.set(0,3.2,-5.82); sc.add(W.boards);
      const sg=new THREE.BufferGeometry(), arr=[]; for(let i=0;i<300;i++) arr.push((Math.random()-.5)*6,Math.random()*5,-5.6+Math.random()*7); sg.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));
      W.snow=new THREE.Points(sg,new THREE.PointsMaterial({color:0xFFFFFF,size:.08,transparent:true,opacity:.9,depthWrite:false})); sc.add(W.snow); }
  } else {
    W.skyA=skyTex(cfg.sky[0]); W.skyB=skyTex(cfg.sky[1]); sc.background=W.skyA; sc.fog=new THREE.Fog(0xCFC3D8,40,120);
    const g=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({map:grassTex(),roughness:1})); g.rotation.x=-Math.PI/2; sc.add(g);
    const road=new THREE.Mesh(new THREE.PlaneGeometry(200,5),new THREE.MeshLambertMaterial({color:0x5A5E6A})); road.rotation.x=-Math.PI/2; road.position.set(0,.01,10.5); sc.add(road);
    for(let x=-60;x<60;x+=5){ const d=new THREE.Mesh(new THREE.PlaneGeometry(2,.18),new THREE.MeshBasicMaterial({color:0xF2F2F2})); d.rotation.x=-Math.PI/2; d.position.set(x,.02,10.5); sc.add(d); }
    // neighbours and hills far away
    [[-16,-6,0xE8C9A0],[15,-5,0xBFD3E6],[-26,-14,0xF4E3C8],[26,-14,0xE2B9A8]].forEach(([x,z,c])=>{ sc.add(box(6,4,5,mat(c),x,2,z)); const r=new THREE.Mesh(new THREE.ConeGeometry(4.6,2.2,4),mat(0x8E5A48)); r.rotation.y=Math.PI/4; r.position.set(x,5.1,z); sc.add(r); });
    for(let i=0;i<9;i++){ const h=new THREE.Mesh(new THREE.SphereGeometry(18+Math.random()*10,12,8,0,Math.PI*2,0,Math.PI/2),mat(0x7CBF6A,{roughness:1})); h.scale.y=.35; h.position.set(-90+i*22,-1,-60-Math.random()*20); sc.add(h); }
    W.sunS=glowSprite(W,0xFFF0C8,26,26,.9); W.sunS.position.set(-30,24,-70); W.sunS.material.fog=false; sc.add(W.sunS);
    if(cfg.house){ BUILD_ORDER.slice(0,7).forEach(id=>{ const m=BUILD_PIECES.find(p=>p[0]===id)[1](W); m[0].position.set(m[1],m[2],m[3]); sc.add(m[0]); }); }
  }
  // the pieces (+ a box or a faint "blueprint" where each one will go)
  const cardboard=mat(0xC49A6C,{roughness:.95}), tape=mat(0xE8D7B5), ghostM=new THREE.MeshBasicMaterial({color:0xFFFFFF,transparent:true,opacity:.13,depthWrite:false,wireframe:true});
  const order=cfg.order.slice(0,Math.min(o.n,cfg.order.length)); while(order.length<o.n) order.push(cfg.order[order.length%cfg.order.length]);
  order.forEach((id,i)=>{ const def=cfg.pieces.find(p=>p[0]===id); const made=def[1](W), g=made[0]; g.position.set(made[1],made[2],made[3]); g.visible=false; sc.add(g);
    const P={id,g,state:0,t:0,y0:made[2]};
    if(cfg.boxes){ const bx=new THREE.Group(), s=.8+Math.random()*.5; bx.add(box(1.2*s,.9*s,1*s,cardboard,0,.45*s,0), box(1.22*s,.06,.25,tape,0,.9*s+.01,0));
      const lab=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTex(String(i+1),'#14294B','#fff',false),depthWrite:false,transparent:true})); lab.scale.set(.9,.24,1); lab.position.y=.9*s+.45; bx.add(lab);
      bx.position.set(Math.max(-6.5,Math.min(6.5,made[1]+(Math.random()-.5)*1.2)),0,Math.max(-4.5,Math.min(4.5,made[3]+(Math.random()-.5)*1.2+(made[2]>2?2.5:0)))); bx.rotation.y=(Math.random()-.5)*.8; sc.add(bx); P.bx=bx; }
    else if(cfg.ghost){ const ud=g.userData; g.userData={}; const gh=g.clone(); g.userData=ud; gh.traverse(c=>{ if(c.isMesh) c.material=ghostM; if(c.isSprite||c.isLight) c.visible=false; }); gh.visible=true; sc.add(gh); P.ghost=gh; }
    W.pieces.push(P); });
  if(cfg.env==='room'&&!cfg.cold){ const dg=new THREE.BufferGeometry(), arr=[]; for(let i=0;i<260;i++) arr.push((Math.random()-.5)*15,Math.random()*5.5,(Math.random()-.5)*11);
    dg.setAttribute('position',new THREE.Float32BufferAttribute(arr,3)); W.dust=new THREE.Points(dg,new THREE.PointsMaterial({color:0xD8CFC0,size:.05,transparent:true,opacity:.7,depthWrite:false})); sc.add(W.dust); }
  // the cast
  if(cfg.cast==='misho'){ W.misho=makeMisho(); W.misho.g.position.set(4.5,0,3.5); W.misho.face=-.6; sc.add(W.misho.g); W.zizi=makeZizi(); sc.add(W.zizi.g); }
  else { W.laila=makeLaila(); const lx=cfg.env==='room'?-.5:3.2, lz=cfg.env==='room'?2.6:4.6; W.laila.x0=lx; W.laila.g.position.set(lx,0,lz); W.laila.g.rotation.y=cfg.env==='room'?.25:-.35; sc.add(W.laila.g); }
  W.hud=document.createElement('div'); W.hud.className='q3dhud'; host.appendChild(W.hud);
  W.focus=new THREE.Vector3(0,1.5,-1); W.camT=new THREE.Vector3(0,4.3,10.5); W.out=cfg.env==='out';
  return W;
}
function sceneReady(W){ return W.pieces.filter(p=>p.state===1&&p.t>=0).length; }
function frameScene(W,dt){
  W.t+=dt; const rm=reduce(), cfg=W.cfg, r=sceneReady(W)/W.pieces.length;
  const lit=W.out?.55+r*.35:.3+r*.45; W.hemi.intensity+=(lit-W.hemi.intensity)*Math.min(1,dt*2); W.sun.intensity+=((W.out?.5+r*.5:.3+r*.4)-W.sun.intensity)*Math.min(1,dt*2);
  if(W.wallM) W.wallM.color.lerp(new THREE.Color(cfg.wall[0]).lerp(new THREE.Color(cfg.wall[1]),r),Math.min(1,dt));
  if(cfg.env==='room') W.sc.background.lerp(new THREE.Color(cfg.bg[0]).lerp(new THREE.Color(cfg.bg[1]),r),Math.min(1,dt));
  else if(r>.5&&W.sc.background!==W.skyB){ W.sc.background=W.skyB; }
  if(cfg.cold){ W.hemi.color.lerp(new THREE.Color(0x9FC0FF).lerp(new THREE.Color(0xFFD8B0),r),Math.min(1,dt)); }
  if(W.dust){ W.dust.material.opacity=.7*(1-r)+.05; W.dust.rotation.y+=dt*.02; }
  if(W.snow){ const fixed=W.pieces.some(p=>p.g.userData.window&&p.state===1&&p.t>=0); const a=W.snow.geometry.attributes.position; for(let i=0;i<a.count;i++){ let y=a.getY(i)-dt*(.6+(i%5)*.15), z=a.getZ(i)+dt*(fixed?0:.5); if(y<0||z>2.5){ y=5; z=-5.6+Math.random()*(fixed?.1:1.5); } a.setY(i,y); a.setZ(i,z); } a.needsUpdate=true;
    W.snow.material.opacity+=((fixed?0:.9)-W.snow.material.opacity)*Math.min(1,dt*.8); if(W.boards) W.boards.visible=!fixed; windSet(fixed?0:.16); }
  W.pieces.forEach((p,i)=>{ p.t+=dt; const ud=p.g.userData;
    if(p.state===1&&p.t>=0){ const k=Math.min(1,p.t/.7), e=k<1?1+Math.sin(k*Math.PI)*.25*(1-k):1; p.g.visible=true; p.g.scale.setScalar(Math.max(.01,(rm?1:k)*e)); p.g.position.y=p.y0+(1-k)*(rm?0:1.6);
      if(!p.shown){ p.shown=true; if(p.bx) burst(W,new THREE.Vector3(p.bx.position.x,.8,p.bx.position.z),'puff',8); burst(W,new THREE.Vector3(p.g.position.x,p.y0+1,p.g.position.z),'ok',36); if(p.ghost) p.ghost.visible=false;
        sfx(ud.window?'glass':ud.fire?'fire':'pop'); setTimeout(()=>sfx('sparkle'),180); if(W.laila){ W.laila.mood=sceneReady(W)/W.pieces.length; W.laila.happy(); setTimeout(()=>sfx('yay'),300); } else if(W.misho) W.misho.cheer(); }
      if(p.bx&&p.bx.visible){ p.bx.scale.multiplyScalar(Math.max(0,1-dt*6)); if(p.bx.scale.x<.05) p.bx.visible=false; }
      if(ud.light) ud.light.intensity=Math.min(1.6,k*1.6)*(ud.fire?1:1);
      if(ud.fire){ ud.fire.children.forEach((f,j)=>{ f.scale.y=.8+Math.sin(W.t*12+j*1.7)*.25; }); ud.light.intensity=1.4+Math.sin(W.t*9)*.25+Math.sin(W.t*23)*.15; }
      if(ud.swing) ud.swing.rotation.x=Math.sin(W.t*1.8)*.35;
      if(ud.cat) ud.cat.update(W,dt);
      if(ud.steam&&Math.random()<dt*6){ const v=new THREE.Vector3(); p.g.getWorldPosition(v); burst(W,v.add(new THREE.Vector3(0,ud.steam==='water'?1.4:(p.y0>3?.9:1),0)),'puff',1); } }
    else if(p.state!==1&&p===W.pieces.find(x=>x.state!==1)&&W.mode==='play'&&!(p.state===-1&&p.t<.8)){ if(p.bx) p.bx.position.y=Math.abs(Math.sin(W.t*4))*.18; if(p.ghost) p.ghost.children.forEach(c=>{ if(c.material) c.material.opacity=.13+Math.abs(Math.sin(W.t*3))*.15; }); }
    else if(p.state===-1&&p.bx){ p.bx.position.y=0; if(p.t<.6) p.bx.rotation.z=Math.sin(p.t*40)*.12*(1-p.t/.6); } });
  if(W.misho) W.misho.update(W,dt); if(W.zizi) W.zizi.update(W,dt); if(W.laila) W.laila.update(W,dt);
  // camera
  const cam=W.cam, far=W.out?1.6:1;
  if(W.mode==='intro'){ const a=Math.sin(W.t*.25)*.5; W.camT.set(Math.sin(a)*9*far,4.6*far,Math.cos(a)*9*far+1.5); W.focus.set(0,1.4,-1.5); }
  else if(W.mode==='finish'){ const a=-.7+Math.min(1.4,W.ft*.35); W.ft+=dt; W.camT.set(Math.sin(a)*8.5*far,3.8*far,Math.cos(a)*8*far+1); W.focus.set(0,1.6,-1.5); }
  else { const p=W.lastP, c=W.misho&&W.misho.state!=='idle'?W.misho.g.position:null; const tgt=p&&p.state===1&&p.t>=0&&p.t<2.2?p.g.position:c;
    if(tgt){ W.focus.lerp(new THREE.Vector3(tgt.x,Math.max(1,tgt.y+.6),tgt.z),Math.min(1,dt*3)); W.camT.lerp(new THREE.Vector3(tgt.x*.5,3.6*far,Math.min(9.5*far,tgt.z+7.5*far)),Math.min(1,dt*2)); }
    else { W.focus.lerp(new THREE.Vector3(Math.sin(W.t*.2)*.6,1.5,-1.4),Math.min(1,dt*1.5)); W.camT.lerp(new THREE.Vector3(Math.sin(W.t*.15)*1.6,4.4*far,10.2*far),Math.min(1,dt*1.5)); } }
  const nar=cam.aspect<1, fv=nar?76:56; if(Math.abs(cam.fov-fv)>.1){ cam.fov=fv; cam.updateProjectionMatrix(); } if(nar) W.camT.z-=1.2;
  cam.position.lerp(W.camT,Math.min(1,dt*2.5)); cam.lookAt(W.focus); if(nar) W.camT.z+=1.2;
  if(W.shake>0&&!rm){ cam.position.x+=(Math.random()-.5)*W.shake*.5; W.shake=Math.max(0,W.shake-dt*1.5); }
  for(let i=W.fx.length-1;i>=0;i--){ const p=W.fx[i]; p.age+=dt; if(p.age>=p.life){ W.sc.remove(p); p.material.dispose(); W.fx.splice(i,1); continue; }
    p.v.y-=(p.kind==='conf'?5:p.kind==='puff'?-.4:7)*dt; p.position.addScaledVector(p.v,dt); const k=p.age/p.life; p.material.opacity=1-k; if(p.kind==='puff') p.scale.setScalar(p.sz*(1+k*2)); }
  if(W.hud){ W.hud.style.display=W.mode==='intro'?'none':''; const n=sceneReady(W), L=W.o.lang==='en'; if(W._n!==n){ W._n=n; const ic={clinic:'🏥',spa:'💆',home:'🔥',build:'🧱',garden:'🌷'}[W.world]||'⭐';
    W.hud.innerHTML=`<span class="q3dpos ${n===W.pieces.length?'p1':''}">${ic} ${n}/${W.pieces.length} ${L?'done':'جاهز'}</span>`; } }
}
const SCENE={
  question(i){ W.mode='play'; W.qi=i; },
  answer(ok){ const p=W.pieces.find(x=>x.state!==1); if(!p) return; p.t=0; W.lastP=p; // next unfinished piece in story order, so a missed step (e.g. the walls) is fixed by the next right answer

    if(ok){ p.state=1;
      if(W.misho&&p.bx){ p.t=-99; const M=W.misho, tx=p.bx.position.x+(p.bx.position.x>0?-1.3:1.3), tz=p.bx.position.z+.9;
        M.walkTo(tx,tz,()=>{ M.g.rotation.y=Math.atan2(p.bx.position.x-tx,p.bx.position.z-tz); sfx('sweep'); M.sweep(1.1,()=>{ p.t=0; }); }); }
      else p.t=-.35; }
    else { p.state=-1; W.shake=.5; sfx('aww');
      if(W.zizi&&p.bx){ const bz=p.bx.position.z+.6; W.zizi.run(-9,bz,9,bz,null,.5,()=>{ p.t=0; sfx('thud'); burst(W,new THREE.Vector3(p.bx.position.x,.8,p.bx.position.z),'puff',10); }); setTimeout(()=>sfx('squeak'),250); if(W.misho) setTimeout(()=>W&&W.misho&&W.misho.shrug(),900); }
      else if(W.laila){ W.laila.cold(); if(W.cfg.cold){ sfx('gust'); windSet(.35); burst(W,new THREE.Vector3(0,3,-5),'puff',14); } } } },
  finish(){ W.mode='finish'; W.ft=0; const n=sceneReady(W), all=n===W.pieces.length; sfx(all?'finish':'yay');
    if(W.laila&&all) W.laila.happy(); if(W.misho) W.misho.cheer();
    setTimeout(()=>{ if(!W) return; for(let i=0;i<4;i++) setTimeout(()=>W&&burst(W,new THREE.Vector3((Math.random()-.5)*8,4.5,(Math.random()-.5)*4),'conf',all?70:35),i*350); },900); return 0; },
  summary(){ return {world:W.world,built:W.pieces.filter(p=>p.state===1).length,total:W.pieces.length}; }
};

// ================= Sound: music per world + effects (all generated with Web Audio, no files) =================
const AU={ctx:null,master:null,music:null,sfx:null,muted:false,noise:null,timer:0,step:0,next:0,world:'',warm:0,eng:null,wind:null,fire:0};
try{ AU.muted=localStorage.getItem('tj-quiz-mute')==='1'; }catch(e){}
function auInit(){
  try{ if(!AU.ctx){ const C=window.AudioContext||window.webkitAudioContext; if(!C) return false; AU.ctx=new C();
      AU.master=AU.ctx.createGain(); AU.master.gain.value=AU.muted?0:.9; AU.master.connect(AU.ctx.destination);
      AU.music=AU.ctx.createGain(); AU.music.gain.value=.32; AU.music.connect(AU.master);
      AU.sfx=AU.ctx.createGain(); AU.sfx.gain.value=.8; AU.sfx.connect(AU.master);
      const len=AU.ctx.sampleRate*2, b=AU.ctx.createBuffer(1,len,AU.ctx.sampleRate), d=b.getChannelData(0); for(let i=0;i<len;i++) d[i]=Math.random()*2-1; AU.noise=b; }
    if(AU.ctx.state==='suspended') AU.ctx.resume(); return true; }catch(e){ return false; } }
function auMute(m){ AU.muted=m; try{ localStorage.setItem('tj-quiz-mute',m?'1':'0'); }catch(e){} if(AU.master) AU.master.gain.setTargetAtTime(m?0:.9,AU.ctx.currentTime,.05); }
function osc(type,f,t0,dur,vol,dest,f2){ const c=AU.ctx, o=c.createOscillator(), g=c.createGain(); o.type=type; o.frequency.setValueAtTime(f,t0); if(f2) o.frequency.exponentialRampToValueAtTime(f2,t0+dur);
  g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(vol,t0+Math.min(.02,dur/4)); g.gain.exponentialRampToValueAtTime(.0001,t0+dur); o.connect(g); g.connect(dest||AU.sfx); o.start(t0); o.stop(t0+dur+.05); }
function noiz(t0,dur,vol,type,f,f2,q,dest){ const c=AU.ctx, s=c.createBufferSource(), fl=c.createBiquadFilter(), g=c.createGain(); s.buffer=AU.noise; fl.type=type||'bandpass'; fl.frequency.setValueAtTime(f||1000,t0); if(f2) fl.frequency.exponentialRampToValueAtTime(f2,t0+dur); fl.Q.value=q||1;
  g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(vol,t0+Math.min(.03,dur/4)); g.gain.exponentialRampToValueAtTime(.0001,t0+dur); s.connect(fl); fl.connect(g); g.connect(dest||AU.sfx); s.start(t0,Math.random()); s.stop(t0+dur+.05); }
function sfx(kind){ if(!AU.ctx||AU.muted) return; const t=AU.ctx.currentTime;
  if(kind==='boost'){ noiz(t,.7,.5,'bandpass',400,4000,1.5); osc('sawtooth',120,t,.6,.12,null,420); }
  else if(kind==='skid'){ noiz(t,.8,.35,'bandpass',2600,1400,6); osc('square',90,t+.05,.35,.05,null,50); }
  else if(kind==='pop'){ osc('sine',660,t,.18,.35,null,180); noiz(t,.12,.2,'highpass',3000); }
  else if(kind==='sparkle'){ [1319,1568,1976,2637].forEach((f,i)=>osc('triangle',f,t+i*.06,.25,.12)); }
  else if(kind==='sweep'){ for(let i=0;i<3;i++) noiz(t+i*.32,.26,.32,'bandpass',1800,700,1.2); }
  else if(kind==='squeak'){ osc('sine',1800,t,.12,.12,null,2600); osc('sine',2200,t+.14,.1,.1,null,1500); noiz(t+.05,.3,.15,'bandpass',600,300,2); }
  else if(kind==='thud'){ osc('sine',140,t,.25,.4,null,60); noiz(t,.2,.25,'lowpass',500); }
  else if(kind==='gust'){ noiz(t,1.3,.45,'bandpass',500,1200,.8); }
  else if(kind==='fire'){ noiz(t,.9,.35,'lowpass',900,300,.7); osc('sine',220,t,.5,.1,null,440); }
  else if(kind==='glass'){ [2093,2637,3136].forEach((f,i)=>osc('sine',f,t+i*.04,.5,.08)); }
  else if(kind==='yay'){ [523,659,784,1047].forEach((f,i)=>osc('triangle',f,t+i*.07,.3,.14)); }
  else if(kind==='aww'){ osc('triangle',392,t,.3,.12,null,330); osc('triangle',330,t+.22,.4,.1,null,262); }
  else if(kind==='finish'){ [523,659,784,1047,784,1047].forEach((f,i)=>osc('square',f,t+i*.12,.22,.07)); [262,330,392].forEach(f=>osc('triangle',f,t+.72,1.2,.08)); } }
// music: a small loop per world. The "home" world starts sad (minor) and turns warm (major) as the room is fixed.
const SONGS={
  race:{bpm:128,chords:[[57,60,64],[53,57,60],[48,52,55],[55,59,62]],arp:'square',bass:true,kick:true},
  clinic:{bpm:104,chords:[[60,64,67],[57,60,64],[53,57,60],[55,59,62]],arp:'triangle',bass:true,kick:false},
  home:{bpm:84,chords:[[57,60,64],[53,57,60],[60,64,67],[55,59,62]],arp:'sine',bass:false,kick:false}
};
const mtof=m=>440*Math.pow(2,(m-69)/12);
function musicStart(world){ if(!AU.ctx) return; musicStop(); AU.world=world; AU.step=0; AU.next=AU.ctx.currentTime+.1; AU.timer=setInterval(musicTick,60); }
function musicStop(){ clearInterval(AU.timer); AU.timer=0; }
function musicTick(){ const c=AU.ctx, S=SONGS[AU.world]; if(!c||!S) return; const st=60/S.bpm/2; // eighth notes
  while(AU.next<c.currentTime+.25){ const t=AU.next, bar=Math.floor(AU.step/8)%4, k=AU.step%8; let ch=S.chords[bar].slice();
    if(AU.world==='home'&&AU.warm<.5&&bar!==1) ch=ch.map((m,i)=>i===1?m-1:m); // minor colour while it's cold
    const pat=[0,1,2,1,0,2,1,2]; osc(S.arp,mtof(ch[pat[k]]+12),t,st*1.6,AU.world==='home'?.09:.06,AU.music);
    if(k===0) ch.forEach(m=>osc('triangle',mtof(m),t,st*7.5,.035,AU.music));
    if(S.bass&&(k===0||k===4)) osc('sine',mtof(ch[0]-12),t,st*1.8,.18,AU.music);
    if(S.kick&&(k%2===0)){ osc('sine',120,t,.12,.3,AU.music,45); if(k%4===2) noiz(t,.08,.08,'highpass',6000,null,1,AU.music); }
    if(AU.world==='clinic'&&k%4===2) noiz(t,.04,.05,'highpass',7000,null,1,AU.music);
    AU.step++; AU.next+=st; } }
// continuous sounds: car engine (race), wind (home, fades as you fix the window)
function loopNoise(type,f,q,vol){ const c=AU.ctx, s=c.createBufferSource(), fl=c.createBiquadFilter(), g=c.createGain(); s.buffer=AU.noise; s.loop=true; fl.type=type; fl.frequency.value=f; fl.Q.value=q; g.gain.value=vol; s.connect(fl); fl.connect(g); g.connect(AU.sfx); s.start(); return {s,fl,g}; }
function engineStart(){ if(!AU.ctx) return; const c=AU.ctx, o=c.createOscillator(), fl=c.createBiquadFilter(), g=c.createGain(); o.type='sawtooth'; o.frequency.value=55; fl.type='lowpass'; fl.frequency.value=400; g.gain.value=.05; o.connect(fl); fl.connect(g); g.connect(AU.sfx); o.start(); AU.eng={o,fl,g}; }
function engineSet(speed){ if(!AU.eng) return; const t=AU.ctx.currentTime; AU.eng.o.frequency.setTargetAtTime(48+speed*1.6,t,.1); AU.eng.fl.frequency.setTargetAtTime(300+speed*14,t,.1); }
function windStart(){ if(!AU.ctx) return; AU.wind=loopNoise('bandpass',700,.7,.16); }
function windSet(v){ if(AU.wind) AU.wind.g.gain.setTargetAtTime(v,AU.ctx.currentTime,.4); }
function auStopLoops(){ try{ if(AU.eng){ AU.eng.o.stop(); AU.eng=null; } if(AU.wind){ AU.wind.s.stop(); AU.wind=null; } }catch(e){} musicStop(); }
function muteBtn(host,lang){ const b=document.createElement('button'); b.className='q3dmute'; b.type='button';
  const draw=()=>{ b.textContent=AU.muted?'🔇':'🔊'; b.title=lang==='en'?(AU.muted?'Sound on':'Mute'):(AU.muted?'شغّل الصوت':'اكتم الصوت'); }; draw();
  b.addEventListener('click',e=>{ e.stopPropagation(); auInit(); auMute(!AU.muted); draw(); }); host.appendChild(b); return b; }

// ---------- public API ----------
let W=null, raf=0, last=0, ro=null;
function loop(t){ raf=requestAnimationFrame(loop); if(!W) return; const dt=Math.min(.05,(t-(last||t))/1000); last=t; if(document.hidden) return;
  if(W.cfg) frameScene(W,dt); else frame(W,dt); W.ren.render(W.sc,W.cam); }
function size(){ if(!W) return; const r=W.host.getBoundingClientRect(); const w=Math.max(1,r.width), h=Math.max(1,r.height); W.ren.setSize(w,h,false); W.cam.aspect=w/h; W.cam.updateProjectionMatrix(); }
const API={
  // host: element to draw in; o: {world:'race'|'clinic', n, night, rivals:[names], me, av, lang}
  async mount(host,o){ API.unmount(); if(!host||!glOk()) return false; const ok=await load(); if(!ok||!host.isConnected) return false;
    try{ W=SCENES[o.world]?buildScene(host,o):build(host,o); }catch(e){ console.warn('quiz3d',e); API.unmount(); return false; }
    W.mode='intro'; muteBtn(host,o.lang); size(); ro=window.ResizeObserver?new ResizeObserver(size):null; if(ro) ro.observe(host); else window.addEventListener('resize',size);
    last=0; raf=requestAnimationFrame(loop); host.classList.add('on'); return true; },
  ready(){ return !!W; },
  // a new question: put its gate ahead of you
  question(i){ if(!W) return; if(W.cfg) return SCENE.question(i); W.mode='race'; W.qi=i; W.cars.forEach(c=>{ c.cap=c.target+.55; }); if(!W.gates[i]) gate(W,-(W.cars[0].target+1)*SEG,(W.o.lang==='en'?'Q ':'س ')+(i+1)); },
  answer(ok){ if(!W) return; if(W.cfg) return SCENE.answer(ok); sfx(ok?'boost':'skid'); const me=W.cars[0], g=W.gates[W.qi]; if(g) g.res=!!ok;
    W.cars.forEach(c=>{ c.cap=0; }); me.target+=ok?OK_STEP:BAD_STEP; W.cars.slice(1).forEach(c=>{ c.target+=c.pace*(.94+Math.random()*.12); });
    if(ok){ me.vel+=26; W.fovKick=4; } else { me.spin=Math.PI*2; W.shake=.6; for(let i=0;i<10;i++) setTimeout(()=>W&&burst(W,new THREE.Vector3(me.position.x,.5,me.position.z+1.5),'puff',2),i*60); } },
  place(){ return W&&!W.cfg?place(W):0; },
  summary(){ return !W?null:W.cfg?SCENE.summary():{world:'race',place:place(W)}; },
  // call from a tap/click: starts the music and the sounds of this world
  unlock(){ if(!auInit()||!W||W.audio) return; W.audio=true; musicStart(W.cfg?W.cfg.music:'race'); if(!W.cfg) engineStart(); if(W.cfg&&W.cfg.cold) windStart(); },
  mute(m){ auMute(!!m); }, muted(){ return AU.muted; },
  // all cars roll over the finish line in their final order
  finish(txt){ if(!W) return 0; if(W.cfg) return SCENE.finish(); sfx('finish'); const p=place(W), lead=Math.max(...W.cars.map(c=>c.target)); finishGate(W,-(lead+.9)*SEG,txt||'FINISH');
    W.cars.forEach(c=>{ c.target+=1.6; }); W.done=true; W.mode='finish'; W.ft=0;
    setTimeout(()=>{ if(!W) return; const me=W.cars[0]; for(let i=0;i<4;i++) setTimeout(()=>W&&burst(W,new THREE.Vector3(me.position.x+(Math.random()-.5)*8,6+Math.random()*3,me.position.z-2),'conf',p===1?70:40),i*350); },1300);
    return p; },
  unmount(){ auStopLoops(); cancelAnimationFrame(raf); raf=0; if(ro){ ro.disconnect(); ro=null; } window.removeEventListener('resize',size);
    if(W){ try{ W.sc.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{ if(m.map) m.map.dispose(); m.dispose(); }); } }); W.ren.dispose(); if(W.ren.forceContextLoss) W.ren.forceContextLoss(); }catch(e){}
      if(W.ren.domElement.parentNode) W.ren.domElement.remove(); if(W.hud&&W.hud.parentNode) W.hud.remove(); if(W.host){ W.host.classList.remove('on'); W.host.querySelectorAll('.q3dmute').forEach(b=>b.remove()); } }
    W=null; }
};
window.QZ3D=API;
})();
