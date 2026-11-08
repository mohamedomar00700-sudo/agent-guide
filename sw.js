/* Offline copy of the guide for studying without internet.
   Network first: when online you always get the newest prices; the saved copy is only used offline. */
const CACHE='kb-v3-2';
const CORE=['./','./index.html','./en.html','./offers.html','./offers-en.html','./kb-plus.js','./kb-plus.css','./manifest.webmanifest','./img/icon-192.png','./img/icon-512.png'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET') return;
  const u=new URL(r.url); if(u.origin!==location.origin) return; // Google Sheets / Apps Script always go to the network
  e.respondWith(fetch(r).then(res=>{ if(res&&res.ok){ const copy=res.clone(); caches.open(CACHE).then(c=>c.put(r,copy)); } return res; })
    .catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('./index.html'))));
});
