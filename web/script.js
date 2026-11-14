'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches, fine=matchMedia('(pointer: fine)').matches;
const C=window.CONTENT, CFG={sitekey:''};
const ERR={captcha_required:'กรุณายืนยันตัวตนก่อน',captcha_failed:'ยืนยันตัวตนไม่สำเร็จ ลองใหม่',captcha_expired:'การยืนยันหมดอายุ ลองใหม่',captcha_reused:'โทเคนถูกใช้ไปแล้ว ลองใหม่',captcha_unavailable:'ระบบยืนยันตัวตนใช้งานไม่ได้ชั่วคราว ลองใหม่ภายหลัง',rate_limited:'ส่งคำขอถี่เกินไป รอสักครู่',bad_input:'ข้อมูลไม่ถูกต้อง',bad_credentials:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',username_taken:'ชื่อผู้ใช้นี้ถูกใช้แล้ว',unauthorized:'กรุณาเข้าสู่ระบบ',rejected:'คำขอถูกปฏิเสธ'};
const tok={get:()=>{try{return localStorage.getItem('ps_token')||''}catch{return''}},set:v=>{try{v?localStorage.setItem('ps_token',v):localStorage.removeItem('ps_token')}catch{}}};
function toast(t,bad){const d=document.createElement('div');d.className='toast'+(bad?' bad':'');d.textContent=t;$('#toasts').append(d);setTimeout(()=>d.remove(),3800)}
async function api(path,opt={}){
  const h={'Content-Type':'application/json'};if(tok.get())h.Authorization='Bearer '+tok.get();
  let r;try{r=await fetch(path,{...opt,headers:h,body:opt.body?JSON.stringify(opt.body):undefined})}catch{throw{code:'network'}}
  const d=await r.json().catch(()=>({}));if(!r.ok)throw{code:d.error||'error',status:r.status};return d}
const errText=e=>ERR[e.code]||(e.code==='network'?'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้':'เกิดข้อผิดพลาด');

/* ---------- content ---------- */
const safeUrl=u=>/^https:\/\//.test(u)?u:'#';
function el(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
function render(){
  $('#tagline').textContent=C.tagline;$('#heroName').textContent=C.name;$('#intro').textContent=C.intro;$('#about-text').textContent=C.about;$('#year').textContent=new Date().getFullYear();
  C.skills.forEach(s=>{const c=el('div','card reveal');c.append(el('b','',s.name),el('span','',' '+s.level+'%'));const b=el('div','bar'),i=el('i');i.dataset.w=s.level;b.append(i);c.append(b);$('#skillList').append(c)});
  C.projects.forEach(p=>{const c=el('div','card reveal');c.append(el('h3','',p.title),el('p','',p.desc));const t=el('div','chips');p.tags.forEach(x=>t.append(el('span','chip',x)));c.append(t);$('#projectList').append(c)});
  C.interests.forEach(i=>$('#interestList').append(el('span','chip',i)));
  C.socials.forEach(s=>{const a=el('a','card reveal',s.label);a.href=safeUrl(s.url);a.target='_blank';a.rel='noopener noreferrer';$('#socialList').append(a)});
  if(C.contact.email){const a=el('a','card reveal','✉ '+C.contact.email);a.href='mailto:'+C.contact.email;$('#socialList').append(a)}
  $$('.cards').forEach(g=>$$('.reveal',g).forEach((e,i)=>e.style.setProperty('--d',i*.08+'s')));
}
render();
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');$$('.bar i',e.target).forEach(i=>i.style.width=i.dataset.w+'%');io.unobserve(e.target)}}),{threshold:.15});
$$('.reveal').forEach(e=>io.observe(e));
addEventListener('load',()=>setTimeout(()=>$('#loader').classList.add('done'),reduce?0:500));

/* ---------- starfield (หยุดเมื่อแท็บถูกซ่อน) ---------- */
(function(){
  const cv=$('#space'),x=cv.getContext('2d');let W,H,stars=[],mx=0,my=0,raf=0;
  const init=()=>{W=cv.width=innerWidth;H=cv.height=innerHeight;const n=Math.min(220,W*H/9000|0);
    stars=Array.from({length:n},()=>({x:Math.random()*W,y:Math.random()*H,z:Math.random()*.9+.1,t:Math.random()*6,c:Math.random()<.15?'#00D9FF':Math.random()<.1?'#ff6b78':'#fff'}))};
  const draw=()=>{x.clearRect(0,0,W,H);for(const s of stars){s.t+=.02;if(!reduce){s.y+=.05*s.z;if(s.y>H)s.y=0}
    x.globalAlpha=.4+.6*Math.abs(Math.sin(s.t))*s.z;x.fillStyle=s.c;x.fillRect(s.x+mx*s.z*18,s.y+my*s.z*18,s.z*1.8,s.z*1.8)}
    raf=requestAnimationFrame(draw)};
  addEventListener('resize',init);
  addEventListener('pointermove',e=>{mx=e.clientX/W-.5;my=e.clientY/H-.5},{passive:true});
  document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(raf);if(!document.hidden)draw()});
  init();draw();
})();

