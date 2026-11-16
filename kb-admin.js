/* =====================================================================
   Bousla content editor ("✏️ تعديل المحتوى")
   Team leads, Quality and the owner (Roster Evaluator / Owner roles,
   signed in with their work email) add, edit and hide content from inside
   the guide, without opening the Google Sheet or the code:
   - the sheet tabs the guide already reads (offers, regular prices,
     doctors, exceptions, updates, team), row by row;
   - the guide's built-in text (price rules, objections, call script,
     service guide, center info, terms, Gulf words, tone, laser prep,
     "needs confirmation"), saved as overrides in the "محتوى إضافي" tab.
   Every change is logged in the QA sheet ("KB edits") with who, when and
   the old value, and can be undone from the change log.
   Loaded by index.html and en.html: both apply the overrides; editing is
   in the Arabic page only.
   ===================================================================== */
(function(){
'use strict';
if(typeof VIEWS==='undefined'||typeof SEC==='undefined') return;
const EN=(typeof LANG!=='undefined'&&LANG==='en');
const API='https://script.google.com/macros/s/AKfycbxREN7jc2IfSI1q6RkZNMYG812eV4AY73EulaQA-XlM-1JFYQYGuZgzsWZAsf9Vf2yTqQ/exec';
const EXTRA='محتوى إضافي';
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const ses=()=>store.get('tj-quiz-ses',null);
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
const h=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nq=s=>(typeof norm==='function'?norm(s):String(s||'').toLowerCase());

/* ================= 1. built-in content: sections and the overrides layer ================= */
const has=n=>{ try{ return Array.isArray(eval(n)); }catch(e){ return false; } };
const arrOf=n=>{ try{ return eval(n); }catch(e){ return null; } };
const RULE_T=[['yes','✅ اعمل كده'],['no','⛔ متعملش كده'],['warn','⚠️ خلي بالك']];
/* field: k = index (array items) or property (objects); t = text | area | sel | lines | rows | offers; opt = may be empty (null) */
const CODE={
 rules:{n:'RULES',l:'قواعد الأسعار والعروض',d:'الصفحة الرئيسية: "قبل ما تقول أي سعر"',kind:'arr',view:'home',
  f:[{k:0,l:'النوع',t:'sel',o:RULE_T},{k:1,l:'القاعدة (عنوان قصير)',req:1},{k:2,l:'الشرح',t:'area'}],
  title:x=>x[1],sub:x=>(RULE_T.find(o=>o[0]===x[0])||['',''])[1],blank:()=>['yes','','']},
 obj:{n:'OBJ',l:'الرد على الاعتراضات',d:'صفحة المكالمة',kind:'arr',view:'calls',
  f:[{k:0,l:'الاعتراض (عنوان)',req:1},{k:1,l:'العميل بيقول إيه (أمثلة)'},{k:5,l:'خطوات قبل الرد',t:'lines',opt:1,hint:'كل خطوة في سطر لوحدها'},{k:2,l:'الرد اللي يتقال',t:'area',req:1},{k:3,l:'متقولش',t:'area'},{k:4,l:'من الأكتر تكراراً حسب الكلاينت؟',t:'sel',o:[['','لأ'],['client','أيوه']]}],
  title:x=>x[0],sub:x=>x[4]?'الأكتر تكراراً':'',blank:()=>['','','','','',null]},
 flows:{n:'FLOWS',l:'سكريبت المكالمة',d:'صفحة المكالمة: خطوات كل نوع مكالمة',kind:'obj',view:'calls',
  f:[{k:'t',l:'نوع المكالمة',req:1},{k:'steps',l:'الخطوات بالترتيب',t:'rows',cols:['التعليمات للإيجنت (مبتتقالش)','الكلام اللي يتقال للعميل (اختياري)'],hint:'في خانة الكلام حط الكلام اللي يتقال بس. اكتب [اسمك] و[الاسم] زي ما هم، وبيتملوا لوحدهم.'}],
  title:x=>x.t,sub:x=>(x.steps||[]).length+' خطوة',blank:()=>({t:'',steps:[['','']]})},
 products:{n:'PRODUCTS',l:'دليل الخدمات',d:'شرح كل خدمة: هي إيه، بتعالج إيه، معلومات وجمل واعتراضات',kind:'obj',view:'services',
  f:[{k:'name',l:'اسم الخدمة',req:1},{k:'en',l:'الاسم بالإنجليزي'},{k:'offers',l:'العروض المرتبطة',t:'offers'},{k:'price',l:'السعر لو مش عرض (اختياري)',opt:1},{k:'what',l:'هو إيه',t:'area'},{k:'areas',l:'بيعالج إيه',t:'lines',hint:'كل حاجة في سطر'},
     {k:'facts',l:'معلومات سريعة',t:'rows',cols:['السؤال','الإجابة']},{k:'phrases',l:'جمل تقنع بيها',t:'lines',hint:'كل جملة في سطر'},{k:'objs',l:'أسئلة واعتراضات',t:'rows',cols:['سؤال / اعتراض العميل','الرد']},
     {k:'compare',l:'مقارنة الأنواع (اختياري)',t:'rows',cols:['النوع','المنشأ','المميزات'],opt:1},{k:'cautions',l:'خلي بالك',t:'lines',hint:'كل تنبيه في سطر'}],
  title:x=>x.name,sub:x=>x.en||'',blank:()=>({id:'p'+Date.now().toString(36),name:'',en:'',offers:[],what:'',areas:[],facts:[],phrases:[],objs:[],cautions:[],src:'kb'})},
 center:{n:'CENTER',l:'معلومات المركز',d:'صفحة الفروع والمواعيد',kind:'arr',view:'branches',
  f:[{k:0,l:'العنوان',req:1},{k:1,l:'المعلومة',t:'area',req:1},{k:2,l:'الحالة',t:'sel',o:[['ok','مؤكد'],['warn','محتاج تأكيد']]}],
  title:x=>x[0],sub:x=>x[2]==='ok'?'مؤكد':'محتاج تأكيد',blank:()=>['','','warn']},
 prep:{n:'PREP',l:'قبل جلسة الليزر',d:'دليل الخدمات: نصايح قبل الجلسة',kind:'str',view:'services',f:[{k:null,l:'النصيحة',t:'area',req:1}],title:x=>x,blank:()=>''},
 terms:{n:'TERMS',l:'المصطلحات',d:'صفحة الخليجي والمصطلحات',kind:'arr',view:'lang',
  f:[{k:0,l:'المصطلح',req:1},{k:1,l:'بالإنجليزي'},{k:2,l:'المعنى ببساطة',t:'area'}],title:x=>x[0],sub:x=>x[1],blank:()=>['','','']},
 gulf:{n:'GULF',l:'قاموس الخليجي',d:'صفحة الخليجي والمصطلحات',kind:'arr',view:'lang',
  f:[{k:0,l:'الكلمة الخليجي',req:1},{k:1,l:'معناها بالمصري',req:1}],title:x=>x[0],sub:x=>x[1],blank:()=>['','']},
 tone:{n:'TONE',l:'خلي بالك من طريقة كلامك',d:'صفحة الخليجي والمصطلحات',kind:'arr',view:'lang',
  f:[{k:0,l:'التعبير اللي منقولوش',req:1},{k:1,l:'ليه، ونقول إيه بداله',t:'area'}],title:x=>x[0],sub:x=>x[1],blank:()=>['','']},
 todo:{n:'TODO',l:'محتاج تأكيد من الكلاينت',d:'صفحة "محتاج تأكيد"',kind:'str',view:'todo',f:[{k:null,l:'اللي محتاج تأكيد',t:'area',req:1}],title:x=>x,blank:()=>''}
};
Object.keys(CODE).forEach(k=>{ if(!has(CODE[k].n)) delete CODE[k]; });
const ORIG={}; Object.keys(CODE).forEach(k=>{ ORIG[k]=clone(arrOf(CODE[k].n)); });
const keyTitle=(sec,x)=>String(CODE[sec].title(x)||'').trim();
let EXTRA_ROWS=[]; // [{sec,key,act,ar,en}]

function parseJ(s){ try{ return s?JSON.parse(s):null; }catch(e){ return null; } }
function readExtra(rows){ // rows: sheet rows incl. header
  return (rows||[]).slice(1).map(r=>({sec:String(r[0]||'').trim(),key:String(r[1]||'').trim(),act:String(r[2]||'').trim(),ar:parseJ(r[3]),en:parseJ(r[4])}))
    .filter(x=>CODE[x.sec]&&x.key&&/^(edit|add|del)$/.test(x.act)); }
function enItem(sec,base,rec){ // English page: built-in English item + the translated fields
  const p=(rec.en&&rec.en.p)||{}, kind=CODE[sec].kind;
  if(kind==='str') return p.v!=null?p.v:(base!=null?base:(rec.ar&&rec.ar.v));
  let it=clone(base!=null?base:(rec.ar&&rec.ar.v));
  const res=(k,v)=>Array.isArray(v)?v.map(e=>e&&typeof e==='object'&&!Array.isArray(e)&&'$o' in e?((base&&base[k])||[])[e.$o]:e):v; // {$o:j} = keep the page's own text for element j
  Object.keys(p).forEach(k=>{ if(kind==='arr') it[+k]=res(+k,p[k]); else it[k]=res(k,p[k]); });
  return it; }
function applyExtra(){
  Object.keys(CODE).forEach(sec=>{
    const c=CODE[sec], arr=arrOf(c.n), recs=EXTRA_ROWS.filter(r=>r.sec===sec);
    const base=clone(ORIG[sec]), slots=base.map((v,i)=>({v,i,del:false}));
    recs.forEach(r=>{
      if(r.act==='add'){ if(!r.ar||r.ar.v==null) return; slots.push({v:EN?enItem(sec,null,r):clone(r.ar.v),i:-1,del:false,key:r.key}); return; }
      const m=/^i(\d+)$/.exec(r.key); if(!m) return; let s=slots[+m[1]];
      if(!EN&&r.ar&&r.ar.o!=null&&s&&keyTitle(sec,s.v)!==r.ar.o){ s=slots.find(x=>x.i>=0&&keyTitle(sec,x.v)===r.ar.o); } // the code changed order since
      if(!s) return;
      if(r.act==='del'){ s.del=true; return; }
      if(EN) s.v=enItem(sec,s.v,r);
      else if(r.ar&&r.ar.v!=null) s.v=c.kind==='obj'?Object.assign({},s.v,clone(r.ar.v)):clone(r.ar.v);
    });
    arr.length=0; slots.filter(s=>!s.del).forEach(s=>arr.push(s.v));
  });
  try{ if(typeof reindex==='function') reindex(); }catch(e){}
}
async function loadExtra(){
  if(typeof sheetGet!=='function'||typeof gviz!=='function') return;
  try{ const rows=await sheetGet(gviz(EXTRA)); if(!rows||!rows.length||!/القسم/.test(rows[0].join(' '))) return; // gviz returns the first tab when the tab is missing
    EXTRA_ROWS=readExtra(rows); if(!EXTRA_ROWS.length) return; applyExtra(); renderMain(); }catch(e){ console.warn('extra content failed',e); } }
loadExtra();

/* ================= 2. the editor (Arabic page, editors only) ================= */
if(EN) return;
const api={
  async get(q){ const r=await fetch(API+'?'+new URLSearchParams(Object.assign({session:(ses()||{}).session||''},q))); return r.json(); },
  async post(b){ const r=await fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({session:(ses()||{}).session||''},b))}); return r.json(); }
};
const WEEKD=['السبت','الأحد','الاتنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];
const catOpts=()=>Object.entries(typeof CATS!=='undefined'?CATS:{}).map(([k,v])=>[v,v]);
const brOpts=()=>(typeof BRANCHES!=='undefined'?BRANCHES:[]).map(b=>[b.city,b.city]);
const docOpts=()=>(typeof DOCTORS!=='undefined'?DOCTORS:[]).map(d=>[d.key||d.name,d.key||d.name]);
/* sheet tabs: f = column fields; del = how "delete" works (hide column, a role value, or remove the row) */
const SHEET={
 offers:{tab:'العروض',l:'العروض والأسعار',d:'كل عرض: الاسم والسعر والكلام اللي يتقال والهدية',view:'offers',del:{hide:16},top:false,
  f:[{c:0,l:'كود العرض',req:1,id:1,hint:'حروف إنجليزي وأرقام بس، من غير مسافات (مثلاً hydra2). بيتكتب مرة واحدة ومبيتغيرش.'},{c:1,l:'اسم العرض بالعربي',req:1},{c:2,l:'Offer name (English)',en:1},
     {c:3,l:'القسم',t:'sel',o:catOpts},{c:4,l:'السعر زي ما يتقال',req:1,hint:'مثلاً 400 / 700'},{c:7,l:'الحالة',t:'sel',o:()=>[['مؤكد','مؤكد'],['محتاج تأكيد','محتاج تأكيد'],['مش متاح','مش متاح']]},
     {c:5,l:'تفاصيل السعر بالعربي'},{c:6,l:'Price details (English)',en:1},{c:8,l:'يتقال للعميل بالعربي',t:'area'},{c:9,l:'Say to customer (English)',t:'area',en:1},
     {c:10,l:'هو إيه بالعربي',t:'area'},{c:11,l:'What it is (English)',t:'area',en:1},{c:12,l:'ملاحظة للإيجنت بالعربي',t:'area'},{c:13,l:'Agent note (English)',t:'area',en:1},
     {c:14,l:'أسعار الحاسبة',hint:'الاسم=السعر; الاسم=السعر (مثلاً: منطقة واحدة=400; الوش كله=700)'},{c:15,l:'Calculator labels (English)',en:1,noTr:1,hint:'label; label'},
     {c:17,l:'وصف الواتساب بالعربي (سطر قصير)',hint:'لو فاضي بيستخدم الوصف الجاهز'},{c:18,l:'WhatsApp description (English)',en:1}],
  head:{17:'وصف الواتساب بالعربي',18:'WhatsApp description (English)'},
  title:r=>r[1]||r[0],sub:r=>[r[4],r[7]].filter(Boolean).join(' · ')},
 regular:{tab:'أسعار عادية',l:'الأسعار العادية (مش عروض)',d:'خدمات من غير عرض وسعرها',view:'offers',del:{hide:5},
  f:[{c:0,l:'الخدمة بالعربي',req:1},{c:1,l:'Service (English)',en:1},{c:2,l:'السعر',req:1},{c:3,l:'التفاصيل بالعربي'},{c:4,l:'Details (English)',en:1}],
  title:r=>r[0],sub:r=>r[2]},
 doctors:{tab:'الدكاترة',l:'الدكاترة والمواعيد',d:'مين موجود، في أنهي فرع، وأيام ومواعيد كل دكتور',view:'branches',del:{row:1},
  f:[{c:0,l:'الاسم بالعربي',req:1,hint:'مثلاً د. ياسمين درويش'},{c:1,l:'Name (English)',en:1},{c:2,l:'التخصص بالعربي'},{c:3,l:'Specialty (English)',en:1},{c:4,l:'الفرع',t:'sel',o:brOpts,req:1},
     {c:5,l:'من الساعة',hint:'مثلاً 2 PM',req:1},{c:6,l:'لحد الساعة',hint:'مثلاً 10 PM',req:1},{c:7,l:'الأيام',t:'days'},{c:14,l:'ملاحظة بالعربي',t:'area'},{c:15,l:'Note (English)',t:'area',en:1},
     {c:16,l:'يبدأ من تاريخ (اختياري)',t:'date'},{c:17,l:'ينتهي في تاريخ (اختياري)',t:'date'}],
  title:r=>r[0],sub:r=>[r[4],r[5]&&r[6]?r[5]+' – '+r[6]:'',WEEKD.filter((d,i)=>r[7+i]).join('، ')].filter(Boolean).join(' · ')},
 exceptions:{tab:'الاستثناءات',l:'إجازات واستثناءات الدكاترة',d:'يوم معين الدكتور مش موجود أو مواعيده مختلفة',view:'branches',del:{row:1},
  f:[{c:0,l:'الدكتور',t:'sel',o:docOpts,req:1},{c:1,l:'التاريخ',t:'date',req:1},{c:2,l:'موجود اليوم ده؟',t:'sel',o:()=>[['لا','لأ، مش موجود'],['نعم','أيوه، بس مواعيد مختلفة']]},
     {c:3,l:'من الساعة (لو مختلف)',hint:'مثلاً 4 PM'},{c:4,l:'لحد الساعة (لو مختلف)'},{c:5,l:'ملاحظة بالعربي'},{c:6,l:'Note (English)',en:1}],
  title:r=>r[0]+' · '+r[1],sub:r=>/^(لا|no)$/i.test(r[2])?'مش موجود':(r[3]?r[3]+' – '+r[4]:'موجود')},
 updates:{tab:'التحديثات',l:'الأخبار والتحديثات',d:'الخبر بيظهر للإيجنتس في الرئيسية وفي إيميل الصبح',view:'home',del:{row:1},top:true,
  f:[{c:0,l:'التاريخ',t:'date',req:1,today:1},{c:1,l:'الخبر بالعربي',t:'area',req:1},{c:2,l:'News (English)',t:'area',en:1}],
  title:r=>r[1],sub:r=>r[0]},
 team:{tab:'الفريق',l:'الفريق',d:'أسماء وإيميلات الإيجنتس (لقوايم الإيميلات والواتساب)',view:'wa',del:{set:[3,'Left']},
  f:[{c:0,l:'الاسم بالإنجليزي',req:1},{c:1,l:'الاسم بالعربي'},{c:2,l:'الإيميل',hint:'لو فاضي بيتعمل من الاسم الإنجليزي: First.Last@techsource-gds.com'},{c:3,l:'الدور',t:'sel',o:()=>[['Agent','إيجنت'],['Quality','كواليتي'],['Left','ساب الأكونت']]}],
  title:r=>r[1]||r[0],sub:r=>[r[2],r[3]].filter(Boolean).join(' · ')}
};
const GROUPS_E=[['من الشيت (أسعار ومواعيد)',['offers','regular','doctors','exceptions','updates','team']],['كلام الدليل',Object.keys(CODE)]];

let OK=store.get('kae-ok',false), DATA=null, LOADING=false, ERR='', PICK=store.get('kae-pick','offers'), FORM=null, MSG='', Q='', LOG=null, BUSY=false, SHOWHID=false;
const root=document.createElement('div'); root.className='kae';
const ERRS={signed_out:'لازم تسجّل دخول الأول بإيميل الشغل (من صفحة الكويز).',forbidden:'التعديل متاح للتيم ليدرز والكواليتي بس.',changed:'حد عدّل الصف ده من شوية. حمّلتلك آخر نسخة، راجعها وعدّل تاني.',
  changed_since:'الحاجة دي اتعدلت تاني بعد التعديل ده. رجّع التعديل الأحدث الأول.',already_undone:'التعديل ده اترجع قبل كده.',empty:'مفيش حاجة مكتوبة.',bad_tab:'التبويب ده مش موجود في الشيت.',net:'مفيش اتصال، أو نسخة الـ Apps Script لسه متحدّثتش. جرّب تاني.'};
const errTxt=e=>ERRS[e]||ERRS.net;

/* ---- view + permission ---- */
function addView(){ if(VIEWS.some(v=>v[0]==='edit')) return; const i=VIEWS.findIndex(v=>v[0]==='todo'); VIEWS.splice(i<0?VIEWS.length:i,0,['edit','✏️ تعديل المحتوى',['edit']]); try{ renderTabs(); }catch(e){} }
function dropView(){ const i=VIEWS.findIndex(v=>v[0]==='edit'); if(i<0) return; VIEWS.splice(i,1); try{ renderTabs(); }catch(e){} if(VIEW==='edit') setView('home'); }
async function checkWho(){ if(!ses()){ if(OK){ OK=false; store.set('kae-ok',false); dropView(); } return; }
  try{ const j=await api.get({action:'kbEdWho'}); OK=!!(j&&j.ok); store.set('kae-ok',OK); OK?addView():(j&&j.error?dropView():0); }catch(e){}
  if(OK&&(location.hash||'').slice(1)==='edit'&&VIEW!=='edit') setView('edit',true); }
if(OK&&ses()) addView();
checkWho();
window.addEventListener('storage',e=>{ if(e.key==='tj-quiz-ses') checkWho(); });
setInterval(()=>{ const s=!!ses(); if(s!==checkWho._s){ checkWho._s=s; checkWho(); } },4000); checkWho._s=!!ses();

SEC.edit=()=>'<section id="edit"><div id="kae-slot"></div></section>';
{ const _rm=renderMain; renderMain=function(){ _rm(); const s=document.getElementById('kae-slot'); if(s){ s.replaceWith(root); if(!DATA&&!LOADING) load(); else paint(); } }; }

async function load(){ LOADING=true; ERR=''; paint();
  try{ const j=await api.get({action:'kbEdRead'}); if(j&&j.ok){ DATA=j.tabs; if(DATA[EXTRA]){ EXTRA_ROWS=readExtra([DATA[EXTRA].head].concat(DATA[EXTRA].rows.map(r=>r.v))); applyExtra(); } } else ERR=errTxt(j&&j.error); }
  catch(e){ ERR=errTxt('net'); }
  LOADING=false; paint(); }
async function reloadTab(tab){ try{ const j=await api.get({action:'kbEdRead',tab}); if(j&&j.ok&&j.tabs[tab]){ DATA[tab]=j.tabs[tab]; if(tab===EXTRA){ EXTRA_ROWS=readExtra([DATA[EXTRA].head].concat(DATA[EXTRA].rows.map(r=>r.v))); applyExtra(); } } }catch(e){} }
function refreshLive(tab){ // the rest of the guide picks up the change
  if(tab===EXTRA){ try{ renderMain(); }catch(e){} return; }
  setTimeout(()=>{ try{ if(tab==='الفريق'){ if(typeof loadTeamSheet==='function') loadTeamSheet(); } else if(typeof loadSheets==='function') loadSheets(); }catch(e){} },1200); }

/* ---- painting ---- */
const btn=(a,t,cls,extra)=>`<button class="btn ${cls||''}" data-kae="${a}" ${extra||''}>${t}</button>`;
function paint(){
  if(!root.isConnected) return;
  const navs=GROUPS_E.map(([g,ids])=>`<div class="kae-g"><div class="kae-gt">${g}</div><div class="kae-chips">${ids.map(id=>{ const c=SHEET[id]||CODE[id]; return `<button class="kae-chip ${PICK===id?'on':''}" data-kae="pick" data-v="${id}">${h(c.l)}</button>`; }).join('')}</div></div>`).join('')
    +`<div class="kae-g"><div class="kae-gt">المتابعة</div><div class="kae-chips"><button class="kae-chip ${PICK==='log'?'on':''}" data-kae="pick" data-v="log">🕘 سجل التعديلات والتراجع</button></div></div>`;
  let body='';
  if(LOADING&&!DATA) body='<div class="panel muted">بيحمّل المحتوى…</div>';
  else if(ERR&&!DATA) body=`<div class="panel"><b>مقدرتش أفتح المحتوى</b><div class="muted">${h(ERR)}</div>${btn('reload','جرّب تاني')}</div>`;
  else if(FORM) body=formHtml();
  else if(PICK==='log') body=logHtml();
  else if(SHEET[PICK]) body=sheetList(PICK);
  else if(CODE[PICK]) body=codeList(PICK);
  root.innerHTML=`<div class="sh"><div class="eyebrow">للتيم ليدرز والكواليتي</div><h2>تعديل المحتوى</h2><p>ضيف أو عدّل أو احذف أي حاجة في الدليل من هنا. التعديل بيظهر لكل الإيجنتس أول ما يفتحوا الدليل أو يعملوا ريفريش. كل تعديل بيتسجل باسمك، وتقدر ترجعه من سجل التعديلات.</p></div>
   ${MSG?`<div class="kae-msg" role="status">${MSG}</div>`:''}<div class="kae-nav">${navs}</div><div class="kae-body">${body}</div>`;
  if(FORM){ const f=root.querySelector('[data-focus]'); if(f&&!paint._kept) try{ f.focus({preventScroll:true}); }catch(e){} }
}
function flash(t,bad){ MSG=`<span class="${bad?'bad':''}">${t}</span>`; paint(); clearTimeout(flash.t); flash.t=setTimeout(()=>{ MSG=''; paint(); },bad?9000:5000); }
const goLink=v=>VIEWS.some(x=>x[0]===v)?`<button class="btn" data-kae="see" data-v="${v}">👁 شوفها في الدليل</button>`:'';

function sheetRows(id){ const c=SHEET[id], d=DATA&&DATA[c.tab]; return d?d.rows.filter(r=>r.v.some(x=>String(x).trim())):null; }
function isHidden(id,r){ const del=SHEET[id].del; if(del.hide!=null) return /^(نعم|yes|y|✓|1|true|مخفي|hide)$/i.test(String(r.v[del.hide]||'').trim()); if(del.set) return /^left$/i.test(String(r.v[del.set[0]]||'').trim()); return false; }
function sheetList(id){
  const c=SHEET[id], rows=sheetRows(id);
  if(!rows) return `<div class="panel"><b>${h(c.l)}</b><div class="muted">التبويب "${h(c.tab)}" مش موجود في الشيت.</div></div>`;
  const q=nq(Q), vis=rows.filter(r=>!q||nq(r.v.join(' ')).includes(q)), hid=vis.filter(r=>isHidden(id,r)), act=vis.filter(r=>!isHidden(id,r));
  const item=(r,hidden)=>`<div class="kae-it ${hidden?'hid':''}"><div class="kae-t"><b>${h(c.title(r.v)||'—')}</b><span>${h(c.sub(r.v)||'')}</span></div><div class="kae-a">
    ${hidden?btn('unhide','↩ رجّعه','', `data-id="${id}" data-n="${r.n}"`):btn('edit','✏️ تعديل','', `data-id="${id}" data-n="${r.n}"`)+btn('del',c.del.row?'🗑 حذف':'🙈 إخفاء','kae-danger',`data-id="${id}" data-n="${r.n}"`)}</div></div>`;
  return `<div class="kae-head"><div><h3>${h(c.l)}</h3><div class="muted">${h(c.d)}</div></div><div class="kae-a">${btn('add','➕ إضافة جديد','pri',`data-id="${id}"`)}${goLink(c.view)}</div></div>
   <input class="kae-q" type="search" data-kae-q placeholder="دوّر…" value="${h(Q)}" aria-label="دوّر">
   <div class="kae-list">${act.map(r=>item(r,false)).join('')||'<div class="muted">مفيش حاجة.</div>'}</div>
   ${hid.length?`<details class="kae-hid" ${SHOWHID?'open':''}><summary>${c.del.set?'سابوا الأكونت':'مخفية'} (${hid.length})</summary><div class="kae-list">${hid.map(r=>item(r,true)).join('')}</div></details>`:''}`;
}
function codeList(sec){
  const c=CODE[sec], cur=arrOf(c.n), q=nq(Q);
  // rows: built-in items (with any edit) in their order, then added ones; deleted built-in items listed apart
  const recs=EXTRA_ROWS.filter(r=>r.sec===sec), byKey={}; recs.forEach(r=>byKey[r.key]=r);
  const items=ORIG[sec].map((o,i)=>{ const r=byKey['i'+i]; return {key:'i'+i,v:r&&r.act==='edit'&&r.ar?(c.kind==='obj'?Object.assign({},o,r.ar.v):r.ar.v):o,state:r?(r.act==='del'?'del':'edit'):'',orig:o}; })
    .concat(recs.filter(r=>r.act==='add'&&r.ar).map(r=>({key:r.key,v:r.ar.v,state:'add'})));
  const txt=x=>typeof x==='string'?x:JSON.stringify(x);
  const vis=items.filter(x=>!q||nq(txt(x.v)).includes(q)), act=vis.filter(x=>x.state!=='del'), gone=vis.filter(x=>x.state==='del');
  const tag={edit:'<span class="chip c-warn">متعدّل</span>',add:'<span class="chip c-ok">جديد</span>'};
  const item=x=>`<div class="kae-it ${x.state==='del'?'hid':''}"><div class="kae-t"><b>${h(keyTitle(sec,x.v)||'—')} ${tag[x.state]||''}</b><span>${h(c.sub?c.sub(x.v)||'':'')}</span></div><div class="kae-a">
     ${x.state==='del'?btn('cunhide','↩ رجّعه','',`data-sec="${sec}" data-k="${x.key}"`):btn('cedit','✏️ تعديل','',`data-sec="${sec}" data-k="${x.key}"`)+(x.state==='edit'?btn('creset','↺ رجّع الأصلي','',`data-sec="${sec}" data-k="${x.key}"`):'')+btn('cdel','🗑 حذف','kae-danger',`data-sec="${sec}" data-k="${x.key}"`)}</div></div>`;
  return `<div class="kae-head"><div><h3>${h(c.l)}</h3><div class="muted">${h(c.d)}</div></div><div class="kae-a">${btn('cadd','➕ إضافة جديد','pri',`data-sec="${sec}"`)}${goLink(c.view)}</div></div>
   ${DATA&&!DATA[EXTRA]?'<div class="muted">أول تعديل هنا هيعمل تبويب "محتوى إضافي" في شيت النولدج لوحده.</div>':''}
   <input class="kae-q" type="search" data-kae-q placeholder="دوّر…" value="${h(Q)}" aria-label="دوّر">
   <div class="kae-list">${act.map(item).join('')||'<div class="muted">مفيش حاجة.</div>'}</div>
   ${gone.length?`<details class="kae-hid" ${SHOWHID?'open':''}><summary>محذوفة (${gone.length})</summary><div class="kae-list">${gone.map(item).join('')}</div></details>`:''}`;
}

/* ---- the form ---- */
const toIso=v=>{ const d=typeof parseDate==='function'?parseDate(v):''; return d||''; };
const fromIso=v=>{ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(v||''); return m?m[3]+'/'+m[2]+'/'+m[1]:''; };
const todayDmy=()=>{ const d=new Date(); return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear(); };
function fieldHtml(f,val,i,first){
  const id='kaef'+i, req=f.req?' <i class="req">*</i>':'', hint=f.hint?`<small>${h(f.hint)}</small>`:'', foc=first?' data-focus':'';
  const lab=`<label for="${id}">${h(f.l)}${req}${f.en?' <span class="kae-en">EN</span>':''}</label>`;
  const t=f.t||'text';
  if(t==='area') return `<div class="kae-f ${f.en?'en':''}">${lab}<textarea id="${id}" data-f="${i}" rows="3" ${f.en?'dir="ltr"':''}${foc}>${h(val)}</textarea>${hint}</div>`;
  if(t==='sel'){ const o=(typeof f.o==='function'?f.o():f.o)||[]; const all=o.some(x=>x[0]===val)||!val?o:o.concat([[val,val]]);
    return `<div class="kae-f">${lab}<select id="${id}" data-f="${i}"${foc}>${f.req?'':'<option value="">—</option>'}${all.map(([v,l])=>`<option value="${h(v)}" ${v===val?'selected':''}>${h(l)}</option>`).join('')}</select>${hint}</div>`; }
  if(t==='date') return `<div class="kae-f">${lab}<input id="${id}" type="date" data-f="${i}" value="${h(toIso(val))}"${foc}>${hint}</div>`;
  if(t==='days') return `<div class="kae-f wide"><span class="lab">${h(f.l)}</span><div class="kae-days">${WEEKD.map((d,j)=>`<label><input type="checkbox" data-f="${i}" data-j="${j}" ${val[j]?'checked':''}> ${d}</label>`).join('')}</div></div>`;
  if(t==='lines') return `<div class="kae-f wide">${lab}<textarea id="${id}" data-f="${i}" rows="${Math.min(10,Math.max(3,(val||[]).length+1))}"${foc}>${h((val||[]).join('\n'))}</textarea>${hint}</div>`;
  if(t==='offers'){ const sel=new Set(val||[]); return `<div class="kae-f wide"><span class="lab">${h(f.l)}</span><div class="kae-days">${(typeof OFFERS!=='undefined'?OFFERS:[]).map(o=>`<label><input type="checkbox" data-f="${i}" data-o="${h(o.id)}" ${sel.has(o.id)?'checked':''}> ${h(o.ar)}</label>`).join('')}</div></div>`; }
  if(t==='rows'){ const rows=(val&&val.length?val:[f.cols.map(()=>'')]);
    return `<div class="kae-f wide"><span class="lab">${h(f.l)}${req}</span>${hint}<div class="kae-rows" data-rows="${i}">${rows.map((r,ri)=>`<div class="kae-row"><span class="kae-n">${ri+1}</span>${f.cols.map((cl,ci)=>`<textarea rows="2" data-f="${i}" data-r="${ri}" data-c="${ci}" placeholder="${h(cl)}" aria-label="${h(cl)}">${h(r[ci]||'')}</textarea>`).join('')}
      <span class="kae-rb"><button type="button" class="ib" data-kae="rup" data-f="${i}" data-r="${ri}" title="لفوق" aria-label="لفوق">▲</button><button type="button" class="ib" data-kae="rdown" data-f="${i}" data-r="${ri}" title="لتحت" aria-label="لتحت">▼</button><button type="button" class="ib" data-kae="radd" data-f="${i}" data-r="${ri}" title="سطر جديد بعده" aria-label="سطر جديد بعده">＋</button><button type="button" class="ib" data-kae="rdel" data-f="${i}" data-r="${ri}" title="امسح السطر" aria-label="امسح السطر">✕</button></span></div>`).join('')}</div></div>`; }
  return `<div class="kae-f ${f.en?'en':''}">${lab}<input id="${id}" type="text" data-f="${i}" value="${h(val)}" ${f.en?'dir="ltr"':''} ${f.id&&FORM.op==='edit'?'readonly':''}${foc}>${hint}</div>`;
}
function formHtml(){
  const F=FORM, fields=F.fields, isNew=F.op==='add';
  const hasEn=F.kind==='sheet'&&fields.some(f=>f.en);
  return `<div class="kae-form panel"><div class="kae-head"><h3>${isNew?'➕ إضافة في':'✏️ تعديل في'} ${h(F.label)}</h3>${btn('cancel','رجوع من غير حفظ')}</div>
   <form data-kae-form novalidate><div class="kae-grid">${fields.map((f,i)=>fieldHtml(f,F.vals[i],i,i===(F.focus||0))).join('')}</div>
   ${F.kind==='code'?`<label class="kae-tr"><input type="checkbox" data-kae-tr ${F.tr?'checked':''}> ترجم اللي اتغير للنسخة الإنجليزي أوتوماتيك</label>`:''}
   <div class="kae-foot">${btn('save',BUSY?'بيحفظ…':(isNew?'➕ أضف':'💾 احفظ التعديل'),'pri',BUSY?'disabled':'')}${hasEn?btn('fillen','🌐 املأ الإنجليزي الفاضي أوتوماتيك'):''}${btn('cancel','إلغاء')}</div>
   ${F.err?`<div class="kae-msg"><span class="bad">${h(F.err)}</span></div>`:''}</form></div>`;
}
// sheet row → field values, and back
function sheetVals(id,row){ return SHEET[id].f.map(f=>f.t==='days'?WEEKD.map((d,j)=>typeof yes==='function'?yes(row[f.c+j]):!!String(row[f.c+j]||'').trim()):String(row[f.c]||'')); }
function sheetRow(id,vals,base){ const out=(base||[]).slice(); const put=(c,v)=>{ while(out.length<=c) out.push(''); out[c]=v; };
  SHEET[id].f.forEach((f,i)=>{ const v=vals[i]; if(f.t==='days') WEEKD.forEach((d,j)=>put(f.c+j,v[j]?'✓':'')); else if(f.t==='date') put(f.c,v); else put(f.c,String(v==null?'':v).trim()); }); return out; }
function codeVals(sec,item){ const c=CODE[sec]; return c.f.map(f=>{ const v=c.kind==='str'?item:item[f.k];
  if(f.t==='lines'||f.t==='offers') return Array.isArray(v)?v.slice():[]; if(f.t==='rows') return Array.isArray(v)?clone(v).map(r=>f.cols.map((x,i)=>r[i]||'')):[]; return v==null?'':String(v); }); }
const trimArr=a=>{ a=a.slice(); while(a.length&&(a[a.length-1]==null||a[a.length-1]==='')) a.pop(); return a; };
function codeItem(sec,vals,base){ const c=CODE[sec];
  if(c.kind==='str') return String(vals[0]||'').trim();
  const it=clone(base); c.f.forEach((f,i)=>{ let v=vals[i];
    if(f.t==='lines'){ v=v.map(x=>String(x).trim()).filter(Boolean); if(!v.length&&f.opt) v=null; }
    else if(f.t==='rows'){ v=v.map(r=>r.map(x=>String(x||'').trim())).filter(r=>r.some(Boolean)).map(r=>{ while(r.length>1&&!r[r.length-1]) r.pop(); return r; }); if(!v.length&&f.opt) v=null; }
    else if(f.t==='offers'){ v=v.slice(); }
    else { v=String(v||'').trim(); if(!v&&f.opt) v=c.kind==='obj'?null:''; }
    it[f.k]=v; }); return c.kind==='arr'?trimArr(it):it; }
function readForm(){ const F=FORM, form=root.querySelector('[data-kae-form]'); if(!form) return;
  F.fields.forEach((f,i)=>{ const t=f.t||'text';
    if(t==='days') F.vals[i]=WEEKD.map((d,j)=>{ const el=form.querySelector(`[data-f="${i}"][data-j="${j}"]`); return !!(el&&el.checked); });
    else if(t==='offers') F.vals[i]=[...form.querySelectorAll(`[data-f="${i}"][data-o]`)].filter(x=>x.checked).map(x=>x.dataset.o);
    else if(t==='rows'){ const rows=[]; form.querySelectorAll(`[data-f="${i}"][data-r]`).forEach(el=>{ const r=+el.dataset.r, c=+el.dataset.c; (rows[r]=rows[r]||f.cols.map(()=>''))[c]=el.value; }); F.vals[i]=rows.filter(Boolean); }
    else if(t==='lines') F.vals[i]=String((form.querySelector(`[data-f="${i}"]`)||{}).value||'').split('\n');
    else if(t==='date') F.vals[i]=fromIso((form.querySelector(`[data-f="${i}"]`)||{}).value||'');
    else F.vals[i]=(form.querySelector(`[data-f="${i}"]`)||{}).value||''; });
  const tr=form.querySelector('[data-kae-tr]'); if(tr) F.tr=tr.checked; }
function openSheetForm(id,n){ const c=SHEET[id]; let row=[], r=null;
  if(n){ r=(DATA[c.tab].rows||[]).find(x=>x.n===+n); if(!r) return; row=r.v.slice(); }
  const vals=sheetVals(id,row); if(!n) c.f.forEach((f,i)=>{ if(f.today) vals[i]=todayDmy(); if(f.t==='sel'&&f.req&&!vals[i]){ const o=(typeof f.o==='function'?f.o():f.o)||[]; if(o[0]) vals[i]=o[0][0]; } });
  FORM={kind:'sheet',id,op:n?'edit':'add',n:n?+n:0,old:row,label:c.l,fields:c.f,vals,focus:n?1:0}; window.scrollTo({top:root.offsetTop-70}); paint(); }
function openCodeForm(sec,key){ const c=CODE[sec]; let item, op='add';
  if(key){ const r=EXTRA_ROWS.find(x=>x.sec===sec&&x.key===key), m=/^i(\d+)$/.exec(key); op='edit';
    if(m){ const o=ORIG[sec][+m[1]]; item=r&&r.act==='edit'&&r.ar?(c.kind==='obj'?Object.assign({},o,r.ar.v):r.ar.v):o; } else item=r&&r.ar?r.ar.v:null;
    if(item==null) return; }
  else item=c.blank();
  FORM={kind:'code',sec,key:key||'',op,label:c.l,fields:c.f,vals:codeVals(sec,item),base:clone(item),tr:true}; window.scrollTo({top:root.offsetTop-70}); paint(); }

/* ---- saving ---- */
async function translate(texts){ const out=texts.map(()=>''), idx=texts.map((t,i)=>/[؀-ۿ]/.test(t)?i:-1).filter(i=>i>=0);
  for(let s=0;s<idx.length;s+=8){ const part=idx.slice(s,s+8); try{ const r=await fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'translate',texts:part.map(i=>texts[i])})}); const j=await r.json(); (j.en||[]).forEach((t,k)=>out[part[k]]=t||''); }catch(e){} }
  texts.forEach((t,i)=>{ if(!out[i]) out[i]=/[؀-ۿ]/.test(t)?'':t; }); return out; }
