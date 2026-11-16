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
  else if(kind==='vac'){ noiz(t,1.25,.32,'bandpass',500,2600,1.2); noiz(t,1.25,.12,'highpass',4000,6000,.7); osc('sawtooth',90,t,1.2,.05,null,160); }
  else if(kind==='laugh'){ [0,.13,.26,.39].forEach((d,i)=>osc('square',1250-i*90,t+d,.1,.06,null,1700-i*90)); }
  else if(kind==='finish'){ [523,659,784,1047,784,1047].forEach((f,i)=>osc('square',f,t+i*.12,.22,.07)); [262,330,392].forEach(f=>osc('triangle',f,t+.72,1.2,.08)); } }
// music: a small loop per world. The "home" world starts sad (minor) and turns warm (major) as the room is fixed.
const SONGS={
  race:{bpm:128,chords:[[57,60,64],[53,57,60],[48,52,55],[55,59,62]],arp:'square',bass:true,kick:true},
  clinic:{bpm:104,chords:[[60,64,67],[57,60,64],[53,57,60],[55,59,62]],arp:'triangle',bass:true,kick:false},
  toon:{bpm:150,chords:[[60,64,67],[65,69,72],[62,65,69],[67,71,74]],arp:'triangle',bass:true,kick:false},
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

// ================= Cartoon room (2D, hand-drawn SVG, no WebGL needed) =================
// A messy, colourful kids' room. Misho the cat (original character) vacuums one mess per right answer;
// Zizi the mouse (original) runs out of his hole and messes it up again on a wrong answer, Misho chases him.
const TQ_NS='http://www.w3.org/2000/svg', TQ_O='#3B2A2A';
const tqMir=s=>`<g transform="translate(1600,0) scale(-1,1)">${s}</g>`;
const tqStar=(r)=>{ let d=''; for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, rr=i%2?r*.45:r; d+=(i?'L':'M')+(Math.cos(a)*rr).toFixed(1)+','+(Math.sin(a)*rr).toFixed(1); } return d+'Z'; };
const TQ_DEFS=`<defs>
<linearGradient id="tqWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7AD3EC"/><stop offset="1" stop-color="#46AED6"/></linearGradient>
<pattern id="tqStripe" width="64" height="600" patternUnits="userSpaceOnUse"><rect width="30" height="600" fill="#fff" opacity=".10"/><circle cx="47" cy="40" r="3" fill="#fff" opacity=".18"/><circle cx="47" cy="140" r="3" fill="#fff" opacity=".18"/><circle cx="47" cy="240" r="3" fill="#fff" opacity=".18"/><circle cx="47" cy="340" r="3" fill="#fff" opacity=".18"/></pattern>
<linearGradient id="tqFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8E5636"/><stop offset="1" stop-color="#B9774B"/></linearGradient>
<linearGradient id="tqSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7FD0FF"/><stop offset="1" stop-color="#DFF6FF"/></linearGradient>
<radialGradient id="tqGlow"><stop offset="0" stop-color="#FFF4C2" stop-opacity=".75"/><stop offset=".5" stop-color="#FFE9A0" stop-opacity=".25"/><stop offset="1" stop-color="#FFE9A0" stop-opacity="0"/></radialGradient>
<radialGradient id="tqShadow"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<linearGradient id="tqJuice" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFC23D"/><stop offset="1" stop-color="#FF8A1F"/></linearGradient>
<clipPath id="tqWin"><rect x="626" y="116" width="348" height="308" rx="6"/></clipPath>
</defs>`;
const TQ_STYLE=`<style>
.tq .ol{stroke:${TQ_O};stroke-width:4;stroke-linejoin:round;stroke-linecap:round}
.tq .ol3{stroke:${TQ_O};stroke-width:3;stroke-linejoin:round;stroke-linecap:round}
.tq .fb{transform-box:fill-box}
.tq .tq-cloud{animation:tqCloud 9s ease-in-out infinite alternate}.tq .tq-cloud.b{animation-duration:13s;animation-direction:alternate-reverse}
@keyframes tqCloud{from{transform:translateX(-50px)}to{transform:translateX(50px)}}
.tq .tq-hm{transform-box:view-box;transform-origin:1230px 170px;animation:tqSpin 8s linear infinite}.tq .tq-hh{transform-box:view-box;transform-origin:1230px 170px;animation:tqSpin 96s linear infinite}
@keyframes tqSpin{to{transform:rotate(360deg)}}
.tq .tq-leg{transform-box:fill-box;transform-origin:50% 0}
.tq .walk .tq-leg.l1{animation:tqLeg .26s ease-in-out infinite alternate}.tq .walk .tq-leg.l2{animation:tqLeg .26s ease-in-out infinite alternate-reverse}
@keyframes tqLeg{from{transform:rotate(-22deg)}to{transform:rotate(22deg)}}
.tq .walk .tq-bob{animation:tqBob .26s ease-in-out infinite alternate}@keyframes tqBob{from{transform:translateY(0)}to{transform:translateY(-9px)}}
.tq .tq-tail{transform-box:fill-box;transform-origin:100% 100%;animation:tqTail 1.4s ease-in-out infinite alternate}@keyframes tqTail{from{transform:rotate(-8deg)}to{transform:rotate(10deg)}}
.tq .tq-eyes{transform-box:fill-box;transform-origin:center;animation:tqBlink 4.2s infinite}@keyframes tqBlink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
.tq .tq-head{transform-box:fill-box;transform-origin:50% 90%;animation:tqNod 2.6s ease-in-out infinite alternate}@keyframes tqNod{from{transform:rotate(-3deg)}to{transform:rotate(3deg)}}
.tq .on .tq-noz{transform-box:fill-box;transform-origin:center;animation:tqVib .07s linear infinite alternate}@keyframes tqVib{from{transform:translate(-2px,1px)}to{transform:translate(2px,-1px)}}
.tq .tq-suck{opacity:0}.tq .on .tq-suck{opacity:1}.tq .on .tq-suck path{animation:tqSuck .35s linear infinite}.tq .on .tq-suck path:nth-child(2){animation-delay:.12s}.tq .on .tq-suck path:nth-child(3){animation-delay:.24s}
@keyframes tqSuck{from{transform:translateX(40px);opacity:0}50%{opacity:1}to{transform:translateX(0);opacity:0}}
.tq .on .tq-can{transform-box:fill-box;transform-origin:center bottom;animation:tqVib .09s linear infinite alternate}
.tq .mo-a,.tq .mo-s,.tq .br-a,.tq .tq-dz,.tq .mo-o{display:none}
.tq .m-angry .mo-h,.tq .m-sad .mo-h,.tq .m-dizzy .mo-h,.tq .m-wow .mo-h{display:none}
.tq .m-angry .mo-a,.tq .m-angry .br-a,.tq .m-sad .mo-s,.tq .m-dizzy .mo-s,.tq .m-dizzy .tq-dz,.tq .m-wow .mo-o{display:inline}
.tq .m-angry .tq-face{fill:#F07B2E}
.tq .tq-dz{transform-box:fill-box;transform-origin:center;animation:tqSpin 1s linear infinite}
.tq .jump .tq-anim{animation:tqJump .55s cubic-bezier(.3,.8,.4,1) 2}@keyframes tqJump{0%,100%{transform:translateY(0) scale(1,1)}15%{transform:translateY(0) scale(1.08,.9)}45%{transform:translateY(-70px) scale(.95,1.06)}80%{transform:translateY(0) scale(1.06,.94)}}
.tq .dance .tq-anim{animation:tqDance .5s ease-in-out infinite alternate}@keyframes tqDance{from{transform:translateY(0) rotate(-8deg)}to{transform:translateY(-46px) rotate(8deg)}}
.tq .tq-mark{animation:tqMark .7s ease-in-out infinite alternate}@keyframes tqMark{from{transform:translateY(0)}to{transform:translateY(-16px)}}
.tq .tq-ring{transform-box:fill-box;transform-origin:center;animation:tqRing 1.2s ease-out infinite}@keyframes tqRing{from{transform:scale(.6);opacity:.9}to{transform:scale(1.5);opacity:0}}
.tq .tq-peek{animation:tqPeek 5s ease-in-out infinite}@keyframes tqPeek{0%,55%,100%{opacity:0}62%,90%{opacity:1}}
.tq .tq-spark{transform-box:fill-box;transform-origin:center;animation:tqTw 1.6s ease-in-out infinite alternate}@keyframes tqTw{from{transform:scale(.4) rotate(0);opacity:.2}to{transform:scale(1.1) rotate(40deg);opacity:1}}
@media (prefers-reduced-motion:reduce){.tq *{animation-duration:0s!important;animation-iteration-count:1!important}}
</style>`;
// ---------- the room (always there) ----------
function tqRoom(){ let planks='', seams='';
  [640,688,742,804,872].forEach((y,i)=>{ planks+=`<path d="M0,${y} L1600,${y}" stroke="#5E3520" stroke-opacity=".28" stroke-width="3"/>`; for(let x=(i%2)*140+60;x<1600;x+=280) seams+=`<path d="M${x},${y} L${x-(x-800)*.04},${[688,742,804,872,900][i]}" stroke="#5E3520" stroke-opacity=".22" stroke-width="3"/>`; });
  let panels=''; for(let x=24;x<1600;x+=150) panels+=`<rect x="${x}" y="488" width="124" height="78" rx="8" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="3"/>`;
  const curtainTop=`<path d="M566,92 L1034,92" stroke="${TQ_O}" stroke-width="12" stroke-linecap="round"/><path d="M566,92 L1034,92" stroke="#D88A35" stroke-width="6" stroke-linecap="round"/><circle cx="562" cy="92" r="11" fill="#D88A35" class="ol3"/><circle cx="1038" cy="92" r="11" fill="#D88A35" class="ol3"/>`;
  return `
<rect width="1600" height="600" fill="url(#tqWall)"/><rect width="1600" height="600" fill="url(#tqStripe)"/>
<path d="M0,0 L70,52 L70,600 L0,640Z" fill="#2E8FBF" opacity=".55"/><path d="M1600,0 L1530,52 L1530,600 L1600,640Z" fill="#2E8FBF" opacity=".55"/>
<rect width="1600" height="46" fill="#2B84B1"/><rect y="44" width="1600" height="12" fill="#FFF1D2"/>
<rect y="470" width="1600" height="130" fill="#2C93C4"/>${panels}<rect y="462" width="1600" height="14" fill="#FFF1D2" class="ol3"/>
<rect y="580" width="1600" height="22" fill="#FFF1D2" class="ol3"/>
<rect y="600" width="1600" height="300" fill="url(#tqFloor)"/>${planks}${seams}
<!-- mouse hole -->
<path d="M973,600 L973,566 A32,32 0 0 1 1037,566 L1037,600Z" fill="#20130C" class="ol"/>
<g class="tq-peek"><ellipse cx="997" cy="580" rx="6" ry="8" fill="#fff"/><ellipse cx="1015" cy="580" rx="6" ry="8" fill="#fff"/><circle cx="999" cy="582" r="3.5" fill="#111"/><circle cx="1017" cy="582" r="3.5" fill="#111"/></g>
<!-- window -->
<rect x="606" y="96" width="388" height="348" rx="16" fill="#FFF1D2" class="ol"/>
<rect x="626" y="116" width="348" height="308" rx="6" fill="url(#tqSky)"/>
<g clip-path="url(#tqWin)">
  <circle cx="905" cy="172" r="56" fill="#FFF3A6" opacity=".55"/><circle cx="905" cy="172" r="34" fill="#FFE066" class="ol3"/>
  <g class="tq-cloud"><ellipse cx="700" cy="170" rx="44" ry="20" fill="#fff"/><ellipse cx="728" cy="156" rx="30" ry="22" fill="#fff"/><ellipse cx="676" cy="162" rx="22" ry="16" fill="#fff"/></g>
  <g class="tq-cloud b"><ellipse cx="830" cy="232" rx="36" ry="15" fill="#fff" opacity=".9"/><ellipse cx="850" cy="222" rx="22" ry="16" fill="#fff" opacity=".9"/></g>
  <path d="M600,360 Q690,290 780,340 T980,320 L980,430 L600,430Z" fill="#8FD86E" class="ol3"/>
  <path d="M600,392 Q720,346 840,384 T1000,380 L1000,430 L600,430Z" fill="#62BF55" class="ol3"/>
  <rect x="706" y="300" width="10" height="44" fill="#8A5A3A"/><circle cx="711" cy="292" r="26" fill="#3FA34D" class="ol3"/><circle cx="696" cy="304" r="16" fill="#4DB65A"/>
  <rect x="902" y="316" width="8" height="34" fill="#8A5A3A"/><circle cx="906" cy="308" r="20" fill="#3FA34D" class="ol3"/>
</g>
<rect x="796" y="116" width="8" height="308" fill="#FFF1D2" class="ol3"/><rect x="626" y="266" width="348" height="8" fill="#FFF1D2" class="ol3"/>
<rect x="588" y="438" width="424" height="20" rx="8" fill="#FFF1D2" class="ol"/>
${curtainTop}
<!-- second picture + clock -->
<g><rect x="372" y="128" width="112" height="86" rx="6" fill="#7DCB5C" class="ol"/><rect x="384" y="140" width="88" height="62" fill="#D8F4FF"/><path d="M384,202 L410,168 L428,186 L446,160 L472,202Z" fill="#4E9A54"/><circle cx="455" cy="152" r="7" fill="#FFD84D"/></g>
<g><circle cx="1230" cy="170" r="48" fill="#FFF7E6" class="ol"/><circle cx="1230" cy="170" r="48" fill="none" stroke="#E2559B" stroke-width="8"/>
 ${[0,1,2,3,4,5,6,7,8,9,10,11].map(i=>{ const a=i*Math.PI/6; return `<circle cx="${(1230+Math.sin(a)*36).toFixed(1)}" cy="${(170-Math.cos(a)*36).toFixed(1)}" r="${i%3?2.5:4}" fill="${TQ_O}"/>`; }).join('')}
 <path class="tq-hh" d="M1230,170 L1230,142" stroke="${TQ_O}" stroke-width="6" stroke-linecap="round"/><path class="tq-hm" d="M1230,170 L1252,152" stroke="#E2559B" stroke-width="4" stroke-linecap="round"/><circle cx="1230" cy="170" r="5" fill="${TQ_O}"/></g>
<!-- shelves -->
<g><rect x="300" y="300" width="230" height="14" rx="4" fill="#C9874D" class="ol3"/><rect x="300" y="384" width="230" height="14" rx="4" fill="#C9874D" class="ol3"/>
 <path d="M320,314 L320,334 L338,314Z M510,314 L510,334 L492,314Z M320,398 L320,418 L338,398Z M510,398 L510,418 L492,398Z" fill="#A86A35" class="ol3"/>
 ${[[310,'#E85D75',62],[332,'#3FA9F5',72],[356,'#FFC93C',56],[376,'#7E57C2',66],[400,'#3CB38A',70]].map(([x,c,h])=>`<rect x="${x}" y="${300-h}" width="20" height="${h}" rx="3" fill="${c}" class="ol3"/>`).join('')}
 <g transform="rotate(-14 440 296)"><rect x="428" y="236" width="20" height="62" rx="3" fill="#FF8A3D" class="ol3"/></g>
 <ellipse cx="495" cy="290" rx="20" ry="12" fill="#FFE066" class="ol3"/><circle cx="495" cy="276" r="14" fill="#FFE066" class="ol3"/><circle cx="500" cy="273" r="2.5" fill="${TQ_O}"/><path d="M508,278 l10,2 l-10,3z" fill="#FF8A3D"/></g>
<!-- bed (frame) -->
<g><ellipse cx="320" cy="752" rx="270" ry="22" fill="url(#tqShadow)"/>
 <rect x="80" y="430" width="52" height="320" rx="16" fill="#E46FA8" class="ol"/><circle cx="106" cy="424" r="17" fill="#F49AC4" class="ol"/><rect x="92" y="470" width="28" height="200" rx="10" fill="#F49AC4" opacity=".6"/>
 <rect x="498" y="566" width="46" height="184" rx="14" fill="#E46FA8" class="ol"/><circle cx="521" cy="560" r="15" fill="#F49AC4" class="ol"/>
 <rect x="122" y="640" width="384" height="62" rx="12" fill="#D2589A" class="ol"/><rect x="150" y="700" width="18" height="44" fill="#B2457E" class="ol3"/><rect x="460" y="700" width="18" height="44" fill="#B2457E" class="ol3"/>
 <rect x="128" y="598" width="374" height="50" rx="18" fill="#FFFFFF" class="ol"/></g>
<!-- rug -->
<g><ellipse cx="820" cy="782" rx="350" ry="76" fill="#F6C343" class="ol"/><ellipse cx="820" cy="782" rx="290" ry="60" fill="#38B48B"/><ellipse cx="820" cy="782" rx="220" ry="44" fill="#E85D75"/><ellipse cx="820" cy="782" rx="150" ry="30" fill="#9B7BE0"/><ellipse cx="820" cy="782" rx="70" ry="14" fill="#FFE9A8"/></g>
<!-- dresser -->
<g><ellipse cx="1190" cy="728" rx="160" ry="16" fill="url(#tqShadow)"/>
 <rect x="1062" y="486" width="256" height="232" rx="12" fill="#F6A63F" class="ol"/><rect x="1048" y="470" width="284" height="24" rx="8" fill="#E08A27" class="ol"/>
 ${[506,576,646].map(y=>`<rect x="1080" y="${y}" width="220" height="56" rx="8" fill="#FFBE5C" class="ol3"/><circle cx="1150" cy="${y+28}" r="7" fill="#C8691E" class="ol3"/><circle cx="1230" cy="${y+28}" r="7" fill="#C8691E" class="ol3"/>`).join('')}
 <rect x="1076" y="716" width="20" height="18" fill="#C8691E" class="ol3"/><rect x="1284" y="716" width="20" height="18" fill="#C8691E" class="ol3"/>
 <path d="M1100,470 L1094,420 Q1110,400 1126,420 L1120,470Z" fill="#5BC0EB" class="ol3"/>
 <path d="M1110,404 Q1100,370 1086,358 M1110,404 Q1112,366 1116,350 M1110,404 Q1124,372 1140,362" stroke="#3E9B4A" stroke-width="4" fill="none"/>
 <circle cx="1086" cy="354" r="11" fill="#FF6F91" class="ol3"/><circle cx="1116" cy="344" r="11" fill="#FFD84D" class="ol3"/><circle cx="1142" cy="358" r="11" fill="#B07CFF" class="ol3"/>
 <rect x="1220" y="440" width="70" height="14" rx="3" fill="#3FA9F5" class="ol3"/><rect x="1226" y="426" width="60" height="14" rx="3" fill="#E85D75" class="ol3"/><rect x="1232" y="412" width="50" height="14" rx="3" fill="#3CB38A" class="ol3"/></g>
<!-- armchair -->
<g><ellipse cx="1462" cy="752" rx="110" ry="14" fill="url(#tqShadow)"/>
 <rect x="1380" y="556" width="164" height="150" rx="46" fill="#36B5A2" class="ol"/><rect x="1402" y="580" width="120" height="80" rx="30" fill="#5FD0BE" opacity=".6"/>
 <rect x="1360" y="664" width="204" height="58" rx="24" fill="#2FA391" class="ol"/><ellipse cx="1366" cy="664" rx="24" ry="44" fill="#36B5A2" class="ol"/><ellipse cx="1558" cy="664" rx="24" ry="44" fill="#36B5A2" class="ol"/>
 <rect x="1384" y="718" width="14" height="30" fill="#8A5A3A" class="ol3"/><rect x="1526" y="718" width="14" height="30" fill="#8A5A3A" class="ol3"/>
 <rect x="1430" y="640" width="70" height="36" rx="14" fill="#FFC93C" class="ol3" transform="rotate(-8 1465 658)"/></g>`; }