/* ---------- cursor + magnetic ---------- */
if(fine&&!reduce){
  const c=$('#cursor');let tx=0,ty=0,cx=0,cy=0;
  addEventListener('pointermove',e=>{tx=e.clientX;ty=e.clientY;c.classList.add('on');c.classList.toggle('big',!!e.target.closest('a,button,input'))},{passive:true});
  (function f(){cx+=(tx-cx)*.2;cy+=(ty-cy)*.2;c.style.transform=`translate(${cx}px,${cy}px)`;requestAnimationFrame(f)})();
  $$('.mag').forEach(b=>{b.addEventListener('pointermove',e=>{const r=b.getBoundingClientRect();b.style.transform=`translate(${(e.clientX-r.left-r.width/2)*.25}px,${(e.clientY-r.top-r.height/2)*.35}px)`});
    b.addEventListener('pointerleave',()=>b.style.transform='')});
}

/* ---------- interactive profile card (3D tilt + spring) ---------- */
(function(){
  const card=$('#profileCard'),img=$('#profileImg');
  img.addEventListener('error',()=>{img.hidden=true;$('#fallback').hidden=false});
  const S={rx:0,ry:0,vx:0,vy:0,tx:0,ty:0};let run=false;
  const loop=()=>{S.vx=(S.vx+(S.tx-S.rx)*.12)*.78;S.vy=(S.vy+(S.ty-S.ry)*.12)*.78;S.rx+=S.vx;S.ry+=S.vy;
    card.style.transform=`perspective(900px) rotateX(${S.rx}deg) rotateY(${S.ry}deg) scale(${1+Math.min(.06,Math.abs(S.ry+S.rx)/300)})`;
    if(Math.abs(S.vx)+Math.abs(S.vy)+Math.abs(S.tx-S.rx)+Math.abs(S.ty-S.ry)>.01)requestAnimationFrame(loop);else run=false};
  const go=()=>{if(!run){run=true;requestAnimationFrame(loop)}};
  if(fine&&!reduce){
    card.addEventListener('pointermove',e=>{const r=card.getBoundingClientRect(),px=(e.clientX-r.left)/r.width,py=(e.clientY-r.top)/r.height;
      S.ty=(px-.5)*22;S.tx=(.5-py)*22;card.style.setProperty('--mx',px*100+'%');card.style.setProperty('--my',py*100+'%');card.classList.add('hot');go()});
    card.addEventListener('pointerleave',()=>{S.tx=S.ty=0;card.classList.remove('hot');go()});
  }else{card.addEventListener('pointerenter',()=>card.classList.add('hot'));card.addEventListener('pointerleave',()=>card.classList.remove('hot'))}
  card.addEventListener('click',()=>{if(img.hidden)return;$('#lbImg').src=img.currentSrc||img.src;openModal($('#lightbox'))});
})();

/* ---------- modals (ESC / นอกกรอบ / ปุ่มปิด) ---------- */
let lastFocus=null;
function openModal(m){lastFocus=document.activeElement;m.hidden=false;(m.querySelector('input,button'))?.focus()}
function closeModal(m){m.hidden=true;lastFocus?.focus()}
$$('.modal').forEach(m=>{m.addEventListener('click',e=>{if(e.target===m||e.target.closest('[data-close]'))closeModal(m)})});
addEventListener('keydown',e=>{if(e.key==='Escape'){$$('.modal').forEach(m=>!m.hidden&&closeModal(m));if(!$('#chat').hidden)toggleChat(false)}});

/* ---------- Turnstile ---------- */
function makeCaptcha(box){
  const w=$('.cap-widget',box),st=$('.cap-status',box),txt=$('.txt',st),rb=$('.retry',st);let id=null,token='',tries=0;
  const set=(s,t)=>{st.dataset.s=s;txt.textContent=t;rb.hidden=!['failed','expired','error'].includes(s)};
  const draw=()=>{
    if(!CFG.sitekey){set('error','ยังไม่ได้ตั้งค่าระบบยืนยันตัวตน');return}
    if(!window.turnstile){if(++tries>30){set('error','โหลดระบบยืนยันตัวตนไม่ได้');return}set('verifying','กำลังโหลด…');setTimeout(draw,400);return}
    token='';set('verifying','กำลังตรวจสอบ…');
    if(id!==null){turnstile.reset(id);return}
    id=turnstile.render(w,{sitekey:CFG.sitekey,theme:'dark',
      callback:t=>{token=t;set('verified','ยืนยันแล้ว')},
      'error-callback':()=>{token='';set('failed','ยืนยันไม่สำเร็จ')},
      'expired-callback':()=>{token='';set('expired','หมดอายุ กดลองใหม่')},
      'timeout-callback':()=>{token='';set('expired','หมดเวลา กดลองใหม่')}})};
  rb.onclick=()=>{tries=0;draw()};
  return {token:()=>token,reset:()=>{tries=0;draw()},start:draw};
}
const cfgReady=api('/api/config').then(d=>{CFG.sitekey=d.sitekey||'';
  if(CFG.sitekey){const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;document.head.append(s)}}).catch(()=>{});