function check(){ const F=FORM, miss=F.fields.filter((f,i)=>{ if(!f.req) return false; const v=F.vals[i]; return Array.isArray(v)?!v.some(r=>Array.isArray(r)?r.some(x=>String(x).trim()):String(r).trim()):!String(v||'').trim(); });
  if(miss.length) return 'لازم تكتب: '+miss.map(f=>f.l).join('، ');
  if(F.kind==='sheet'&&F.id==='offers'&&F.op==='add'){ const id=String(F.vals[0]||'').trim();
    if(!/^[a-z0-9_-]+$/i.test(id)) return 'كود العرض لازم يكون حروف إنجليزي وأرقام بس، من غير مسافات.';
    if((DATA['العروض'].rows||[]).some(r=>String(r.v[0]).trim().toLowerCase()===id.toLowerCase())||(typeof OFFERS!=='undefined'&&OFFERS.some(o=>o.id.toLowerCase()===id.toLowerCase()))) return 'الكود ده مستخدم لعرض تاني. اختار كود تاني.'; }
  return ''; }
async function sheetSave(id,op,n,old,vals,item,extra){
  const c=SHEET[id], body=Object.assign({action:'kbEdSave',tab:c.tab,op,row:n,old,vals,item},extra||{});
  const j=await api.post(body); if(!j||!j.ok){ if(j&&j.error==='changed') await reloadTab(c.tab); throw new Error(j&&j.error||'net'); } await reloadTab(c.tab); refreshLive(c.tab); return j; }
