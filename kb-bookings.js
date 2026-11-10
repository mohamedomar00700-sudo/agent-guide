/* =====================================================================
   Bookings for Fresha (team leads only)
   Inside the "📞 Follow-up calls" tab, team leads (Evaluators / Owner in
   the Roster) get every booking sent from the "📅 Booking email" tab,
   laid out the way it's typed into Fresha: tick "In Fresha" after
   entering it, download the list as Excel, or open the Google Sheet.
   Data: Apps Script actions "kbBookings" (list) and "kbFresha" (tick).
   Customer names and numbers live only in the Google Sheet.
   ===================================================================== */
(function(){
'use strict';
if(typeof SEC==='undefined'||typeof SEC.follow!=='function') return;
const EN=(typeof LANG!=='undefined'&&LANG==='en');
const API='https://script.google.com/macros/s/AKfycbxREN7jc2IfSI1q6RkZNMYG812eV4AY73EulaQA-XlM-1JFYQYGuZgzsWZAsf9Vf2yTqQ/exec';
const ses=()=>{ try{ return JSON.parse(localStorage.getItem('tj-quiz-ses')||'null'); }catch(e){ return null; } };
const H=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const plus=n=>{ const d=new Date(); d.setDate(d.getDate()+n); return ymd(d); };
const say=t=>{ try{ toast(t); }catch(e){} };

const T=EN?{
  h:'🗂 Bookings for Fresha',sub:'Every booking sent from the 📅 Booking email tab, in the order you type it into Fresha. Tick ✅ after you enter it. If a booking you entered changes day or is cancelled, its tick comes off and it shows ⚠ so you fix it in Fresha.',
  show:'Show',pend:'Not in Fresha yet',all:'All',by:'Dates by',byD:'Appointment day',byS:'Day it was booked',from:'From',to:'To',
  q:{any:'Any day',today:'Today',tom:'Tomorrow',week:'Next 7 days',past:'Last 7 days'},
  dl:'⬇ Download Excel',sheet:'📄 Open the Google Sheet',reload:'↻ Refresh',none:'Nothing here 👌',load:'Loading…',
  err:'Couldn\'t load the bookings. The scorecard script may need updating.',tick:'In Fresha',ticked:'Saved ✓',untick:'Take off',
  c:{date:'Day',time:'Time',loc:'Branch',name:'Client',mob:'Mobile',svc:'Services',doc:'Doctor',kind:'For',by:'Booked by',odoo:'Odoo',notes:'Notes'},
  n:n=>n+' booking'+(n===1?'':'s'),copy:'Copy',copied:'Copied',sheetNote:'The sheet is shared with the team leads\' Google accounts.'}
:{h:'🗂 الحجوزات لفريشا',sub:'كل حجز اتبعت من تبويب 📅 إيميل حجز، مترتب بنفس ترتيب إدخاله على فريشا. علّم ✅ بعد ما تدخّله. ولو حجز دخلته اتغير ميعاده أو اتلغى، العلامة بتتشال ويظهر ⚠ علشان تعدّله على فريشا.',
  show:'اعرض',pend:'لسه مش على فريشا',all:'الكل',by:'التاريخ حسب',byD:'يوم الميعاد',byS:'يوم الحجز',from:'من',to:'لحد',
  q:{any:'أي يوم',today:'النهارده',tom:'بكرة',week:'الـ 7 أيام الجاية',past:'آخر 7 أيام'},
  dl:'⬇ تحميل Excel',sheet:'📄 افتح جوجل شيت',reload:'↻ تحديث',none:'مفيش حاجة هنا 👌',load:'بيحمّل…',
  err:'مقدرتش أجيب الحجوزات. ممكن سكريبت السكور كارد محتاج يتحدث.',tick:'على فريشا',ticked:'اتسجل ✓',untick:'شيل العلامة',
  c:{date:'اليوم',time:'الساعة',loc:'الفرع',name:'العميل',mob:'الموبايل',svc:'الخدمات',doc:'الدكتور',kind:'الحجز لـ',by:'حجزه',odoo:'أودوو',notes:'ملاحظات'},
  n:n=>n+' حجز',copy:'انسخ',copied:'اتنسخ',sheetNote:'الشيت متشارك مع حسابات جوجل بتاعة التيم ليدرز.'};

const css=`.frw{display:grid;gap:10px}.frw .frbar{display:flex;flex-wrap:wrap;gap:8px;align-items:end}
.frw .frbar label{display:grid;gap:3px;font-size:12.5px;color:var(--muted);font-weight:700}
.frw .frbar input{font:inherit;font-size:14px;border:2px solid var(--line);border-radius:10px;padding:6px 8px;background:var(--paper);color:var(--ink)}
.frw .frchips{display:flex;flex-wrap:wrap;gap:6px}.frw .frchips button,.frw .frbtn{font:inherit;font-size:13.5px;font-weight:700;border:2px solid var(--line);border-radius:99px;padding:6px 12px;background:var(--paper);color:var(--ink);cursor:pointer;text-decoration:none}
.frw .frchips button.on{border-color:var(--blue);background:var(--blue-soft);color:var(--blue)}.frw .frbtn.main{background:#1d2731;color:#fff;border-color:#1d2731}
.frw .frtbl{overflow-x:auto;border:2px solid var(--line);border-radius:12px}.frw table{border-collapse:collapse;width:100%;font-size:13.5px;min-width:900px}
.frw th{position:sticky;top:0;background:var(--soft);text-align:start;padding:8px;font-size:12px;color:var(--muted);white-space:nowrap}
.frw td{padding:8px;border-top:1px solid var(--line);vertical-align:top}.frw tr.warn td{background:var(--amber-soft)}.frw tr.done td{opacity:.6}
.frw .frtick{font:inherit;font-weight:800;font-size:13px;border:2px solid var(--line);border-radius:10px;padding:5px 9px;background:var(--paper);color:var(--ink);cursor:pointer;white-space:nowrap}
.frw .frtick.on{border-color:var(--sage);background:var(--sage-soft);color:var(--sage)}.frw .frwarn{color:var(--amber);font-weight:800;font-size:12.5px}
.frw .frtel{direction:ltr;unicode-bidi:embed;white-space:nowrap;font-weight:700}.frw .frmini{font:inherit;font-size:11.5px;border:1px solid var(--line);border-radius:8px;padding:1px 6px;background:none;color:var(--muted);cursor:pointer}`;
document.head.insertAdjacentHTML('beforeend','<style>'+css+'</style>');

const S={lead:null,items:null,url:'',err:false,busy:false,pend:true,by:'date',from:'',to:'',q:'any'};
async function load(){ const s=ses(); if(!s){ S.lead=null; return; }
  S.busy=true; let j=null;
  try{ j=await (await fetch(API+'?action=kbBookings&session='+encodeURIComponent(s.session)+'&by='+S.by+'&from='+S.from+'&to='+S.to)).json(); }catch(e){}
  S.busy=false;
  if(j&&j.ok){ S.lead=true; S.items=j.items||[]; S.url=j.url||''; S.err=false; }
  else if(j&&(j.error==='forbidden'||j.error==='signed_out')){ S.lead=false; }
  else { S.err=true; if(S.lead===null) S.lead=false; } // old script: stay hidden for agents
  redraw(); }
function redraw(){ if(typeof VIEW!=='undefined'&&VIEW==='follow'&&!(typeof RUN!=='undefined'&&RUN)){ const old=document.getElementById('frw'); if(old) old.outerHTML=panel(); else if(S.lead) renderMain(); } }
const actTxt=a=>EN?a:String(a||'').replace(/^⚠ Changed: update it in Fresha \(was (.*)\)$/,'⚠ اتغير: عدّله على فريشا (كان $1)').replace(/^⚠ Cancelled: cancel it in Fresha$/,'⚠ اتلغى: الغيه من فريشا').replace(/^⚠ Booked again: add it back in Fresha$/,'⚠ اتحجز تاني: ضيفه تاني على فريشا');
const pending=x=>!x.tick&&!/^—/.test(x.act);
const rows=()=>(S.items||[]).filter(x=>!S.pend||pending(x)).sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.time||'').localeCompare(b.time||''));
function dayLbl(d){ try{ return new Date(d+'T12:00:00').toLocaleDateString(EN?'en-GB':'ar-EG',{weekday:'short',day:'numeric',month:'short'}); }catch(e){ return d; } }
function panel(){ if(!S.lead) return '<div id="frw"></div>';
  const R=rows(), chip=(k,v,lbl,on)=>`<button data-fr="${k}" data-v="${v}" class="${on?'on':''}">${lbl}</button>`;
  const body=!S.items?`<div class="muted">${S.err?T.err:T.load}</div>`:!R.length?`<div class="muted">${T.none}</div>`:
   `<div class="frtbl"><table><thead><tr><th>✅</th><th>${T.c.date}</th><th>${T.c.time}</th><th>${T.c.loc}</th><th>${T.c.name}</th><th>${T.c.mob}</th><th>${T.c.svc}</th><th>${T.c.doc}</th><th>${T.c.kind}</th><th>${T.c.by}</th><th>${T.c.odoo}</th><th>${T.c.notes}</th></tr></thead><tbody>${R.map(x=>{ const warn=/^⚠/.test(x.act);
    return `<tr class="${warn?'warn':x.tick?'done':''}"><td><button class="frtick ${x.tick?'on':''}" data-fr="tick" data-v="${H(x.id)}" data-on="${x.tick?0:1}" title="${x.tick?T.untick:T.tick}">${x.tick?'✅ '+T.tick:'⬜ '+T.tick}</button>${warn?`<div class="frwarn">${H(actTxt(x.act))}</div>`:''}${x.tick&&x.enteredBy?`<div class="small muted">${H(x.enteredBy)}</div>`:''}</td>
     <td>${H(dayLbl(x.date))}${x.status!=='Active'?`<div class="small muted">${H(x.status)}</div>`:''}</td><td dir="ltr">${H(x.time)}</td><td>${H(x.loc)}</td><td><b>${H(x.first)} ${H(x.last)}</b></td>
     <td><span class="frtel">${H(x.mob)}</span> <button class="frmini" data-fr="copy" data-v="${H(x.mob)}">${T.copy}</button></td><td>${H(x.svc)}${x.price?`<div class="small muted">${H(x.price)}</div>`:''}</td><td>${H(x.doc)}</td><td>${H(x.kind)}</td><td>${H(x.by)}<div class="small muted">${H(x.saved)}</div></td><td>${H(x.odoo)}</td><td style="white-space:pre-line;max-width:240px">${H(x.notes)}</td></tr>`; }).join('')}</tbody></table></div>`;
  return `<div class="panel frw" id="frw"><b style="font-size:17px">${T.h}</b><div class="small muted">${T.sub}</div>
   <div class="frbar"><div class="frchips">${chip('pend',1,T.pend,S.pend)}${chip('pend',0,T.all,!S.pend)}</div>
    <span class="small muted">${T.by}:</span><div class="frchips">${chip('by','date',T.byD,S.by==='date')}${chip('by','saved',T.byS,S.by==='saved')}</div></div>
   <div class="frbar"><div class="frchips">${Object.keys(T.q).map(k=>chip('q',k,T.q[k],S.q===k)).join('')}</div>
    <label>${T.from}<input type="date" id="frFrom" value="${H(S.from)}"></label><label>${T.to}<input type="date" id="frTo" value="${H(S.to)}"></label></div>
   <div class="frbar"><button class="frbtn main" data-fr="dl" ${R.length?'':'disabled'}>${T.dl}</button>${S.url?`<a class="frbtn" href="${H(S.url)}" target="_blank" rel="noopener" title="${H(T.sheetNote)}">${T.sheet}</a>`:''}<button class="frbtn" data-fr="reload">${T.reload}</button>${S.items?`<span class="small muted">${T.n(R.length)}</span>`:''}</div>
   ${body}</div>`; }