/* ---------- auth ---------- */
let authCap=null,mode='login';
function setMode(m){mode=m;$$('[data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===m));
  $$('[data-only=register]').forEach(l=>l.hidden=m!=='register');$('#authTitle').textContent=m==='login'?'เข้าสู่ระบบ':'สมัครสมาชิก';
  $('#authForm').password.autocomplete=m==='login'?'current-password':'new-password'}
$$('[data-tab]').forEach(b=>b.onclick=()=>setMode(b.dataset.tab));
async function showAuth(){setMode('login');openModal($('#authModal'));await cfgReady;if(!authCap){authCap=makeCaptcha($('#authCap'));authCap.start()}}
$('#authForm').addEventListener('submit',async e=>{
  e.preventDefault();const f=e.target,err=$('#authErr');err.textContent='';
  if(!f.checkValidity()){err.textContent=ERR.bad_input;return}
  if(!authCap?.token()){err.textContent=ERR.captcha_required;return}
  $('#authSubmit').disabled=true;
  try{
    const body={username:f.username.value.trim(),password:f.password.value,captcha:authCap.token(),website:f.website.value};
    if(mode==='register')body.email=f.email.value.trim();
    const d=await api('/api/'+mode,{method:'POST',body});
    tok.set(d.token);f.reset();closeModal($('#authModal'));updateAuth(d.username);toast('ยินดีต้อนรับ '+d.username);toggleChat(true)
  }catch(x){err.textContent=errText(x)}finally{$('#authSubmit').disabled=false;authCap.reset()}});
let me=null;
function updateAuth(name){me=name;const b=$('#authBtn');b.textContent=name?'ออกจากระบบ ('+name+')':'เข้าสู่ระบบ'}
$('#authBtn').onclick=()=>{if(me){tok.set('');updateAuth(null);toggleChat(false);$('#msgs').replaceChildren();state.tid=null;toast('ออกจากระบบแล้ว')}else showAuth()};
if(tok.get())api('/api/me').then(d=>updateAuth(d.username)).catch(()=>tok.set(''));

/* ---------- chat ---------- */
const state={tid:null,last:0,open:false,timer:0,status:null};let chatCap=null;
function toggleChat(o){const c=$('#chat');state.open=o;c.hidden=!o;clearInterval(state.timer);if(o){poll();state.timer=setInterval(poll,2500);$('#chatInput').focus()}}
$('#chatFab').onclick=()=>{if(!me){showAuth();return}toggleChat($('#chat').hidden)};
$('#chatClose').onclick=()=>toggleChat(false);
function addMsg(m){const d=el('div','m '+(m.sender==='web'?'me':m.sender==='system'?'sys':''));
  if(m.sender==='admin')d.append(el('small','',m.author));d.append(document.createTextNode(m.body));const box=$('#msgs');box.append(d);box.scrollTop=box.scrollHeight}
function pill(s){const p=$('#ticketPill');const map={open:['on','ตั๋วเปิดอยู่'],claimed:['on','Potter รับเรื่องแล้ว'],closed:['off','ตั๋วปิดแล้ว']}[s]||['off','ยังไม่มีตั๋ว'];p.dataset.s=map[0];p.textContent=map[1]}
async function poll(){
  if(!state.open||document.hidden||!tok.get())return;
  try{const d=await api(`/api/messages?tid=${state.tid||0}&after=${state.last}`);
    const t=d.ticket;if(t&&t.id!==state.tid){state.tid=t.id;state.last=0;$('#msgs').replaceChildren()}
    if(t)d.messages.forEach(m=>{if(m.id>state.last){state.last=m.id;addMsg(m)}});
    state.status=t?t.status:null;pill(state.status);
    const need=!t||t.status==='closed';$('#chatCap').hidden=!need;
    if(need&&!chatCap){await cfgReady;chatCap=makeCaptcha($('#chatCap'));chatCap.start()}
  }catch(x){if(x.status===401){tok.set('');updateAuth(null);toggleChat(false)}}}
$('#chatForm').addEventListener('submit',async e=>{
  e.preventDefault();const i=$('#chatInput'),body=i.value.trim();if(!body)return;
  const need=!state.status||state.status==='closed';
  if(need&&!chatCap?.token()){toast(ERR.captcha_required,true);return}
  try{await api('/api/messages',{method:'POST',body:{body,captcha:need?chatCap.token():''}});i.value='';if(need)chatCap.reset();poll()}
  catch(x){toast(errText(x),true);if(need)chatCap?.reset()}});

/* ---------- bot status ---------- */
async function stat(){try{const d=await api('/api/stats');const p=$('#botStatus');p.dataset.s=d.bot_online?'on':'off';
  p.textContent=`Bot: ${d.bot_online?'Online':'Offline'} · ตั๋ว ${d.tickets} · ผู้ใช้ ${d.users} · ข้อความ ${d.messages}`}catch{}}
stat();setInterval(()=>{if(!document.hidden)stat()},30000);