async function save(){ readForm(); const F=FORM; F.err=check(); if(F.err){ paint(); return; }
  BUSY=true; paint();
  try{
    if(F.kind==='sheet'){ const row=sheetRow(F.id,F.vals,F.old), c=SHEET[F.id];
      const head=c.head&&DATA[c.tab]?c.head:null;
      await sheetSave(F.id,F.op,F.n,F.old,row,c.title(row),{top:F.op==='add'&&!!c.top});
      if(head){ /* fill blank header cells for newer columns (WhatsApp description) once */ const hd=DATA[c.tab].head.slice(); let ch=false; Object.keys(head).forEach(k=>{ while(hd.length<=+k) hd.push(''); if(!String(hd[+k]).trim()){ hd[+k]=head[k]; ch=true; } });
        if(ch) try{ await api.post({action:'kbEdSave',tab:c.tab,op:'edit',row:1,old:DATA[c.tab].head,vals:hd,item:'header'}); await reloadTab(c.tab); }catch(e){} }
      FORM=null; flash(F.op==='add'?'✅ اتضاف. هيظهر للإيجنتس في الدليل خلال ثواني.':'✅ اتحفظ. التعديل هيظهر للإيجنتس خلال ثواني.');
    } else await codeSave(F);
  }catch(e){ F.err=errTxt(e.message); }
  BUSY=false; paint(); }