function csv(){ const R=rows(), q=v=>{ const s=String(v==null?'':v); return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; };
  const head=['In Fresha','Fresha action','Status','Appointment date','Day','Time','Location','Client first name','Client last name','Mobile number','Services','Price','Booking for','Team member (doctor)','Notes for the clinic','Booked by','Booked at','Odoo','Entered by','Booking ID'];
  const keys=['tick','act','status','date','day','time','loc','first','last','mob','svc','price','kind','doc','notes','by','saved','odoo','enteredBy','id'];
  const lines=[head.map(q).join(',')].concat(R.map(x=>keys.map(k=>k==='tick'?(x.tick?'Yes':'No'):x[k]).map(q).join(',')));
  const blob=new Blob(['﻿'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}), a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download='bookings-for-fresha-'+ymd(new Date())+'.csv'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500); }
async function tick(id,on){ const s=ses(); if(!s) return; const x=(S.items||[]).find(y=>y.id===id); if(x){ x.tick=on; x.act=on?'Done ✓':'Add to Fresha'; redraw(); }
  let j=null; try{ j=await (await fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'kbFresha',session:s.session,id,on})})).json(); }catch(e){}
  say(j&&j.ok?T.ticked:T.err); load(); }
function quick(k){ S.q=k; S.from=k==='today'?plus(0):k==='tom'?plus(1):k==='week'?plus(0):k==='past'?plus(-7):''; S.to=k==='today'?plus(0):k==='tom'?plus(1):k==='week'?plus(7):k==='past'?plus(0):''; }

{ const f=SEC.follow; SEC.follow=function(){ const h=f.apply(this,arguments); const i=h.lastIndexOf('</section>'); return i<0?h+panel():h.slice(0,i)+panel()+h.slice(i); }; }
if(typeof setView==='function'){ const _set=setView; setView=function(v){ const r=_set.apply(this,arguments); if(v==='follow') load(); return r; }; }
document.addEventListener('click',e=>{ const b=e.target.closest('[data-fr]'); if(!b) return; e.preventDefault(); const k=b.dataset.fr, v=b.dataset.v;
  if(k==='pend'){ S.pend=v==='1'; redraw(); }
  else if(k==='by'){ S.by=v; load(); }
  else if(k==='q'){ quick(v); load(); }
  else if(k==='reload') load();
  else if(k==='dl') csv();
  else if(k==='copy'){ try{ copyText(v,T.copied); }catch(err){} }
  else if(k==='tick') tick(v,b.dataset.on==='1'); });
document.addEventListener('change',e=>{ if(e.target.id==='frFrom'||e.target.id==='frTo'){ S.from=(document.getElementById('frFrom')||{}).value||''; S.to=(document.getElementById('frTo')||{}).value||''; S.q=''; load(); } });
if(ses()) load(); else S.lead=false;
})();
