const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const D={base:'',cam:'',snap:'',sens:'',bat:'',to:2000,th:20,ks:'1',mode:'real'};
let cfg=Object.assign({},D);
try{Object.assign(cfg,JSON.parse(localStorage.getItem('bee.cfg')||'{}'))}catch(e){}
const save=()=>{try{localStorage.setItem('bee.cfg',JSON.stringify(cfg))}catch(e){}};
const S={online:null,cur:'S',last:'None',locked:false,cam:'idle',dist:null,distOk:null,hist:[],bat:null,batOk:null,mis:'idle',acc:0,t0:0,mlog:[],paused:false,buf:[],lines:[]};
const NAMES={F:'Forward',B:'Backward',L:'Left',R:'Right',S:'Stopped'};
const hhmmss=d=>d.toTimeString().slice(0,8);
const demo=()=>cfg.mode==='demo';

// ---- Event terminal ----
function log(type,msg){
 const col={ok:'var(--ok)',err:'var(--er)',warn:'var(--wr)',cmd:'var(--cy)',demo:'var(--ye)',info:'var(--tx)'}[type]||'var(--tx)';
 const row=`<div><span class="t">[${hhmmss(new Date())}]</span> <span style="color:${col}">${type.toUpperCase()}</span> ${msg.replace(/</g,'&lt;')}</div>`;
 S.lines.push(row);if(S.lines.length>500)S.lines.shift();
 if(!S.paused){const t=$('#term');t.insertAdjacentHTML('beforeend',row);while(t.children.length>500)t.firstChild.remove();t.scrollTop=t.scrollHeight}
}
$('#tpause').onclick=e=>{S.paused=!S.paused;e.target.textContent=S.paused?'Resume':'Pause';e.target.classList.toggle('act',S.paused);if(!S.paused){$('#term').innerHTML=S.lines.join('');$('#term').scrollTop=1e9}};
$('#tclear').onclick=()=>{S.lines=[];$('#term').innerHTML=''};