function extraRow(sec,key){ return DATA[EXTRA]?(DATA[EXTRA].rows||[]).find(r=>String(r.v[0]).trim()===sec&&String(r.v[1]).trim()===key):null; }
async function extraPut(sec,key,act,ar,en,title){ // one row per item in "محتوى إضافي"
  const me=(ses()||{}).name||'', now=new Date().toISOString().slice(0,16).replace('T',' ');
  const vals=[sec,key,act,ar?JSON.stringify(ar):'',en?JSON.stringify(en):'',me,now];
  const r=extraRow(sec,key);
  const j=await api.post(r?{action:'kbEdSave',tab:EXTRA,op:'edit',row:r.n,old:r.v,vals,item:CODE[sec].l+': '+title}:{action:'kbEdSave',tab:EXTRA,op:'add',vals,item:CODE[sec].l+': '+title});
  if(!j||!j.ok){ if(j&&j.error==='changed') await reloadTab(EXTRA); throw new Error(j&&j.error||'net'); }
  await reloadTab(EXTRA); refreshLive(EXTRA); }
async function extraDrop(sec,key,title){ const r=extraRow(sec,key); if(!r) return;
  const j=await api.post({action:'kbEdSave',tab:EXTRA,op:'delete',row:r.n,old:r.v,item:CODE[sec].l+': '+title}); if(!j||!j.ok) throw new Error(j&&j.error||'net'); await reloadTab(EXTRA); refreshLive(EXTRA); }
