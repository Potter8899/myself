(function(){
var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
var IMAGES=["img/p1.jpg"];

/* ---- tabs ---- */
var tabs=[].slice.call(document.querySelectorAll(".tab")),panels=[].slice.call(document.querySelectorAll(".panel")),ids=tabs.map(function(t){return t.dataset.t});
function show(id){
  if(ids.indexOf(id)<0)id="about";
  tabs.forEach(function(t){var on=t.dataset.t===id;t.setAttribute("aria-selected",on);t.tabIndex=on?0:-1});
  panels.forEach(function(p){p.hidden=p.id!==id});
}
tabs.forEach(function(t,i){
  t.onclick=function(){location.hash=t.dataset.t};
  t.onkeydown=function(e){var n=e.key==="ArrowRight"?1:e.key==="ArrowLeft"?-1:0;if(n){var k=tabs[(i+n+tabs.length)%tabs.length];k.focus();location.hash=k.dataset.t}};
});
addEventListener("hashchange",function(){show(location.hash.slice(1))});
show(location.hash.slice(1));

/* ---- typing ---- */
var txt="นักพัฒนาเว็บ แอป และมอดเกม",el=document.getElementById("type"),n=0;
if(reduce){el.textContent=txt}else{var iv=setInterval(function(){el.textContent=txt.slice(0,++n);if(n>=txt.length)clearInterval(iv)},70)}

/* ---- gallery ---- */
var grid=document.getElementById("grid"),lb=document.getElementById("lb"),lbi=lb.querySelector("img"),hasReal=false;
var hc=document.getElementById("heroCard"),hs=IMAGES[0];
hc.querySelector("img").src=hs;tilt(hc);hc.onclick=function(){lbi.src=hs;lb.classList.add("on")};
function tilt(b){
  b.addEventListener("pointermove",function(e){
    var r=b.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
    b.style.setProperty("--rx",((.5-y)*20)+"deg");b.style.setProperty("--ry",((x-.5)*20)+"deg");
    b.style.setProperty("--mx",x*100+"%");b.style.setProperty("--my",y*100+"%")});
  b.addEventListener("pointerleave",function(){b.style.setProperty("--rx","0deg");b.style.setProperty("--ry","0deg")});
}
function sample(i){var c=[["#ff1f3d","#2de2ff"],["#2de2ff","#111"],["#ff1f3d","#111"]][i];
  return "data:image/svg+xml,"+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='600' height='800'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='"+c[0]+"'/><stop offset='1' stop-color='"+c[1]+"'/></linearGradient></defs><rect width='600' height='800' fill='url(#g)'/><text x='300' y='420' font-size='64' fill='white' text-anchor='middle' font-family='sans-serif'>Potter</text></svg>")}
function addCard(src,isSample){
  var b=document.createElement("button"),im=new Image(),g=document.createElement("i");
  b.className="card";b.type="button";if(isSample)b.dataset.sample="1";
  im.src=src;im.alt="รูปในแกลเลอรี";b.appendChild(im);b.appendChild(g);
  if(isSample){var t=document.createElement("span");t.className="tag";t.textContent="ตัวอย่าง";b.appendChild(t)}
  tilt(b);b.onclick=function(){lbi.src=src;lb.classList.add("on")};
  grid.insertBefore(b,grid.firstChild);
}
function addFiles(files){
  var imgs=[].filter.call(files,function(f){return /^image\//.test(f.type)});
  if(!imgs.length)return;
  if(!hasReal){hasReal=true;[].slice.call(grid.querySelectorAll("[data-sample]")).forEach(function(s){s.remove()})}
  imgs.forEach(function(f){addCard(URL.createObjectURL(f))});
  location.hash="gallery";
}
if(IMAGES.length){hasReal=true;IMAGES.forEach(function(s){addCard(s)})}else{[2,1,0].forEach(function(i){addCard(sample(i),true)})}
lb.onclick=function(){lb.classList.remove("on")};
addEventListener("keydown",function(e){if(e.key==="Escape")lb.classList.remove("on")});
document.getElementById("file").onchange=function(e){addFiles(e.target.files);e.target.value=""};
var drop=document.getElementById("drop");
["dragenter","dragover"].forEach(function(ev){addEventListener(ev,function(e){e.preventDefault();drop.classList.add("on")})});
addEventListener("dragleave",function(e){if(!e.relatedTarget)drop.classList.remove("on")});
addEventListener("drop",function(e){e.preventDefault();drop.classList.remove("on");addFiles(e.dataTransfer.files)});

/* ---- copy ---- */
var cp=document.getElementById("copy"),sn=document.getElementById("snippet");
function done(){cp.textContent="คัดลอกแล้ว";setTimeout(function(){cp.textContent="คัดลอก"},1500)}
function fb(){try{var r=document.createRange();r.selectNodeContents(sn);var s=getSelection();s.removeAllRanges();s.addRange(r);document.execCommand("copy");done()}catch(e){}}
cp.onclick=function(){try{navigator.clipboard.writeText(sn.textContent).then(done,fb)}catch(e){fb()}};

/* ---- ซากุระ/ประกายลอย + ลากเส้นเมาส์ ---- */
var cv=document.getElementById("bg"),cx=cv.getContext("2d"),W,H,P=[],mouse={x:-999,y:-999};
var COL=["255,31,61","45,226,255","255,255,255"];
function size(){var d=devicePixelRatio||1;W=innerWidth;H=innerHeight;cv.width=W*d;cv.height=H*d;cx.setTransform(d,0,0,d,0,0)}
size();addEventListener("resize",size);
addEventListener("pointermove",function(e){mouse.x=e.clientX;mouse.y=e.clientY});
function petal(i){return{x:Math.random()*W,y:Math.random()*H,vx:.3+Math.random()*.6,vy:.5+Math.random()*1,r:3+Math.random()*5,a:Math.random()*6,va:(Math.random()-.5)*.05,c:COL[i%3]}}
for(var i=0;i<(W<600?26:55);i++)P.push(petal(i));
function draw(){
  cx.clearRect(0,0,W,H);
  P.forEach(function(p,i){
    p.x+=p.vx+Math.sin(p.a)*.4;p.y+=p.vy;p.a+=p.va;
    var dx=p.x-mouse.x,dy=p.y-mouse.y,m=Math.hypot(dx,dy);
    if(m<120){p.x+=dx/m*2;p.y+=dy/m*2}
    if(p.y>H+10||p.x>W+10){Object.assign(p,petal(i));p.y=-10;p.x=Math.random()*W}
    cx.save();cx.translate(p.x,p.y);cx.rotate(p.a);
    cx.fillStyle="rgba("+p.c+",.75)";cx.shadowColor="rgba("+p.c+",.9)";cx.shadowBlur=10;
    cx.beginPath();cx.moveTo(0,-p.r*1.3);cx.lineTo(p.r*.5,0);cx.lineTo(0,p.r*1.3);cx.lineTo(-p.r*.5,0);cx.closePath();cx.fill();
    cx.restore();
  });
  if(!reduce)requestAnimationFrame(draw);
}
draw();

/* ---- คลิกแล้วมีประกายระเบิด ---- */
addEventListener("pointerdown",function(e){
  if(reduce)return;
  for(var k=0;k<10;k++){
    var s=document.createElement("div"),a=k/10*6.28,d=40+Math.random()*50;
    s.id="petal";s.style.left=e.clientX+"px";s.style.top=e.clientY+"px";
    s.style.background=COL[k%3]==="255,255,255"?"#fff":"rgb("+COL[k%3]+")";
    s.style.setProperty("--dx",Math.cos(a)*d+"px");s.style.setProperty("--dy",Math.sin(a)*d+"px");
    document.body.appendChild(s);setTimeout(function(x){x.remove()},750,s);
  }
});
})();