// ---------- the messes: each has a messy look and (for "fix" ones) a tidy look ----------
// x,y = where the sparkles go; cx = where Misho stands; my = marker height
const TQ_MESS=[
 {id:'cobweb',kind:'rm',x:1500,y:110,cx:1330,my:60,d:`<g opacity=".85"><path d="M1530,52 L1420,52 M1530,52 L1440,120 M1530,52 L1486,160 M1530,52 L1530,170" stroke="#fff" stroke-width="3"/>${[30,60,90].map(r=>`<path d="M${1530-r},52 Q${1530-r*.8},${52+r*.35} ${1530-r*.72},${52+r*.72} Q${1530-r*.45},${52+r*.85} ${1530-r*.35},${52+r*1.1} Q${1530-r*.12},${52+r*1.05} 1530,${52+r*1.2}" fill="none" stroke="#fff" stroke-width="2.5"/>`).join('')}<path d="M1486,160 L1486,200" stroke="#fff" stroke-width="2"/><circle cx="1486" cy="208" r="9" fill="#333"/><circle cx="1483" cy="206" r="2" fill="#fff"/><circle cx="1490" cy="206" r="2" fill="#fff"/></g>`},
 {id:'curtains',kind:'fix',x:800,y:280,cx:640,my:60,
  d:`<path d="M580,92 L806,92 C798,200 812,330 800,474 L592,474 C604,330 572,200 580,92Z" fill="#E77F1F" class="ol"/><path d="M630,100 C640,230 622,360 640,470 M690,100 C700,230 684,360 700,470 M750,100 C760,230 744,360 756,470" stroke="#B85E10" stroke-width="4" fill="none"/>`+tqMir(`<path d="M580,92 L806,92 C798,200 812,330 800,474 L592,474 C604,330 572,200 580,92Z" fill="#E77F1F" class="ol"/><path d="M630,100 C640,230 622,360 640,470 M690,100 C700,230 684,360 700,470 M750,100 C760,230 744,360 756,470" stroke="#B85E10" stroke-width="4" fill="none"/>`),
  c:`<path d="M572,92 L652,92 C640,190 676,250 650,300 C680,360 640,420 662,474 L578,474 C596,420 560,330 584,300 C562,240 586,180 572,92Z" fill="#FF9F2E" class="ol"/><path d="M604,100 C600,200 620,250 610,300 M628,100 C624,200 648,250 632,300 M610,310 C600,380 620,430 610,470 M634,310 C630,380 650,430 640,470" stroke="#D87A12" stroke-width="3.5" fill="none"/><rect x="574" y="290" width="86" height="18" rx="9" fill="#FFD84D" class="ol3"/>`+tqMir(`<path d="M572,92 L652,92 C640,190 676,250 650,300 C680,360 640,420 662,474 L578,474 C596,420 560,330 584,300 C562,240 586,180 572,92Z" fill="#FF9F2E" class="ol"/><path d="M604,100 C600,200 620,250 610,300 M628,100 C624,200 648,250 632,300 M610,310 C600,380 620,430 610,470 M634,310 C630,380 650,430 640,470" stroke="#D87A12" stroke-width="3.5" fill="none"/><rect x="574" y="290" width="86" height="18" rx="9" fill="#FFD84D" class="ol3"/>`)},
 {id:'lamp',kind:'fix',x:800,y:150,cx:650,my:40,
  d:`<path d="M800,0 L800,76" stroke="${TQ_O}" stroke-width="4"/><path d="M768,74 L832,74 L872,134 L728,134Z" fill="#B54480" class="ol"/><ellipse cx="800" cy="138" rx="22" ry="10" fill="#9AA0A8" class="ol3"/>`,
  c:`<path d="M728,134 L872,134 L1010,600 L590,600Z" fill="#FFF3B0" opacity=".16"/><ellipse cx="800" cy="200" rx="230" ry="170" fill="url(#tqGlow)"/><path d="M800,0 L800,76" stroke="${TQ_O}" stroke-width="4"/><path d="M768,74 L832,74 L872,134 L728,134Z" fill="#E2559B" class="ol"/><path d="M780,82 L770,126" stroke="#fff" stroke-opacity=".5" stroke-width="6" stroke-linecap="round"/><ellipse cx="800" cy="138" rx="22" ry="10" fill="#FFF7C2" class="ol3"/>`},
 {id:'picture',kind:'fix',x:230,y:200,cx:390,my:110,
  d:`<g transform="rotate(-18 230 210)"><rect x="160" y="150" width="140" height="112" rx="6" fill="#F2A33A" class="ol"/><rect x="174" y="164" width="112" height="84" fill="#FFF0B8"/><path d="M174,226 Q200,214 230,226 T286,226 L286,248 L174,248Z" fill="#3FA9F5"/><path d="M206,222 L254,222 L246,234 L214,234Z" fill="#C8691E" class="ol3"/><path d="M230,222 L230,176 L254,214Z" fill="#fff" class="ol3"/><circle cx="270" cy="182" r="9" fill="#FF8A3D"/></g><path d="M196,150 L230,128 L262,140" stroke="${TQ_O}" stroke-width="3" fill="none"/>`,
  c:`<path d="M182,152 L230,124 L278,152" stroke="${TQ_O}" stroke-width="3" fill="none"/><circle cx="230" cy="124" r="4" fill="${TQ_O}"/><rect x="160" y="150" width="140" height="112" rx="6" fill="#F2A33A" class="ol"/><rect x="174" y="164" width="112" height="84" fill="#FFF0B8"/><path d="M174,226 Q200,214 230,226 T286,226 L286,248 L174,248Z" fill="#3FA9F5"/><path d="M206,222 L254,222 L246,234 L214,234Z" fill="#C8691E" class="ol3"/><path d="M230,222 L230,176 L254,214Z" fill="#fff" class="ol3"/><circle cx="270" cy="182" r="9" fill="#FF8A3D"/>`},
 {id:'books',kind:'fix',x:300,y:830,cx:470,my:770,
  d:`<g transform="rotate(-20 250 830)"><rect x="210" y="818" width="70" height="20" rx="3" fill="#E85D75" class="ol3"/></g><g transform="rotate(12 330 840)"><rect x="296" y="828" width="74" height="22" rx="3" fill="#3FA9F5" class="ol3"/></g><path d="M360,812 L400,800 L440,812 L440,846 L400,834 L360,846Z" fill="#fff" class="ol3"/><path d="M400,800 L400,834" stroke="${TQ_O}" stroke-width="3"/><path d="M368,818 L392,812 M368,826 L392,820 M408,812 L432,818 M408,820 L432,826" stroke="#999" stroke-width="2"/><g transform="rotate(-6 250 860)"><rect x="226" y="848" width="60" height="18" rx="3" fill="#FFC93C" class="ol3"/></g>`,
  c:`${[[426,'#E85D75',64],[446,'#3FA9F5',72],[470,'#FFC93C',58],[490,'#7E57C2',68]].map(([x,cl,h])=>`<rect x="${x}" y="${384-h}" width="18" height="${h}" rx="3" fill="${cl}" class="ol3"/>`).join('')}`},
 {id:'plant',kind:'fix',x:560,y:690,cx:400,my:600,
  d:`<path d="M520,748 Q560,724 610,740 Q640,756 600,764 Q560,770 520,760Z" fill="#6B4226" class="ol3"/><g transform="rotate(-80 560 720)"><path d="M534,690 L586,690 L578,744 L542,744Z" fill="#E0703A" class="ol"/><rect x="528" y="682" width="64" height="14" rx="5" fill="#F08A4B" class="ol3"/></g><ellipse cx="636" cy="742" rx="22" ry="8" fill="#3E9B4A" class="ol3" transform="rotate(20 636 742)"/><ellipse cx="500" cy="752" rx="18" ry="7" fill="#4DB65A" class="ol3" transform="rotate(-25 500 752)"/>`,
  c:`<ellipse cx="562" cy="748" rx="44" ry="8" fill="url(#tqShadow)"/><path d="M562,690 Q520,640 506,600 Q540,620 556,664 M562,690 Q560,630 574,590 Q582,630 566,684 M562,690 Q600,644 624,616 Q612,656 568,690" fill="#3E9B4A" class="ol3"/><ellipse cx="520" cy="628" rx="22" ry="11" fill="#4DB65A" class="ol3" transform="rotate(40 520 628)"/><ellipse cx="604" cy="630" rx="22" ry="11" fill="#4DB65A" class="ol3" transform="rotate(-40 604 630)"/><ellipse cx="572" cy="604" rx="11" ry="22" fill="#5CC86A" class="ol3"/><path d="M536,690 L588,690 L580,746 L544,746Z" fill="#E0703A" class="ol"/><rect x="530" y="682" width="64" height="14" rx="5" fill="#F08A4B" class="ol3"/>`},
 {id:'bed',kind:'fix',x:320,y:610,cx:600,my:520,
  d:`<path d="M196,604 C222,546 286,566 304,588 C334,540 410,556 420,594 C462,578 500,594 506,614 L506,664 C474,706 444,646 424,706 L400,710 C380,652 300,694 262,656 C230,672 200,650 196,604Z" fill="#3E7FE6" class="ol"/><path d="M250,600 C270,620 300,610 320,630 M360,590 C380,610 400,600 420,630" stroke="#2B5FB8" stroke-width="4" fill="none"/><path d="M424,706 L430,744 L404,740 L400,710Z" fill="#FFF" class="ol3"/><g transform="rotate(-14 610 858)"><ellipse cx="610" cy="858" rx="54" ry="22" fill="#FFF8EC" class="ol"/></g>`,
  c:`<ellipse cx="196" cy="592" rx="58" ry="26" fill="#FFF8EC" class="ol"/><path d="M180,584 Q196,578 214,586" stroke="#E8DCC6" stroke-width="3" fill="none"/><path d="M250,586 Q380,572 508,590 L508,668 Q380,690 250,672Z" fill="#3E7FE6" class="ol"/><path d="M250,586 Q380,572 508,590 L508,606 Q380,590 250,604Z" fill="#fff" class="ol3"/>${[300,350,400,450].map(x=>`<circle cx="${x}" cy="640" r="7" fill="#FFD84D"/>`).join('')}`},
 {id:'dust',kind:'rm',x:300,y:770,cx:470,my:700,d:`${[[250,770,22],[312,778,26],[370,768,18]].map(([x,y,r])=>`<path d="${[...Array(12)].map((_,i)=>{ const a=i*Math.PI/6, rr=i%2?r:r*1.18; return (i?'L':'M')+(x+Math.cos(a)*rr).toFixed(1)+','+(y+Math.sin(a)*rr*.8).toFixed(1); }).join('')}Z" fill="#A8A2A0" class="ol3"/><circle cx="${x-6}" cy="${y-3}" r="3" fill="#222"/><circle cx="${x+6}" cy="${y-3}" r="3" fill="#222"/>`).join('')}`},
 {id:'socks',kind:'rm',x:740,y:780,cx:600,my:720,d:`<path d="M690,760 L712,760 L712,788 Q712,800 728,800 L746,800 Q756,812 744,818 L716,818 Q692,818 690,796Z" fill="#fff" class="ol3"/><path d="M690,768 L712,768 M690,778 L712,778" stroke="#E85D75" stroke-width="5"/><g transform="rotate(30 790 780)"><path d="M770,756 L792,756 L792,784 Q792,796 808,796 L826,796 Q836,808 824,814 L796,814 Q772,814 770,792Z" fill="#7BD3F7" class="ol3"/><path d="M770,764 L792,764 M770,774 L792,774" stroke="#3F7FE0" stroke-width="5"/></g><path d="M640,790 Q660,760 700,770 L720,800 Q690,822 650,812Z" fill="#FFC93C" class="ol3"/>`},
 {id:'juice',kind:'rm',x:1010,y:830,cx:860,my:770,d:`<path d="M940,830 Q960,806 1010,812 Q1062,806 1086,828 Q1100,850 1060,858 Q1020,872 970,860 Q930,852 940,830Z" fill="url(#tqJuice)" class="ol3"/><ellipse cx="990" cy="826" rx="18" ry="5" fill="#fff" opacity=".6"/><g transform="rotate(-80 1060 820)"><path d="M1040,786 L1080,786 L1074,836 L1046,836Z" fill="#DDF3FF" class="ol3" opacity=".95"/><path d="M1046,812 L1076,812 L1074,836 L1046,836Z" fill="#FFB12E"/></g>`},
 {id:'papers',kind:'rm',x:1170,y:800,cx:1020,my:740,d:`${[[1120,800,20],[1166,812,16],[1206,796,22],[1240,816,14]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="#F4F1EA" class="ol3"/><path d="M${x-r*.6},${y-r*.2} L${x-r*.1},${y+r*.3} L${x+r*.2},${y-r*.3} L${x+r*.6},${y+r*.1}" stroke="#B8B2A6" stroke-width="2.5" fill="none"/>`).join('')}`},
 {id:'footprints',kind:'rm',x:860,y:660,cx:700,my:590,d:`${[[985,624],[948,638],[910,650],[872,662],[834,672],[796,682],[758,692]].map(([x,y],i)=>`<ellipse cx="${x}" cy="${y+(i%2?8:-6)}" rx="10" ry="6" fill="#6B4226" opacity=".85"/><circle cx="${x-8}" cy="${y+(i%2?2:-12)}" r="3" fill="#6B4226" opacity=".85"/><circle cx="${x}" cy="${y+(i%2?0:-14)}" r="3" fill="#6B4226" opacity=".85"/>`).join('')}`},
 {id:'blocks',kind:'rm',x:900,y:860,cx:740,my:800,d:`${[[860,850,'#E85D75','A'],[910,862,'#3FA9F5','B'],[884,816,'#FFC93C','C'],[960,846,'#3CB38A','1']].map(([x,y,c,l])=>`<g><path d="M${x},${y} l20,-12 l40,0 l-20,12Z" fill="#fff" opacity=".55" class="ol3"/><rect x="${x}" y="${y}" width="40" height="40" rx="4" fill="${c}" class="ol3"/><path d="M${x+40},${y} l20,-12 l0,40 l-20,12Z" fill="${c}" class="ol3" opacity=".75"/><text x="${x+20}" y="${y+30}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="26" fill="#fff" stroke="${TQ_O}" stroke-width="1.5">${l}</text></g>`).join('')}`},
 {id:'pizza',kind:'rm',x:1290,y:850,cx:1130,my:790,d:`<path d="M1220,840 L1360,840 L1360,880 L1220,880Z" fill="#D9A066" class="ol3"/><path d="M1220,840 L1250,790 L1390,790 L1360,840Z" fill="#C88A50" class="ol3"/><path d="M1232,836 L1290,808 L1300,838Z" fill="#FFD27A" class="ol3"/><circle cx="1280" cy="826" r="5" fill="#E8413E"/><path d="M1300,836 L1350,812 L1352,838Z" fill="#FFD27A" class="ol3"/><circle cx="1336" cy="828" r="5" fill="#E8413E"/>${[[1206,870],[1196,858],[1374,872],[1384,860]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="3" fill="#E0A458"/>`).join('')}`},
 {id:'banana',kind:'rm',x:1450,y:830,cx:1290,my:770,d:`<path d="M1430,836 Q1450,800 1476,812 Q1462,824 1456,846Z" fill="#FFE066" class="ol3"/><path d="M1430,836 Q1404,820 1396,846 Q1420,846 1440,846Z" fill="#FFD23F" class="ol3"/><path d="M1440,846 Q1005,850 1490,866 Q1462,870 1436,856Z" fill="#FFE066" class="ol3"/><circle cx="1440" cy="840" r="6" fill="#8A5A3A"/>`}
];
const TQ_ORDER=['curtains','bed','socks','juice','papers','lamp','plant','books','picture','pizza','blocks','dust','footprints','banana','cobweb'];
// ---------- characters (original designs) ----------
function tqCat(){ const fur='#F39A3D', cream='#FFF0D6', st=`stroke="${TQ_O}"`;
  const limb=(d,w,c)=>`<path d="${d}" ${st} stroke-width="${w+8}" stroke-linecap="round" fill="none"/><path d="${d}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
  return `<ellipse cx="0" cy="0" rx="70" ry="13" fill="url(#tqShadow)"/>
<g class="tq-anim"><g class="tq-bob">
 <g class="tq-tail">${limb('M-40,-92 C-104,-92 -122,-150 -96,-200 C-86,-222 -60,-218 -68,-196',16,fur)}<path d="M-96,-200 C-86,-222 -60,-218 -68,-196" stroke="${cream}" stroke-width="10" stroke-linecap="round" fill="none"/></g>
 <g class="tq-can"><rect x="-132" y="-78" width="82" height="60" rx="26" fill="#E8414E" class="ol"/><rect x="-120" y="-68" width="34" height="14" rx="7" fill="#FF9AA2"/><circle cx="-90" cy="-48" r="9" fill="#FFD84D" class="ol3"/><circle cx="-116" cy="-14" r="12" fill="#4A4A55" class="ol3"/><circle cx="-66" cy="-14" r="12" fill="#4A4A55" class="ol3"/></g>
 <path d="M-54,-52 C-14,-16 26,-84 64,-104" fill="none" ${st} stroke-width="15"/><path d="M-54,-52 C-14,-16 26,-84 64,-104" fill="none" stroke="#A9B3BE" stroke-width="8" stroke-dasharray="7 4"/>
 <g class="tq-leg l1">${limb('M-20,-72 L-24,-14',18,fur)}<ellipse cx="-18" cy="-8" rx="25" ry="12" fill="${cream}" class="ol"/></g>
 <g class="tq-leg l2">${limb('M22,-72 L24,-14',18,fur)}<ellipse cx="30" cy="-8" rx="25" ry="12" fill="${cream}" class="ol"/></g>
 <ellipse cx="0" cy="-106" rx="50" ry="62" fill="${fur}" class="ol tq-face"/><ellipse cx="14" cy="-98" rx="30" ry="44" fill="${cream}"/>
 <path d="M-46,-124 q12,5 20,-6 M-50,-104 q14,5 22,-6 M-46,-84 q12,5 20,-6" stroke="#C9661F" stroke-width="5" fill="none" stroke-linecap="round"/>
 <g class="tq-head">
  <path d="M-42,-206 L-50,-266 L-6,-230Z" fill="${fur}" class="ol tq-face"/><path d="M-40,-216 L-44,-250 L-18,-230Z" fill="#FF9FB0"/>
  <path d="M22,-232 L54,-268 L60,-210Z" fill="${fur}" class="ol tq-face"/><path d="M30,-232 L52,-256 L54,-218Z" fill="#FF9FB0"/>
  <path d="M-60,-180 C-64,-238 62,-248 68,-186 C72,-150 42,-128 4,-128 C-36,-128 -58,-148 -60,-180Z" fill="${fur}" class="ol tq-face"/>
  <path d="M-58,-172 l-16,4 l12,6 l-12,8 l16,0" fill="${fur}" class="ol3"/>
  <path d="M-6,-232 l4,14 M8,-236 l2,14 M22,-234 l-1,13" stroke="#C9661F" stroke-width="5" stroke-linecap="round"/>
  <ellipse cx="24" cy="-158" rx="34" ry="22" fill="${cream}" class="ol3"/>
  <g class="tq-eyes"><ellipse cx="2" cy="-192" rx="14" ry="18" fill="#fff" class="ol3"/><ellipse cx="42" cy="-194" rx="14" ry="18" fill="#fff" class="ol3"/>
   <circle cx="8" cy="-190" r="8" fill="#38A85A"/><circle cx="48" cy="-192" r="8" fill="#38A85A"/><circle cx="9" cy="-190" r="4.5" fill="#111"/><circle cx="49" cy="-192" r="4.5" fill="#111"/><circle cx="11" cy="-194" r="2.2" fill="#fff"/><circle cx="51" cy="-196" r="2.2" fill="#fff"/></g>
  <path class="br-a" d="M-12,-216 L18,-204 M30,-206 L58,-218" stroke="${TQ_O}" stroke-width="7" stroke-linecap="round"/>
  <path d="M32,-174 l14,0 l-7,9z" fill="#FF6F91" class="ol3"/>
  <g class="mo-h"><path d="M18,-150 q14,16 30,0" fill="#B5304A" class="ol3"/><path d="M26,-146 q7,6 14,0" fill="#FF8FA3"/></g>
  <g class="mo-a"><path d="M14,-146 q18,-10 36,0 l0,8 q-18,-8 -36,0z" fill="#fff" class="ol3"/></g>
  <g class="mo-s"><path d="M18,-142 q14,-12 30,0" fill="none" class="ol3"/></g>
  <g class="mo-o"><ellipse cx="34" cy="-146" rx="8" ry="10" fill="#B5304A" class="ol3"/></g>
  <path d="M56,-162 l38,-8 M56,-155 l40,0 M56,-148 l36,7 M-6,-162 l-30,-8 M-6,-155 l-32,0" stroke="${TQ_O}" stroke-width="2.5" stroke-linecap="round"/>
  <g class="tq-dz"><path d="${tqStar(12)}" transform="translate(-30,-262)" fill="#FFD84D" class="ol3"/><path d="${tqStar(10)}" transform="translate(40,-276)" fill="#FFD84D" class="ol3"/><path d="${tqStar(9)}" transform="translate(70,-240)" fill="#FFD84D" class="ol3"/></g>
 </g>
 ${limb('M10,-132 Q40,-120 64,-104',14,fur)}<circle cx="66" cy="-103" r="12" fill="${cream}" class="ol3"/>
 <path d="M66,-104 L146,-14" ${st} stroke-width="13" stroke-linecap="round"/><path d="M66,-104 L146,-14" stroke="#CBD3DB" stroke-width="7" stroke-linecap="round"/>
 <g class="tq-noz"><rect x="120" y="-20" width="66" height="20" rx="7" fill="#E8414E" class="ol"/><rect x="128" y="-16" width="20" height="5" rx="2" fill="#FF9AA2"/></g>
 <g class="tq-suck"><path d="M196,-30 q10,8 0,18" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M206,-8 q12,4 2,14" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M200,6 q10,-2 6,10" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/></g>
</g></g>`; }
function tqMouse(){ const fur='#B9B0CC', belly='#F3EDF8', st=`stroke="${TQ_O}"`;
  return `<ellipse cx="0" cy="0" rx="34" ry="7" fill="url(#tqShadow)"/>
<g class="tq-anim"><g class="tq-bob">
 <path class="tq-tail" d="M-20,-22 C-56,-14 -64,-52 -92,-44 C-104,-40 -108,-30 -100,-24" fill="none" ${st} stroke-width="9" stroke-linecap="round"/><path d="M-20,-22 C-56,-14 -64,-52 -92,-44 C-104,-40 -108,-30 -100,-24" fill="none" stroke="#F4A9B8" stroke-width="4" stroke-linecap="round"/>
 <g class="tq-leg l1"><path d="M-8,-18 L-10,-6" ${st} stroke-width="9" stroke-linecap="round"/><ellipse cx="-8" cy="-4" rx="12" ry="6" fill="#F4A9B8" class="ol3"/></g>
 <g class="tq-leg l2"><path d="M10,-18 L12,-6" ${st} stroke-width="9" stroke-linecap="round"/><ellipse cx="16" cy="-4" rx="12" ry="6" fill="#F4A9B8" class="ol3"/></g>
 <ellipse cx="0" cy="-34" rx="24" ry="28" fill="${fur}" class="ol3"/><ellipse cx="6" cy="-30" rx="14" ry="18" fill="${belly}"/>
 <path d="M-14,-54 Q4,-46 22,-56 L20,-46 Q4,-38 -12,-44Z" fill="#FFC93C" class="ol3"/><path d="M-12,-48 L-26,-30 L-14,-30Z" fill="#FFC93C" class="ol3"/>
 <path d="M18,-40 Q30,-46 34,-56" ${st} stroke-width="8" stroke-linecap="round" fill="none"/><path d="M18,-40 Q30,-46 34,-56" stroke="${fur}" stroke-width="4" stroke-linecap="round" fill="none"/>
 <g class="tq-head">
  <circle cx="-16" cy="-98" r="18" fill="${fur}" class="ol3"/><circle cx="-16" cy="-98" r="11" fill="#FFA8BC"/><circle cx="26" cy="-100" r="18" fill="${fur}" class="ol3"/><circle cx="26" cy="-100" r="11" fill="#FFA8BC"/>
  <circle cx="6" cy="-76" r="25" fill="${fur}" class="ol3"/><ellipse cx="26" cy="-68" rx="13" ry="10" fill="${belly}"/>
  <g class="tq-eyes"><ellipse cx="6" cy="-82" rx="6.5" ry="8.5" fill="#fff" class="ol3"/><ellipse cx="22" cy="-83" rx="6.5" ry="8.5" fill="#fff" class="ol3"/><circle cx="8" cy="-81" r="3.6" fill="#111"/><circle cx="24" cy="-82" r="3.6" fill="#111"/><circle cx="9" cy="-83" r="1.4" fill="#fff"/><circle cx="25" cy="-84" r="1.4" fill="#fff"/></g>
  <circle cx="38" cy="-71" r="5" fill="#FF6F91" class="ol3"/>
  <path d="M16,-62 q10,8 20,-2" fill="#B5304A" class="ol3"/><rect x="22" y="-61" width="6" height="5" fill="#fff" class="ol3" stroke-width="1.5"/>
  <path d="M40,-68 l20,-5 M40,-64 l21,2 M12,-66 l-18,-3" stroke="${TQ_O}" stroke-width="2" stroke-linecap="round"/>
 </g>
</g></g>`; }
// ---------- shared bits for the other cartoon rooms ----------
const tqBox=(x,y,s)=>{ s=s||1; const w=96*s, h=74*s, l=x-w/2, t=y-h; return `<g><ellipse cx="${x}" cy="${y+2}" rx="${w*.62}" ry="${10*s}" fill="url(#tqShadow)"/><path d="M${l},${t} l${w*.22},${-16*s} l${w},0 l${-w*.22},${16*s}Z" fill="#E3B57A" class="ol3"/><rect x="${l}" y="${t}" width="${w}" height="${h}" rx="4" fill="#C98F4E" class="ol3"/><path d="M${l+w},${t} l${w*.22},${-16*s} l0,${h} l${-w*.22},${16*s}Z" fill="#B37A3C" class="ol3"/><rect x="${x-9*s}" y="${t}" width="${18*s}" height="${h}" fill="#E8C990" opacity=".9"/><path d="M${l+10*s},${t+h-18*s} l14,0 M${l+10*s},${t+h-11*s} l22,0" stroke="#7A4E22" stroke-width="3"/></g>`; };
const tqWin=(x,y,w,h,sky,inner)=>`<rect x="${x-14}" y="${y-14}" width="${w+28}" height="${h+28}" rx="14" fill="#FFF6E6" class="ol"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${sky}"/><g clip-path="url(#tqW2)">${inner}</g><rect x="${x+w/2-4}" y="${y}" width="8" height="${h}" fill="#FFF6E6" class="ol3"/><rect x="${x}" y="${y+h/2-4}" width="${w}" height="8" fill="#FFF6E6" class="ol3"/><rect x="${x-26}" y="${y+h+12}" width="${w+52}" height="18" rx="7" fill="#FFF6E6" class="ol"/>`;
const tqFloorPlanks=(c1,c2,line)=>{ let s=`<rect y="600" width="1600" height="300" fill="${c1}"/><rect y="600" width="1600" height="300" fill="${c2}" opacity=".35"/>`; [640,688,742,804,872].forEach((y,i)=>{ s+=`<path d="M0,${y} L1600,${y}" stroke="${line}" stroke-opacity=".3" stroke-width="3"/>`; for(let x=(i%2)*140+60;x<1600;x+=280) s+=`<path d="M${x},${y} L${x-(x-800)*.04},${[688,742,804,872,900][i]}" stroke="${line}" stroke-opacity=".22" stroke-width="3"/>`; }); return s; };
const tqTiles=(c1,c2)=>{ let s=`<rect y="600" width="1600" height="300" fill="${c1}"/>`; const rows=[600,648,706,776,860,900]; for(let r=0;r<5;r++){ const y0=rows[r], y1=rows[r+1], k0=.6+r*.12, k1=.6+(r+1)*.12; for(let i=-10;i<10;i++){ if((i+r)%2) continue; const xa=800+i*100*k0, xb=800+(i+1)*100*k0, xc=800+(i+1)*100*k1, xd=800+i*100*k1; s+=`<path d="M${xa},${y0} L${xb},${y0} L${xc},${y1} L${xd},${y1}Z" fill="${c2}"/>`; } } return s; };
const tqHole=x=>`<path d="M${x-32},600 L${x-32},566 A32,32 0 0 1 ${x+32},566 L${x+32},600Z" fill="#20130C" class="ol"/><g class="tq-peek"><ellipse cx="${x-8}" cy="580" rx="6" ry="8" fill="#fff"/><ellipse cx="${x+10}" cy="580" rx="6" ry="8" fill="#fff"/><circle cx="${x-6}" cy="582" r="3.5" fill="#111"/><circle cx="${x+12}" cy="582" r="3.5" fill="#111"/></g>`;
const tqPlant=(x,y,s)=>{ s=s||1; return `<g transform="translate(${x},${y}) scale(${s})"><ellipse cx="0" cy="2" rx="46" ry="9" fill="url(#tqShadow)"/><path d="M0,-58 Q-46,-110 -60,-150 Q-24,-130 -8,-84 M0,-58 Q-2,-130 12,-170 Q22,-128 4,-64 M0,-58 Q40,-104 64,-136 Q52,-96 6,-58" fill="#3E9B4A" class="ol3"/><ellipse cx="-42" cy="-112" rx="24" ry="12" fill="#4DB65A" class="ol3" transform="rotate(40 -42 -112)"/><ellipse cx="44" cy="-110" rx="24" ry="12" fill="#4DB65A" class="ol3" transform="rotate(-40 44 -110)"/><ellipse cx="10" cy="-150" rx="12" ry="24" fill="#5CC86A" class="ol3"/><path d="M-30,-60 L30,-60 L22,0 L-22,0Z" fill="#E0703A" class="ol"/><rect x="-36" y="-70" width="72" height="16" rx="6" fill="#F08A4B" class="ol3"/></g>`; };
const tqBalloons=(x,y)=>`<g><path d="M${x},${y} Q${x-30},${y-80} ${x-40},${y-170} M${x},${y} Q${x+4},${y-90} ${x+6},${y-190} M${x},${y} Q${x+30},${y-80} ${x+46},${y-160}" stroke="${TQ_O}" stroke-width="2" fill="none"/>${[[x-40,y-200,'#FF6F91'],[x+6,y-222,'#FFD84D'],[x+48,y-190,'#3FA9F5']].map(([bx,by,c])=>`<ellipse cx="${bx}" cy="${by}" rx="30" ry="36" fill="${c}" class="ol3"/><ellipse cx="${bx-10}" cy="${by-12}" rx="7" ry="11" fill="#fff" opacity=".55"/><path d="M${bx-5},${by+36} l5,8 l5,-8z" fill="${c}" class="ol3"/>`).join('')}</g>`;
const tqFlowers=(x,y,s)=>{ s=s||1; return `<g transform="translate(${x},${y}) scale(${s})"><path d="M0,-40 Q-8,-80 -26,-96 M0,-40 Q2,-86 6,-108 M0,-40 Q12,-82 30,-92" stroke="#3E9B4A" stroke-width="4" fill="none"/>${[[-26,-98,'#FF6F91'],[6,-110,'#FFD84D'],[30,-94,'#B07CFF']].map(([a,b,c])=>`<circle cx="${a}" cy="${b}" r="12" fill="${c}" class="ol3"/><circle cx="${a}" cy="${b}" r="4" fill="#fff"/>`).join('')}<path d="M-16,-44 L16,-44 L12,0 L-12,0Z" fill="#5BC0EB" class="ol3"/></g>`; };

// ================= Laila's cold room (cartoon) =================
// Snowy night outside, a broken window, a cold fireplace. Every right answer fixes or adds one cosy thing,
// the blue cold tint fades and Laila (in hijab, original character) warms up and cheers.
function tqHomeRoom(){ let panels=''; for(let x=24;x<1600;x+=150) panels+=`<rect x="${x}" y="488" width="124" height="78" rx="8" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="3"/>`;
  return `<defs><linearGradient id="tqHWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F9C99B"/><stop offset="1" stop-color="#F3A97A"/></linearGradient><pattern id="tqHDot" width="70" height="70" patternUnits="userSpaceOnUse"><path d="M35,20 l4,10 l10,1 l-8,7 l3,10 l-9,-6 l-9,6 l3,-10 l-8,-7 l10,-1z" fill="#fff" opacity=".18"/></pattern><linearGradient id="tqNight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1E2A5A"/><stop offset="1" stop-color="#4A5FA8"/></linearGradient><clipPath id="tqW2"><rect x="560" y="120" width="320" height="280" rx="5"/></clipPath></defs>
<rect width="1600" height="600" fill="url(#tqHWall)"/><rect width="1600" height="600" fill="url(#tqHDot)"/>
<path d="M0,0 L70,52 L70,600 L0,640Z" fill="#D9895C" opacity=".5"/><path d="M1600,0 L1530,52 L1530,600 L1600,640Z" fill="#D9895C" opacity=".5"/>
<rect width="1600" height="46" fill="#C8744A"/><rect y="44" width="1600" height="12" fill="#FFF1D2"/>
<rect y="470" width="1600" height="130" fill="#B76A45"/>${panels}<rect y="462" width="1600" height="14" fill="#FFF1D2" class="ol3"/><rect y="580" width="1600" height="22" fill="#FFF1D2" class="ol3"/>
${tqFloorPlanks('#8A5434','#B9774B','#5E3520')}
${tqWin(560,120,320,280,'url(#tqNight)',`<circle cx="820" cy="170" r="26" fill="#FFF6C8" class="ol3"/><circle cx="830" cy="164" r="22" fill="#2A3A72"/>${[[600,150],[660,200],[720,140],[780,230],[620,260],[860,250],[700,300]].map(([a,b])=>`<circle cx="${a}" cy="${b}" r="3" fill="#fff"/>`).join('')}<path d="M540,330 L600,290 L660,330Z M640,340 L720,286 L800,340Z M770,336 L840,296 L910,336Z" fill="#8FA4D8" class="ol3"/><path d="M540,330 L600,290 L660,330 L660,345 L540,345Z M640,340 L720,286 L800,340 L800,352 L640,352Z" fill="#fff" opacity=".85"/><rect x="540" y="340" width="380" height="80" fill="#EAF2FF" class="ol3"/><rect x="600" y="318" width="10" height="16" fill="#FFD84D"/><rect x="740" y="314" width="10" height="16" fill="#FFD84D"/>`)}
<!-- fireplace (always there; cold or burning is a piece) -->
<g><rect x="1000" y="356" width="300" height="24" rx="8" fill="#FFF1D2" class="ol"/><rect x="1016" y="380" width="268" height="222" fill="#C9603E" class="ol"/>
 ${[392,422,452,482,512,542,572].map((y,i)=>`<path d="M1016,${y} L1284,${y}" stroke="#A84A2E" stroke-width="3"/>${[0,1,2,3].map(k=>`<path d="M${1040+k*64+(i%2)*32},${y} l0,${30}" stroke="#A84A2E" stroke-width="3"/>`).join('')}`).join('')}
 <path d="M1070,602 L1070,470 Q1150,410 1230,470 L1230,602Z" fill="#2A1A14" class="ol"/></g>
<!-- armchair + little table -->
<g><ellipse cx="1462" cy="752" rx="110" ry="14" fill="url(#tqShadow)"/><rect x="1380" y="556" width="164" height="150" rx="46" fill="#8E6CD8" class="ol"/><rect x="1360" y="664" width="204" height="58" rx="24" fill="#7A58C4" class="ol"/><ellipse cx="1366" cy="664" rx="24" ry="44" fill="#8E6CD8" class="ol"/><ellipse cx="1558" cy="664" rx="24" ry="44" fill="#8E6CD8" class="ol"/><rect x="1384" y="718" width="14" height="30" fill="#8A5A3A" class="ol3"/><rect x="1526" y="718" width="14" height="30" fill="#8A5A3A" class="ol3"/></g>
<g><ellipse cx="1300" cy="770" rx="60" ry="10" fill="url(#tqShadow)"/><ellipse cx="1300" cy="690" rx="58" ry="14" fill="#D88A4A" class="ol"/><rect x="1294" y="700" width="12" height="66" fill="#B06A30" class="ol3"/><ellipse cx="1300" cy="768" rx="32" ry="7" fill="#B06A30" class="ol3"/></g>`; }
const TQH_MESS=[
 {id:'fairy',kind:'fix',x:800,y:74,cx:640,my:90,d:'',c:`<path d="M80,64 Q300,104 520,70 Q800,110 1080,70 Q1300,104 1520,66" stroke="${TQ_O}" stroke-width="3" fill="none"/>${[...Array(22)].map((_,i)=>{ const x=100+i*66, y=70+Math.abs(Math.sin(i*.75))*30; return `<circle cx="${x}" cy="${y}" r="16" fill="${['#FFD84D','#FF6F91','#7FE0FF','#9CF07A'][i%4]}" opacity=".35"/><circle cx="${x}" cy="${y}" r="7" fill="${['#FFD84D','#FF6F91','#7FE0FF','#9CF07A'][i%4]}" class="ol3" stroke-width="2"/>`; }).join('')}`},
 {id:'curtains',kind:'fix',x:720,y:260,cx:520,my:90,d:'',c:`<path d="M512,104 L928,104" stroke="${TQ_O}" stroke-width="12" stroke-linecap="round"/><path d="M512,104 L928,104" stroke="#9A5BC4" stroke-width="6" stroke-linecap="round"/><path d="M520,104 L600,104 C590,200 620,250 600,300 C626,360 590,420 610,456 L526,456 C544,410 508,330 530,300 C510,240 534,180 520,104Z" fill="#B07CFF" class="ol"/><rect x="522" y="292" width="86" height="18" rx="9" fill="#FFD84D" class="ol3"/><path d="M920,104 L840,104 C850,200 820,250 840,300 C814,360 850,420 830,456 L914,456 C896,410 932,330 910,300 C930,240 906,180 920,104Z" fill="#B07CFF" class="ol"/><rect x="832" y="292" width="86" height="18" rx="9" fill="#FFD84D" class="ol3"/>`},
 {id:'window',kind:'fix',x:720,y:260,cx:540,my:100,
  d:`<path d="M600,150 L660,220 L640,280 L700,330 M660,220 L730,200 M640,280 L590,320 M780,160 L760,240 L820,300 M760,240 L700,250" stroke="#fff" stroke-width="4" fill="none"/><path d="M690,230 L740,214 L760,262 L716,290 L680,270Z" fill="#0E1636" class="ol3"/><path d="M600,456 l30,-6 l-8,14z M660,470 l26,4 l-20,10z M720,462 l18,-10 l6,16z" fill="#CFE8FF" class="ol3"/>`,
  c:`<path d="M564,124 q30,4 40,30 q-30,-6 -40,6z M876,124 q-30,4 -40,30 q30,-6 40,6z M564,396 q30,-4 40,-30 q-30,6 -40,-6z M876,396 q-30,-4 -40,-30 q30,6 40,-6z" fill="#fff" opacity=".8"/><path d="M600,140 L640,180 M820,140 L860,180" stroke="#fff" stroke-opacity=".5" stroke-width="6" stroke-linecap="round"/>`},
 {id:'heater',kind:'fix',x:1150,y:530,cx:960,my:420,
  d:`<path d="M1100,600 l20,-14 l30,6 l26,-10 l24,12 l-10,6Z" fill="#555" class="ol3"/><ellipse cx="1150" cy="596" rx="60" ry="8" fill="#888"/><rect x="1100" y="580" width="100" height="14" rx="6" fill="#6B4226" class="ol3"/>`,
  c:`<ellipse cx="1150" cy="500" rx="260" ry="200" fill="url(#tqGlow)"/><rect x="1100" y="580" width="100" height="14" rx="6" fill="#6B4226" class="ol3"/><g class="tq-fire"><path d="M1110,586 Q1100,540 1130,500 Q1132,530 1146,540 Q1144,500 1162,470 Q1170,520 1190,530 Q1200,560 1190,586Z" fill="#FF7A1A" class="ol3"/><path d="M1128,586 Q1124,556 1144,532 Q1150,552 1160,556 Q1164,530 1174,520 Q1184,560 1176,586Z" fill="#FFD23F"/></g>`},
 {id:'bed',kind:'fix',x:300,y:620,cx:600,my:470,d:'',c:`<ellipse cx="320" cy="752" rx="270" ry="22" fill="url(#tqShadow)"/><rect x="80" y="440" width="52" height="310" rx="16" fill="#F28DB2" class="ol"/><circle cx="106" cy="434" r="17" fill="#FFB3CF" class="ol"/><rect x="498" y="566" width="46" height="184" rx="14" fill="#F28DB2" class="ol"/><circle cx="521" cy="560" r="15" fill="#FFB3CF" class="ol"/><rect x="122" y="640" width="384" height="62" rx="12" fill="#DD6E98" class="ol"/><rect x="150" y="700" width="18" height="44" fill="#B2457E" class="ol3"/><rect x="460" y="700" width="18" height="44" fill="#B2457E" class="ol3"/><rect x="128" y="598" width="374" height="50" rx="18" fill="#fff" class="ol"/><ellipse cx="196" cy="592" rx="58" ry="26" fill="#FFF8EC" class="ol"/><path d="M250,586 Q380,572 508,590 L508,668 Q380,690 250,672Z" fill="#FFB547" class="ol"/><path d="M250,586 Q380,572 508,590 L508,606 Q380,590 250,604Z" fill="#fff" class="ol3"/>${[290,340,390,440].map(x=>`<path d="${tqStar(9)}" transform="translate(${x},640)" fill="#fff" opacity=".8"/>`).join('')}`},
 {id:'rug',kind:'fix',x:820,y:790,cx:640,my:720,d:'',c:`<ellipse cx="820" cy="790" rx="330" ry="72" fill="#E85D75" class="ol"/><ellipse cx="820" cy="790" rx="280" ry="58" fill="#FFC93C"/><ellipse cx="820" cy="790" rx="210" ry="42" fill="#38B48B"/><ellipse cx="820" cy="790" rx="130" ry="26" fill="#FFF1D2"/>${[...Array(18)].map((_,i)=>{ const a=i/18*Math.PI*2; return `<path d="M${(820+Math.cos(a)*330).toFixed(0)},${(790+Math.sin(a)*72).toFixed(0)} l${(Math.cos(a)*14).toFixed(0)},${(Math.sin(a)*6).toFixed(0)}" stroke="#E85D75" stroke-width="4" stroke-linecap="round"/>`; }).join('')}`},
 {id:'lamp',kind:'fix',x:600,y:420,cx:760,my:330,d:'',c:`<ellipse cx="600" cy="480" rx="170" ry="150" fill="url(#tqGlow)"/><ellipse cx="600" cy="750" rx="40" ry="8" fill="url(#tqShadow)"/><path d="M600,440 L600,744" stroke="${TQ_O}" stroke-width="10"/><path d="M600,440 L600,744" stroke="#C9A06A" stroke-width="5"/><ellipse cx="600" cy="746" rx="34" ry="8" fill="#C9A06A" class="ol3"/><path d="M560,380 L640,380 L664,446 L536,446Z" fill="#FFD27A" class="ol"/><path d="M572,388 L560,438" stroke="#fff" stroke-opacity=".6" stroke-width="6" stroke-linecap="round"/>`},
 {id:'tea',kind:'fix',x:1300,y:660,cx:1150,my:590,d:'',c:`<path d="M1278,648 L1318,648 L1314,678 Q1298,686 1282,678Z" fill="#FF6F91" class="ol3"/><path d="M1318,654 q14,2 10,14 q-4,6 -12,4" stroke="${TQ_O}" stroke-width="3" fill="none"/><path class="tq-steam" d="M1290,640 q-8,-12 0,-24 q8,-12 0,-24 M1306,640 q-8,-12 0,-24 q8,-12 0,-24" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/><circle cx="1336" cy="676" r="9" fill="#C98F4E" class="ol3"/><circle cx="1260" cy="678" r="8" fill="#C98F4E" class="ol3"/>`},
 {id:'plant',kind:'fix',x:950,y:640,cx:800,my:560,d:'',c:tqPlant(950,740,.9)},
 {id:'picture',kind:'fix',x:1390,y:220,cx:1250,my:130,d:'',c:`<path d="M1340,172 L1390,146 L1440,172" stroke="${TQ_O}" stroke-width="3" fill="none"/><rect x="1324" y="170" width="132" height="104" rx="6" fill="#F2A33A" class="ol"/><rect x="1338" y="184" width="104" height="76" fill="#CFEFFF"/><path d="M1338,260 L1366,226 L1386,244 L1408,216 L1442,260Z" fill="#62BF55"/><circle cx="1420" cy="200" r="9" fill="#FFD84D"/><path d="M1350,206 q10,-8 20,0 q10,-8 20,0" stroke="#FF6F91" stroke-width="4" fill="none"/>`},
 {id:'books',kind:'fix',x:300,y:300,cx:470,my:200,d:'',c:`<rect x="190" y="300" width="230" height="14" rx="4" fill="#C9874D" class="ol3"/><path d="M210,314 L210,334 L228,314Z M400,314 L400,334 L382,314Z" fill="#A86A35" class="ol3"/>${[[200,'#E85D75',62],[222,'#3FA9F5',72],[246,'#FFC93C',56],[266,'#7E57C2',66],[290,'#3CB38A',70]].map(([x,c,h])=>`<rect x="${x}" y="${300-h}" width="20" height="${h}" rx="3" fill="${c}" class="ol3"/>`).join('')}<circle cx="380" cy="280" r="18" fill="#FFD84D" class="ol3"/><path d="M372,276 l4,4 l8,-8" stroke="${TQ_O}" stroke-width="3" fill="none"/>`},
 {id:'cushions',kind:'fix',x:1460,y:640,cx:1300,my:560,d:'',c:`<rect x="1400" y="612" width="70" height="56" rx="18" fill="#FFC93C" class="ol3" transform="rotate(-10 1435 640)"/><rect x="1470" y="616" width="66" height="54" rx="18" fill="#FF6F91" class="ol3" transform="rotate(12 1503 643)"/><path d="M1420,636 l30,-4 M1486,632 l30,6" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>`},
 {id:'clock',kind:'fix',x:1150,y:320,cx:960,my:230,d:'',c:`<rect x="1118" y="292" width="64" height="66" rx="14" fill="#7FCBEA" class="ol"/><circle cx="1150" cy="322" r="22" fill="#fff" class="ol3"/><path d="M1150,322 L1150,306 M1150,322 L1162,328" stroke="${TQ_O}" stroke-width="4" stroke-linecap="round"/><circle cx="1128" cy="358" r="6" fill="#7FCBEA" class="ol3"/><circle cx="1172" cy="358" r="6" fill="#7FCBEA" class="ol3"/>`},
 {id:'slippers',kind:'fix',x:600,y:850,cx:440,my:790,d:'',c:`<ellipse cx="580" cy="852" rx="30" ry="14" fill="#FFB3CF" class="ol3"/><ellipse cx="572" cy="846" rx="14" ry="8" fill="#fff"/><ellipse cx="636" cy="860" rx="30" ry="14" fill="#FFB3CF" class="ol3"/><ellipse cx="628" cy="854" rx="14" ry="8" fill="#fff"/><circle cx="596" cy="848" r="6" fill="#FFD84D" class="ol3"/><circle cx="652" cy="856" r="6" fill="#FFD84D" class="ol3"/>`},
 {id:'kitty',kind:'fix',x:960,y:790,cx:780,my:720,d:'',c:`<ellipse cx="960" cy="800" rx="70" ry="10" fill="url(#tqShadow)"/><path d="M904,796 C900,760 940,744 976,750 C1010,756 1024,784 1016,800Z" fill="#F39A3D" class="ol"/><path d="M1016,798 C1040,796 1044,778 1030,772" stroke="${TQ_O}" stroke-width="16" fill="none" stroke-linecap="round"/><path d="M1016,798 C1040,796 1044,778 1030,772" stroke="#F39A3D" stroke-width="9" fill="none" stroke-linecap="round"/><circle cx="912" cy="778" r="26" fill="#F39A3D" class="ol"/><path d="M892,762 L890,738 L908,754Z M922,754 L938,738 L936,764Z" fill="#F39A3D" class="ol3"/><path d="M898,778 q6,4 12,0 M916,778 q6,4 12,0" stroke="${TQ_O}" stroke-width="3" fill="none"/><text x="944" y="742" font-family="Arial" font-weight="900" font-size="22" fill="#fff" stroke="${TQ_O}" stroke-width="1.5">z</text><text x="962" y="722" font-family="Arial" font-weight="900" font-size="16" fill="#fff" stroke="${TQ_O}" stroke-width="1.2">z</text>`}
];
const TQH_ORDER=['window','heater','bed','rug','lamp','curtains','tea','plant','picture','books','cushions','fairy','slippers','clock','kitty'];
function tqLaila(){ const skin='#F6D1B1', hij='#F28DB2', dress='#4E6FC9', st=`stroke="${TQ_O}"`;
  return `<ellipse cx="0" cy="0" rx="56" ry="11" fill="url(#tqShadow)"/>
<g class="tq-anim"><g class="tq-bob">
 <g class="tq-leg l1"><ellipse cx="-16" cy="-8" rx="20" ry="10" fill="#7A4A8C" class="ol3"/></g><g class="tq-leg l2"><ellipse cx="18" cy="-8" rx="20" ry="10" fill="#7A4A8C" class="ol3"/></g>
 <path d="M-32,-150 L32,-150 L58,-14 Q0,-2 -58,-14Z" fill="${dress}" class="ol"/><path d="M-44,-80 Q0,-70 46,-80" stroke="#FFD84D" stroke-width="6" fill="none"/><path d="M-50,-40 Q0,-30 52,-40" stroke="#7F9BEA" stroke-width="4" fill="none"/>
 <g class="arm-o"><path d="M-30,-140 Q-52,-110 -50,-82" ${st} stroke-width="20" stroke-linecap="round" fill="none"/><path d="M-30,-140 Q-52,-110 -50,-82" stroke="${dress}" stroke-width="13" stroke-linecap="round" fill="none"/><circle cx="-50" cy="-78" r="9" fill="${skin}" class="ol3"/>
  <path d="M30,-140 Q52,-110 50,-82" ${st} stroke-width="20" stroke-linecap="round" fill="none"/><path d="M30,-140 Q52,-110 50,-82" stroke="${dress}" stroke-width="13" stroke-linecap="round" fill="none"/><circle cx="50" cy="-78" r="9" fill="${skin}" class="ol3"/></g>
 <g class="arm-h"><path d="M-30,-140 Q-40,-104 20,-108" ${st} stroke-width="20" stroke-linecap="round" fill="none"/><path d="M-30,-140 Q-40,-104 20,-108" stroke="${dress}" stroke-width="13" stroke-linecap="round" fill="none"/><path d="M30,-140 Q40,-112 -16,-118" ${st} stroke-width="20" stroke-linecap="round" fill="none"/><path d="M30,-140 Q40,-112 -16,-118" stroke="${dress}" stroke-width="13" stroke-linecap="round" fill="none"/><circle cx="22" cy="-108" r="8" fill="${skin}" class="ol3"/><circle cx="-18" cy="-118" r="8" fill="${skin}" class="ol3"/></g>
 <g class="tq-head">
  <path d="M-50,-186 C-54,-252 58,-256 56,-186 C56,-158 62,-150 52,-136 Q0,-122 -48,-136 C-58,-150 -52,-160 -50,-186Z" fill="${hij}" class="ol"/>
  <ellipse cx="4" cy="-188" rx="32" ry="37" fill="${skin}" class="ol3"/>
  <path d="M-30,-206 Q4,-238 38,-206" stroke="${hij}" stroke-width="10" fill="none"/>
  <g class="tq-eyes"><ellipse cx="-8" cy="-192" rx="6.5" ry="8.5" fill="#fff" class="ol3"/><ellipse cx="18" cy="-192" rx="6.5" ry="8.5" fill="#fff" class="ol3"/><circle cx="-6" cy="-191" r="4" fill="#4A2C1A"/><circle cx="20" cy="-191" r="4" fill="#4A2C1A"/><circle cx="-5" cy="-193" r="1.5" fill="#fff"/><circle cx="21" cy="-193" r="1.5" fill="#fff"/></g>
  <path class="br-c" d="M-18,-203 l12,-6 M22,-209 l12,6" stroke="${TQ_O}" stroke-width="3" stroke-linecap="round"/>
  <circle class="ck" cx="-16" cy="-174" r="7" fill="#FF8FA8" opacity=".6"/><circle class="ck" cx="28" cy="-174" r="7" fill="#FF8FA8" opacity=".6"/>
  <circle class="ck-c" cx="-16" cy="-174" r="7" fill="#7FB5FF" opacity=".7"/><circle class="ck-c" cx="28" cy="-174" r="7" fill="#7FB5FF" opacity=".7"/>
  <g class="mo-h"><path d="M-2,-170 q8,10 16,0" fill="#B5304A" class="ol3"/></g>
  <g class="mo-s"><path d="M-2,-164 q8,-8 16,0" fill="none" class="ol3"/><path d="M-6,-166 l4,-3 l4,3 l4,-3 l4,3 l4,-3 l4,3" stroke="${TQ_O}" stroke-width="2" fill="none"/></g>
  <g class="mo-o"><path d="M-6,-172 q14,18 28,0z" fill="#B5304A" class="ol3"/></g>
  <g class="tq-breath"><ellipse cx="44" cy="-170" rx="12" ry="8" fill="#fff" opacity=".85"/><ellipse cx="58" cy="-176" rx="8" ry="6" fill="#fff" opacity=".7"/></g>
  <g class="tq-hearts"><path d="M60,-226 c-6,-10 -20,-2 -12,8 l12,12 l12,-12 c8,-10 -6,-18 -12,-8z" fill="#FF6F91" class="ol3"/><path d="M-60,-240 c-4,-7 -14,-1 -8,5 l8,8 l8,-8 c6,-6 -4,-12 -8,-5z" fill="#FF6F91" class="ol3"/></g>
 </g>
</g></g>`; }

// ================= Clinic reception + treatment room (cartoon, boxes to unpack) =================
function tqClinicRoom(){ return `<defs><linearGradient id="tqCWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9FBF7"/><stop offset="1" stop-color="#CDEFE8"/></linearGradient><clipPath id="tqW2"><rect x="110" y="140" width="250" height="230" rx="5"/></clipPath></defs>
<rect width="1600" height="600" fill="url(#tqCWall)"/>${[...Array(24)].map((_,i)=>`<rect x="${i*70}" y="56" width="34" height="400" fill="#fff" opacity=".35"/>`).join('')}
<path d="M0,0 L70,52 L70,600 L0,640Z" fill="#9FD8CC" opacity=".55"/><path d="M1600,0 L1530,52 L1530,600 L1600,640Z" fill="#9FD8CC" opacity=".55"/>
<rect width="1600" height="46" fill="#1F9E8F"/><rect y="44" width="1600" height="12" fill="#fff"/>
<rect y="456" width="1600" height="144" fill="#2BB3A1"/><rect y="450" width="1600" height="12" fill="#fff" class="ol3"/><rect y="580" width="1600" height="22" fill="#fff" class="ol3"/>
${tqTiles('#F3EEE6','#E2D9CC')}
${tqWin(110,140,250,230,'url(#tqSky)',`<rect x="110" y="250" width="40" height="130" fill="#BFD7F2" class="ol3"/><rect x="160" y="210" width="56" height="170" fill="#A9C8EE" class="ol3"/><rect x="226" y="240" width="44" height="140" fill="#C7DDF5" class="ol3"/><rect x="280" y="200" width="60" height="180" fill="#9DBFEA" class="ol3"/>${[180,200,300,320].map(x=>[230,260,290].map(y=>`<rect x="${x}" y="${y}" width="10" height="12" fill="#fff" opacity=".8"/>`).join('')).join('')}<circle cx="320" cy="170" r="18" fill="#FFE066"/>`)}
${tqHole(900)}<g><circle cx="1460" cy="190" r="46" fill="#fff" class="ol"/><circle cx="1460" cy="190" r="46" fill="none" stroke="#2BB3A1" stroke-width="8"/><path class="tq-hh" style="transform-origin:1460px 190px" d="M1460,190 L1460,162" stroke="#3B2A2A" stroke-width="6" stroke-linecap="round"/><path class="tq-hm" style="transform-origin:1460px 190px" d="M1460,190 L1482,172" stroke="#FF6F91" stroke-width="4" stroke-linecap="round"/></g>`; }
const tqDesk=`<ellipse cx="620" cy="770" rx="230" ry="16" fill="url(#tqShadow)"/><rect x="410" y="560" width="420" height="34" rx="10" fill="#FFF6E6" class="ol"/><path d="M420,594 L820,594 L800,764 L440,764Z" fill="#1FA594" class="ol"/><path d="M440,620 L800,620" stroke="#fff" stroke-width="5" opacity=".6"/><rect x="560" y="650" width="120" height="44" rx="10" fill="#fff" class="ol3"/><text x="620" y="681" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="22" fill="#1F9E8F">WELCOME</text><path d="${tqStar(16)}" transform="translate(520,700)" fill="#FFD84D" class="ol3"/><path d="${tqStar(16)}" transform="translate(720,700)" fill="#FFD84D" class="ol3"/>`;
const TQC_MESS=[
 {id:'lights',x:620,y:140,cx:470,my:150,bx:300,by:850,c:`${[470,620,770].map(x=>`<ellipse cx="${x}" cy="230" rx="110" ry="90" fill="url(#tqGlow)"/><path d="M${x},46 L${x},120" stroke="${TQ_O}" stroke-width="4"/><path d="M${x-40},164 Q${x-40},120 ${x},120 Q${x+40},120 ${x+40},164Z" fill="#FFC93C" class="ol"/><ellipse cx="${x}" cy="166" rx="14" ry="6" fill="#FFF7C2" class="ol3"/>`).join('')}`},
 {id:'sign',x:620,y:250,cx:470,my:170,bx:470,by:860,c:`<rect x="470" y="210" width="300" height="86" rx="20" fill="#fff" class="ol"/><rect x="482" y="222" width="276" height="62" rx="14" fill="#2BB3A1"/><text x="620" y="252" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="24" fill="#fff">استقبال</text><text x="620" y="276" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="16" fill="#E9FBF7">RECEPTION</text><circle cx="500" cy="253" r="10" fill="#FF6F91" class="ol3"/><path d="M495,253 h10 M500,248 v10" stroke="#fff" stroke-width="3"/>`},
 {id:'desk',x:620,y:660,cx:900,my:520,bx:620,by:770,c:tqDesk},
 {id:'monitor',x:700,y:520,cx:900,my:440,bx:700,by:760,c:`<rect x="670" y="476" width="86" height="64" rx="8" fill="#3A4256" class="ol"/><rect x="678" y="484" width="70" height="48" rx="4" fill="#7FE0FF"/><path d="M684,520 l14,-12 l12,8 l16,-16 l16,10" stroke="#fff" stroke-width="3" fill="none"/><rect x="704" y="540" width="18" height="16" fill="#3A4256" class="ol3"/><rect x="688" y="554" width="50" height="8" rx="3" fill="#3A4256" class="ol3"/>`},
 {id:'flowers',x:500,y:500,cx:300,my:420,bx:520,by:770,c:tqFlowers(500,560,.9)},
 {id:'sofa',x:1230,y:660,cx:1060,my:560,bx:1230,by:760,c:`<ellipse cx="1230" cy="760" rx="200" ry="16" fill="url(#tqShadow)"/><rect x="1070" y="560" width="320" height="120" rx="40" fill="#FF8A5B" class="ol"/><rect x="1050" y="650" width="360" height="74" rx="28" fill="#F26B3A" class="ol"/><ellipse cx="1056" cy="650" rx="28" ry="56" fill="#FF8A5B" class="ol"/><ellipse cx="1404" cy="650" rx="28" ry="56" fill="#FF8A5B" class="ol"/><path d="M1230,566 L1230,670" stroke="#E0552A" stroke-width="4"/><rect x="1080" y="720" width="16" height="34" fill="#8A5A3A" class="ol3"/><rect x="1364" y="720" width="16" height="34" fill="#8A5A3A" class="ol3"/><rect x="1110" y="612" width="70" height="50" rx="16" fill="#FFD84D" class="ol3" transform="rotate(-10 1145 637)"/>`},
 {id:'plants',x:1480,y:640,cx:1320,my:500,bx:1480,by:860,c:tqPlant(1480,760,1.15)+tqPlant(960,740,.9)},
 {id:'tv',x:1230,y:250,cx:1060,my:150,bx:1150,by:870,c:`<rect x="1110" y="170" width="240" height="150" rx="12" fill="#2B3142" class="ol"/><rect x="1122" y="182" width="216" height="126" rx="6" fill="#9FE6D8"/><circle cx="1230" cy="238" r="34" fill="#FFD84D" class="ol3"/><circle cx="1218" cy="230" r="4" fill="${TQ_O}"/><circle cx="1242" cy="230" r="4" fill="${TQ_O}"/><path d="M1214,246 q16,14 32,0" stroke="${TQ_O}" stroke-width="4" fill="none"/><path d="M1130,296 l30,-20 l20,12 l30,-24" stroke="#fff" stroke-width="3" fill="none"/>`},
 {id:'rug',x:1230,y:820,cx:1060,my:760,bx:1330,by:880,c:`<ellipse cx="1230" cy="826" rx="240" ry="50" fill="#7FCBEA" class="ol"/><ellipse cx="1230" cy="826" rx="190" ry="38" fill="#B4E4F5"/><ellipse cx="1230" cy="826" rx="120" ry="22" fill="#fff" opacity=".7"/>`},
 {id:'table',x:1230,y:800,cx:1050,my:730,bx:1230,by:850,c:`<ellipse cx="1230" cy="842" rx="110" ry="10" fill="url(#tqShadow)"/><rect x="1130" y="780" width="200" height="22" rx="10" fill="#FFF6E6" class="ol"/><rect x="1146" y="800" width="12" height="40" fill="#C9874D" class="ol3"/><rect x="1302" y="800" width="12" height="40" fill="#C9874D" class="ol3"/><rect x="1180" y="766" width="54" height="14" rx="3" fill="#FF6F91" class="ol3"/><rect x="1186" y="754" width="44" height="12" rx="3" fill="#3FA9F5" class="ol3"/><circle cx="1290" cy="770" r="10" fill="#fff" class="ol3"/>`},
 {id:'chairs',x:240,y:700,cx:420,my:600,bx:240,by:820,c:[170,310].map(x=>`<ellipse cx="${x}" cy="796" rx="60" ry="9" fill="url(#tqShadow)"/><rect x="${x-46}" y="640" width="92" height="90" rx="26" fill="#B07CFF" class="ol"/><rect x="${x-54}" y="712" width="108" height="36" rx="14" fill="#9562F0" class="ol"/><rect x="${x-40}" y="746" width="10" height="46" fill="#5A3A8A" class="ol3"/><rect x="${x+30}" y="746" width="10" height="46" fill="#5A3A8A" class="ol3"/>`).join('')},
 {id:'art',x:1466,y:340,cx:1300,my:230,bx:120,by:880,c:``},
 {id:'shelf',x:900,y:280,cx:760,my:180,bx:880,by:880,c:`<rect x="830" y="300" width="160" height="12" rx="4" fill="#C9874D" class="ol3"/><rect x="830" y="370" width="160" height="12" rx="4" fill="#C9874D" class="ol3"/>${[[842,'#FF6F91'],[872,'#7FE0FF'],[902,'#FFD84D'],[932,'#9CF07A'],[962,'#B07CFF']].map(([x,c],i)=>`<rect x="${x}" y="${i%2?262:270}" width="22" height="${i%2?38:30}" rx="6" fill="${c}" class="ol3"/><rect x="${x+5}" y="${i%2?254:262}" width="12" height="9" rx="2" fill="#fff" class="ol3" stroke-width="2"/>`).join('')}${[[850,'#FFD84D'],[890,'#FF8A5B'],[930,'#7FE0FF']].map(([x,c])=>`<circle cx="${x+10}" cy="352" r="16" fill="${c}" class="ol3"/>`).join('')}`},
 {id:'water',x:1000,y:620,cx:880,my:480,bx:1060,by:870,c:`<ellipse cx="1000" cy="762" rx="44" ry="8" fill="url(#tqShadow)"/><rect x="964" y="600" width="72" height="160" rx="10" fill="#fff" class="ol"/><path d="M972,600 Q964,540 1000,528 Q1036,540 1028,600Z" fill="#9FDFFF" class="ol" opacity=".95"/><rect x="980" y="630" width="40" height="30" rx="6" fill="#E6F6FF" class="ol3"/><circle cx="988" cy="676" r="6" fill="#3FA9F5" class="ol3"/><circle cx="1012" cy="676" r="6" fill="#FF6F91" class="ol3"/>`},
 {id:'balloons',x:360,y:300,cx:520,my:120,bx:380,by:880,c:tqBalloons(380,560)}
];
TQC_MESS.find(m=>m.id==='art').c=`<path d="M180,190 L240,160 L300,190" stroke="${TQ_O}" stroke-width="3" fill="none"/><rect x="170" y="188" width="140" height="0" fill="none"/>`;
const TQC_ORDER=['desk','sign','lights','sofa','plants','tv','table','chairs','rug','flowers','art','monitor','shelf','water','balloons'];
function tqSpaRoom(){ return `<defs><linearGradient id="tqSWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FCE6F1"/><stop offset="1" stop-color="#F4CFE2"/></linearGradient><clipPath id="tqW2"><rect x="1240" y="140" width="220" height="200" rx="5"/></clipPath></defs>
<rect width="1600" height="600" fill="url(#tqSWall)"/>${[...Array(12)].map((_,i)=>`<path d="M${i*140+20},120 q30,-30 60,0 q-30,30 -60,0z" fill="#fff" opacity=".35"/>`).join('')}
<path d="M0,0 L70,52 L70,600 L0,640Z" fill="#E9A9C9" opacity=".5"/><path d="M1600,0 L1530,52 L1530,600 L1600,640Z" fill="#E9A9C9" opacity=".5"/>
<rect width="1600" height="46" fill="#C86A9E"/><rect y="44" width="1600" height="12" fill="#fff"/>
<rect y="456" width="1600" height="144" fill="#B98AD6"/><rect y="450" width="1600" height="12" fill="#fff" class="ol3"/><rect y="580" width="1600" height="22" fill="#fff" class="ol3"/>
${tqFloorPlanks('#E9D4BE','#F6E6D4','#B89574')}
${tqWin(1240,140,220,200,'url(#tqSky)',`<path d="M1230,300 Q1300,250 1360,290 T1480,280 L1480,350 L1230,350Z" fill="#8FD86E" class="ol3"/><circle cx="1420" cy="180" r="20" fill="#FFE066"/><g class="tq-cloud"><ellipse cx="1290" cy="190" rx="30" ry="14" fill="#fff"/><ellipse cx="1310" cy="180" rx="20" ry="14" fill="#fff"/></g>`)}
${tqHole(1370)}`; }
const TQS_MESS=[
 {id:'divider',x:220,y:500,cx:400,my:330,bx:220,by:850,c:[0,1,2].map(i=>`<path d="M${110+i*76},400 l70,${i%2?12:-12} l0,330 l-70,${i%2?-12:12}Z" fill="${['#B07CFF','#FFB3CF','#B07CFF'][i]}" class="ol"/><path d="M${126+i*76},430 q20,30 40,0 q-20,40 -40,80" stroke="#fff" stroke-width="4" fill="none" opacity=".6"/>`).join('')},
 {id:'mirror',x:1000,y:260,cx:860,my:120,bx:1000,by:870,c:`<ellipse cx="1000" cy="262" rx="86" ry="114" fill="#FFD27A" class="ol"/><ellipse cx="1000" cy="262" rx="68" ry="96" fill="#D9F3FF" class="ol3"/><path d="M960,220 L990,190 M966,250 L1010,206" stroke="#fff" stroke-width="8" stroke-linecap="round"/>${[0,1,2,3,4,5].map(i=>{ const a=i/6*Math.PI*2; return `<circle cx="${(1000+Math.cos(a)*92).toFixed(0)}" cy="${(262+Math.sin(a)*120).toFixed(0)}" r="9" fill="#FFF7C2" class="ol3"/>`; }).join('')}`},
 {id:'bed',x:700,y:640,cx:500,my:520,bx:700,by:770,c:`<ellipse cx="700" cy="770" rx="260" ry="18" fill="url(#tqShadow)"/><rect x="470" y="610" width="460" height="54" rx="20" fill="#fff" class="ol"/><path d="M470,640 L930,640" stroke="#7FCBEA" stroke-width="10"/><path d="M470,610 Q480,560 560,570 L560,612Z" fill="#fff" class="ol"/><ellipse cx="520" cy="596" rx="44" ry="16" fill="#E6F6FF" class="ol3"/><rect x="520" y="662" width="20" height="96" fill="#B5C2CF" class="ol3"/><rect x="860" y="662" width="20" height="96" fill="#B5C2CF" class="ol3"/><rect x="500" y="740" width="400" height="14" rx="6" fill="#B5C2CF" class="ol3"/><rect x="700" y="598" width="200" height="26" rx="10" fill="#FFB3CF" class="ol3"/>`},
 {id:'laser',x:1080,y:600,cx:1260,my:430,bx:1080,by:860,c:`<ellipse cx="1080" cy="772" rx="70" ry="10" fill="url(#tqShadow)"/><rect x="1030" y="560" width="100" height="200" rx="18" fill="#fff" class="ol"/><rect x="1042" y="574" width="76" height="56" rx="8" fill="#7FE0FF" class="ol3"/><path d="M1052,612 l12,-14 l12,10 l14,-18 l14,12" stroke="#fff" stroke-width="3" fill="none"/><circle cx="1060" cy="660" r="9" fill="#FF6F91" class="ol3"/><circle cx="1100" cy="660" r="9" fill="#9CF07A" class="ol3"/><rect x="1046" y="690" width="68" height="10" rx="5" fill="#B07CFF"/><path d="M1130,600 Q1190,560 1160,500" stroke="${TQ_O}" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M1130,600 Q1190,560 1160,500" stroke="#CBD3DB" stroke-width="6" fill="none" stroke-linecap="round"/><rect x="1146" y="476" width="30" height="34" rx="8" fill="#B07CFF" class="ol3"/><circle cx="1044" cy="770" r="9" fill="#555" class="ol3"/><circle cx="1116" cy="770" r="9" fill="#555" class="ol3"/>`},
 {id:'lights',x:700,y:140,cx:540,my:150,bx:420,by:870,c:`${[560,840].map(x=>`<ellipse cx="${x}" cy="230" rx="130" ry="100" fill="url(#tqGlow)"/><path d="M${x},46 L${x},110" stroke="${TQ_O}" stroke-width="4"/><circle cx="${x}" cy="140" r="34" fill="#FFF7C2" class="ol"/><circle cx="${x}" cy="140" r="22" fill="#fff"/>`).join('')}`},
 {id:'plants',x:1500,y:640,cx:1340,my:500,bx:1500,by:860,c:tqPlant(1500,760,1.1)},
 {id:'towels',x:1350,y:400,cx:1200,my:300,bx:1340,by:860,c:`<rect x="1260" y="420" width="190" height="12" rx="4" fill="#C9874D" class="ol3"/>${[[1290,'#FFB3CF'],[1336,'#7FE0FF'],[1382,'#fff'],[1428,'#B07CFF']].map(([x,c])=>`<ellipse cx="${x}" cy="400" rx="20" ry="20" fill="${c}" class="ol3"/><path d="M${x-6},392 q6,8 12,0" stroke="${TQ_O}" stroke-width="2" fill="none"/>`).join('')}`},
 {id:'candles',x:300,y:330,cx:460,my:230,bx:120,by:880,c:`<rect x="210" y="350" width="180" height="12" rx="4" fill="#C9874D" class="ol3"/>${[[240,40],[290,56],[340,46]].map(([x,h])=>`<ellipse cx="${x}" cy="${330-h}" rx="24" ry="24" fill="url(#tqGlow)"/><rect x="${x-12}" y="${350-h}" width="24" height="${h}" rx="4" fill="#FFF6E6" class="ol3"/><path d="M${x},${342-h} q-8,-12 0,-24 q8,12 0,24z" fill="#FFB12E" class="ol3" stroke-width="2"/>`).join('')}`},
 {id:'stool',x:1240,y:740,cx:1400,my:640,bx:1240,by:860,c:`<ellipse cx="1240" cy="800" rx="50" ry="8" fill="url(#tqShadow)"/><ellipse cx="1240" cy="720" rx="44" ry="14" fill="#B07CFF" class="ol"/><path d="M1240,734 L1240,790 M1210,792 L1270,792" stroke="${TQ_O}" stroke-width="8" stroke-linecap="round"/><path d="M1240,734 L1240,790" stroke="#CBD3DB" stroke-width="4"/>`},
 {id:'rug',x:700,y:830,cx:520,my:780,bx:820,by:885,c:`<ellipse cx="700" cy="830" rx="300" ry="54" fill="#B07CFF" class="ol"/><ellipse cx="700" cy="830" rx="250" ry="42" fill="#FFB3CF"/><ellipse cx="700" cy="830" rx="170" ry="26" fill="#fff" opacity=".7"/>`},
 {id:'art',x:640,y:250,cx:500,my:150,bx:600,by:880,c:`<path d="M600,196 L660,170 L720,196" stroke="${TQ_O}" stroke-width="3" fill="none"/><rect x="580" y="194" width="160" height="120" rx="8" fill="#fff" class="ol"/><rect x="594" y="208" width="132" height="92" fill="#FCE6F1"/><path d="M660,290 q-50,-30 -30,-60 q20,-20 30,10 q10,-30 30,-10 q20,30 -30,60z" fill="#FF6F91" class="ol3"/>`},
 {id:'diffuser',x:330,y:650,cx:500,my:560,bx:330,by:860,c:`<ellipse cx="330" cy="760" rx="50" ry="8" fill="url(#tqShadow)"/><rect x="290" y="680" width="80" height="12" rx="5" fill="#C9874D" class="ol3"/><rect x="300" y="690" width="10" height="66" fill="#A86A35" class="ol3"/><rect x="350" y="690" width="10" height="66" fill="#A86A35" class="ol3"/><path d="M310,680 Q300,640 330,630 Q360,640 350,680Z" fill="#9CF07A" class="ol3"/><path class="tq-steam" d="M326,626 q-10,-14 0,-28 q10,-14 0,-28 M336,626 q-8,-14 2,-28" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".85"/>`},
 {id:'water',x:1240,y:680,cx:1400,my:580,bx:1430,by:880,c:`<path d="M1212,706 L1208,656 Q1224,644 1240,656 L1236,706Z" fill="#BFEAFF" class="ol3" opacity=".9"/><path d="M1212,680 L1236,680" stroke="#3FA9F5" stroke-width="8" opacity=".6"/><rect x="1248" y="676" width="24" height="30" rx="4" fill="#BFEAFF" class="ol3"/><path d="M1252,688 l16,0" stroke="#3FA9F5" stroke-width="6"/>`},
 {id:'flowers',x:900,y:560,cx:760,my:460,bx:960,by:880,c:tqFlowers(900,610,.8)},
 {id:'balloons',x:200,y:300,cx:380,my:120,bx:250,by:880,c:tqBalloons(230,560)}
];
const TQS_ORDER=['bed','laser','mirror','lights','plants','towels','candles','stool','rug','art','divider','diffuser','water','flowers','balloons'];
// box worlds: every piece starts as a cardboard box on the floor
[TQC_MESS,TQS_MESS].forEach(L=>L.forEach(m=>{ m.kind='box'; m.d=tqBox(m.bx,m.by,.9); }));
TQC_MESS.find(m=>m.id==='art').c=`<g transform="translate(1226,96)"><path d="M182,186 L240,160 L298,186" stroke="${TQ_O}" stroke-width="3" fill="none"/><rect x="164" y="184" width="152" height="116" rx="8" fill="#FF8A5B" class="ol"/><rect x="178" y="198" width="124" height="88" fill="#FFF6E6"/><circle cx="214" cy="236" r="20" fill="#3FA9F5" class="ol3"/><path d="M234,276 l24,-40 l24,40z" fill="#FFD84D" class="ol3"/><path d="M190,280 q50,-20 100,0" stroke="#2BB3A1" stroke-width="6" fill="none"/></g>`;
// the worlds that use this 2D engine
const TQW={
 toonroom:{room:()=>tqRoom(),mess:()=>TQ_MESS,order:TQ_ORDER,cast:'cat',hole:1005,music:'toon',ic:'🧹',w:['نضيف','clean'],dim:'#1C1636',dimO:.42},
 home:{room:tqHomeRoom,mess:()=>TQH_MESS,order:TQH_ORDER,cast:'laila',music:'home',ic:'🔥',w:['جاهز','done'],dim:'#3D6FD8',dimO:.5,cold:true},
 clinic:{room:tqClinicRoom,mess:()=>TQC_MESS,order:TQC_ORDER,cast:'cat',hole:900,music:'clinic',ic:'🏥',w:['جاهز','done'],dim:'#24304A',dimO:.38},
 spa:{room:tqSpaRoom,mess:()=>TQS_MESS,order:TQS_ORDER,cast:'cat',hole:1370,music:'clinic',ic:'💆',w:['جاهز','done'],dim:'#2E2440',dimO:.38}
};
const TQ_STYLE2=`<style>
.tq .tq-fire{transform-box:fill-box;transform-origin:50% 100%;animation:tqFire .18s ease-in-out infinite alternate}@keyframes tqFire{from{transform:scale(1,1)}to{transform:scale(1.06,.9)}}
.tq .tq-steam{animation:tqSteam 1.8s ease-in-out infinite}@keyframes tqSteam{0%{transform:translateY(6px);opacity:0}40%{opacity:.85}100%{transform:translateY(-14px);opacity:0}}
.tq .arm-h,.tq .ck-c,.tq .tq-breath,.tq .br-c,.tq .tq-hearts{display:none}
.tq .m-cold .arm-h,.tq .m-cold .ck-c,.tq .m-cold .tq-breath,.tq .m-cold .br-c,.tq .m-cold .mo-s{display:inline}.tq .m-cold .arm-o,.tq .m-cold .ck,.tq .m-cold .mo-h{display:none}
.tq .m-cold .tq-anim{animation:tqShiver .09s linear infinite alternate}@keyframes tqShiver{from{transform:translateX(-3px)}to{transform:translateX(3px)}}
.tq .tq-breath{animation:tqSteam 1.6s ease-out infinite}
.tq .m-love .tq-hearts{display:inline}.tq .tq-hearts{transform-box:fill-box;transform-origin:center;animation:tqMark .6s ease-in-out infinite alternate}
.tq .snow circle{animation:tqSnow linear infinite}@keyframes tqSnow{from{transform:translate(0,-40px)}to{transform:translate(160px,700px)}}
</style>`;
// ---------- engine ----------
let T=null;
function tqEl(tag,attrs,parent){ const e=document.createElementNS(TQ_NS,tag); for(const k in attrs) e.setAttribute(k,attrs[k]); if(parent) parent.appendChild(e); return e; }
function tqMount(host,o){ const cfg=TQW[o.world], all=cfg.mess();
  const n=Math.max(1,Math.min(cfg.order.length,o.n||5)), pick=cfg.order.slice(0,n), svg=tqEl('svg',{class:'tq',preserveAspectRatio:'xMidYMid meet',viewBox:'0 0 1600 900'});
  svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block';
  const messHtml=all.map(m=>pick.includes(m.id)?`<g data-m="${m.id}">${m.c?`<g class="cl" opacity="0">${m.c}</g>`:''}<g class="dt">${m.d||''}</g></g>`:(m.c&&o.world==='toonroom'?`<g>${m.c}</g>`:'')).join('');
  let snow=''; if(cfg.cold) for(let i=0;i<34;i++) snow+=`<circle cx="${560+Math.random()*320}" cy="${120+Math.random()*120}" r="${3+Math.random()*4}" fill="#fff" opacity=".9" style="animation-duration:${(2.6+Math.random()*2.4).toFixed(2)}s;animation-delay:-${(Math.random()*4).toFixed(2)}s"/>`;
  const cast=cfg.cast==='cat'?`<g class="mouse" opacity="0"><g class="tq-ch">${tqMouse()}</g></g><g class="cat"><g class="tq-ch">${tqCat()}</g></g>`:`<g class="cat"><g class="tq-ch m-cold">${tqLaila()}</g></g>`;
  svg.innerHTML=TQ_DEFS+TQ_STYLE+TQ_STYLE2+`<g class="room">${cfg.room()}${messHtml}</g>${cfg.cold?`<g class="snow">${snow}</g>`:''}<rect class="dim" x="-10" y="-10" width="1620" height="920" fill="${cfg.dim}" opacity="${cfg.dimO}" pointer-events="none"${cfg.cold?' style="mix-blend-mode:multiply"':''}/>
   <g class="mark" opacity="0"><ellipse class="tq-ring" cx="0" cy="40" rx="60" ry="18" fill="none" stroke="#FFE066" stroke-width="6"/><g class="tq-mark"><path d="M-22,-30 L22,-30 L22,0 L40,0 L0,40 L-40,0 L-22,0Z" fill="#FFE066" class="ol"/></g></g>${cast}<g class="fx"></g>`;
  host.appendChild(svg);
  const q=s=>svg.querySelector(s), H=cfg.hole||1005;
  T={host,o,cfg,svg,world:o.world,mode:'intro',t:0,cam:800,shake:0,timers:[],raf:0,last:0,dim:q('.dim'),mark:q('.mark'),fx:q('.fx'),snow:q('.snow'),H,
     cat:{el:q('.cat'),ch:q('.cat .tq-ch'),x:cfg.cast==='laila'?800:420,y:842,tx:cfg.cast==='laila'?800:420,ty:842,dir:1,s:cfg.cast==='laila'?1.05:1,sp:620,cb:null},
     mouse:cfg.cast==='cat'?{el:q('.mouse'),ch:q('.mouse .tq-ch'),x:H,y:612,tx:H,ty:612,dir:-1,s:.62,sp:900,cb:null,out:false}:null,
     pieces:pick.map(id=>({id,m:all.find(x=>x.id===id),g:svg.querySelector(`[data-m="${id}"]`),state:0,shown:false}))};
  T.hud=document.createElement('div'); T.hud.className='q3dhud'; host.appendChild(T.hud);
  const step=ts=>{ if(!T) return; T.raf=requestAnimationFrame(step); const dt=Math.min(.05,(ts-(T.last||ts))/1000); T.last=ts; if(!document.hidden) tqFrame(dt); };
  T.raf=requestAnimationFrame(step); tqHud(); return T; }
function tqLater(fn,ms){ const id=setTimeout(()=>{ T&&fn(); },ms); T.timers.push(id); }
function tqMove(c,dt){ if(!c) return; const dx=c.tx-c.x, dy=c.ty-c.y, d=Math.hypot(dx,dy);
  if(d>2){ const k=Math.min(1,c.sp*dt/d); c.x+=dx*k; c.y+=dy*k; if(Math.abs(dx)>4) c.dir=dx>0?1:-1; c.ch.classList.add('walk'); }
  else { c.x=c.tx; c.y=c.ty; c.ch.classList.remove('walk'); if(c.cb){ const f=c.cb; c.cb=null; f(); } }
  const s=c.s*(.8+.2*(c.y-600)/240); c.el.setAttribute('transform',`translate(${c.x.toFixed(1)},${c.y.toFixed(1)}) scale(${(c.dir*s).toFixed(3)},${s.toFixed(3)})`); }
function tqFrame(dt){ T.t+=dt; tqMove(T.cat,dt); tqMove(T.mouse,dt);
  const r=T.host.getBoundingClientRect(), a=Math.max(.3,r.width/Math.max(1,r.height)); let vw,vh; if(a<16/9){ vh=900; vw=900*a; } else { vw=1600; vh=1600/a; }
  let fx; if(T.mode==='intro') fx=800+Math.sin(T.t*.35)*500; else if(T.mode==='finish') fx=800; else if(T.mouse&&T.mouse.out) fx=(T.cat.x+T.mouse.x)/2; else fx=T.cat.x+T.cat.dir*60;
  T.cam+=(fx-T.cam)*Math.min(1,dt*2.2); let vx=Math.max(0,Math.min(1600-vw,T.cam-vw/2)), vy=(900-vh)*.78;
  if(T.shake>0){ vx+=(Math.random()-.5)*T.shake*18; vy+=(Math.random()-.5)*T.shake*12; T.shake=Math.max(0,T.shake-dt*1.6); }
  T.svg.setAttribute('viewBox',`${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`); }
function tqDone(){ return T.pieces.filter(p=>p.state===1).length; }
function tqHud(){ if(!T||!T.hud) return; T.hud.style.display=T.mode==='intro'?'none':''; const n=tqDone(), L=T.o.lang==='en', k=n/T.pieces.length;
  T.hud.innerHTML=`<span class="q3dpos ${n===T.pieces.length?'p1':''}">${T.cfg.ic} ${n}/${T.pieces.length} ${T.cfg.w[L?1:0]}</span>`;
  T.dim.style.transition='opacity 1.2s'; T.dim.setAttribute('opacity',(T.cfg.dimO*(1-k)).toFixed(3));
  if(T.cfg.cold){ AU.warm=k; const win=T.pieces.find(p=>p.id==='window'); if(T.snow) T.snow.style.display=win&&win.state!==1?'':'none'; windSet(win&&win.state!==1?.16:.03);
    if(T.mode!=='intro'){ tqMood(T.cat,k<.34?'cold':k>=1?'love':null); } } }
function tqMarkNext(){ const p=T.pieces.find(x=>x.state!==1); if(!p||T.mode!=='play'){ T.mark.setAttribute('opacity','0'); return; } T.mark.setAttribute('transform',`translate(${p.m.x},${p.m.my})`); T.mark.setAttribute('opacity','1'); }
function tqFx(kind,x,y,count){ for(let i=0;i<count;i++){ let e;
    if(kind==='star'){ e=tqEl('path',{d:tqStar(8+Math.random()*10),fill:['#FFE066','#FFFFFF','#FFB3D1','#9EE8FF'][i%4],stroke:TQ_O,'stroke-width':2},T.fx); }
    else if(kind==='puff'){ e=tqEl('circle',{r:14+Math.random()*16,fill:'#EDE6DF',stroke:TQ_O,'stroke-width':2.5,opacity:.9},T.fx); }
    else if(kind==='snow'){ e=tqEl('circle',{r:4+Math.random()*6,fill:'#fff',opacity:.95},T.fx); }
    else if(kind==='heart'){ e=tqEl('path',{d:'M0,-6 c-6,-10 -20,-2 -12,8 l12,12 l12,-12 c8,-10 -6,-18 -12,-8z',fill:'#FF6F91',stroke:TQ_O,'stroke-width':2},T.fx); }
    else { e=tqEl('rect',{x:-7,y:-4,width:14,height:8,rx:2,fill:['#FF6F91','#FFD84D','#3FA9F5','#3CB38A','#B07CFF','#FF9F2E'][i%6]},T.fx); }
    let k; if(kind==='conf') k=[{transform:`translate(${x+(Math.random()-.5)*1400}px,${-60-Math.random()*200}px) rotate(0deg)`},{transform:`translate(${x+(Math.random()-.5)*1500}px,960px) rotate(${(Math.random()-.5)*1440}deg)`}];
    else if(kind==='snow'){ const y2=y+Math.random()*120-60; k=[{transform:`translate(${x}px,${y2}px)`,opacity:1},{transform:`translate(${x+500+Math.random()*700}px,${y2+260+Math.random()*300}px)`,opacity:0}]; }
    else { const a=Math.random()*Math.PI*2, sp=60+Math.random()*110, dx=Math.cos(a)*sp, dy=Math.sin(a)*sp*.7-(kind==='star'||kind==='heart'?40:20); k=[{transform:`translate(${x}px,${y}px) scale(.2) rotate(0deg)`,opacity:1},{transform:`translate(${x+dx}px,${y+dy}px) scale(1) rotate(${kind==='heart'?0:(Math.random()-.5)*200}deg)`,opacity:1,offset:.6},{transform:`translate(${x+dx*1.2}px,${y+dy*1.2+(kind==='heart'?-40:20)}px) scale(.6)`,opacity:0}]; }
    const an=e.animate?e.animate(k,{duration:kind==='conf'?2200+Math.random()*1400:kind==='snow'?1300+Math.random()*700:900+Math.random()*500,easing:kind==='conf'||kind==='snow'?'linear':'cubic-bezier(.2,.7,.3,1)',delay:kind==='conf'?Math.random()*500:kind==='snow'?Math.random()*400:0,fill:'both'}):null;
    if(an) an.onfinish=()=>e.remove(); else setTimeout(()=>e.remove(),50); } }
function tqClass(c,cls,on){ c.ch.classList.toggle(cls,on); }
function tqMood(c,m){ ['m-angry','m-sad','m-dizzy','m-wow','m-cold','m-love'].forEach(k=>c.ch.classList.remove(k)); if(m) c.ch.classList.add('m-'+m); }
function tqJump(c){ c.ch.classList.remove('jump'); requestAnimationFrame(()=>c&&c.ch.classList.add('jump')); tqLater(()=>c.ch.classList.remove('jump'),1150); }
function tqResetSeq(){ T.timers.forEach(clearTimeout); T.timers=[]; T.cat.cb=null; if(T.mouse) T.mouse.cb=null; tqClass(T.cat,'on',false); }
function tqHideMouse(){ const M=T.mouse; if(!M) return; M.out=false; M.el.setAttribute('opacity','0'); M.x=M.tx=T.H; M.y=M.ty=612; M.s=.62; }
function tqCleanNow(p,instant){ if(p.shown) return; p.shown=true; const m=p.m, dt=p.g.querySelector('.dt'), cl=p.g.querySelector('.cl');
  if(instant||!dt.animate){ dt.setAttribute('opacity','0'); if(cl) cl.setAttribute('opacity','1'); return; }
  dt.style.transformBox='view-box';
  if(m.kind==='rm'){ dt.style.transformOrigin=`${m.x}px ${m.y}px`; const nx=T.cat.x+T.cat.dir*165-m.x, ny=T.cat.y-10-m.y; dt.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${nx*.3}px,${ny*.3}px) scale(.8) rotate(8deg)`,opacity:1,offset:.4},{transform:`translate(${nx}px,${ny}px) scale(.05) rotate(-30deg)`,opacity:0}],{duration:900,easing:'ease-in',fill:'forwards'}); }
  else if(m.kind==='box'){ dt.style.transformOrigin=`${m.bx}px ${m.by}px`; dt.animate([{transform:'scale(1)',opacity:1},{transform:'scale(1.15,.85)',opacity:1,offset:.3},{transform:'scale(.2) rotate(20deg)',opacity:0}],{duration:520,easing:'ease-in',fill:'forwards'}); tqFx('puff',m.bx,m.by-40,9); }
  else dt.animate([{opacity:1},{opacity:0}],{duration:450,fill:'forwards'});
  if(cl){ cl.setAttribute('opacity','1'); cl.style.transformBox='view-box'; cl.style.transformOrigin=`${m.x}px ${m.y+60}px`; cl.animate([{transform:'scale(.6) translateY(-30px)',opacity:0},{transform:'scale(1.08)',opacity:1,offset:.7},{transform:'scale(1)',opacity:1}],{duration:650,delay:m.kind==='box'?200:250,easing:'ease-out',fill:'both'}); } }
const TQ={
  question(){ T.mode='play'; tqHud(); tqMarkNext(); },
  answer(ok){ const p=T.pieces.find(x=>x.state!==1); tqResetSeq(); tqHideMouse(); if(T.cfg.cast==='cat') tqMood(T.cat,null); T.mark.setAttribute('opacity','0'); if(!p) return;
    const C=T.cat, m=p.m, face=m.cx<m.x?1:-1;
    if(T.cfg.cast==='laila'){
      if(ok){ p.state=1; C.sp=520; C.tx=m.cx+(m.cx<m.x?40:-40); C.ty=842;
        C.cb=()=>{ C.dir=face; tqCleanNow(p); sfx(m.id==='window'?'glass':m.id==='heater'?'fire':'pop'); tqLater(()=>{ tqFx('star',m.x,m.y,14); sfx('sparkle'); tqHud(); tqJump(C); if(tqDone()<T.pieces.length){ tqMood(C,'wow'); tqLater(()=>tqHud(),1000); } tqLater(()=>sfx('yay'),250); },450); }; }
      else { p.state=-1; sfx('gust'); windSet(.35); tqLater(()=>tqHud(),1500); T.shake=.5; tqFx('snow',600,240,26); tqMood(C,'cold'); sfx('aww'); }
      return; }
    if(ok){ p.state=1; C.sp=680; C.tx=m.cx; C.ty=842;
      C.cb=()=>{ C.dir=face; if(m.kind==='box'){ tqJump(C); sfx('pop'); tqLater(()=>tqCleanNow(p),250); tqLater(()=>{ tqFx('star',m.x,m.y,16); sfx('sparkle'); tqMood(C,'wow'); tqHud(); tqLater(()=>tqMood(C,null),900); },700); return; }
        tqClass(C,'on',true); sfx('vac'); tqLater(()=>tqCleanNow(p),200);
        tqLater(()=>{ tqClass(C,'on',false); tqFx('star',m.x,m.y,16); sfx('sparkle'); tqJump(C); tqMood(C,'wow'); tqHud(); tqLater(()=>tqMood(C,null),900); },1250); }; }
    else { const M=T.mouse, H=T.H, ax=m.kind==='box'?m.bx:m.x, ay=m.kind==='box'?m.by:m.y; p.state=-1; M.out=true; M.el.setAttribute('opacity','1'); M.s=.62; M.sp=1000; M.tx=H; M.ty=700; sfx('squeak');
      M.cb=()=>{ M.s=1.15; M.tx=ax+20; M.ty=Math.max(800,Math.min(885,ay+(m.kind==='box'?6:50))); M.sp=1100;
        M.cb=()=>{ tqJump(M); sfx('laugh'); T.shake=.5; const dt=p.g.querySelector('.dt'); if(dt.animate){ dt.style.transformBox='view-box'; dt.style.transformOrigin=`${ax}px ${ay}px`; dt.animate([{transform:'rotate(0) scale(1)'},{transform:'rotate(-6deg) scale(1.12)'},{transform:'rotate(5deg) scale(1.08)'},{transform:'rotate(0) scale(1)'}],{duration:700}); }
          tqFx('puff',ax,ay-30,8); tqMood(C,'angry'); sfx('aww');
          tqLater(()=>{ C.sp=760; C.tx=H+(C.x<H?-120:120); C.ty=842; M.sp=1250; M.tx=H; M.ty=700; M.cb=()=>{ M.s=.62; M.ty=612; M.cb=()=>tqHideMouse(); };
            C.cb=()=>{ C.dir=C.x<H?1:-1; sfx('thud'); T.shake=.7; tqMood(C,'dizzy'); tqFx('star',C.x+40*C.dir,C.y-250,6); tqLater(()=>{ tqMood(C,null); C.sp=520; C.tx=Math.max(300,Math.min(1300,T.cam)); },1500); }; },900); }; }; } },
  finish(){ tqResetSeq(); T.pieces.forEach(p=>{ if(p.state===1) tqCleanNow(p,true); }); T.mode='finish'; T.mark.setAttribute('opacity','0'); tqHud();
    const all=tqDone()===T.pieces.length, C=T.cat, M=T.mouse; sfx(all?'finish':'yay');
    if(T.cfg.cast==='laila'){ C.sp=500; C.tx=800; C.ty=846; C.cb=()=>{ C.dir=1; if(all){ tqMood(C,'love'); tqClass(C,'dance',true); } else tqMood(C,tqDone()/T.pieces.length<.34?'cold':null); };
      for(let i=0;i<(all?5:2);i++) tqLater(()=>{ tqFx('conf',800,0,all?40:20); tqFx('heart',C.x,C.y-260,6); sfx('sparkle'); },600+i*450); return 0; }
    if(all){ C.sp=600; C.tx=700; C.ty=846; M.out=true; M.el.setAttribute('opacity','1'); M.s=.62; M.sp=900; M.tx=T.H; M.ty=700; M.cb=()=>{ M.s=1.2; M.tx=900; M.ty=850; M.cb=()=>{ M.dir=-1; tqClass(M,'dance',true); }; };
      C.cb=()=>{ C.dir=1; tqMood(C,'wow'); tqClass(C,'dance',true); };
      for(let i=0;i<5;i++) tqLater(()=>{ tqFx('conf',800,0,40); tqFx('star',200+Math.random()*1200,150+Math.random()*500,10); sfx('sparkle'); },600+i*450); }
    else { tqMood(C,'sad'); C.tx=Math.max(300,Math.min(1200,T.cam)); M.out=false; M.el.setAttribute('opacity','1'); M.s=.62; M.x=M.tx=T.H; M.y=612; M.ty=640; M.cb=()=>{ tqJump(M); sfx('laugh'); };
      tqLater(()=>tqFx('conf',800,0,30),700); }
    return 0; },
  summary(){ return {world:T.world,built:tqDone(),total:T.pieces.length}; },
  unmount(){ tqResetSeq(); cancelAnimationFrame(T.raf); if(T.svg.parentNode) T.svg.remove(); if(T.hud&&T.hud.parentNode) T.hud.remove(); T=null; }
};

// ---------- public API ----------
let W=null, raf=0, last=0, ro=null;
function loop(t){ raf=requestAnimationFrame(loop); if(!W) return; const dt=Math.min(.05,(t-(last||t))/1000); last=t; if(document.hidden) return;
  if(W.cfg) frameScene(W,dt); else frame(W,dt); W.ren.render(W.sc,W.cam); }
function size(){ if(!W) return; const r=W.host.getBoundingClientRect(); const w=Math.max(1,r.width), h=Math.max(1,r.height); W.ren.setSize(w,h,false); W.cam.aspect=w/h; W.cam.updateProjectionMatrix(); }
const API={
  // host: element to draw in; o: {world:'race'|'clinic', n, night, rivals:[names], me, av, lang}
  async mount(host,o){ API.unmount(); if(host&&o&&TQW[o.world]){ try{ tqMount(host,o); }catch(e){ console.warn('quiz2d',e); API.unmount(); return false; } muteBtn(host,o.lang); host.classList.add('on'); return true; }
    if(!host||!glOk()) return false; const ok=await load(); if(!ok||!host.isConnected) return false;
    try{ W=SCENES[o.world]?buildScene(host,o):build(host,o); }catch(e){ console.warn('quiz3d',e); API.unmount(); return false; }
    W.mode='intro'; muteBtn(host,o.lang); size(); ro=window.ResizeObserver?new ResizeObserver(size):null; if(ro) ro.observe(host); else window.addEventListener('resize',size);
    last=0; raf=requestAnimationFrame(loop); host.classList.add('on'); return true; },
  ready(){ return !!(W||T); },
  // a new question: put its gate ahead of you
  question(i){ if(T) return TQ.question(i); if(!W) return; if(W.cfg) return SCENE.question(i); W.mode='race'; W.qi=i; W.cars.forEach(c=>{ c.cap=c.target+.55; }); if(!W.gates[i]) gate(W,-(W.cars[0].target+1)*SEG,(W.o.lang==='en'?'Q ':'س ')+(i+1)); },
  answer(ok){ if(T) return TQ.answer(ok); if(!W) return; if(W.cfg) return SCENE.answer(ok); sfx(ok?'boost':'skid'); const me=W.cars[0], g=W.gates[W.qi]; if(g) g.res=!!ok;
    W.cars.forEach(c=>{ c.cap=0; }); me.target+=ok?OK_STEP:BAD_STEP; W.cars.slice(1).forEach(c=>{ c.target+=c.pace*(.94+Math.random()*.12); });
    if(ok){ me.vel+=26; W.fovKick=4; } else { me.spin=Math.PI*2; W.shake=.6; for(let i=0;i<10;i++) setTimeout(()=>W&&burst(W,new THREE.Vector3(me.position.x,.5,me.position.z+1.5),'puff',2),i*60); } },
  place(){ return W&&!W.cfg?place(W):0; },
  summary(){ if(T) return TQ.summary(); return !W?null:W.cfg?SCENE.summary():{world:'race',place:place(W)}; },
  // call from a tap/click: starts the music and the sounds of this world
  unlock(){ if(T){ if(auInit()&&!T.audio){ T.audio=true; musicStart(T.cfg.music); if(T.cfg.cold){ windStart(); tqHud(); } } return; } if(!auInit()||!W||W.audio) return; W.audio=true; musicStart(W.cfg?W.cfg.music:'race'); if(!W.cfg) engineStart(); if(W.cfg&&W.cfg.cold) windStart(); },
  mute(m){ auMute(!!m); }, muted(){ return AU.muted; },
  // all cars roll over the finish line in their final order
  finish(txt){ if(T) return TQ.finish(); if(!W) return 0; if(W.cfg) return SCENE.finish(); sfx('finish'); const p=place(W), lead=Math.max(...W.cars.map(c=>c.target)); finishGate(W,-(lead+.9)*SEG,txt||'FINISH');
    W.cars.forEach(c=>{ c.target+=1.6; }); W.done=true; W.mode='finish'; W.ft=0;
    setTimeout(()=>{ if(!W) return; const me=W.cars[0]; for(let i=0;i<4;i++) setTimeout(()=>W&&burst(W,new THREE.Vector3(me.position.x+(Math.random()-.5)*8,6+Math.random()*3,me.position.z-2),'conf',p===1?70:40),i*350); },1300);
    return p; },
  unmount(){ auStopLoops(); if(T){ const h=T.host; TQ.unmount(); if(h){ h.classList.remove('on'); h.querySelectorAll('.q3dmute').forEach(b=>b.remove()); } } cancelAnimationFrame(raf); raf=0; if(ro){ ro.disconnect(); ro=null; } window.removeEventListener('resize',size);
    if(W){ try{ W.sc.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{ if(m.map) m.map.dispose(); m.dispose(); }); } }); W.ren.dispose(); if(W.ren.forceContextLoss) W.ren.forceContextLoss(); }catch(e){}
      if(W.ren.domElement.parentNode) W.ren.domElement.remove(); if(W.hud&&W.hud.parentNode) W.hud.remove(); if(W.host){ W.host.classList.remove('on'); W.host.querySelectorAll('.q3dmute').forEach(b=>b.remove()); } }
    W=null; }
};
window.QZ3D=API;
})();