async function codeSave(F){
  const c=CODE[F.sec], item=codeItem(F.sec,F.vals,F.base), title=keyTitle(F.sec,item);
  const old=EXTRA_ROWS.find(x=>x.sec===F.sec&&x.key===F.key);
  // English: translate only what changed (the English page keeps its own text for the rest)
  let patch=Object.assign({},old&&old.en&&old.en.p||{});
  const changed=c.kind==='str'?(item!==F.base?['v']:[]):c.f.map(f=>f.k).filter(k=>JSON.stringify(item[k])!==JSON.stringify(F.base[k]));
  if(changed.length){ const flat=[], put=[], mi=/^i(\d+)$/.exec(F.key||''), orig=mi?ORIG[F.sec][+mi[1]]:null;
    changed.forEach(k=>{ const v=c.kind==='str'?item:item[k];
      if(typeof v==='string'){ patch[k]=v; put.push([k,null,null]); flat.push(v); }
      else if(Array.isArray(v)){ const ov=orig&&Array.isArray(orig[k])?orig[k]:[]; const out=patch[k]=clone(v);
        v.forEach((x,i)=>{ const j=k!=='offers'?ov.findIndex(y=>JSON.stringify(y)===JSON.stringify(x)):-1; if(j>=0){ out[i]={$o:j}; return; } // unchanged line: keep the English page's own text
          if(Array.isArray(x)) x.forEach((y,jj)=>{ put.push([k,i,jj]); flat.push(String(y)); }); else if(typeof x==='string'){ put.push([k,i,null]); flat.push(x); } }); }
      else patch[k]=v; });
    const en=F.tr?await translate(flat):flat.map(()=>'');
    put.forEach(([k,i,j],n)=>{ const t=en[n]||flat[n]; if(i==null) patch[k]=t; else if(j==null) patch[k][i]=t; else patch[k][i][j]=t; });
    if(c.kind!=='obj'&&c.kind!=='str') Object.keys(patch).forEach(k=>{ if(!/^\d+$/.test(k)) delete patch[k]; });
  }
  if(F.op==='add'){ const key=F.key||('n'+Date.now().toString(36)); await extraPut(F.sec,key,'add',{v:item},{p:patch},title); FORM=null; flash('✅ اتضاف. هيظهر للإيجنتس في الدليل أول ما يعملوا ريفريش.'); return; }
  if(/^n/.test(F.key)){ await extraPut(F.sec,F.key,'add',{v:item},{p:patch},title); FORM=null; flash('✅ اتحفظ.'); return; }
  const idx=+F.key.slice(1), orig=ORIG[F.sec][idx];
  const same=c.kind==='arr'?JSON.stringify(item)===JSON.stringify(trimArr(orig)):JSON.stringify(item)===JSON.stringify(orig);
  if(same){ await extraDrop(F.sec,F.key,title); FORM=null; flash('✅ رجع زي الأصلي.'); return; }
  await extraPut(F.sec,F.key,'edit',{v:c.kind==='obj'?diffObj(orig,item):item,o:keyTitle(F.sec,orig)},{p:patch},title); FORM=null; flash('✅ اتحفظ. التعديل هيظهر للإيجنتس أول ما يعملوا ريفريش.'); }