// ---- Hardware command layer (never reports success unless the rover answered) ----
const mixed=u=>location.protocol==='https:'&&/^http:/i.test(u);
async function req(url,ms){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),ms||cfg.to);
 try{return await fetch(url,{cache:'no-store',signal:c.signal})}finally{clearTimeout(t)}
}
function setOnline(v,why){
 if(S.online!==v){S.online=v;log(v?'ok':'err',v?'Rover reachable':'Rover unreachable'+(why?': '+why:''))}
 render();
}
async function send(m,quiet){
 if(demo()){S.last=m+' (demo, not sent)';log('demo','Command '+m+' not sent (demo mode)');render();return false}
 if(!cfg.base){log('err','No rover address set. Open Settings.');return false}
 try{
  const r=await req(cfg.base.replace(/\/$/,'')+'/cmd?m='+m);
  if(!r.ok)throw new Error('HTTP '+r.status);
  S.last=m+' – '+NAMES[m]+' (confirmed '+hhmmss(new Date())+')';
  if(!quiet)log('cmd','/cmd?m='+m+' acknowledged by rover');
  setOnline(true);return true;
 }catch(e){
  const why=mixed(cfg.base)?'HTTPS page cannot call HTTP rover (mixed content). See README.':(e.name==='AbortError'?'timeout':e.message);
  S.last=m+' – FAILED';log('err','/cmd?m='+m+' failed: '+why);setOnline(false,why);return false;
 }
}
function press(m){
 if(S.locked&&m!=='S')return;
 if(m===S.cur&&m!=='S')return;
 S.cur=m;send(m);render();
}
function release(){if(S.cur!=='S'){S.cur='S';send('S')}}
async function emergency(){
 S.locked=true;S.cur='S';log('warn','EMERGENCY STOP');render();
 for(let i=0;i<3;i++){if(await send('S',true)||demo())break}
 if(S.mis==='active')mission('pause','Emergency stop');
}
$('#estop').onclick=emergency;
$('#estop').addEventListener('pointerdown',e=>{e.preventDefault();emergency()});
$$('.pad .btn').forEach(b=>{
 const m=b.dataset.m;
 b.addEventListener('pointerdown',e=>{e.preventDefault();m==='S'?(S.cur='S',send('S'),render()):press(m)});
 ['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,()=>{if(m!=='S')release()}));
 b.addEventListener('contextmenu',e=>e.preventDefault());
});
const KM={w:'F',arrowup:'F',s:'B',arrowdown:'B',a:'L',arrowleft:'L',d:'R',arrowright:'R'};const held=[];
addEventListener('keydown',e=>{
 if(cfg.ks!=='1'||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
 const k=e.key.toLowerCase();
 if(k===' '){e.preventDefault();S.cur='S';send('S');return}
 if(!KM[k]||e.repeat)return;e.preventDefault();
 if(!held.includes(k))held.push(k);press(KM[k]);
});
addEventListener('keyup',e=>{
 const k=e.key.toLowerCase();const i=held.indexOf(k);if(i<0)return;held.splice(i,1);
 held.length?press(KM[held[held.length-1]]):release();
});
// safety: stop whenever focus or visibility is lost
addEventListener('blur',()=>{held.length=0;release()});
document.addEventListener('visibilitychange',()=>{if(document.hidden){held.length=0;release()}});
addEventListener('pagehide',release);

// ---- Connection ----
async function probe(){
 if(demo()||!cfg.base||S.cur!=='S')return;
 $('#cdot').className='dot busy';
 try{const r=await req(cfg.base.replace(/\/$/,'')+'/cmd?m=S');if(!r.ok)throw 0;setOnline(true)}
 catch(e){setOnline(false,mixed(cfg.base)?'mixed content blocked':'no response')}
}
$('#save-ip').onclick=()=>{cfg.base=$('#ip').value.trim();save();log('info','Rover address set to '+(cfg.base||'(empty)'));probe()};
setInterval(probe,5000);

// ---- Camera ----
function camLoad(){
 const img=$('#camimg');img.removeAttribute('src');
 if(!cfg.cam||demo()){S.cam=demo()?'demo':'none';$('#cam').classList.remove('live');return render()}
 S.cam='loading';render();
 img.onload=()=>{S.cam='ok';$('#cam').classList.add('live');log('ok','Camera stream connected');render()};
 img.onerror=()=>{S.cam='err';$('#cam').classList.remove('live');log('err','Camera stream failed'+(mixed(cfg.cam)?' (mixed content blocked)':''));render()};
 img.src=cfg.cam+(cfg.cam.includes('?')?'&':'?')+'t='+Date.now();
}
$('#camReload').onclick=camLoad;
$('#camFull').onclick=()=>{const c=$('#cam');(document.fullscreenElement?document.exitFullscreen():c.requestFullscreen?.())};
$('#camSnap').onclick=()=>{const u=cfg.snap||(cfg.cam?new URL('/capture',cfg.cam).href:'');u?window.open(u,'_blank','noopener'):log('warn','No snapshot URL available')};

// ---- Sensors & battery (only with a configured endpoint that really answers) ----
const num=async r=>{const t=(await r.text()).trim();try{const j=JSON.parse(t);return typeof j==='number'?j:parseFloat(j.cm??j.distance??j.v??j.voltage)}catch(e){return parseFloat(t)}};
async function poll(){
 if(demo())return;
 if(cfg.base&&cfg.sens){try{const r=await req(cfg.base.replace(/\/$/,'')+cfg.sens);if(!r.ok)throw 0;const v=await num(r);if(isNaN(v))throw 0;
  const was=S.dist!==null&&S.dist<cfg.th;S.dist=v;S.distOk=true;S.hist.push(v);if(S.hist.length>120)S.hist.shift();
  if(v<cfg.th&&!was)log('warn','Obstacle at '+v.toFixed(0)+' cm')}catch(e){if(S.distOk!==false)log('err','Distance sensor not responding');S.distOk=false;S.dist=null}}
 if(cfg.base&&cfg.bat){try{const r=await req(cfg.base.replace(/\/$/,'')+cfg.bat);if(!r.ok)throw 0;const v=await num(r);if(isNaN(v))throw 0;
  const low=S.bat!==null&&S.bat<6.6;S.bat=v;S.batOk=true;if(v<6.6&&!low)log('warn','Low battery: '+v.toFixed(2)+' V')}catch(e){if(S.batOk!==false)log('err','Battery monitor not responding');S.batOk=false;S.bat=null}}
 render();
}
setInterval(poll,1000);
function chart(){
 const c=$('#chart'),w=c.width=c.clientWidth*devicePixelRatio,h=c.height=200*devicePixelRatio,x=c.getContext('2d');
 x.clearRect(0,0,w,h);x.strokeStyle='rgba(0,229,255,.15)';for(let i=1;i<4;i++){x.beginPath();x.moveTo(0,h*i/4);x.lineTo(w,h*i/4);x.stroke()}
 if(S.hist.length<2){x.fillStyle='#7F9AA6';x.font=`${14*devicePixelRatio}px Inter`;x.fillText('No readings. Sensor firmware not connected.',16,h/2);return}
 const mx=Math.max(100,...S.hist);x.strokeStyle='#00E5FF';x.lineWidth=2*devicePixelRatio;x.beginPath();
 S.hist.forEach((v,i)=>{const px=i/(S.hist.length-1)*w,py=h-v/mx*h;i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke();
 x.strokeStyle='#FFD700';x.setLineDash([6,6]);x.beginPath();x.moveTo(0,h-cfg.th/mx*h);x.lineTo(w,h-cfg.th/mx*h);x.stroke();x.setLineDash([]);
}

// ---- Mission ----
const elapsed=()=>S.acc+(S.mis==='active'?Date.now()-S.t0:0);
function mission(a,note){
 const now=Date.now();
 if(a==='start'&&S.mis!=='active'){if(S.mis==='idle'||S.mis==='stopped')S.acc=0;S.t0=now;S.mis='active'}
 else if(a==='pause'&&S.mis==='active'){S.acc+=now-S.t0;S.mis='paused'}
 else if(a==='stop'&&S.mis!=='idle'&&S.mis!=='stopped'){if(S.mis==='active')S.acc+=now-S.t0;S.mis='stopped';S.cur='S';send('S')}
 else return;
 S.mlog.unshift(`${hhmmss(new Date())} Mission ${S.mis}${note?' ('+note+')':''} at ${fmt(elapsed())}`);log('info','Mission '+S.mis);render();
}
const fmt=ms=>{const s=Math.floor(ms/1e3);return[s/3600|0,s/60%60|0,s%60].map(n=>String(n).padStart(2,'0')).join(':')};
$('#m-start').onclick=()=>mission('start');$('#m-pause').onclick=()=>mission('pause');$('#m-stop').onclick=()=>mission('stop');

// ---- Rendering ----
const cls=(ok,er)=>ok?'ok':er?'er':'na';
function card(t,v,s,c){return `<div class="panel"><h3>${t}</h3><div class="val ${c||''}">${v}</div><div class="sub">${s||''}</div></div>`}
function render(){
 $('#banner').classList.toggle('show',demo());
 $$('#modeSeg button').forEach(b=>b.classList.toggle('on',b.dataset.mode===cfg.mode));
 const st=demo()?['wr','Demo mode']:S.online===true?['ok','Rover online']:S.online===false?['er','Rover offline']:['','Not checked'];
 ['h','c'].forEach(p=>$('#'+p+'dot').className='dot '+st[0]);$('#htxt').textContent=st[1];$('#ctxt').textContent=st[1];
 $('#cdet').textContent=demo()?'Switch to Real hardware to connect.':cfg.base?(mixed(cfg.base)?'Blocked: this page is HTTPS and the rover is HTTP. See README.':cfg.base):'Enter the rover address.';
 $('#lastc').textContent=S.last;
 $('#lockNote').innerHTML=S.locked?'Controls locked after emergency stop. <a href="#" id="unlock" style="color:var(--cy)">Unlock controls</a>':'';
 $$('.pad .btn:not(.s)').forEach(b=>b.setAttribute('aria-disabled',S.locked));
 const u=$('#unlock');if(u)u.onclick=e=>{e.preventDefault();S.locked=false;log('info','Controls unlocked');render()};
 const verified=[S.online===true,S.cam==='ok',S.distOk===true,S.batOk===true].filter(Boolean).length;
 const dv=S.dist!==null,obs=dv&&S.dist<cfg.th;
 $('#dash').innerHTML=
  card('Rover',st[1],demo()?'Simulated session':'Checked with /cmd?m=S',{ok:'ok',er:'er'}[st[0]]||(demo()?'wr':'na'))+
  card('Wi-Fi link',demo()?'Demo':S.online===true?'Reachable':S.online===false?'Unreachable':'Unknown','Browsers cannot read signal strength',cls(S.online===true,S.online===false))+
  card('Movement',NAMES[S.cur],S.locked?'Emergency lock on':'Mode',S.locked?'er':'')+
  card('Mission timer',fmt(elapsed()),S.mis)+
  card('Camera',{ok:'Streaming',err:'Failed',loading:'Connecting',none:'Not configured',demo:'Demo',idle:'Not configured'}[S.cam],'ESP32-CAM',cls(S.cam==='ok',S.cam==='err'))+
  card('Obstacle',dv?(obs?'Obstacle':'Clear'):'Unavailable',dv?S.dist.toFixed(0)+' cm':'Distance firmware not connected',dv?(obs?'er':'ok'):'na')+
  card('Battery',S.bat!==null?pct()+'%':'Unavailable',S.bat!==null?S.bat.toFixed(2)+' V':'Monitoring hardware not connected',S.bat!==null?(pct()<20?'er':'ok'):'na')+
  card('Last command',S.last,'')+
  card('System health',verified+' / 4 verified','Rover, camera, sensor, battery',verified?'ok':'na');
 $('#camdot').className='dot '+({ok:'ok',err:'er',loading:'busy',demo:'wr'}[S.cam]||'');
 $('#camtxt').textContent={ok:'Connected',err:'Connection failed',loading:'Connecting',demo:'Demo mode (no stream)'}[S.cam]||'Not configured';
 $('#camph').textContent=S.cam==='err'?'Could not load the stream. Check the URL, power, and HTTPS/HTTP restrictions.':demo()?'Camera disabled in demo mode.':'Set the ESP32-CAM stream URL in Settings.';
 $('#dist').textContent=dv?S.dist.toFixed(0)+' cm':'Unavailable';
 $('#distsub').textContent=dv?'Live':'Firmware has no distance endpoint configured';
 $('#obs').textContent=dv?(obs?'OBSTACLE':'Clear'):'Unavailable';$('#obs').className='val '+(dv?(obs?'er':'ok'):'na');$('#thv').textContent=cfg.th;
 $('#sstat').textContent=S.distOk===true?'Connected':S.distOk===false?'Not responding':'Not configured';
 $('#ssub').textContent=cfg.sens?cfg.base+cfg.sens:'Set endpoint in Settings';
 $('#bv').textContent=S.bat!==null?S.bat.toFixed(2)+' V':'Unavailable';
 $('#bp').textContent=S.bat!==null?pct()+'%':'Unavailable';$('#bbar').style.width=S.bat!==null?pct()+'%':'0';
 $('#bs').textContent=S.bat===null?'Unavailable':pct()<20?'LOW BATTERY':'Normal';$('#bs').className='val '+(S.bat===null?'na':pct()<20?'er':'ok');
 $('#mt').textContent=fmt(elapsed());
 $('#ms').textContent={idle:'No mission',active:'Mission active',paused:'Mission paused',stopped:'Mission ended'}[S.mis];
 $('#mh').innerHTML=S.mlog.length?S.mlog.map(l=>`<li>${l}</li>`).join(''):'<li class="na">No activity yet.</li>';
 chart();
}
const pct=()=>Math.max(0,Math.min(100,Math.round((S.bat-6)/2.4*100)));
setInterval(()=>{if(S.mis==='active')render()},1000);

// ---- Settings & diagnostics ----
const F={base:'#s-base',cam:'#s-cam',snap:'#s-snap',sens:'#s-sens',bat:'#s-bat',to:'#s-to',th:'#s-th',ks:'#s-ks'};
function fill(){for(const k in F)$(F[k]).value=cfg[k];$('#ip').value=cfg.base}
$('#s-save').onclick=()=>{for(const k in F){const v=$(F[k]).value.trim();cfg[k]=(k==='to'||k==='th')?Number(v)||D[k]:v}save();$('#ip').value=cfg.base;log('info','Settings saved');camLoad();probe();render()};
$('#s-diag').onclick=async()=>{
 const out=[],add=(ok,t)=>out.push(`<li class="${ok===null?'wr':ok?'ok':'er'}">${ok===null?'⚠':ok?'✔':'✖'} ${t}</li>`);
 add(null,'Page protocol: '+location.protocol+(mixed(cfg.base)?' (will block HTTP rover)':''));
 if(demo())add(null,'Demo mode: no hardware tested');
 else{
  if(!cfg.base)add(false,'No rover address');
  else{try{const r=await req(cfg.base.replace(/\/$/,'')+'/cmd?m=S');add(r.ok,'Rover /cmd?m=S: HTTP '+r.status)}catch(e){add(false,'Rover unreachable ('+(mixed(cfg.base)?'mixed content':e.name==='AbortError'?'timeout':'blocked or CORS missing')+')')}}
  add(S.cam==='ok'?true:cfg.cam?false:null,'Camera: '+(S.cam==='ok'?'streaming':cfg.cam?'not streaming':'not configured'));
  add(S.distOk===true?true:cfg.sens?false:null,'Distance sensor: '+(S.distOk?'reading':cfg.sens?'no data':'not configured'));
  add(S.batOk===true?true:cfg.bat?false:null,'Battery monitor: '+(S.batOk?'reading':cfg.bat?'no data':'not connected'));
 }
 $('#diag').innerHTML=out.join('');
};

// ---- Navigation & boot ----
const V=[['dashboard','◉','Dashboard'],['control','✥','Control'],['camera','▣','Camera'],['sensors','∿','Sensors'],['battery','▮','Battery'],['mission','⚑','Mission'],['terminal','>_','Terminal'],['settings','⚙','Settings']];
$('#nav').innerHTML='<div class="brand"><b>BEE</b><span>RoboRescue<small>Disaster Response</small></span></div>'+V.map(v=>`<button data-v="${v[0]}"><span>${v[1]}</span>${v[2]}</button>`).join('');
function show(v){if(!V.some(x=>x[0]===v))v='dashboard';$$('.view').forEach(e=>e.classList.toggle('on',e.id==='v-'+v));$$('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));if(v!=='control')release();render()}
$$('#nav button').forEach(b=>b.onclick=()=>{location.hash=b.dataset.v});
addEventListener('hashchange',()=>show(location.hash.slice(1)));
$$('#modeSeg button').forEach(b=>b.onclick=()=>{release();cfg.mode=b.dataset.mode;save();S.online=null;log('info','Mode: '+cfg.mode.toUpperCase());camLoad();probe();render()});
addEventListener('resize',chart);
fill();show(location.hash.slice(1));camLoad();probe();log('info','BEE RoboRescue ready ('+cfg.mode.toUpperCase()+' mode)');
