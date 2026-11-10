/* =====================================================================
   KB+ (v2): new layout, command palette, compare, sell more, customer
   finder, study cards, missed-search log, theme toggle, PWA.
   Loaded by index.html (Arabic) and en.html (English) after the main
   scripts. It only ADDS views and wraps existing functions, so every
   older tab keeps working. Content comes from the guide's own data
   (OFFERS, PRODUCTS, OBJ, GULF, TERMS, DISP, RULES) in each language.
   ===================================================================== */
(function(){
'use strict';
if(typeof VIEWS==='undefined'||typeof SEC==='undefined') return;
const EN=(typeof LANG!=='undefined'&&LANG==='en');
const API='https://script.google.com/macros/s/AKfycbxREN7jc2IfSI1q6RkZNMYG812eV4AY73EulaQA-XlM-1JFYQYGuZgzsWZAsf9Vf2yTqQ/exec';
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const ses=()=>store.get('tj-quiz-ses',null);
const offer=id=>OFFERS.find(o=>o.id===id);
const has=id=>!!offer(id);
const L=(a,e)=>EN?e:a;
const nums=s=>String(s||'').replace(/,/g,'').match(/\d+(\.\d+)?/g)?.map(Number)||[];
const money=n=>fmt(n)+' '+L('درهم','AED');
const ARR=EN?'→':'←';
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- text ---------------- */
const T=EN?{
  groups:{call:'On the call',req:'Requests & emails',learn:'Learn',team:'Team',more:'More'},
  views:{compare:'Compare services',fit:'What does the customer want?',sell:'Service 360°',study:'Study'},
  brand:'Bousla',tagline:'Your compass on every call',
  hub:{eyebrow:'Pick a service, see everything',title:'Service 360°',intro:'Choose the service the customer asked about. You get the price, what to say, the upsell and the cross-sell together, plus questions and cautions.',find:'Find a service…',pickFirst:'Pick a service above.',copySay:'Copy what to say',copyWa:'Copy for WhatsApp',cmp:'Compare with similar',full:'Full offer card',br:'Branches & hours',upT:'Upsell',upS:'A bigger or better option of the same thing',xT:'Cross-sell',xS:'Only when the customer brings it up',valT:'Show the value inside',noUp:'No bigger option for this one. Focus on the gift and the free consultation.',noX:'No suggested pairing for this service. Keep the call on the main booking.',qaT:'Customer questions & objections',guide:'Open the service guide',rulesT:'How to sell more without pressure (4 steps, gift, when not to offer)'},
  brq:{title:'Branches & hours now',all:'All branch details',docs:'Doctors today',none:'No doctor today',phone:'Phone'},
  noor:{svc:'Upsell & cross-sell',cmp:'Compare',say:'Copy what to say',mic:'Speak',micNo:'Voice input is not supported in this browser',ask:q=>'Ask Noor: '+q,listening:'Listening…'},
  theme:'Theme',themes:{auto:'Auto',light:'Light',dark:'Dark'},kbd:'Quick search',
  palPh:'Search pages, offers, tools… (Ctrl K)',palViews:'Pages',palActs:'Actions',palHits:'In the guide',palNone:'Nothing found. Try another word.',
  acts:{noor:'Ask Noor',call:'Call assistant (checklist)',quote:'Price calculator',wiz:'Call outcome (Odoo)',theme:'Switch light / dark',en:'النسخة العربي',study:'Start a quick review',compare:'Compare two services'},
  bottom:{home:'Home',offers:'Offers',noor:'Noor',study:'Study',more:'More'},
  hello:h=>h<12?'Good morning':h<17?'Good afternoon':'Good evening',
  heroSub:'Everything for the call in one place. Search with Ctrl K or ask Noor.',
  heroCards:[['offers','Offers & prices','Every offer, price and gift'],['branches','Branches & hours','Open now? Which doctor is in?'],['sell','Service 360°','Price, upsell and cross-sell together'],['fit','What does the customer want?','Pick the concern, get the right offer'],['compare','Compare services','Side by side, with what to say'],['study','Study','Smart flashcards from the guide']],
  recent:'Recently opened',studyProg:'Your study progress',studyGo:'Continue studying',tipT:'Tip of the day',
  confirmed:'confirmed',
  cmp:{eyebrow:'Side by side',title:'Compare services',intro:'Pick up to 3 offers. Prices and details come live from the offers sheet.',presets:'Ready comparisons',pick:'Pick offers',max:'You can compare 3 at most. Remove one first.',
    rows:{cat:'Category',price:'Price (AED)',pn:'Details',st:'Status',what:'What it is',who:'Who it suits',qa:'Customer questions',caution:'Careful',say:'What to say'},
    copyWa:'Copy summary for WhatsApp',copied:'Copied, paste it in WhatsApp',open:'Open in offers',clear:'Clear',empty:'Pick at least 2 offers to compare.',
    waHead:'Here is a quick comparison as you asked:',waTail:'Each offer comes with a gift you choose, and the first consultation is free. The doctor decides what suits you best in the consultation.',waNoPrice:'price confirmed in the consultation',
    brands:'Brand comparisons from the service guide',free:'Free consultation'},
  fit:{eyebrow:'Need → offer',title:'What does the customer want?',intro:'Pick what the customer is worried about. You get the matching offers, a question to ask, and what to say.',ask:'Ask first',offers:'Matching offers',cmp:'Compare these',none:'No current offer for this. Book a free consultation and the doctor decides.',med:'Medical questions go to the doctor.'},
  sell:{eyebrow:'Cross-sell & upsell',title:'Sell more, the right way',intro:'More value for the customer, not pressure. One extra suggestion per call, after the main need is settled.',
    disc:'These are sales suggestions built from the confirmed offers, not medical advice. The doctor decides in the consultation. The client has not approved bundle discounts, so never combine offers into a new price.',
    stepsT:'The 4 steps',ladT:'Upsell: move up one step',ladSub:'When the customer already wants the offer, show the bigger option and the real difference in price.',
    crossT:'Cross-sell: when the customer says…',crossSub:'Only when the customer brings it up. Offer one thing and link it to what they said.',
    giftT:'Use the gift to close',dontT:'When NOT to offer anything extra',phrT:'Bridge phrases',
    diff:'Difference',from:'From',to:'To',trig:'When',offerL:'Offer',say:'Say it like this',why:'Why it helps the customer',open:'Open the offer',copy:'Copy'},
  st:{eyebrow:'Study anywhere',title:'Study cards',intro:'Cards made from the guide itself. Flip, then say if you knew it. Cards you miss come back sooner.',
    decks:{mix:'Quick mixed review',prices:'Offer prices',who:'Who each offer suits',services:'Service guide',objections:'Objections',rules:'Price & offer rules',odoo:'Odoo: stage and tag',gulf:'Gulf dialect',terms:'Terms'},
    cards:n=>n+' cards',known:(a,b)=>a+' of '+b+' learned',start:'Start',again:'Not yet',got:'I knew it',flip:'Tap to see the answer',keys:'Space = flip · 1 = not yet · 2 = knew it',
    done:'Session done',doneSub:(g,n)=>'You knew '+g+' of '+n+'. The ones you missed will come back first next time.',more:'Another round',back:'Back to decks',reset:'Reset my progress',resetQ:'Reset all study progress on this device?',
    q:{price:o=>'How much is '+o+'?',who:o=>'Who is '+o+' for?',what:p=>'What is '+p+'?'}},
  miss:{title:'Searched for and not found (last 30 days)',sub:'What agents looked for in the guide and didn\'t find. Add it to the guide or ask the client.',none:'Nothing yet.',times:n=>n+'×',noor:'Noor',err:'The list needs the new Apps Script version.'},
  install:'Install the guide on your phone',offline:'You are offline. The guide still works with the last saved copy.'
}:{
  groups:{call:'على المكالمة',req:'طلبات وإيميلات',learn:'اتعلّم',team:'التيم',more:'كمان'},
  views:{compare:'قارن الخدمات',fit:'العميل عايز إيه؟',sell:'الخدمة 360°',study:'ذاكر'},
  brand:'بوصلة',tagline:'بوصلتك في كل مكالمة',
  hub:{eyebrow:'اختار الخدمة وشوف كل حاجة',title:'الخدمة 360°',intro:'اختار الخدمة اللي العميل بيسأل عليها. هيطلعلك السعر وتقول إيه، والأب سيل والكروس سيل بتوعها مع بعض، وأسئلة العميل والتحذيرات.',find:'دوّر على خدمة…',pickFirst:'اختار خدمة من فوق.',copySay:'انسخ الكلام',copyWa:'انسخ للواتساب',cmp:'قارنها بالشبهها',full:'كارت العرض كامل',br:'الفروع والمواعيد',upT:'أب سيل (Upsell)',upS:'اختيار أكبر أو أحسن من نفس الحاجة',xT:'كروس سيل (Cross-sell)',xS:'بس لما العميل يجيب سيرتها',valT:'وضّح القيمة اللي جوه العرض',noUp:'مفيش اختيار أكبر للخدمة دي. ركّز على الهدية والاستشارة المجانية.',noX:'مفيش كروس سيل مقترح للخدمة دي. خلّي المكالمة على الحجز الأساسي.',qaT:'أسئلة العميل والاعتراضات',guide:'افتح دليل الخدمة',rulesT:'إزاي تبيع أكتر من غير ضغط (الـ 4 خطوات، الهدية، وامتى متعرضش)'},
  brq:{title:'الفروع والمواعيد دلوقتي',all:'كل تفاصيل الفروع',docs:'الدكاترة النهارده',none:'مفيش دكتور النهارده',phone:'التليفون'},
  noor:{svc:'أب وكروس سيل',cmp:'قارن',say:'انسخ الكلام',mic:'اتكلم',micNo:'المتصفح ده مش بيدعم الكلام بالصوت',ask:q=>'اسأل نور: '+q,listening:'بسمعك…'},
  theme:'الشكل',themes:{auto:'تلقائي',light:'فاتح',dark:'غامق'},kbd:'بحث سريع',
  palPh:'دوّر على صفحة أو عرض أو أداة… (Ctrl K)',palViews:'الصفحات',palActs:'أوامر',palHits:'في الدليل',palNone:'مفيش نتايج. جرب كلمة تانية.',
  acts:{noor:'اسأل نور',call:'مساعد المكالمة (تشيك ليست)',quote:'حاسبة الأسعار',wiz:'نتيجة المكالمة (أودوو)',theme:'غيّر فاتح / غامق',en:'English version',study:'ابدأ مراجعة سريعة',compare:'قارن خدمتين'},
  bottom:{home:'الرئيسية',offers:'العروض',noor:'نور',study:'ذاكر',more:'المزيد'},
  hello:h=>h<12?'صباح الخير':'مساء الخير',
  heroSub:'كل اللي محتاجه في المكالمة في مكان واحد. دوّر بـ Ctrl K أو اسأل نور.',
  heroCards:[['offers','العروض والأسعار','كل عرض بسعره وهديته'],['branches','الفروع والمواعيد','مفتوح دلوقتي؟ ومين من الدكاترة موجود؟'],['sell','الخدمة 360°','السعر والأب سيل والكروس سيل مع بعض'],['fit','العميل عايز إيه؟','اختار مشكلته يطلعلك العرض المناسب'],['compare','قارن الخدمات','جنب بعض، ومعاها تقول إيه'],['study','ذاكر','كروت مذاكرة ذكية من الدليل']],
  recent:'آخر حاجات فتحتها',studyProg:'تقدّمك في المذاكرة',studyGo:'كمّل مذاكرة',tipT:'معلومة النهارده',
  confirmed:'مؤكد',
  cmp:{eyebrow:'جنب بعض',title:'قارن الخدمات',intro:'اختار لحد 3 عروض. الأسعار والتفاصيل جاية من شيت العروض أول بأول.',presets:'مقارنات جاهزة',pick:'اختار العروض',max:'تقدر تقارن 3 بس. شيل واحد الأول.',
    rows:{cat:'القسم',price:'السعر (درهم)',pn:'التفاصيل',st:'الحالة',what:'هو إيه',who:'يناسب مين',qa:'أسئلة العميل',caution:'خلي بالك',say:'تقول إيه'},
    copyWa:'انسخ ملخص للواتساب',copied:'اتنسخ، الصقه في الواتساب',open:'افتح في العروض',clear:'امسح',empty:'اختار عرضين على الأقل عشان تقارن.',
    waHead:'زي ما حضرتك طلبت، دي مقارنة سريعة:',waTail:'كل عرض معاه هدية حضرتك تختاريها، والاستشارة الأولى مجانية، والدكتور هيحدد الأنسب ليكي في الاستشارة.',waNoPrice:'السعر هيتأكد في الاستشارة',
    brands:'مقارنات الأنواع من دليل الخدمات',free:'الاستشارة مجانية'},
  fit:{eyebrow:'الاحتياج ← العرض',title:'العميل عايز إيه؟',intro:'اختار العميل قلقان من إيه. هيطلعلك العروض المناسبة، وسؤال تسأله، وتقول إيه.',ask:'اسأل الأول',offers:'العروض المناسبة',cmp:'قارن دول',none:'مفيش عرض حالياً للحاجة دي. احجز استشارة مجانية والدكتور يقرر.',med:'أي سؤال طبي بيتحوّل للدكتور.'},
  sell:{eyebrow:'Cross-sell و Upsell',title:'بيع أكتر بالطريقة الصح',intro:'قيمة أكتر للعميل، مش ضغط عليه. اقتراح زيادة واحد بس في المكالمة، وبعد ما احتياجه الأساسي يتقفل.',
    disc:'دي اقتراحات بيعية مبنية على العروض المؤكدة، مش نصيحة طبية. الدكتور هو اللي بيقرر في الاستشارة. والكلاينت مأكدش أي خصم على الجمع بين عرضين، فمتعملش سعر جديد من عندك.',
    stepsT:'الـ 4 خطوات',ladT:'Upsell: طلّعه درجة',ladSub:'لما العميل يكون عايز العرض أصلاً، اعرض الاختيار الأكبر والفرق الحقيقي في السعر.',
    crossT:'Cross-sell: لما العميل يقول…',crossSub:'بس لما العميل هو اللي يجيب سيرتها. اعرض حاجة واحدة واربطها باللي قاله.',
    giftT:'الهدية بتقفل البيعة',dontT:'امتى متعرضش أي حاجة زيادة',phrT:'جمل تربط بيها',
    diff:'الفرق',from:'من',to:'لـ',trig:'لما',offerL:'اعرض',say:'قولها كده',why:'بتفيد العميل في إيه',open:'افتح العرض',copy:'نسخ'},
  st:{eyebrow:'ذاكر في أي مكان',title:'كروت المذاكرة',intro:'كروت معمولة من الدليل نفسه. اقلب الكارت، وقول عرفتها ولا لسه. اللي مش عارفه بيرجعلك أسرع.',
    decks:{mix:'مراجعة سريعة من كل حاجة',prices:'أسعار العروض',who:'كل عرض يناسب مين',services:'دليل الخدمات',objections:'الاعتراضات',rules:'قواعد الأسعار والعروض',odoo:'أودوو: المرحلة والتاج',gulf:'الخليجي',terms:'المصطلحات'},
    cards:n=>n+' كارت',known:(a,b)=>'عرفت '+a+' من '+b,start:'ابدأ',again:'لسه',got:'عرفتها',flip:'دوس عشان تشوف الإجابة',keys:'مسافة = اقلب · 1 = لسه · 2 = عرفتها',
    done:'خلصت الجولة',doneSub:(g,n)=>'عرفت '+g+' من '+n+'. اللي مكنتش عارفها هترجعلك الأول المرة الجاية.',more:'جولة كمان',back:'ارجع للمجموعات',reset:'ابدأ المذاكرة من الأول',resetQ:'تمسح كل تقدّمك في المذاكرة على الجهاز ده؟',
    q:{price:o=>'سعر '+o+' كام؟',who:o=>o+' يناسب مين؟',what:p=>'إيه هو '+p+'؟'}},
  miss:{title:'اتدوّر عليه ومتلقاش (آخر 30 يوم)',sub:'حاجات الإيجنتس دوّروا عليها في الدليل ومالقوهاش. ضيفها للدليل أو اسأل الكلاينت.',none:'لسه مفيش.',times:n=>n+' مرة',noor:'نور',err:'القايمة محتاجة نسخة الـ Apps Script الجديدة.'},
  install:'نزّل الدليل على موبايلك',offline:'إنت أوفلاين. الدليل شغال بآخر نسخة اتحفظت.'
};

/* ---------------- icons ---------------- */
const P={
 home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>',
 offers:'<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
 services:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>',
 compare:'<rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="16" rx="1.5"/>',
 fit:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8"/>',
 sell:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
 calls:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
 branches:'<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
 odoo:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
 wa:'<path d="M21 3 10 14"/><path d="M21 3l-7 18-4-7-7-4 18-7z"/>',
 booking:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
 follow:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/><path d="M15 3h6v6M21 3l-6 6"/>',
 aux:'<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>',
 complaint:'<path d="M4 15V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8l-4 4v-4z"/><path d="M12 7v3M12 12.5v.5"/>',
 study:'<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/>',
 quiz:'<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
 lang:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
 ask:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.5"/>',
 dash:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
 todo:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
 noor:'<path d="M4 5h16v11H9l-5 4V5z"/><path d="M8 10h.5M12 10h.5M16 10h.5"/>',
 more:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
 moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
 auto:'<circle cx="12" cy="12" r="9"/><path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor"/>',
 copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
 x:'<path d="M6 6l12 12M18 6 6 18"/>',
 arrow:'<path d="M15 5l-7 7 7 7"/>',
 spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
 install:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'
};
const ic=(k,s)=>`<svg class="kp-i" width="${s||18}" height="${s||18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[k]||P.spark}</svg>`;

/* ---------------- groups ---------------- */
const GROUPS=[
 ['call',['home','offers','branches','sell','fit','compare','services','calls','odoo']],
 ['req',['wa','booking','follow','aux','complaint']],
 ['learn',['study','quiz','lang']],
 ['team',['ask','dash','todo']]
];
const clean=t=>String(t||'').replace(/^[^\p{L}\p{N}]+/u,'').replace(/\d+$/,'').trim();
const viewLabel=id=>{ const v=VIEWS.find(x=>x[0]===id); return v?clean(v[1]):''; };
const cnt=id=>id==='offers'?OFFERS.length:id==='todo'?TODO.length:0;

/* ---------------- new views ---------------- */
const addView=(id,secs,after)=>{ if(VIEWS.some(v=>v[0]===id)) return; const i=VIEWS.findIndex(v=>v[0]===after); VIEWS.splice(i<0?VIEWS.length:i+1,0,[id,T.views[id],secs]); };
addView('compare',['compare'],'services');
addView('fit',['fit'],'compare');
addView('sell',['sell'],'fit');
addView('study',['study'],'lang');

/* =============== COMPARE =============== */
const PRESETS=[
 [['nabota','dysport'],L('بوتوكس: نابوتا ولا ديسبورت','Botox: Nabota or Dysport')],
 [['laser1','laser2'],L('ليزر: من غير الظهر والبطن ولا الجسم كله','Laser: without back & belly, or full body')],
 [['lipfill','facefill'],L('فيلر الشفايف ولا فيلر الوش','Lip filler or face filler')],
 [['sculptra','facefill'],L('سكلبترا ولا فيلر الوش','Sculptra or face filler')],
 [['rrs','rrseye','dermapen'],L('البشرة: RRS ولا RRS للعين ولا ديرمابن','Skin: RRS, RRS Eye or Dermapen')],
 [['silutrix','endolaser'],L('الغبغب: سيلوتريكس ولا إندوليزر','Double chin: Cellutrix or Endolaser')],
 [['fatcourse','cellulite','lymph'],L('الجسم: الدهون ولا السيلوليت ولا المساج','Body: fat, cellulite or massage')],
 [['mounjaro','fatcourse'],L('التخسيس: مونجارو ولا كورس الأجهزة','Weight: Mounjaro or devices course')]
];
let CMP=store.get('kp-cmp',['nabota','dysport']).filter(has);
let CMPCAT='all';
const saveCmp=()=>store.set('kp-cmp',CMP);
function cmpWa(){
  const rows=CMP.map(offer).filter(Boolean).map(o=>`• ${o.ar}: ${o.st==='ok'?o.price+' '+L('درهم','AED')+(o.pn?' ('+o.pn+')':''):T.cmp.waNoPrice}`);
  return T.cmp.waHead+'\n'+rows.join('\n')+'\n\n'+T.cmp.waTail;
}
function compareHtml(){
  const sel=CMP.map(offer).filter(Boolean);
  const pool=OFFERS.filter(o=>CMPCAT==='all'||o.cat===CMPCAT);
  const pre=PRESETS.filter(p=>p[0].every(has));
  const row=(k,f)=>`<div class="kp-cr"><div class="kp-ch">${T.cmp.rows[k]}</div>${sel.map(o=>`<div class="kp-cc">${f(o)||'<span class="kp-mut">—</span>'}</div>`).join('')}</div>`;
  const table=sel.length<2?`<div class="kp-empty">${ic('compare',28)}<span>${T.cmp.empty}</span></div>`:
   `<div class="kp-ctab" style="--n:${sel.length}">
     <div class="kp-cr kp-chead"><div class="kp-ch"></div>${sel.map(o=>`<div class="kp-cc"><span class="kp-cat">${esc(CATS[o.cat]||'')}</span><b>${esc(o.ar)}</b><button class="kp-x" data-kp="cmp-del" data-v="${o.id}" aria-label="remove">${ic('x',14)}</button></div>`).join('')}</div>
     ${row('price',o=>`<span class="kp-price">${esc(o.price)}</span>`)}
     ${row('pn',o=>esc(o.pn))}
     ${row('st',o=>stChip(o.st))}
     ${row('what',o=>esc(o.what))}
     ${row('who',o=>esc(o.who))}
     ${row('qa',o=>(o.qa||[]).length?`<details><summary>${(o.qa||[]).length} ${L('سؤال','questions')}</summary>${o.qa.map(([q,a])=>`<p><b>${esc(q)}</b><br>${esc(a)}</p>`).join('')}</details>`:'')}
     ${row('caution',o=>o.caution?`<span class="kp-warn">${esc(o.caution)}</span>`:'')}
     ${row('say',o=>o.say?`<div class="kp-say">${esc(o.say)}<button class="kp-mini" data-a="copy" data-t="${esc(o.say)}">${ic('copy',14)} ${T.sell.copy}</button></div>`:'')}
     <div class="kp-cr"><div class="kp-ch"></div>${sel.map(o=>`<div class="kp-cc"><button class="kp-link" data-a="go" data-v="o-${o.id}">${T.cmp.open} ${ARR}</button></div>`).join('')}</div>
    </div>
    <div class="kp-actions"><button class="kp-btn pri" data-kp="cmp-wa">${ic('wa',16)} ${T.cmp.copyWa}</button><button class="kp-btn" data-kp="cmp-clear">${T.cmp.clear}</button></div>`;
  const brands=PRODUCTS.filter(p=>(p.compare||[]).length);
  return `<section id="compare" class="kp-sec"><div class="sh"><div class="eyebrow">${T.cmp.eyebrow}</div><h2>${T.cmp.title}</h2><p>${T.cmp.intro}</p></div>
   <div class="kp-card"><div class="kp-lbl">${T.cmp.presets}</div><div class="kp-chips">${pre.map((p,i)=>`<button class="kp-chip ${p[0].join()===CMP.join()?'on':''}" data-kp="cmp-pre" data-v="${i}">${esc(p[1])}</button>`).join('')}</div>
   <div class="kp-lbl" style="margin-top:10px">${T.cmp.pick}</div>
   <div class="kp-chips kp-cats">${[['all',L('الكل','All')]].concat(Object.entries(CATS)).map(([k,t])=>`<button class="kp-tab ${CMPCAT===k?'on':''}" data-kp="cmp-cat" data-v="${k}">${esc(t)}</button>`).join('')}</div>
   <div class="kp-chips">${pool.map(o=>`<button class="kp-chip pick ${CMP.includes(o.id)?'on':''}" data-kp="cmp-tog" data-v="${o.id}" aria-pressed="${CMP.includes(o.id)}">${CMP.includes(o.id)?'✓ ':''}${esc(o.ar)}</button>`).join('')}</div></div>
   ${table}
   ${brands.length?`<h3 class="kp-h3">${T.cmp.brands}</h3><div class="kp-grid2">${brands.map(p=>`<div class="kp-card"><b>${esc(p.name)}</b>${p.compare.map(r=>`<div class="kp-brand"><b>${esc(r[0])}</b><span class="kp-cat">${esc(r[1])}</span><p>${esc(r[2])}</p></div>`).join('')}</div>`).join('')}</div>`:''}
  </section>`;
}
SEC.compare=compareHtml;

/* =============== WHAT DOES THE CUSTOMER WANT =============== */
const NEEDS=[
 {id:'wrinkles',e:'〰️',t:L('تجاعيد الجبهة أو حوالين العين','Forehead or eye wrinkles'),hint:L('"خطوط الضحك"، "بين الحواجب"','"crow\'s feet", "frown lines"'),o:['nabota','dysport'],ask:L('التجاعيد اللي مضايقة حضرتك في أنهي منطقة بالظبط؟','Which area bothers you most?')},
 {id:'glow',e:'✨',t:L('نضارة وترطيب وشد خفيف','Glow, hydration, light tightening'),hint:L('"وشي باهت"، "شكلي تعبان"','"my face looks dull/tired"'),o:['hydra','oxy','rrs','meso'],ask:L('حضرتك عايزة نضارة وترطيب، ولا فيه تجاعيد معينة مضايقاكي؟','Is it more about glow and hydration, or specific wrinkles?')},
 {id:'scars',e:'🔹',t:L('آثار حب شباب أو مسام أو بقع','Acne scars, pores or spots'),hint:L('"حفر"، "مسام واسعة"','"pits", "open pores"'),o:['dermapen','oxy'],ask:L('الموضوع آثار حب شباب ولا مسام ولا بقع؟','Is it acne scars, pores or spots?')},
 {id:'eyes',e:'👁️',t:L('هالات أو تعب تحت العين','Dark circles or tired under-eyes'),hint:L('"سواد تحت العين"','"dark under my eyes"'),o:['rrseye','rrsbox'],ask:L('الهالات دي من زمان ولا جديدة؟ الدكتور هيقيّمها في الاستشارة.','Have the circles been there long? The doctor will assess them.')},
 {id:'lips',e:'💋',t:L('شفايف أوضح أو أملى','Fuller or more defined lips'),hint:L('"شفايفي رفيعة"','"thin lips"'),o:['allawin','restylane','lipfill'],ask:L('حضرتك عايزة تحديد وشكل، ولا حجم أكتر؟','Do you want more shape, or more volume?')},
 {id:'contour',e:'💎',t:L('خدود وفك وملامح الوش','Cheeks, jawline, face contour'),hint:L('"الوش الملكي"، "الجو لاين"','"jawline", "royal face"'),o:['facefill','facetem','restyface','sculptra'],ask:L('عايزة تحديد ملامح، ولا الوش فقد امتلاءه مع الوقت؟','Do you want definition, or has the face lost fullness over time?')},
 {id:'sag',e:'⬆️',t:L('ترهل أو الوش فقد الامتلاء','Sagging or lost fullness'),hint:L('"وشي نزل"','"my face dropped"'),o:['hifu','sculptra','mono','endolaser'],ask:L('الترهل في الوش ولا الرقبة ولا الاتنين؟','Is the sagging in the face, the neck, or both?')},
 {id:'chin',e:'🙂',t:L('الغبغب (الذقن المزدوج)','Double chin'),hint:L('"دبل تشن"','"double chin"'),o:['silutrix','endolaser'],ask:L('المشكلة دهون تحت الدقن، ولا كمان ترهل في الرقبة؟','Is it fat under the chin, or also loose skin on the neck?')},
 {id:'fat',e:'📏',t:L('دهون موضعية أو نحت الجسم','Local fat or body sculpting'),hint:L('"الكرش"، "الجنب"','"belly", "love handles"'),o:['fatcourse','silutrixabd','aqualyx','ultrasculpt','endolaser'],ask:L('حضرتك عايزة تنحتي منطقة معينة ولا تخسي بشكل عام؟','Do you want to shape one area, or lose weight overall?')},
 {id:'cellulite',e:'🌊',t:L('سيلوليت أو احتباس سوايل','Cellulite or fluid retention'),hint:L('"قشر البرتقان"، "تورم"','"orange peel", "swelling"'),o:['cellulite','lymph'],ask:L('الموضوع سيلوليت ولا تورّم واحتباس سوايل؟','Is it cellulite, or swelling and fluid retention?')},
 {id:'weight',e:'⚖️',t:L('إنقاص الوزن','Weight loss'),hint:L('"إبر التخسيس"، "مونجارو"','"weight-loss shots", "Mounjaro"'),o:['mounjaro','fatcourse'],ask:L('حضرتك جربتي قبل كده دايت أو أجهزة؟ الدكتور هيحدد المناسب في الاستشارة.','Have you tried diets or devices before? The doctor will decide in the consultation.'),med:true},
 {id:'hairloss',e:'🌿',t:L('تساقط الشعر أو خفّته','Hair loss or thinning'),hint:L('"شعري بيقع"، "فيه فراغات"','"my hair is falling", "thin patches"'),o:['gcell'],ask:L('التساقط ده من إمتى، وفي منطقة معينة ولا الشعر كله؟ الدكتور هيفحص فروة الراس في الاستشارة ويحدد المناسب.','Since when, and is it one area or all over? The doctor will check the scalp in the consultation and decide what suits you.')},
 {id:'tone',e:'🍑',t:L('شد المؤخرة أو عضلات البطن','Buttock lift or toned abs'),hint:L('"عايزة أرفع المؤخرة"','"lift my buttocks"'),o:['ultrasculpt'],ask:L('حضرتك عايزة شد ورفع، ولا كمان فيه دهون عايزة تتخلصي منها؟','Is it about lifting and toning, or is there also fat to lose?')},
 {id:'hair',e:'🪒',t:L('إزالة الشعر بالليزر','Laser hair removal'),hint:L('"ليزر فل بادي"','"full body laser"'),o:['laser1','laser2'],ask:L('حضرتك عايزة الجسم كله، ولا محتاجة الظهر والبطن كمان؟','Full body without back & belly, or including them?')}
];
let NEED=store.get('kp-need','wrinkles');
function fitHtml(){
  const n=NEEDS.find(x=>x.id===NEED)||NEEDS[0];
  const os=n.o.map(offer).filter(Boolean);
  return `<section id="fit" class="kp-sec"><div class="sh"><div class="eyebrow">${T.fit.eyebrow}</div><h2>${T.fit.title}</h2><p>${T.fit.intro}</p></div>
   <div class="kp-needs">${NEEDS.map(x=>`<button class="kp-need ${x.id===n.id?'on':''}" data-kp="need" data-v="${x.id}"><span class="e">${x.e}</span><b>${esc(x.t)}</b><small>${esc(x.hint)}</small></button>`).join('')}</div>
   <div class="kp-fitbox">
    <div class="kp-askq"><span class="kp-lbl">${T.fit.ask}</span><p>${esc(n.ask)}</p><button class="kp-mini" data-a="copy" data-t="${esc(n.ask)}">${ic('copy',14)} ${T.sell.copy}</button></div>
    ${n.med?`<div class="kp-note warn">${T.fit.med}</div>`:''}
    <div class="kp-lbl">${T.fit.offers}</div>
    ${os.length?`<div class="kp-grid2">${os.map(o=>offerMini(o)).join('')}</div>${os.length>1?`<button class="kp-btn" data-kp="cmp-set" data-v="${os.map(o=>o.id).join(',')}">${ic('compare',16)} ${T.fit.cmp}</button>`:''}`:`<div class="kp-note">${T.fit.none}</div>`}
   </div></section>`;
}
function offerMini(o){
  return `<div class="kp-card kp-om"><div class="kp-omh"><span class="kp-cat">${esc(CATS[o.cat]||'')}</span>${stChip(o.st)}</div>
   <b class="kp-omt">${esc(o.ar)}</b><div class="kp-price">${esc(o.price)} <small>${L('درهم','AED')}</small></div><div class="kp-mut">${esc(o.pn||'')}</div>
   ${o.who?`<p class="kp-who">${esc(o.who)}</p>`:''}
   ${o.say?`<div class="kp-say">${esc(o.say)}<button class="kp-mini" data-a="copy" data-t="${esc(o.say)}">${ic('copy',14)} ${T.sell.copy}</button></div>`:''}
   ${o.caution?`<div class="kp-warn">${esc(o.caution)}</div>`:''}
   <button class="kp-link" data-a="go" data-v="o-${o.id}">${T.sell.open} ${ARR}</button></div>`;
}
SEC.fit=fitHtml;

/* =============== SERVICE 360: pick a service, see price, upsell and cross-sell together =============== */
const CATE={botox:'💉',filler:'💋',skin:'✨',body:'🔥',weight:'⚖️',laser:'⚡',hair:'🌿'};
const AED=L('درهم','AED');
function priceSay(o){
  if(!o||o.st!=='ok') return L('والسعر هأكده لحضرتك قبل الحجز','and I will confirm the price before booking');
  const pn=String(o.pn||'');
  if(/\d/.test(pn)) return L('(',' (')+pn+' '+AED+L(')',')');
  return L('بـ ','at ')+o.price+' '+AED+(pn?' ('+pn+')':'');
}
function priceLine(o){ return o.st==='ok'?o.price+' '+AED+(o.pn?' · '+o.pn:''):L('السعر محتاج تأكيد','Price needs confirming'); }
/* upsell inside the same offer: price tier i -> tier j */
const tier=(id,i,j,fa,fe,ta,te,wa,we,sa,se)=>()=>{ const o=offer(id); if(!o||o.st!=='ok') return null; const n=nums(o.price), a=n[i], b=n[j]; if(!(a&&b&&b>a)) return null;
  return {o,self:true,from:L(fa,fe)+' '+money(a),to:L(ta,te)+' '+money(b),d:b-a,when:L(wa,we),say:L(sa(a,b),se(a,b))}; };
/* upsell to a bigger or premium offer */
const upg=(id,to,wa,we,why,whyE)=>()=>{ const a=offer(id), b=offer(to); if(!a||!b) return null; const x=nums(a.price)[0], y=nums(b.price)[0];
  const d=a.st==='ok'&&b.st==='ok'&&x&&y&&y>x?y-x:0;
  return {o:b,from:a.ar+' · '+(a.st==='ok'?a.price:'?'),to:b.ar+' · '+(b.st==='ok'?b.price:'?'),d,when:L(wa,we),
    say:L(`لو حضرتك حابة ${why}، فيه كمان ${b.ar} ${priceSay(b)}${d?`، يعني الفرق ${fmt(d)} درهم`:''}، ومعاه هدية. والدكتور هيقولك الأنسب ليكي في الاستشارة.`,
          `If you'd like ${whyE}, there is also ${b.ar} ${priceSay(b)}${d?`, only ${fmt(d)} AED more`:''}, with a gift. The doctor will tell you what suits you best in the consultation.`)}; };
const UP={
 nabota:[tier('nabota',0,1,'منطقة واحدة','One area','الوش كله','Full face','ذكرت أكتر من منطقة (الجبهة وحوالين العين مثلاً).','Mentions more than one area (e.g. forehead and around the eyes).',
   (a,b)=>`بما إن حضرتك ذكرتي أكتر من منطقة، عرض الوش كله بـ ${fmt(b)} بدل ${fmt(a)} للمنطقة الواحدة، يعني الفرق ${fmt(b-a)} درهم بس، والدكتور هيحدد المناطق المناسبة في الاستشارة.`,
   (a,b)=>`Since you mentioned more than one area, the full-face offer is ${fmt(b)} instead of ${fmt(a)} for one area, only ${fmt(b-a)} AED more. The doctor will decide the right areas in the consultation.`)],
 dysport:[tier('dysport',0,1,'منطقة واحدة','One area','الوش كله','Full face','طالب ديسبورت بالاسم وذكر أكتر من منطقة.','Asks for Dysport by name and mentions more than one area.',
   (a,b)=>`عرض ديسبورت للوش كله بـ ${fmt(b)} بدل ${fmt(a)} للمنطقة الواحدة، يعني الفرق ${fmt(b-a)} درهم، والدكتور هيحدد المناطق المناسبة.`,
   (a,b)=>`The full-face Dysport offer is ${fmt(b)} instead of ${fmt(a)} for one area, ${fmt(b-a)} AED more, and the doctor will decide the right areas.`)],
 hydra:[tier('hydra',0,1,'جلسة واحدة','One session','5 جلسات','5 sessions','عايزة نضارة مستمرة، أو سألت تكررها كل قد إيه.','Wants a lasting glow, or asks how often to repeat it.',
   (a,b)=>`لو حضرتك ناوية تكرريها، باكدج الـ 5 جلسات بـ ${fmt(b)} درهم، يعني الجلسة بـ ${fmt(Math.round(b/5))} بدل ${fmt(a)}.`,
   (a,b)=>`If you plan to repeat it, the 5-session package is ${fmt(b)} AED, so each session is ${fmt(Math.round(b/5))} instead of ${fmt(a)}.`)],
 oxy:[tier('oxy',0,1,'جلسة واحدة','One session','5 جلسات','5 sessions','عايزة نتيجة أوضح، أو سألت عن عدد الجلسات.','Wants a clearer result, or asks how many sessions.',
   (a,b)=>`باكدج الـ 5 جلسات بـ ${fmt(b)} درهم، يعني الجلسة بـ ${fmt(Math.round(b/5))} بدل ${fmt(a)}، والدكتور هيحدد العدد المناسب.`,
   (a,b)=>`The 5-session package is ${fmt(b)} AED, so each session is ${fmt(Math.round(b/5))} instead of ${fmt(a)}. The doctor will decide how many you need.`)],
 laser1:[upg('laser1','laser2','عايزة "الجسم كله"، أو سألت على الظهر أو البطن.','Wants "full body", or asks about the back or belly.','الظهر والبطن كمان','the back and belly too')],
 rrs:[upg('rrs','rrsbox','ذكرت الوش والخدود وتحت العين مع بعض.','Mentions the face, cheeks and under-eyes together.','تغطي الوش والخدود وتحت العين','to cover the face, cheeks and under-eyes')],
 rrseye:[upg('rrseye','rrsbox','مهتمة بالوش كله مش تحت العين بس.','Cares about the whole face, not only under the eyes.','تغطي الوش والخدود كمان مش تحت العين بس','to cover the face and cheeks as well')],
 allawin:[upg('allawin','restylane','سألت على ماركة أوروبية أو "أحسن نوع".','Asks for a European brand or "the best type".','ماركة أوروبية معروفة','a well-known European brand')],
 lipfill:[upg('lipfill','restylane','سألت على ماركة أوروبية أو "أحسن نوع".','Asks for a European brand or "the best type".','ماركة أوروبية معروفة','a well-known European brand')],
 facefill:[upg('facefill','facetem','عايزة تحديد واضح للفك أو الدقن أو الوجنات.','Wants clear definition of the jaw, chin or cheekbones.','تحديد أوضح للفك والدقن والوجنات','sharper definition of the jaw, chin and cheekbones')],
 restyface:[upg('restyface','facetem','عايزة تحديد واضح للفك أو الدقن أو الوجنات.','Wants clear definition of the jaw, chin or cheekbones.','تحديد أوضح للفك والدقن والوجنات','sharper definition of the jaw, chin and cheekbones')],
 silutrix:[upg('silutrix','endolaser','فيه كمان ترهل في الرقبة، مش دهون بس.','There is also loose neck skin, not only fat.','شد الرقبة كمان مش تذويب الدهون بس','to tighten the neck as well, not only dissolve fat')]
};
/* what to explain instead of adding something (value inside the package) */
const VALUE={
 mounjaro:L('الباكدج مش القلم بس: فيه متابعة غذائية وطبية لمدة 3 شهور، ومعاه هدية. والدكتور هو اللي بيحدد إذا كان مناسب لحضرتك.','The package is more than the pen: 3 months of nutrition and medical follow-up, and a gift. The doctor decides whether it suits you.'),
 fatcourse:L('الكورس مش جلسات بس: 16 جلسة ومعاهم متابعة غذائية أسبوعية لمدة شهرين وهدية.','The course is more than sessions: 16 sessions plus weekly nutrition follow-up for two months and a gift.'),
 gcell:L('وضّح إنها جلسة واحدة في يوم واحد ومن غير جراحة، وإن الدكتور بيفحص فروة الراس الأول ويحدد إذا كانت مناسبة.','Explain it is one session in one day, without surgery, and that the doctor checks the scalp first and decides if it suits them.')
};
/* cross-sell: [offer, when the customer says…, what they mentioned] */
const C=(o,ta,te,ka,ke)=>({o,t:L(ta,te),k:L(ka,ke)});
const cLips=C('allawin','قالت إن شفايفها رفيعة أو ناشفة','Says her lips are thin or dry','الشفايف','your lips');
const cEyes=C('rrseye','اشتكت من الهالات أو التعب تحت العين','Mentions dark circles or tired under-eyes','تحت العين','your under-eyes');
const cGlow=C('hydra','عايزة نضارة لمناسبة، أو بشرتها باهتة','Wants a glow for an occasion, or her skin looks dull','النضارة','a glow');
const cBotox=C('nabota','مضايقة من خطوط الجبهة أو حوالين العين','Bothered by forehead or eye lines','الخطوط','the lines');
const cContour=C('facefill','عايزة تحديد للخدود أو الفك','Wants more defined cheeks or jaw','ملامح الوش','your face contour');
const cSag=C('hifu','اشتكت من ترهل في الوش أو الرقبة','Mentions sagging in the face or neck','الترهل','the sagging');
const cVol=C('sculptra','حاسة إن وشها فقد امتلاءه','Feels her face has lost fullness','الامتلاء','lost fullness');
const cLift=C('mono','عايزة شد ورفع خفيف','Wants a light lift','الشد','a lift');
const cScars=C('dermapen','اشتكت من آثار حب الشباب أو المسام','Mentions acne scars or pores','آثار الحبوب والمسام','scars and pores');
const cChin=C('silutrix','اشتكت من الغبغب (دهون تحت الدقن)','Mentions a double chin','الغبغب','your double chin');
const cBody=C('fatcourse','عايزة تنحت الجسم أو تخس بشكل عام','Wants to shape the body or lose weight overall','نحت الجسم','body shaping');
const cCell=C('cellulite','اشتكت من السيلوليت','Mentions cellulite','السيلوليت','cellulite');
const cLymph=C('lymph','اشتكت من تورم أو احتباس سوايل','Mentions swelling or fluid retention','التورم','the swelling');
const cTone=C('ultrasculpt','عايزة شد المؤخرة أو عضلات البطن','Wants a buttock lift or toned abs','الشد','toning');
const cBelly=C('silutrixabd','اشتكت من دهون البطن','Mentions belly fat','دهون البطن','belly fat');
const cRrs=C('rrsbox','عايزة نضارة للوش كله مع تحت العين','Wants a glow for the whole face and under-eyes','نضارة الوش كله','a whole-face glow');
const XS={
 nabota:[cLips,cEyes,cGlow], dysport:[cLips,cEyes,cGlow], meso:[cGlow,cLips],
 allawin:[cBotox,cContour,cGlow], lipfill:[cBotox,cContour,cGlow], restylane:[cBotox,C('restyface','عايزة فيلر للوش من نفس الماركة','Wants face filler from the same brand','الوش','your face'),cGlow],
 facefill:[cLips,cBotox,cVol], restyface:[cLips,cBotox,cVol], facetem:[cLips,cBotox,cGlow],
 sculptra:[cSag,cBotox,cLift], hifu:[cVol,cLift,cBotox], mono:[cSag,cVol], threads:[cSag,cVol],
 rrs:[cBotox,cGlow,cScars], rrseye:[cBotox,cGlow], rrsbox:[cBotox,cGlow],
 dermapen:[cGlow,cRrs], hydra:[cScars,cBotox], oxy:[cScars,cBotox],
 endolaser:[cChin,cBody,cCell], silutrix:[cBelly,cSag], silutrixabd:[cBody,cTone], aqualyx:[cBelly,cBody],
 fatcourse:[cCell,cLymph,cTone], cellulite:[cLymph,cBody], lymph:[cCell,cBody], ultrasculpt:[cBody,cCell],
 mounjaro:[cTone], laser1:[cGlow], laser2:[cGlow]
};
function crossFor(id){ return (XS[id]||[]).filter(c=>c.o!==id&&has(c.o)).map(c=>{ const o=offer(c.o);
  return {...c,ref:o,say:L(`بما إن حضرتك ذكرتي ${c.k}، عندنا ${o.ar} ${priceSay(o)}، ومعاه هدية حضرتك تختاريها. الدكتور ممكن يبصلك عليها في نفس الاستشارة المجانية. تحبي أكتبها في الحجز؟`,
    `Since you mentioned ${c.k}, we have ${o.ar} ${priceSay(o)}, with a gift of your choice. The doctor can check it in the same free consultation. Shall I note it on your booking?`)}; }); }
function upFor(id){ return (UP[id]||[]).map(f=>{try{return f()}catch(e){return null}}).filter(Boolean); }
const NOGIFT=new Set(['gcell']); // gift not confirmed yet
function waFor(o){ return o.ar+'\n'+(o.st==='ok'?'• '+o.price+' '+AED+(o.pn?' ('+o.pn+')':''):'• '+T.cmp.waNoPrice)+'\n'+(NOGIFT.has(o.id)?'':L('• معاه هدية حضرتك تختاريها\n','• With a gift of your choice\n'))+L('• الاستشارة الأولى مجانية، والدكتور هيحدد الأنسب ليكي','• The first consultation is free, and the doctor will decide what suits you best'); }
let SVCID=store.get('kp-svc','nabota'); let SVCCAT='all';
const STEPS=EN?[
 ['Close the main need first','Price, gift and a booking time for what they called about. Don\'t add anything before that.'],
 ['Ask one discovery question','"Is there anything else you\'d like the doctor to look at in the same visit?"'],
 ['Link one offer to what they said','One suggestion only, with its confirmed price and the gift. "The doctor decides in the consultation."'],
 ['Respect the answer','If they say no, go straight back to confirming the main booking. Never push twice.']
]:[
 ['اقفل الاحتياج الأساسي الأول','السعر والهدية وميعاد الحجز للحاجة اللي العميل متصل عشانها. متزودش حاجة قبل كده.'],
 ['اسأل سؤال اكتشاف واحد','"فيه حاجة تانية حضرتك حابة الدكتور يبصلك عليها في نفس الزيارة؟"'],
 ['اربط عرض واحد باللي قاله','اقتراح واحد بس، بسعره المؤكد والهدية. "والدكتور هو اللي بيحدد في الاستشارة."'],
 ['احترم الرد','لو قال لأ، ارجع على طول لتأكيد الحجز الأساسي. متلحّش مرتين.']
];
const DONT=EN?['The customer is upset or complaining. Solve that first.','A pregnant customer (Hold): no extra offers.','Any medical question: transfer it to the doctor.','The customer asked to remove their number.','The customer is in a hurry or said "just book".','After one "no". Never offer a second time.']
 :['العميل متضايق أو بيشتكي. حل المشكلة الأول.','العميلة الحامل (Hold): مفيش عروض زيادة.','أي سؤال طبي: حوّله للدكتور.','العميل طلب نشيل رقمه.','العميل مستعجل أو قال "احجزلي وخلاص".','بعد أول "لأ". متعرضش تاني.'];
const PHR=EN?['"Since you mentioned…, the doctor can check it in the same free consultation."','"One visit, one free consultation, and each offer comes with a gift you choose."','"I\'ll note it on your booking so the doctor looks at it, no commitment."','"Would you like me to add it, or keep the booking as it is?"']
 :['"بما إن حضرتك ذكرتي…، الدكتور ممكن يشوفها في نفس الاستشارة المجانية."','"زيارة واحدة، واستشارة واحدة مجانية، وكل عرض معاه هدية حضرتك تختاريها."','"هكتبها في الحجز عشان الدكتور يبصلها، من غير أي التزام."','"تحبي أضيفها، ولا نخلي الحجز زي ما هو؟"'];
const sayBox=t=>`<div class="kp-say">${esc(t)}<button class="kp-mini" data-a="copy" data-t="${esc(t)}">${ic('copy',14)} ${T.sell.copy}</button></div>`;
function hubHtml(o){
  if(!o) return `<div class="kp-empty">${ic('sell',28)}<span>${T.hub.pickFirst}</span></div>`;
  const ups=upFor(o.id), xs=crossFor(o.id), val=VALUE[o.id];
  const needs=NEEDS.filter(n=>n.o.includes(o.id)), alts=[...new Set([].concat(...needs.map(n=>n.o)))].filter(x=>x!==o.id&&has(x)).slice(0,2);
  const pr=PRODUCTS.find(p=>p.id===o.guide), objs=pr?(pr.objs||[]).slice(0,4):[];
  return `<div class="kp-hub" data-cat="${o.cat}">
   <div class="kp-hubh"><span class="kp-hube" aria-hidden="true">${CATE[o.cat]||'✨'}</span>
    <div class="kp-hubt"><span class="kp-cat">${esc(CATS[o.cat]||'')}</span><h3>${esc(o.ar)}</h3>${o.en&&o.en!==o.ar?`<span class="ltr kp-mut">${esc(o.en)}</span>`:''}</div>
    <div class="kp-hubp"><span class="kp-price xl">${o.price==='—'?'—':esc(o.price)}</span><small>${o.price==='—'?'':AED}</small>${stChip(o.st)}</div></div>
   ${o.pn?`<div class="kp-hubpn">${esc(o.pn)}</div>`:''}
   <div class="kp-actions">
    <button class="kp-btn pri" data-a="copy" data-t="${esc(o.say||'')}">${ic('copy',16)} ${T.hub.copySay}</button>
    <button class="kp-btn" data-a="copy" data-t="${esc(waFor(o))}">${ic('wa',16)} ${T.hub.copyWa}</button>
    ${alts.length?`<button class="kp-btn" data-kp="cmp-set" data-v="${[o.id].concat(alts).join(',')}">${ic('compare',16)} ${T.hub.cmp}</button>`:''}
    <button class="kp-btn" data-a="go" data-v="o-${o.id}">${ic('offers',16)} ${T.hub.full}</button>
    <button class="kp-btn" data-kp="br">${ic('branches',16)} ${T.hub.br}</button>
   </div>
   <div class="kp-grid2">
    ${o.what?`<div class="kp-card"><div class="kp-lbl">${T.cmp.rows.what}</div><p class="kp-pp">${esc(o.what)}</p></div>`:''}
    ${o.who?`<div class="kp-card"><div class="kp-lbl">${T.cmp.rows.who}</div><p class="kp-pp">${esc(o.who)}</p></div>`:''}
   </div>
   ${o.say?`<div><div class="kp-lbl">${T.sell.say}</div>${sayBox(o.say)}</div>`:''}
   ${o.caution?`<div class="kp-warn"><b>${T.cmp.rows.caution}:</b> ${esc(o.caution)}</div>`:''}
   <div class="kp-ux">
    <div class="kp-uxc up"><div class="kp-uxh"><span class="kp-uxi">⬆</span><div><b>${T.hub.upT}</b><small>${T.hub.upS}</small></div></div>
     ${ups.length?ups.map(x=>`<div class="kp-card kp-lad">${x.self?'':`<div class="kp-omh"><button class="kp-link strong" data-kp="svc" data-v="${x.o.id}">${esc(x.o.ar)}</button>${stChip(x.o.st)}</div>`}
       <div class="kp-ladder"><div><small>${T.sell.from}</small><b>${esc(x.from)}</b></div><span class="kp-up">${x.d?'+'+fmt(x.d):ARR}</span><div><small>${T.sell.to}</small><b>${esc(x.to)}</b></div></div>
       <div class="kp-when"><span class="kp-lbl">${T.sell.trig}</span> ${esc(x.when)}</div>${sayBox(x.say)}</div>`).join('')
      :val?`<div class="kp-card"><div class="kp-lbl">${T.hub.valT}</div>${sayBox(val)}</div>`:`<div class="kp-note">${T.hub.noUp}</div>`}
     ${ups.length&&val?`<div class="kp-card"><div class="kp-lbl">${T.hub.valT}</div>${sayBox(val)}</div>`:''}</div>
    <div class="kp-uxc x"><div class="kp-uxh"><span class="kp-uxi">↔</span><div><b>${T.hub.xT}</b><small>${T.hub.xS}</small></div></div>
     ${xs.length?xs.map(c=>`<div class="kp-card kp-x1" data-cat="${c.ref.cat}"><div class="kp-trig"><span class="kp-lbl">${T.sell.trig}</span><b>${esc(c.t)}</b></div>
       <div class="kp-xo"><span class="kp-lbl">${T.sell.offerL}</span><button class="kp-link strong" data-kp="svc" data-v="${c.ref.id}">${CATE[c.ref.cat]||''} ${esc(c.ref.ar)}</button> <span class="kp-price sm">${esc(c.ref.price)}</span> ${stChip(c.ref.st)}</div>${sayBox(c.say)}</div>`).join('')
      :`<div class="kp-note">${T.hub.noX}</div>`}</div>
   </div>
   ${(o.qa||[]).length||objs.length?`<details class="kp-card kp-det" open><summary>${T.hub.qaT} (${(o.qa||[]).length+objs.length})</summary><div class="kp-qa">${(o.qa||[]).concat(objs).map(([q,a])=>`<div><b>${esc(q)}</b><span>${esc(a)}</span></div>`).join('')}</div>${pr?`<button class="kp-link" data-a="go" data-v="p-${pr.id}">📘 ${T.hub.guide} ${ARR}</button>`:''}</details>`:''}
   <div class="kp-note warn">${T.sell.disc}</div>
  </div>`;
}
function sellHtml(){
  const pool=OFFERS.filter(o=>SVCCAT==='all'||o.cat===SVCCAT);
  const cur=offer(SVCID)||OFFERS[0];
  const giftRule=(RULES.find(r=>/هدية|gift/i.test(r[1]))||[])[2]||'';
  const cats=[['all',L('الكل','All')]].concat(Object.entries(CATS).filter(([k])=>OFFERS.some(o=>o.cat===k)));
  return `<section id="sell" class="kp-sec"><div class="sh"><div class="eyebrow">${T.hub.eyebrow}</div><h2>${T.hub.title}</h2><p>${T.hub.intro}</p></div>
   <div class="kp-card kp-pick">
    <div class="kp-pickh"><div class="kp-chips kp-cats">${cats.map(([k,t])=>`<button class="kp-tab ${SVCCAT===k?'on':''}" data-kp="svc-cat" data-v="${k}">${k==='all'?'':(CATE[k]||'')+' '}${esc(t)}</button>`).join('')}</div>
     <input class="kp-pf" id="kp-pf" type="search" placeholder="${T.hub.find}" aria-label="${T.hub.find}"></div>
    <div class="kp-chips kp-svcs">${pool.map(o=>`<button class="kp-chip pick ${o.id===cur.id?'on':''}" data-cat="${o.cat}" data-kp="svc" data-v="${o.id}" data-k="${esc(norm(o.ar+' '+(o.en||'')+' '+(CATS[o.cat]||'')))}" aria-pressed="${o.id===cur.id}"><i>${CATE[o.cat]||''}</i>${esc(o.ar)}</button>`).join('')}</div>
   </div>
   ${hubHtml(cur)}
   <details class="kp-card kp-det"><summary>${T.hub.rulesT}</summary>
    <ol class="kp-steps">${STEPS.map(([a,b],i)=>`<li><span class="n">${i+1}</span><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join('')}</ol>
    <div class="kp-grid2">
     <div class="kp-card"><h3 class="kp-h3 sm">🎁 ${T.sell.giftT}</h3><p>${esc(giftRule)}</p><p class="kp-mut">${L('اسأل: "تحبي هديتك تكون إيه؟" قبل ما تأكد الحجز. الاختيار بيخلّي العميل يحس إنه كسبان.','Ask: "Which gift would you like?" before confirming the booking. Choosing makes the customer feel they won.')}</p></div>
     <div class="kp-card"><h3 class="kp-h3 sm">✋ ${T.sell.dontT}</h3><ul class="kp-ul">${DONT.map(d=>`<li>${esc(d)}</li>`).join('')}</ul></div>
    </div>
    <div class="kp-card"><h3 class="kp-h3 sm">🔗 ${T.sell.phrT}</h3><div class="kp-phr">${PHR.map(p=>`<button class="kp-chip" data-a="copy" data-t="${esc(p.replace(/^"|"$/g,''))}">${esc(p)}</button>`).join('')}</div></div>
   </details>
  </section>`;
}
SEC.sell=sellHtml;
function openSvc(id){ if(!has(id)) return; SVCID=id; store.set('kp-svc',id); SVCCAT='all'; if(VIEW!=='sell') setView('sell'); else { renderMain(); } const h=document.querySelector('.kp-hub'); if(h) h.scrollIntoView({block:'start',behavior:reduce()?'auto':'smooth'}); }


/* =============== STUDY =============== */
function hash(s){let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(36)}
function decks(){
  const D={};
  D.prices=OFFERS.filter(o=>o.price&&o.price!=='—').map(o=>({q:T.st.q.price(o.ar),a:o.price+' '+L('درهم','AED')+(o.pn?' · '+o.pn:''),st:o.st}));
  D.who=OFFERS.filter(o=>o.who).map(o=>({q:T.st.q.who(o.ar),a:o.who}));
  D.services=[].concat(...PRODUCTS.map(p=>[{q:T.st.q.what(p.name),a:p.what}].concat((p.facts||[]).map(f=>({q:p.name+': '+f[0],a:f[1]}))).concat((p.objs||[]).map(f=>({q:p.name+': '+f[0],a:f[1]})))));
  D.objections=OBJ.map(o=>({q:o[0]+(o[1]?'\n'+o[1]:''),a:o[2]}));
  D.rules=RULES.map(r=>({q:r[1],a:r[2]}));
  D.odoo=(typeof DISP!=='undefined'?DISP:[]).map(d=>({q:d.s,a:[d.st,d.tg,d.act].filter(Boolean).join(' · ')+(d.note?'\n'+d.note:'')}));
  D.gulf=GULF.map(g=>({q:g[0],a:g[1]}));
  D.terms=TERMS.map(t=>({q:t[0]+(t[1]?' ('+t[1]+')':''),a:t[2]}));
  Object.keys(D).forEach(k=>{ D[k]=D[k].filter(c=>c.q&&c.a); D[k].forEach(c=>c.id=k+':'+hash(c.q)); });
  return D;
}
const DECK_IC={mix:'spark',prices:'offers',who:'fit',services:'services',objections:'calls',rules:'todo',odoo:'odoo',gulf:'lang',terms:'study'};
let SP=store.get('kp-study',{});
const saveSP=()=>store.set('kp-study',SP);
const box=id=>(SP[id]&&SP[id].b)||0;
const learned=cards=>cards.filter(c=>box(c.id)>=2).length;
let RUN=null; // {deck,cards,i,flip,got}
function pickCards(cards,n){
  return cards.slice().sort((a,b)=>box(a.id)-box(b.id)||((SP[a.id]&&SP[a.id].t)||0)-((SP[b.id]&&SP[b.id].t)||0)||Math.random()-.5).slice(0,n);
}
function startDeck(k){
  const D=decks(); let cards;
  if(k==='mix'){ const all=[].concat(...Object.values(D)); cards=pickCards(all,12); }
  else cards=pickCards(D[k]||[],15);
  for(let i=cards.length-1;i>0;i--){ if(box(cards[i].id)===box(cards[i-1].id)&&Math.random()<.5){ const t=cards[i];cards[i]=cards[i-1];cards[i-1]=t; } }
  RUN={deck:k,cards,i:0,flip:false,got:0};
  renderMain(); const el=$('kp-run'); if(el) el.scrollIntoView({block:'start'});
}
function grade(ok){
  if(!RUN) return; const c=RUN.cards[RUN.i]; if(!c) return;
  const cur=SP[c.id]||{b:0}; SP[c.id]={b:ok?Math.min(4,(cur.b||0)+1):0,t:Date.now()}; saveSP();
  if(ok) RUN.got++; RUN.i++; RUN.flip=false;
  if(RUN.i>=RUN.cards.length&&RUN.got/RUN.cards.length>=.8&&typeof confetti==='function'&&!reduce()){ try{confetti()}catch(e){} }
  renderMain();
}
function studyHtml(){
  const D=decks(); const all=[].concat(...Object.values(D));
  const head=`<div class="sh"><div class="eyebrow">${T.st.eyebrow}</div><h2>${T.st.title}</h2><p>${T.st.intro}</p></div>`;
  if(RUN){
    const n=RUN.cards.length;
    if(RUN.i>=n) return `<section id="study" class="kp-sec">${head}<div class="kp-card kp-done" id="kp-run"><div class="kp-big">${RUN.got}/${n}</div><h3>${T.st.done}</h3><p>${T.st.doneSub(RUN.got,n)}</p>
      <div class="kp-actions"><button class="kp-btn pri" data-kp="st-start" data-v="${RUN.deck}">${T.st.more}</button><button class="kp-btn" data-kp="st-back">${T.st.back}</button></div></div></section>`;
    const c=RUN.cards[RUN.i], dk=c.id.split(':')[0];
    return `<section id="study" class="kp-sec">${head}<div class="kp-run" id="kp-run">
      <div class="kp-runh"><button class="kp-mini" data-kp="st-back">${ic('arrow',14)} ${T.st.back}</button><span class="kp-cat">${esc(T.st.decks[dk]||'')}</span><span class="kp-mut">${RUN.i+1} / ${n}</span></div>
      <div class="kp-bar"><i style="width:${Math.round(100*RUN.i/n)}%"></i></div>
      <button class="kp-flash ${RUN.flip?'flip':''}" data-kp="st-flip" aria-live="polite">
        <span class="kp-face front"><span class="kp-q">${esc(c.q).replace(/\n/g,'<br><small>')}</span><span class="kp-hint">${T.st.flip}</span></span>
        <span class="kp-face back"><span class="kp-qs">${esc(c.q.split('\n')[0])}</span><span class="kp-a">${esc(c.a).replace(/\n/g,'<br>')}</span>${c.st==='warn'?'<span class="chip c-warn">'+L('محتاج تأكيد','Needs confirmation')+'</span>':''}</span>
      </button>
      <div class="kp-grade ${RUN.flip?'':'dim'}"><button class="kp-btn no" data-kp="st-no">✕ ${T.st.again}</button><button class="kp-btn ok" data-kp="st-ok">✓ ${T.st.got}</button></div>
      <div class="kp-mut kp-keys">${T.st.keys}</div></div></section>`;
  }
  const tot=all.length, kn=learned(all);
  const card=(k,cards)=>{ const a=k==='mix'?kn:learned(cards), b=k==='mix'?tot:cards.length, p=b?Math.round(100*a/b):0;
    return `<button class="kp-deck" data-kp="st-start" data-v="${k}"><span class="kp-dic">${ic(DECK_IC[k],22)}</span><b>${esc(T.st.decks[k])}</b><span class="kp-mut">${k==='mix'?T.st.cards(12):T.st.cards(cards.length)} · ${T.st.known(a,b)}</span><span class="kp-bar"><i style="width:${p}%"></i></span></button>`; };
  return `<section id="study" class="kp-sec">${head}
    <div class="kp-stat"><div class="kp-ring" style="--p:${tot?Math.round(100*kn/tot):0}"><b>${tot?Math.round(100*kn/tot):0}%</b></div><div><b>${T.st.known(kn,tot)}</b><div class="kp-mut">${T.st.keys}</div></div></div>
    <div class="kp-decks">${card('mix',all)}${Object.keys(D).filter(k=>D[k].length).map(k=>card(k,D[k])).join('')}</div>
    <div><button class="kp-link" data-kp="st-reset">${T.st.reset}</button></div></section>`;
}
SEC.study=studyHtml;

/* =============== HOME HERO =============== */
let RECENT=store.get('kp-recent',[]);
function track(id){ if(!id||id==='home') return; RECENT=[id].concat(RECENT.filter(x=>x!==id)).slice(0,6); store.set('kp-recent',RECENT); }
function recentLabel(id){
  if(id.startsWith('o-')){ const o=offer(id.slice(2)); return o?[o.ar,'offers']:null; }
  if(id.startsWith('p-')){ const p=PRODUCTS.find(x=>'p-'+x.id===id); return p?[p.name,'services']:null; }
  const v=VIEWS.find(x=>x[0]===id); return v?[clean(v[1]),id]:null;
}
function myName(){ try{ const s=ses(); const t=(typeof TEAM!=='undefined'&&typeof meGet==='function')?TEAM.find(x=>x.id===meGet()):null; const n=t?(EN?t.en:t.ar):(s&&s.name)||''; return String(n).split(' ')[0]; }catch(e){ return ''; } }
function hero(){
  const h=new Date().getHours(), nm=myName();
  const D=decks(), all=[].concat(...Object.values(D)), kn=learned(all), pct=all.length?Math.round(100*kn/all.length):0;
  const rec=RECENT.map(id=>[id,recentLabel(id)]).filter(x=>x[1]).slice(0,5);
  const day=Math.floor(Date.now()/864e5), tip=RULES.length?RULES[day%RULES.length]:null;
  return `<section class="kp-hero"><div class="kp-hero-in"><div><div class="kp-hi">${T.hello(h)}${nm?(EN?', ':' يا ')+esc(nm):''} 👋</div><p>${T.heroSub}</p></div>
     <button class="kp-search" data-kp="pal">${ic('search',18)}<span>${T.palPh}</span><kbd>Ctrl K</kbd></button></div>
    <div class="kp-tiles">${T.heroCards.map(([id,t,s])=>`<button class="kp-tile t-${id}" data-kp="view" data-v="${id}"><span class="kp-tic">${ic(id,22)}</span><b>${t}</b><span>${s}</span></button>`).join('')}</div>
    <div class="kp-hrow">
     <div class="kp-card kp-hcard"><div class="kp-lbl">${T.studyProg}</div><div class="kp-stat sm"><div class="kp-ring sm" style="--p:${pct}"><b>${pct}%</b></div><div><b>${T.st.known(kn,all.length)}</b><button class="kp-link" data-kp="st-start" data-v="mix">${T.studyGo} ${ARR}</button></div></div></div>
     ${rec.length?`<div class="kp-card kp-hcard"><div class="kp-lbl">${T.recent}</div><div class="kp-chips">${rec.map(([id,[t]])=>`<button class="kp-chip" data-kp="go" data-v="${id}">${esc(t)}</button>`).join('')}</div></div>`:''}
     ${tip?`<div class="kp-card kp-hcard"><div class="kp-lbl">💡 ${T.tipT}</div><b>${esc(tip[1])}</b><span class="kp-mut">${esc(tip[2])}</span></div>`:''}
    </div></section>`;
}
{ const _home=SEC.home; SEC.home=()=>hero()+_home(); }

/* =============== MISSED SEARCHES =============== */
const MISSED=new Set(); let MT=null;
function logMiss(q,src){
  q=String(q||'').trim(); if(q.length<3) return; const k=src+':'+norm(q); if(MISSED.has(k)) return; MISSED.add(k);
  const s=ses(); const body=JSON.stringify({action:'kbMiss',q,src,lang:EN?'en':'ar',session:s&&s.session||''});
  try{ fetch(API,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body}).catch(()=>{}); }catch(e){}
}
if(typeof showRes==='function'){ const _sr=showRes; showRes=function(){ _sr(); clearTimeout(MT); const q=$('q').value.trim(); if(q.length>=3&&typeof RES!=='undefined'&&!RES.length) MT=setTimeout(()=>{ if($('q').value.trim()===q) logMiss(q,'search'); },2500); }; }
if(typeof botSend==='function'&&typeof botAsk==='function'){ const _bs=botSend; botSend=function(q){ try{ const r=botAsk(String(q||'')); if(r&&r.kind==='none') logMiss(q,'noor'); }catch(e){} return _bs(q); }; }
let MISS=null, MISS_ERR='';
async function loadMisses(){ const s=ses(); if(!s) return; try{ const j=await (await fetch(API+'?action=kbMisses&session='+encodeURIComponent(s.session))).json(); if(j&&j.ok){ MISS=j; MISS_ERR=''; } else MISS_ERR=j&&j.error==='forbidden'?'':T.miss.err; }catch(e){ MISS_ERR=''; } if(VIEW==='dash') renderMain(); }
if(SEC.dash){ const _d=SEC.dash; SEC.dash=()=>{ const h=_d(); if(!MISS&&!MISS_ERR) return h; const p=`<div class="panel kp-miss"><b>🔎 ${T.miss.title}</b><div class="muted">${T.miss.sub}</div>${MISS_ERR?`<div class="muted">${esc(MISS_ERR)}</div>`:MISS.items.length?`<ol>${MISS.items.map(x=>`<li><span>${esc(x.q)}</span><span class="kp-mut">${T.miss.times(x.n)}${x.noor?' · '+T.miss.noor+' '+x.noor:''} · ${esc(x.last)}</span></li>`).join('')}</ol>`:`<div class="muted">${T.miss.none}</div>`}</div>`; return h.replace(/<\/section>\s*$/,p+'</section>'); }; }

/* =============== OFFERS + BRANCHES side by side =============== */
function todayDocs(bid){ try{ const t=uaeParts(), dt=uaeDate(0); return DOCTORS.map((d,i)=>[d,i]).filter(([d])=>d.br===bid&&docDay(d,dt,t.wd).on); }catch(e){ return []; } }
function brqHtml(){
  if(typeof BRANCHES==='undefined'||typeof branchStatus!=='function') return '';
  return `<div class="kp-brq"><div class="kp-brqh"><b>${ic('branches',16)} ${T.brq.title}</b><button class="kp-link" data-kp="br">${T.brq.all} ${ARR}</button></div>
   <div class="kp-brqg">${BRANCHES.map(b=>{ const st=branchStatus(b), ds=todayDocs(b.id);
    return `<div class="kp-brc ${st.open?'on':'off'}"><div class="kp-brt"><b>${esc(b.city)}</b><span class="bstat ${st.open?'on':'off'}" data-bstat="${b.id}">${esc(st.txt)}</span></div>
     <div class="kp-brd"><span class="kp-lbl">${T.brq.docs}</span> ${ds.length?ds.map(([d,i])=>`<span class="kp-doc">${esc(d.name)} <small>${esc(d.spec)}</small> <span class="bstat" data-dstat="${i}">${esc(docStatus(d).txt)}</span></span>`).join(''):`<span class="kp-mut">${T.brq.none}</span>`}</div>
     ${b.phone?`<button class="kp-mini" data-a="copy" data-t="${esc(b.phone)}">${ic('calls',13)} ${esc(b.phone)}</button>`:''}</div>`; }).join('')}</div></div>`;
}
if(SEC.offers){ const _of=SEC.offers; SEC.offers=()=>{ const h=_of(); const i=h.indexOf('<div class="filters">'); return i<0?h:h.slice(0,i)+brqHtml()+h.slice(i); }; }
if(SEC.branches){ const _br=SEC.branches; SEC.branches=()=>`<div class="kp-jump"><button class="kp-chip" data-kp="view" data-v="offers">${ic('offers',15)} ${viewLabel('offers')} ${ARR}</button><button class="kp-chip" data-kp="view" data-v="sell">${ic('sell',15)} ${T.views.sell} ${ARR}</button></div>`+_br(); }
const brm=document.createElement('div'); brm.className='kp-pal kp-brm'; brm.hidden=true; document.body.appendChild(brm);
function openBr(){ if(!SEC.branches) return; brm.innerHTML=`<div class="kp-pal-bg" data-kp="br-x"></div><div class="kp-pal-in kp-brin" role="dialog" aria-modal="true" aria-label="${T.hub.br}"><button class="kp-x kp-brx" data-kp="br-x" aria-label="close">${ic('x',16)}</button>${SEC.branches()}</div>`; brm.hidden=false; const x=brm.querySelector('.kp-brx'); if(x) x.focus(); }
function closeBr(){ brm.hidden=true; brm.innerHTML=''; }

/* =============== offer cards: category colour + quick actions =============== */
function decorate(){
  document.querySelectorAll('#main article.offer').forEach(el=>{ const o=offer(el.id.slice(2)); if(!o) return; el.dataset.cat=o.cat;
    if(!el.querySelector('.kp-oact')){ const d=document.createElement('div'); d.className='kp-oact';
      d.innerHTML=`<button data-kp="svc" data-v="${o.id}">${ic('sell',14)} ${T.noor.svc}</button><button data-kp="cmp-add" data-v="${o.id}">${ic('compare',14)} ${T.noor.cmp}</button><button data-kp="br">${ic('branches',14)} ${T.hub.br}</button>`;
      const h=el.querySelector('.ohead'); if(h) h.after(d); } });
}
{ const _rm=renderMain; renderMain=function(){ _rm(); try{ decorate(); }catch(e){} }; }

/* =============== Noor: actions on answers, voice, ask from the palette =============== */
if(typeof botAnswerHtml==='function'){ const _ba=botAnswerHtml; botAnswerHtml=function(r){ let h=_ba(r);
  try{ const it=r&&r.kind==='hit'&&r.best; let o=null;
    if(it&&(it.type==='offer'||it.type==='oqa')) o=it.ref; else if(it&&it.type==='product'&&it.ref&&(it.ref.offers||[]).length) o=offer(it.ref.offers[0]);
    if(o&&has(o.id)) h+=`<div class="kp-nact"><button data-kp="svc" data-v="${o.id}">${ic('sell',14)} ${T.noor.svc}</button><button data-kp="cmp-add" data-v="${o.id}">${ic('compare',14)} ${T.noor.cmp}</button>${o.say?`<button data-a="copy" data-t="${esc(o.say)}">${ic('copy',14)} ${T.noor.say}</button>`:''}</div>`; }catch(e){}
  return h; }; }
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
if(typeof drawerChat==='function'&&SR){ const _dc=drawerChat; drawerChat=function(){ return _dc().replace(/(<button class="btn pri" type="submit")/,`<button type="button" class="btn kp-mic" data-kp="mic" title="${T.noor.mic}" aria-label="${T.noor.mic}">🎙</button>$1`); }; }
let REC=null;
function mic(){
  if(!SR){ toast(T.noor.micNo); return; } if(REC){ try{REC.stop()}catch(e){} return; }
  const r=new SR(); REC=r; r.lang=EN?'en-US':'ar-EG'; r.interimResults=true; r.maxAlternatives=1;
  const b=document.querySelector('.kp-mic'); if(b) b.classList.add('on'); const i=$('cq'); if(i) i.placeholder=T.noor.listening;
  r.onresult=e=>{ let t=''; for(const x of e.results) t+=x[0].transcript; const n=$('cq'); if(n) n.value=t; };
  r.onerror=()=>{}; r.onend=()=>{ REC=null; const b2=document.querySelector('.kp-mic'); if(b2) b2.classList.remove('on'); const v=(($('cq')||{}).value||'').trim(); if(v) botSend(v); };
  try{ r.start(); }catch(e){ REC=null; }
}
function closeNarrowDrawer(){ if(matchMedia('(max-width:1080px)').matches&&DRAWER){ DRAWER=null; renderRail(); } }

/* =============== offline copy of the live offers =============== */
if(typeof applyOfferRows==='function'){
  const _ao=applyOfferRows; applyOfferRows=function(rows){ const r=_ao(rows); try{ if(rows&&rows.length>1) store.set('kp-offers',{t:Date.now(),rows}); }catch(e){} return r; };
  const snap=store.get('kp-offers',null);
  if(snap&&Array.isArray(snap.rows)&&Date.now()-(snap.t||0)<30*864e5){ try{ _ao(snap.rows); if(typeof reindex==='function') reindex(); }catch(e){} }
}

/* =============== name =============== */
{ const br=document.querySelector('.brand'); if(br&&!br.querySelector('.kp-logos')){ const lg=document.createElement('span'); lg.className='kp-logos'; lg.innerHTML='<img src="img/techsource.png" alt="Tech Source"><img src="img/tresjolie.png" alt="Tres Jolie" class="acct">'; const t=document.createElement('span'); t.className='kp-bt'; while(br.firstChild) t.appendChild(br.firstChild); br.appendChild(lg); br.appendChild(t); } }
{ const b=document.querySelector('.brand b'); if(b) b.textContent=T.brand; const s=document.querySelector('.brand b + span'); if(s&&!/H&P|H&amp;P/.test(s.textContent)) s.textContent='H&P · '+s.textContent; try{ document.title=T.brand+' · H&P'; }catch(e){} }

/* =============== SIDEBAR + BOTTOM NAV + PALETTE =============== */
document.body.classList.add('kp');
const wrap=$('wrap'), side=document.createElement('nav');
side.className='kp-side'; side.setAttribute('aria-label',L('أقسام الدليل','Guide sections'));
wrap.insertBefore(side,wrap.firstChild);
function groupsHtml(){
  const used=new Set(); const gs=GROUPS.map(([g,ids])=>[g,ids.filter(id=>VIEWS.some(v=>v[0]===id))]);
  gs.forEach(([,ids])=>ids.forEach(i=>used.add(i)));
  const rest=VIEWS.map(v=>v[0]).filter(id=>!used.has(id)); if(rest.length) gs.push(['more',rest]);
  return gs.filter(g=>g[1].length).map(([g,ids])=>`<div class="kp-g"><div class="kp-gt">${T.groups[g]}</div>${ids.map(id=>{const c=cnt(id);return `<a href="#${id}" data-kpv="${id}" class="${VIEW===id?'on':''}" ${VIEW===id?'aria-current="page"':''}>${ic(id)}<span>${esc(viewLabel(id))}</span>${c?`<em>${c}</em>`:''}</a>`}).join('')}</div>`).join('');
}
const TH=['auto','light','dark'];
let THEME=store.get('kp-theme','auto'); if(!TH.includes(THEME)) THEME='auto';
function applyTheme(){ if(THEME==='auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme=THEME; const m=document.querySelector('meta[name="theme-color"]'); if(m) m.content=getComputedStyle(document.documentElement).getPropertyValue('--head').trim()||'#1D2B3A'; }
function renderSide(){
  side.innerHTML=`<div class="kp-side-in">${groupsHtml()}<div class="kp-sfoot"><div class="kp-theme" role="group" aria-label="${T.theme}">${TH.map(t=>`<button data-kp="theme" data-v="${t}" class="${THEME===t?'on':''}" title="${T.themes[t]}" aria-pressed="${THEME===t}">${ic(t==='auto'?'auto':t==='light'?'sun':'moon',15)}</button>`).join('')}</div><button class="kp-kbd" data-kp="pal">${ic('search',14)} ${T.kbd} <kbd>Ctrl K</kbd></button></div></div>`;
  renderBottom();
}
const bottom=document.createElement('nav'); bottom.className='kp-bottom'; bottom.setAttribute('aria-label',L('تنقل سريع','Quick navigation')); document.body.appendChild(bottom);
function renderBottom(){
  const it=[['home','home',T.bottom.home],['offers','offers',T.bottom.offers],['noor','noor',T.bottom.noor],['study','study',T.bottom.study],['more','more',T.bottom.more]];
  bottom.innerHTML=it.map(([id,i,t])=>`<button data-kp="bn" data-v="${id}" class="${(VIEW===id)||(id==='more'&&!['home','offers','study'].includes(VIEW))?'on':''} ${id==='noor'?'mid':''}">${ic(i,id==='noor'?24:20)}<span>${t}</span></button>`).join('');
}
const sheet=document.createElement('div'); sheet.className='kp-sheet'; sheet.hidden=true; document.body.appendChild(sheet);
function openSheet(){ sheet.innerHTML=`<div class="kp-sheet-bg" data-kp="sheet-x"></div><div class="kp-sheet-in" role="dialog" aria-modal="true"><div class="kp-grab"></div>${groupsHtml()}<div class="kp-sfoot"><div class="kp-theme">${TH.map(t=>`<button data-kp="theme" data-v="${t}" class="${THEME===t?'on':''}">${ic(t==='auto'?'auto':t==='light'?'sun':'moon',15)} ${T.themes[t]}</button>`).join('')}</div>${INSTALL?`<button class="kp-btn" data-kp="install">${ic('install',16)} ${T.install}</button>`:''}</div></div>`; sheet.hidden=false; }
function closeSheet(){ sheet.hidden=true; sheet.innerHTML=''; }

/* palette */
const pal=document.createElement('div'); pal.className='kp-pal'; pal.hidden=true; document.body.appendChild(pal);
let PALI=[], PALS=0;
function palItems(q){
  const nq=norm(q||''); const out=[];
  const views=VIEWS.map(v=>({k:'v',id:v[0],t:clean(v[1]),ic:v[0]})).filter(x=>!nq||norm(x.t+' '+x.id).includes(nq));
  const acts=[['noor','noor',T.acts.noor],['call','calls',T.acts.call],['quote','offers',T.acts.quote],['wiz','odoo',T.acts.wiz],['study','study',T.acts.study],['compare','compare',T.acts.compare],['theme','moon',T.acts.theme],['lang','lang',T.acts.en]]
    .map(([id,i,t])=>({k:'a',id,t,ic:i})).filter(x=>!nq||norm(x.t).includes(nq));
  let hits=[]; if(nq&&typeof search==='function'){ try{ hits=search(q).slice(0,8).map(r=>({k:'h',id:r.go,t:r.title,s:r.sec,ic:'search'})); }catch(e){} }
  if(views.length) out.push([T.palViews,views.slice(0,nq?6:30)]);
  if(acts.length) out.push([T.palActs,acts.slice(0,nq?4:8)]);
  if(hits.length) out.push([T.palHits,hits]);
  if(nq) out.push([L('نور','Noor'),[{k:'a',id:'ask:'+q,t:T.noor.ask(q),ic:'noor'}]]);
  return out;
}
function renderPal(){
  const q=($('kp-pq')||{}).value||''; const groups=palItems(q); PALI=[].concat(...groups.map(g=>g[1])); if(PALS>=PALI.length) PALS=0;
  let n=-1; $('kp-pl').innerHTML=PALI.length?groups.map(([t,its])=>`<div class="kp-pg">${t}</div>`+its.map(x=>{n++;return `<button class="kp-pi ${n===PALS?'on':''}" data-kp="pi" data-i="${n}">${ic(x.ic,16)}<span><b>${esc(x.t)}</b>${x.s?`<small>${esc(x.s)}</small>`:''}</span></button>`}).join('')).join(''):`<div class="kp-pnone">${T.palNone}</div>`;
  const on=$('kp-pl').querySelector('.on'); if(on) on.scrollIntoView({block:'nearest'});
}
function openPal(){ pal.innerHTML=`<div class="kp-pal-bg" data-kp="pal-x"></div><div class="kp-pal-in" role="dialog" aria-modal="true" aria-label="${T.kbd}"><div class="kp-pin">${ic('search',18)}<input id="kp-pq" autocomplete="off" placeholder="${T.palPh}"><kbd>Esc</kbd></div><div class="kp-pl" id="kp-pl"></div></div>`; pal.hidden=false; PALS=0; renderPal(); const i=$('kp-pq'); if(i) i.focus(); }
function closePal(){ pal.hidden=true; pal.innerHTML=''; }
function runPal(i){
  const x=PALI[i]; if(!x) return; closePal();
  if(x.k==='v') setView(x.id);
  else if(x.k==='h'){ track(x.id); go(x.id); }
  else action(x.id);
}
function action(id){
  if(id.startsWith('ask:')){ DRAWER='chat'; renderRail(); botSend(id.slice(4)); return; }
  if(['noor','call','quote','wiz'].includes(id)){ DRAWER={noor:'chat',call:'call',quote:'quote',wiz:'wiz'}[id]; renderRail(); if(DRAWER==='chat'){ setTimeout(()=>{const i=$('cq'); if(i) i.focus();},50); } return; }
  if(id==='study'){ setView('study'); startDeck('mix'); return; }
  if(id==='compare'){ setView('compare'); return; }
  if(id==='theme'){ THEME=(document.documentElement.dataset.theme==='dark'||(!document.documentElement.dataset.theme&&matchMedia('(prefers-color-scheme: dark)').matches))?'light':'dark'; store.set('kp-theme',THEME); applyTheme(); renderSide(); return; }
  if(id==='lang'){ const b=$('langbtn'); if(b) location.href=b.getAttribute('href')+location.hash; }
}
document.addEventListener('input',e=>{ if(e.target.id!=='kp-pf') return; const q=norm(e.target.value); document.querySelectorAll('.kp-svcs .kp-chip').forEach(b=>b.hidden=!!q&&!(b.dataset.k||'').includes(q)); });
pal.addEventListener('input',e=>{ if(e.target.id==='kp-pq'){ PALS=0; renderPal(); } });
pal.addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); if(!PALI.length) return; PALS=(PALS+(e.key==='ArrowDown'?1:-1)+PALI.length)%PALI.length; renderPal(); }
  else if(e.key==='Enter'){ e.preventDefault(); runPal(PALS); }
  else if(e.key==='Escape'){ e.preventDefault(); closePal(); }
});

/* header button */
{ const tools=document.querySelector('.tools'); if(tools){ const b=document.createElement('button'); b.className='tbtn kp-hk'; b.dataset.kp='pal'; b.title=T.kbd+' (Ctrl K)'; b.innerHTML=ic('search',16)+'<span class="t">Ctrl K</span>'; tools.insertBefore(b,tools.firstChild); } }

/* ---------------- wrap core functions ---------------- */
{ const _rt=renderTabs; renderTabs=function(){ _rt(); renderSide(); }; }
{ const _sv=setView; setView=function(v,n){ if(v!=='study') RUN=null; _sv(v,n); track(v); if(v==='dash'&&!MISS) loadMisses(); closeSheet(); }; }
{ const _go=go; go=function(t){ if(/^(o|p)-/.test(t)) track(t); return _go(t); }; }

/* ---------------- call script: what to SAY vs notes for the agent ----------------
   Every step is split into: the line the agent says (green bubble, one column)
   and the note for the agent only (grey, beside it on PC, under it on phones).
   "Script only" hides the notes. Steps with nothing to say show as an action row. */
let FMODE=store.get('kp-flowmode','both'); // both | say
let FSEL=+store.get('ks-flow',0)||0;
const COND_RE=EN?/^(If|After|For)\b/i:/^(لو|بعد|في)\s/;
function stepParts(s,l){
  s=String(s||''); let cond='', note=s; const say=String(l||'');
  if(COND_RE.test(s)){ const k=s.indexOf(':');
    if(k>0&&k<90){ cond=s.slice(0,k).trim(); note=s.slice(k+1).trim(); if(EN) note=note.charAt(0).toUpperCase()+note.slice(1); }
    else if(say){ cond=s.replace(/[.:؟?]\s*$/,''); note=''; } }
  return {cond,note,say};
}
const ME_RE=/\[(اسمك|your name)\]/gi;
const meFill=t=>{ const n=myName(); return n?String(t).replace(ME_RE,n):String(t); };
const hiPh=t=>{ const n=myName(); let h=esc(t); if(n) h=h.replace(ME_RE,`<span class="ks-me">${esc(n)}</span>`); return h.replace(/\[([^\]]+)\]/g,'<span class="ks-ph">$1</span>'); };
const FT={
  eyebrow:L('سكريبت المكالمة','Call script'), title:L('خطوات المكالمة حسب نوعها','Call steps by call type'),
  intro:L('اختار نوع المكالمة. الكلام اللي في الفقاعة الخضرا هو اللي تقوله للعميل، والكلام الرمادي جنبه ملاحظة ليك إنت ومتتقالش.','Pick the call type. The green bubble is what you say to the customer. The grey text beside it is a note for you, never read it out.'),
  pending:L('سكريبت مقترح، مستني موافقة الكلاينت النهائية','Suggested script, waiting for the client\'s final approval'),
  say:L('قول للعميل','Say to the customer'), note:L('ملاحظة ليك (متتقالش)','Note for you (don\'t say it)'),
  act:L('خطوة تعملها','Do this'), both:L('الاسكريبت + الملاحظات','Script + notes'), only:L('الاسكريبت بس','Script only'),
  use:L('افتحها في مساعد المكالمة','Open in the Call assistant'), copy:L('نسخ','Copy'), copyAll:L('انسخ الاسكريبت كله','Copy the whole script'),
  steps:n=>L(n+' خطوة',n+' steps'), copied:L('اتنسخ الاسكريبت','Script copied'),
  me:n=>n?L(`السكريبت متظبط باسمك: <span class="ks-me">${esc(n)}</span>. الاسم بيتاخد من دخولك في بوصلة.`,`The script uses your name: <span class="ks-me">${esc(n)}</span>, taken from your Bousla sign-in.`):L('سجّل دخولك في الكويز مرة واحدة، واسمك هيظهر في السكريبت مكان [اسمك] تلقائي.','Sign in to the quiz once and your name will replace [your name] in the script automatically.'),
  ph:L('الكلام اللي بين الأقواس الملوّنة زي <span class="ks-ph">الاسم</span> بتغيّره بالبيانات الحقيقية.','Coloured words like <span class="ks-ph">name</span> are placeholders: replace them with the real details.')
};
function stepHtml(st,i){
  const p=stepParts(st[0],st[1]); const ifc=p.cond?`<span class="ks-if">${esc(p.cond)}</span>`:'';
  if(!p.say) return `<li class="ks-st is-act${p.cond?' is-cond':''}"><span class="ks-n">${i+1}</span><div class="ks-act">${ifc}<span class="ks-al">${FT.act}</span><span>${esc(p.note)}</span></div></li>`;
  return `<li class="ks-st${p.cond?' is-cond':''}"><span class="ks-n">${i+1}</span>
   <div class="ks-say">${ifc}<p>${hiPh(p.say)}</p><button class="ks-cp" data-a="copy" data-t="${esc(meFill(p.say))}" aria-label="${FT.copy}">${FT.copy}</button></div>
   ${p.note?`<div class="ks-note"><span class="ks-nl">${FT.note}</span>${esc(p.note)}</div>`:'<div class="ks-note ks-empty"></div>'}</li>`;
}
function flowScript(f){ return f.steps.map((st,i)=>{ const p=stepParts(st[0],st[1]); return p.say?(p.cond?'('+p.cond+') ':'')+meFill(p.say):''; }).filter(Boolean).join('\n\n'); }
function flowsHtml(){
  if(FSEL>=FLOWS.length) FSEL=0;
  const tabs=FLOWS.map((f,i)=>`<button class="ks-tab${i===FSEL?' on':''}" data-kp="fsel" data-v="${i}" aria-pressed="${i===FSEL}"><b>${esc(f.t.replace(/\s*\(.*\)\s*$/,''))}</b>${/\(/.test(f.t)?`<small>${esc((f.t.match(/\((.*)\)/)||[])[1]||'')}</small>`:''}</button>`).join('');
  const f=FLOWS[FSEL];
  return `<section id="flows" class="ks-flows ${FMODE==='say'?'say-only':''}"><div class="sh"><div class="eyebrow">${FT.eyebrow}</div><h2>${FT.title}</h2><p>${FT.intro}</p><p><span class="chip c-warn">${FT.pending}</span></p></div>
   <div class="ks-tabs" role="tablist">${tabs}</div>
   <div class="ks-bar"><div class="ks-seg" role="group"><button data-kp="fmode" data-v="both" class="${FMODE!=='say'?'on':''}">${FT.both}</button><button data-kp="fmode" data-v="say" class="${FMODE==='say'?'on':''}">${FT.only}</button></div>
    <span class="ks-legend"><i class="ks-dot say"></i>${FT.say}<i class="ks-dot note"></i>${FT.note}</span></div>
   <div class="ks-flow flow" id="flow-${FSEL}"><div class="ks-head"><div><h3>${esc(f.t)}</h3><span class="muted">${FT.steps(f.steps.length)}</span></div>
    <div class="ks-acts"><button class="ib" data-kp="fcopy" data-v="${FSEL}">${FT.copyAll}</button><button class="ib pri" data-a="useflow" data-v="${FSEL}">☎ ${FT.use}</button></div></div>
    <div class="ks-cols" aria-hidden="true"><span></span><span>🗣 ${FT.say}</span><span>📝 ${FT.note}</span></div>
    <ol class="ks-steps">${f.steps.map(stepHtml).join('')}</ol>
    <p class="small ks-phhelp">${FT.me(myName())} ${FT.ph}</p></div>
   ${FLOWS.map((x,i)=>i===FSEL?'':`<span id="flow-${i}" hidden></span>`).join('')}</section>`;
}
SEC.flows=flowsHtml;
{ const _go2=go; go=function(t){ const m=/^flow-(\d+)$/.exec(t||''); if(m&&+m[1]!==FSEL){ FSEL=+m[1]; store.set('ks-flow',FSEL); if(VIEW===viewOf('flows')) renderMain(); } return _go2(t); }; }
/* Call assistant drawer: same split, script line first */
drawerCall=function(){
  const k=ST.callType; const f=FLOWS[CALLCK[k].f]; const done=ST.call[k]||{};
  const steps=f.steps.map((s,i)=>({id:'s'+i,p:stepParts(s[0],s[1])}));
  const comp=COMPCK.map((t,i)=>({id:'c'+i,t}));
  const total=steps.length+comp.length; const n=Object.keys(done).filter(x=>done[x]).length;
  const cb=(id)=>`<input type="checkbox" data-a="ck" data-v="${id}" ${done[id]?'checked':''}>`;
  return `<div class="dhead"><b>${L('مساعد المكالمة','Call assistant')}</b><span class="timer" id="tmr">${T0?mm((Date.now()-T0)/1000):'00:00'}</span></div>
   <select class="sel" id="ctype" data-a="ctype" aria-label="${L('نوع المكالمة','Call type')}">${Object.entries(CALLCK).map(([k2,v])=>`<option value="${k2}" ${k2===k?'selected':''}>${v.t}</option>`).join('')}</select>
   <div class="row" style="display:flex;gap:6px"><button class="btn pri" data-a="tstart">${T0?L('مكالمة جديدة','New call'):L('ابدأ المكالمة','Start the call')}</button><button class="btn" data-a="creset">${L('امسح العلامات','Clear checks')}</button></div>
   <div class="prog" aria-hidden="true"><i style="width:${Math.round(100*n/total)}%"></i></div>
   <div class="ks-seg ks-seg-sm" role="group"><button data-kp="fmode" data-v="both" class="${FMODE!=='say'?'on':''}">${FT.both}</button><button data-kp="fmode" data-v="say" class="${FMODE==='say'?'on':''}">${FT.only}</button></div>
   <div class="ck ks-ck ${FMODE==='say'?'say-only':''}"><h4>${L('الخطوات','Steps')}</h4>${steps.map(({id,p})=>`<label class="${done[id]?'done':''}${p.say?'':' is-act'}">${cb(id)}<span>${p.cond?`<span class="ks-if">${esc(p.cond)}</span>`:''}${p.say?`<span class="ks-say-sm">${hiPh(p.say)}</span>${p.note?`<span class="ks-note-sm">📝 ${esc(p.note)}</span>`:''}`:`<span class="ks-act-sm">${esc(p.note)}</span>`}</span></label>`).join('')}
    <h4>${L('الكومبلاينس','Compliance')}</h4>${comp.map(s=>`<label class="${done[s.id]?'done':''}">${cb(s.id)}<span>${esc(s.t)}</span></label>`).join('')}</div>
   <button class="btn" data-a="drawer" data-v="wiz">${L('خلصت؟ اختار نتيجة المكالمة ←','Done? Choose the call outcome →')}</button>`;
};

/* ---------------- events ---------------- */
side.addEventListener('click',e=>{ const a=e.target.closest('a[data-kpv]'); if(!a) return; e.preventDefault(); setView(a.dataset.kpv); });
sheet.addEventListener('click',e=>{ const a=e.target.closest('a[data-kpv]'); if(!a) return; e.preventDefault(); closeSheet(); setView(a.dataset.kpv); });
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-kp]'); if(!b) return; const a=b.dataset.kp, v=b.dataset.v;
  if(a==='pal'){ e.preventDefault(); openPal(); }
  else if(a==='pal-x') closePal();
  else if(a==='pi') runPal(+b.dataset.i);
  else if(a==='view') setView(v);
  else if(a==='go'){ go(v); }
  else if(a==='theme'){ THEME=v; store.set('kp-theme',v); applyTheme(); renderSide(); if(!sheet.hidden) openSheet(); }
  else if(a==='bn'){ if(v==='noor') action('noor'); else if(v==='more') sheet.hidden?openSheet():closeSheet(); else { closeSheet(); setView(v); } }
  else if(a==='sheet-x') closeSheet();
  else if(a==='install'){ if(INSTALL){ INSTALL.prompt(); INSTALL=null; closeSheet(); } }
  else if(a==='cmp-tog'){ if(CMP.includes(v)) CMP=CMP.filter(x=>x!==v); else if(CMP.length>=3){ toast(T.cmp.max); return; } else CMP.push(v); saveCmp(); renderMain(); }
  else if(a==='cmp-del'){ CMP=CMP.filter(x=>x!==v); saveCmp(); renderMain(); }
  else if(a==='cmp-pre'){ CMP=PRESETS.filter(p=>p[0].every(has))[+v][0].slice(); saveCmp(); renderMain(); }
  else if(a==='cmp-cat'){ CMPCAT=v; renderMain(); }
  else if(a==='cmp-clear'){ CMP=[]; saveCmp(); renderMain(); }
  else if(a==='cmp-set'){ CMP=v.split(',').filter(has).slice(0,3); saveCmp(); setView('compare'); }
  else if(a==='cmp-wa'){ copyText(cmpWa(),T.cmp.copied); }
  else if(a==='svc'){ closeBr(); closeNarrowDrawer(); openSvc(v); }
  else if(a==='svc-cat'){ SVCCAT=v; renderMain(); }
  else if(a==='br'){ openBr(); }
  else if(a==='br-x'){ closeBr(); }
  else if(a==='mic'){ e.preventDefault(); mic(); }
  else if(a==='cmp-add'){ closeNarrowDrawer(); if(!CMP.includes(v)){ CMP.push(v); if(CMP.length>3) CMP=CMP.slice(-3); saveCmp(); } setView('compare'); }
  else if(a==='need'){ NEED=v; store.set('kp-need',v); renderMain(); }
  else if(a==='st-start'){ if(VIEW!=='study'){ VIEW='study'; } startDeck(v); try{history.replaceState(null,'','#study')}catch(e){} }
  else if(a==='st-flip'){ if(RUN){ RUN.flip=!RUN.flip; renderMain(); } }
  else if(a==='st-ok') grade(true);
  else if(a==='st-no') grade(false);
  else if(a==='st-back'){ RUN=null; renderMain(); }
  else if(a==='fmode'){ FMODE=v==='say'?'say':'both'; store.set('kp-flowmode',FMODE); renderMain(); if(typeof DRAWER!=='undefined'&&DRAWER==='call') renderRail(); }
  else if(a==='fsel'){ FSEL=+v||0; store.set('ks-flow',FSEL); renderMain(); }
  else if(a==='fcopy'){ copyText(flowScript(FLOWS[+v]),FT.copied); }
  else if(a==='st-reset'){ if(confirm(T.st.resetQ)){ SP={}; saveSP(); renderMain(); } }
});
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&(e.key==='k'||e.key==='K')){ e.preventDefault(); pal.hidden?openPal():closePal(); return; }
  if(e.key==='Escape'&&!sheet.hidden){ closeSheet(); return; }
  if(e.key==='Escape'&&!brm.hidden){ closeBr(); return; }
  if(VIEW==='study'&&RUN&&RUN.i<RUN.cards.length&&!/INPUT|TEXTAREA|SELECT/.test((document.activeElement||{}).tagName||'')&&pal.hidden){
    if(e.key===' '){ e.preventDefault(); RUN.flip=!RUN.flip; renderMain(); }
    else if(e.key==='1'&&RUN.flip) grade(false);
    else if(e.key==='2'&&RUN.flip) grade(true);
  }
});
/* swipe on study cards (phone) */
let SX=null;
document.addEventListener('touchstart',e=>{ if(e.target.closest('.kp-flash')) SX=e.touches[0].clientX; },{passive:true});
document.addEventListener('touchend',e=>{ if(SX==null) return; const dx=e.changedTouches[0].clientX-SX; SX=null; if(RUN&&RUN.flip&&Math.abs(dx)>70){ grade(EN?dx>0:dx<0); } },{passive:true});

/* ---------------- PWA ---------------- */
let INSTALL=null;
window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); INSTALL=e; });
if('serviceWorker' in navigator&&location.protocol==='https:'){ window.addEventListener('load',()=>{ navigator.serviceWorker.register('sw.js').catch(()=>{}); }); }
window.addEventListener('offline',()=>toast(T.offline));

/* ---------------- start ---------------- */
TODO.push(L('خريطة الـ Cross-sell والـ Upsell في تبويب "بيع أكتر": محتاجين موافقة الكلاينت على الربط بين الخدمات، وهل فيه سعر خاص لو العميل حجز عرضين مع بعض؟','Cross-sell and upsell map in the "Sell more" tab: we need the client to approve the service pairings, and whether there is a special price when a customer books two offers together.'));
applyTheme();
{ const hv=(location.hash||'').slice(1); if(['compare','fit','sell','study'].includes(hv)){ VIEW=hv; } }
renderMain();
if(VIEW==='dash') loadMisses();
setTimeout(()=>{ try{ setHH(); }catch(e){} },50);
})();