function diffObj(o,n){ const d={}; Object.keys(n).forEach(k=>{ if(JSON.stringify(o[k])!==JSON.stringify(n[k])) d[k]=n[k]; }); return d; }

/* ---- delete / hide / restore ---- */
async function sheetDel(id,n,un){ const c=SHEET[id], r=(DATA[c.tab].rows||[]).find(x=>x.n===+n); if(!r) return; const t=c.title(r.v);
  if(!un&&!confirm((c.del.row?'تحذف':c.del.set?'تشيل من الفريق':'تخفي')+' "'+t+'"؟ تقدر ترجعه من سجل التعديلات.')) return;
  try{
    if(c.del.row) await sheetSave(id,'delete',r.n,r.v,null,t);
    else { const v=r.v.slice(), col=c.del.hide!=null?c.del.hide:c.del.set[0], val=un?(c.del.set?'Agent':''):(c.del.hide!=null?'نعم':c.del.set[1]); while(v.length<=col) v.push(''); v[col]=val; await sheetSave(id,'edit',r.n,r.v,v,t); }
    flash(un?'✅ رجع تاني.':c.del.row?'🗑 اتحذف. لو غلط، رجّعه من سجل التعديلات.':'🙈 اتخفى من الدليل. تلاقيه تحت في "'+(c.del.set?'سابوا الأكونت':'مخفية')+'".');
  }catch(e){ flash(errTxt(e.message),true); } }
async function codeDel(sec,key){ const c=CODE[sec], r=EXTRA_ROWS.find(x=>x.sec===sec&&x.key===key); const m=/^i(\d+)$/.exec(key);
  const item=m?ORIG[sec][+m[1]]:(r&&r.ar&&r.ar.v); const t=keyTitle(sec,item);
  if(!confirm('تحذف "'+t+'" من الدليل؟ تقدر ترجعه بعدين.')) return;
  try{ if(!m) await extraDrop(sec,key,t); else await extraPut(sec,key,'del',{o:t},null,t); flash('🗑 اتحذف من الدليل. تقدر ترجعه من "محذوفة" تحت أو من سجل التعديلات.'); }catch(e){ flash(errTxt(e.message),true); } }
async function codeReset(sec,key,quiet){ const m=/^i(\d+)$/.exec(key), t=m?keyTitle(sec,ORIG[sec][+m[1]]):key;
  if(!quiet&&!confirm('ترجّع "'+t+'" زي ما كان في الأصل؟')) return;
  try{ await extraDrop(sec,key,t); flash('✅ رجع زي الأصل.'); }catch(e){ flash(errTxt(e.message),true); } }

/* ---- change log ---- */
const OPS={add:'➕ أضاف',edit:'✏️ عدّل',delete:'🗑 حذف'};
function tabLabel(t){ const s=Object.values(SHEET).find(x=>x.tab===t); return s?s.l:t===EXTRA?'كلام الدليل':t; }
function opLabel(x){ if(/^undo/.test(x.op)) return '↩ رجّع تعديل '+x.op.replace('undo ',''); if(x.tab===EXTRA){ const a=(x.after||[])[2]||'', b=(x.before||[])[2]||''; if(x.op==='delete') return b==='del'?'↩ رجّع محذوف':b==='add'?'🗑 حذف':'↺ رجّع الأصلي'; if(a==='del') return '🗑 حذف'; if(a==='edit') return '✏️ عدّل'; if(a==='add') return x.op==='add'?'➕ أضاف':'✏️ عدّل'; }
  if(x.tab!==EXTRA&&x.op==='edit'){ const s=Object.values(SHEET).find(y=>y.tab===x.tab); if(s&&s.del&&s.del.hide!=null){ const was=String((x.before||[])[s.del.hide]||''), now=String((x.after||[])[s.del.hide]||''); if(!was&&now) return '🙈 أخفى'; if(was&&!now) return '↩ أظهر'; } }
  return OPS[x.op]||x.op; }
function diffHtml(x){ if(x.tab===EXTRA){ const a=parseJ((x.after||[])[3]), b=parseJ((x.before||[])[3]); const show=o=>o&&o.v!=null?(typeof o.v==='string'?o.v:Object.values(o.v).map(v=>Array.isArray(v)?v.map(y=>Array.isArray(y)?y.join(' — '):y).join(' / '):v).filter(Boolean).join(' · ')):'';
    return `${b?`<div class="kae-b">قبل: ${h(show(b)||'—')}</div>`:''}${a?`<div class="kae-n2">بعد: ${h(show(a)||'—')}</div>`:''}`; }
  const head=(DATA&&DATA[x.tab]&&DATA[x.tab].head)||[], b=x.before||[], a=x.after||[], n=Math.max(a.length,b.length), out=[];
  for(let i=0;i<n;i++){ const o=String(b[i]||''), v=String(a[i]||''); if(o!==v) out.push(`<div><b>${h(head[i]||('عمود '+(i+1)))}:</b> ${o?`<span class="kae-b">${h(o)}</span>`:''}${o&&v?' ← ':''}${v?`<span class="kae-n2">${h(v)}</span>`:(o?' <i>(اتشال)</i>':'')}</div>`); }
  return out.join('')||'<div class="muted">مفيش فرق ظاهر.</div>'; }
function logHtml(){
  if(!LOG){ loadLog(); return '<div class="panel muted">بيحمّل السجل…</div>'; }
  if(LOG.err) return `<div class="panel"><div class="muted">${h(LOG.err)}</div>${btn('logreload','جرّب تاني')}</div>`;
  const q=nq(Q), items=LOG.items.filter(x=>x.item!=='header').filter(x=>!q||nq([x.by,x.item,x.tab].join(' ')).includes(q));
  return `<div class="kae-head"><div><h3>🕘 سجل التعديلات</h3><div class="muted">آخر 150 تعديل: مين عدّل إيه وإمتى. "رجّع" بيرجّع الحاجة زي ما كانت قبل التعديل ده.</div></div><div class="kae-a">${btn('logreload','↻ تحديث')}</div></div>
   <input class="kae-q" type="search" data-kae-q placeholder="دوّر باسم أو حاجة…" value="${h(Q)}" aria-label="دوّر">
   <div class="kae-list">${items.map(x=>`<details class="kae-log ${x.undone?'hid':''}"><summary><span class="kae-t"><b>${h(opLabel(x))} · ${h(x.item||'—')}</b><span>${h(x.by)} · ${h(x.at)} · ${h(tabLabel(x.tab))}${x.undone?' · اترجع':''}</span></span>
     ${!x.undone&&!/^undo/.test(x.op)&&x.item!=='header'?btn('undo','↩ رجّع','',`data-no="${x.no}"`):''}</summary><div class="kae-diff">${diffHtml(x)}</div></details>`).join('')||'<div class="muted">لسه مفيش تعديلات.</div>'}</div>`; }
async function loadLog(){ if(loadLog.busy) return; loadLog.busy=true; try{ const j=await api.get({action:'kbEdLog'}); LOG=j&&j.ok?{items:j.items}:{err:errTxt(j&&j.error),items:[]}; }catch(e){ LOG={err:errTxt('net'),items:[]}; } loadLog.busy=false; paint(); }
async function undo(no){ const x=LOG&&LOG.items.find(y=>+y.no===+no); if(!x) return;
  if(!confirm('ترجّع "'+(x.item||'')+'" زي ما كان قبل التعديل ده؟')) return;
  try{ const j=await api.post({action:'kbEdUndo',no:+no}); if(!j||!j.ok) throw new Error(j&&j.error||'net'); LOG=null; await reloadTab(x.tab); refreshLive(x.tab); flash('↩ اترجع زي ما كان.'); }
  catch(e){ flash(errTxt(e.message),true); } }

/* ---- events ---- */
root.addEventListener('click',async e=>{ const b=e.target.closest('[data-kae]'); if(!b||!root.contains(b)) return; const a=b.dataset.kae;
  if(a!=='pick'&&a!=='see'&&b.tagName==='BUTTON') e.preventDefault();
  if(a==='pick'){ if(FORM&&!confirm('تسيب التعديل من غير حفظ؟')) return; PICK=b.dataset.v; store.set('kae-pick',PICK); FORM=null; Q=''; SHOWHID=false; if(PICK==='log') LOG=null; paint(); }
  else if(a==='see') setView(b.dataset.v);
  else if(a==='reload'){ DATA=null; load(); }
  else if(a==='add') openSheetForm(b.dataset.id,0);
  else if(a==='edit') openSheetForm(b.dataset.id,b.dataset.n);
  else if(a==='del') sheetDel(b.dataset.id,b.dataset.n,false);
  else if(a==='unhide'){ SHOWHID=true; sheetDel(b.dataset.id,b.dataset.n,true); }
  else if(a==='cadd') openCodeForm(b.dataset.sec,'');
  else if(a==='cedit') openCodeForm(b.dataset.sec,b.dataset.k);
  else if(a==='cdel') codeDel(b.dataset.sec,b.dataset.k);
  else if(a==='creset') codeReset(b.dataset.sec,b.dataset.k);
  else if(a==='cunhide'){ SHOWHID=true; codeReset(b.dataset.sec,b.dataset.k,true); }
  else if(a==='cancel'){ FORM=null; paint(); }
  else if(a==='save') save();
  else if(a==='fillen'){ readForm(); const F=FORM, pairs=[]; F.fields.forEach((f,i)=>{ if(f.en&&!f.noTr&&!String(F.vals[i]).trim()){ const ar=F.fields.findIndex(g=>g.c===f.c-1); if(ar>=0&&String(F.vals[ar]).trim()) pairs.push([i,F.vals[ar]]); } });
    if(!pairs.length){ F.err='مفيش خانات إنجليزي فاضية قدامها عربي.'; paint(); return; } b.disabled=true; b.textContent='بيترجم…';
    const en=await translate(pairs.map(p=>p[1])); pairs.forEach(([i],k)=>{ if(en[k]) F.vals[i]=en[k]; }); F.err=''; paint(); }
  else if(/^r(up|down|add|del)$/.test(a)){ readForm(); const i=+b.dataset.f, r=+b.dataset.r, f=FORM.fields[i], rows=FORM.vals[i]=FORM.vals[i].length?FORM.vals[i]:[f.cols.map(()=>'')];
    if(a==='rup'&&r>0) [rows[r-1],rows[r]]=[rows[r],rows[r-1]]; if(a==='rdown'&&r<rows.length-1) [rows[r+1],rows[r]]=[rows[r],rows[r+1]];
    if(a==='radd') rows.splice(r+1,0,f.cols.map(()=>'')); if(a==='rdel'){ rows.splice(r,1); if(!rows.length) rows.push(f.cols.map(()=>'')); } paint._kept=true; paint(); paint._kept=false; }
  else if(a==='logreload'){ LOG=null; paint(); }
  else if(a==='undo') undo(b.dataset.no);
});
root.addEventListener('submit',e=>{ e.preventDefault(); save(); });
root.addEventListener('input',e=>{ if(e.target.matches('[data-kae-q]')){ Q=e.target.value; const pos=e.target.selectionStart; paint(); const q=root.querySelector('[data-kae-q]'); if(q){ q.focus(); try{ q.setSelectionRange(pos,pos); }catch(x){} } } });
root.addEventListener('toggle',e=>{ if(e.target.classList&&e.target.classList.contains('kae-hid')) SHOWHID=e.target.open; },true);
window.addEventListener('beforeunload',e=>{ if(FORM&&VIEW==='edit'){ e.preventDefault(); e.returnValue=''; } });

/* ---- styles ---- */
const css=document.createElement('style'); css.textContent=`
.kae{display:grid;gap:14px}.kae .sh{margin-bottom:0}
.kae-nav{display:grid;gap:10px;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.kae-gt{font-size:12px;color:var(--muted);font-weight:700;margin-bottom:6px}.kae-chips{display:flex;flex-wrap:wrap;gap:6px}
.kae-chip{border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:999px;padding:5px 12px;font:inherit;font-size:13.5px;cursor:pointer}
.kae-chip.on{background:var(--rose);border-color:var(--rose);color:#fff}
.kae-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}.kae-head h3{margin:0 0 2px;font-size:18px}
.kae-a{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.kae .btn{cursor:pointer;font:inherit;font-size:13.5px}.kae .btn[disabled]{opacity:.6}
.kae-danger{color:var(--red)}.kae-q{width:100%;max-width:420px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink);font:inherit}
.kae-list{display:grid;gap:6px}.kae-it,.kae-log>summary{display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:9px 12px}
.kae-log>summary{cursor:pointer;list-style:none}.kae-log>summary::-webkit-details-marker{display:none}
.kae-t{display:grid;gap:2px;min-width:0}.kae-t b{font-weight:600;overflow-wrap:anywhere}.kae-t span{font-size:12.5px;color:var(--muted);overflow-wrap:anywhere}
.kae-it.hid,.kae-log.hid>summary{opacity:.65;border-style:dashed}.kae-hid summary{cursor:pointer;color:var(--muted);margin:4px 0}
.kae-diff{padding:8px 12px;display:grid;gap:4px;font-size:13px;line-height:1.6}.kae-b{background:var(--red-soft);color:var(--ink);border-radius:4px;padding:0 4px;text-decoration:line-through;text-decoration-color:var(--red)}.kae-n2{background:var(--sage-soft);border-radius:4px;padding:0 4px}
.kae-form{gap:12px}.kae-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px 14px}
.kae-f{display:grid;gap:4px;align-content:start}.kae-f.wide{grid-column:1/-1}.kae-f label,.kae-f .lab{font-weight:600;font-size:13.5px}.kae-f small{color:var(--muted);font-size:12px}
.kae-f input[type=text],.kae-f input[type=date],.kae-f select,.kae-f textarea,.kae-row textarea{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:9px;background:var(--bg);color:var(--ink);font:inherit;font-size:14px}
.kae-f textarea,.kae-row textarea{resize:vertical;line-height:1.55}.kae-f input[readonly]{opacity:.7}.kae-f.en input,.kae-f.en textarea{text-align:left}
.kae-en{font-size:10px;background:var(--blue-soft);color:var(--blue);border-radius:6px;padding:0 5px;font-weight:700}.req{color:var(--red);font-style:normal}
.kae-days{display:flex;flex-wrap:wrap;gap:6px 14px}.kae-days label{font-weight:400;display:inline-flex;gap:5px;align-items:center}
.kae-rows{display:grid;gap:8px}.kae-row{display:grid;grid-template-columns:24px 1fr 1fr auto;gap:6px;align-items:start}.kae-row:has(textarea:nth-of-type(3)){grid-template-columns:24px 1fr 1fr 1.6fr auto}
.kae-n{color:var(--muted);font-size:12px;padding-top:9px;text-align:center}.kae-rb{display:flex;gap:2px}.kae-rb .ib{cursor:pointer;min-width:28px}
.kae-foot{display:flex;gap:8px;flex-wrap:wrap}.kae-tr{display:flex;gap:6px;align-items:center;font-size:13.5px}
.kae-msg{background:var(--sage-soft);border:1px solid var(--line);border-radius:10px;padding:8px 12px;font-weight:600}.kae-msg .bad{color:var(--red)}
@media (max-width:640px){.kae-it{flex-direction:column;align-items:stretch}.kae-row,.kae-row:has(textarea:nth-of-type(3)){grid-template-columns:1fr}.kae-n{display:none}.kae-rb{justify-content:flex-end}}
`; document.head.appendChild(css);
})();
