'use strict';
/* Cortei: servidor (sem dependências externas; precisa só do Node.js 18+) */
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=+process.env.PORT||3000;
const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data');
const PUBLIC_DIR=process.env.PUBLIC_DIR||path.join(__dirname,'public');
const ADMIN_EMAIL=(process.env.ADMIN_EMAIL||'').trim().toLowerCase();
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'';
const CONTACT_EMAIL=process.env.CONTACT_EMAIL||ADMIN_EMAIL||'contato@exemplo.com.br';
const COOKIE_SECURE=process.env.COOKIE_SECURE==='1';
const MAX_BODY=8*1024*1024,SESSION_DAYS=30,CLIENT_ADM='admin@cortei.com.br';
fs.mkdirSync(DATA_DIR,{recursive:true});
const DB_FILE=path.join(DATA_DIR,'db.json');
const DEFAULT_SET={auto:true,autoSub:false,car:15,carV:7,min:10,fee:15,aviso:'',contato:CONTACT_EMAIL};
let db=null;
try{db=JSON.parse(fs.readFileSync(DB_FILE,'utf8'))}catch(e){}
if(!db)db={ver:1,secret:crypto.randomBytes(32).toString('hex'),users:{},camps:[],set:{...DEFAULT_SET},nw:[],tk:[],nt:[],log:[]};
db.set=Object.assign({},DEFAULT_SET,db.set||{});
/* ---------- persistência ---------- */
let saveTimer=null,dirty=false;
function saveNow(){if(!dirty)return;dirty=false;const tmp=DB_FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db));fs.renameSync(tmp,DB_FILE)}
function touch(){db.ver++;dirty=true;if(!saveTimer)saveTimer=setTimeout(()=>{saveTimer=null;try{saveNow()}catch(e){console.error('erro ao salvar',e)}},150)}
function backup(){try{const dir=path.join(DATA_DIR,'backups');fs.mkdirSync(dir,{recursive:true});saveNow();const f=path.join(dir,'db-'+new Date().toISOString().slice(0,10)+'.json');fs.copyFileSync(DB_FILE,f);const all=fs.readdirSync(dir).filter(x=>x.startsWith('db-')).sort();while(all.length>30)fs.unlinkSync(path.join(dir,all.shift()))}catch(e){}}
['SIGINT','SIGTERM'].forEach(s=>process.on(s,()=>{try{saveNow()}catch(e){}process.exit(0)}));
/* ---------- utilidades ---------- */
const BAD=new Set(['__proto__','constructor','prototype']);
const cl=s=>String(s==null?'':s).replace(/[<>]/g,'').trim();
const isObj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const num=x=>{x=+x;return isFinite(x)?x:0};
const r2=x=>Math.round(x*100)/100;
function clone(x){return x===undefined?undefined:JSON.parse(JSON.stringify(x))}
function pick(o,keys){const r={};keys.forEach(k=>{if(o&&o[k]!==undefined)r[k]=o[k]});return r}
function safeAssign(t,s,skip){if(!isObj(s))return t;for(const k of Object.keys(s)){if(BAD.has(k)||(skip&&skip.has(k)))continue;t[k]=s[k]}return t}
const hmac=(s)=>crypto.createHmac('sha256',db.secret).update(s).digest('base64url');
const aliasOf=email=>'u'+hmac('alias:'+email).slice(0,12)+'@u.cortei';
function hashPw(pw,salt){salt=salt||crypto.randomBytes(16).toString('hex');return{s:salt,h:crypto.scryptSync(pw,salt,64).toString('hex'),v:1}}
function checkPw(pw,a){if(!a)return false;try{const h=crypto.scryptSync(pw,a.s,64);return crypto.timingSafeEqual(h,Buffer.from(a.h,'hex'))}catch(e){return false}}
function newUser(o){return Object.assign({email:'',nome:'',pix:'',zap:'',cr:Date.now(),h:{},enr:[],subs:[],wd:[],role:'cortador',cw:0,dp:[]},o)}
/* administrador inicial (pelas variáveis de ambiente) */
function ensureAdmin(){if(!ADMIN_EMAIL||!ADMIN_PASSWORD)return;const u=db.users[ADMIN_EMAIL];if(!u){db.users[ADMIN_EMAIL]=newUser({email:ADMIN_EMAIL,nome:'Administrador',adm:true,auth:hashPw(ADMIN_PASSWORD)});touch();console.log('Administrador criado:',ADMIN_EMAIL)}else if(!u.adm){u.adm=true;touch()}}
ensureAdmin();
/* ---------- sessão ---------- */
function makeToken(u){const p=Buffer.from(JSON.stringify({e:u.email,x:Date.now()+SESSION_DAYS*864e5,v:(u.auth&&u.auth.v)||1})).toString('base64url');return p+'.'+hmac(p)}
function readToken(tok){if(!tok||tok.indexOf('.')<0)return null;const[p,sg]=tok.split('.');const e=hmac(p);if(sg.length!==e.length||!crypto.timingSafeEqual(Buffer.from(sg),Buffer.from(e)))return null;let o;try{o=JSON.parse(Buffer.from(p,'base64url').toString())}catch(x){return null}if(!o||o.x<Date.now())return null;const u=db.users[o.e];if(!u||u.ban)return null;if(((u.auth&&u.auth.v)||1)!==o.v)return null;return u}
function parseCookies(h){const o={};String(h||'').split(';').forEach(c=>{const i=c.indexOf('=');if(i>0)o[c.slice(0,i).trim()]=decodeURIComponent(c.slice(i+1).trim())});return o}
function setCookie(res,req,tok,clear){const secure=COOKIE_SECURE||req.headers['x-forwarded-proto']==='https';res.setHeader('Set-Cookie','cz_sid='+(clear?'':tok)+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+(clear?0:SESSION_DAYS*86400)+(secure?'; Secure':''))}
const viewerOf=req=>readToken(parseCookies(req.headers.cookie).cz_sid);
/* ---------- limite de tentativas ---------- */
const RL=new Map();
function limited(key,max,win){const now=Date.now();let a=(RL.get(key)||[]).filter(t=>now-t<win);a.push(now);RL.set(key,a);if(RL.size>5000)for(const[k,v]of RL)if(!v.length||now-v[v.length-1]>win)RL.delete(k);return a.length>max}
/* ---------- projeção (o que cada pessoa pode ver) ---------- */
function strip(u){const c=Object.assign({},u);delete c.auth;delete c.ph;return c}
function postOk(s){if(!s||s.ov!=='aprovado'||!s.obs)return 0;const o=s.obs,v=num(o.v);const ok=(o.ok!=null&&o.ok!=='')?Math.max(0,Math.min(v,num(o.ok))):Math.round(v*(1-Math.min(1,Math.max(0,num(o.d)/100))));return ok}
function pubSub(s){const o=s.obs?Object.assign({},s.obs):undefined;if(o)delete o.note;return pick(Object.assign({},s,{obs:o}),['cid','url','p','t','at','cd','ov','obs','manual','mot'])}
function view(v){
const adm=!!(v&&v.adm),mine=new Set(db.camps.filter(c=>v&&c.ow===v.email).map(c=>c.s)),users={};
for(const em of Object.keys(db.users)){const u=db.users[em];
if(adm||(v&&em===v.email)){users[em]=strip(u);continue}
if(u.adm)continue;const al=aliasOf(em);
if(!v){if(u.role==='cliente')users[al]={email:al,nome:'',role:'cliente',vf:!!u.vf,enr:[],subs:[],wd:[],foto:u.foto};continue}
const p={email:al,nome:u.nome,role:u.role||'cortador',vf:!!u.vf,cr:u.cr,enr:[],enT:{},ap:{},subs:[],wd:[],ct:[]};
if(u.role==='cliente'){p.foto=u.foto}else{p.enr=u.enr||[];p.enT=u.enT||{};p.ap=u.ap||{};p.subs=(u.subs||[]).filter(s=>v.role==='cliente'?mine.has(s.cid):s.ov==='aprovado').map(pubSub)}
users[al]=p}
const camps=db.camps.filter(c=>adm||(v&&c.ow===v.email)||!['pedido','recusada','revisao'].includes(c.st)).map(c=>{if(adm||(v&&c.ow===v.email))return c;const x=Object.assign({},c);if(x.ow)x.ow=aliasOf(x.ow);delete x.val;return x});
let total=0;for(const u of Object.values(db.users))for(const s of(u.subs||[]))total+=postOk(s);
return{ver:db.ver,session:v?{email:v.email,role:v.role||'cortador',adm:!!v.adm}:null,users,camps,set:db.set,nw:db.nw,
tk:v?(adm?db.tk:db.tk.filter(t=>t.u===v.email)):[],nt:v?db.nt.filter(n=>n.u===v.email):[],log:adm?db.log:[],total}}
/* ---------- escrita (com regras de permissão) ---------- */
const PROT_USER=new Set(['email','role','adm','vf','ban','adj','ap','cr','auth','ph','dp','cw','subs','wd','enr','enT','pg']);
function mergeUserSelf(st,c){ // pessoa comum alterando o próprio cadastro
safeAssign(st,c,PROT_USER);
if(typeof st.nome==='string')st.nome=cl(st.nome).slice(0,80)||'Sem nome';
['pix','pxt','tit','zap','site','ig'].forEach(k=>{if(st[k]!==undefined)st[k]=cl(st[k]).slice(0,200)});
if(c.cw!==undefined&&num(c.cw)<num(st.cw)&&num(c.cw)>=0)st.cw=r2(num(c.cw));
if(Array.isArray(c.pg)){const have=new Set((st.pg||[]).map(x=>x.t));(st.pg=st.pg||[]);c.pg.forEach(x=>{if(isObj(x)&&!have.has(x.t))st.pg.unshift({v:num(x.v),t:num(x.t)||Date.now(),c:cl(x.c)})});st.pg=st.pg.slice(0,500)}
// campanhas em que se inscreveu
if(Array.isArray(c.enr)){st.enr=st.enr||[];st.enT=st.enT||{};c.enr.forEach(id=>{if(typeof id==='string'&&!st.enr.includes(id)&&db.camps.some(x=>x.s===id&&!['pedido','recusada'].includes(x.st))){st.enr.push(id);st.enT[id]=num(c.enT&&c.enT[id])||Date.now()}})}
// posts: só novos; nos existentes só a marca de aviso
if(Array.isArray(c.subs)){st.subs=st.subs||[];const have=new Map(st.subs.map(s=>[s.t,s]));
for(const s of c.subs){if(!isObj(s))continue;const o=have.get(s.t);if(o){if(typeof s.nl==='boolean')o.nl=s.nl;continue}
if(st.subs.length>=500)break;const url=String(s.url||'').trim();if(!/^https?:\/\//i.test(url)||url.length>500)continue;if(!db.camps.some(x=>x.s===s.cid))continue;
let t=num(s.t);if(Math.abs(Date.now()-t)>10*60e3)t=Date.now();while(have.has(t))t++;const n={cid:String(s.cid),url,p:cl(s.p).slice(0,20),acc:cl(s.acc).slice(0,60),t,manual:true};st.subs.push(n);have.set(t,n)}}
// pedidos de saque: só novos, sem status
if(Array.isArray(c.wd)){st.wd=st.wd||[];const have=new Set(st.wd.map(w=>w.t));for(const w of c.wd){if(!isObj(w)||have.has(w.t))continue;const v=r2(num(w.v));if(v<=0)continue;if(st.wd.filter(x=>!x.st).length>=5)break;let t=num(w.t)||Date.now();while(have.has(t))t++;st.wd.push({v,t});have.add(t)}}
}
function mergeUserAdmin(st,c){
safeAssign(st,c,new Set(['email','auth','ph','subs','wd']));
const merge=(a,b)=>{a=a||[];const m=new Map(a.map(x=>[x.t,x]));(b||[]).forEach(x=>{if(isObj(x)&&x.t!==undefined){const o=m.get(x.t);if(o)safeAssign(o,x);else{a.push(x);m.set(x.t,x)}}});return a};
st.subs=merge(st.subs,c.subs);st.wd=merge(st.wd,c.wd)}
function ownerCampaigns(c){return c}
const C_ALWAYS=['h','ds','soc','rq','cont','foto'],C_PENDING=['n','pl','esc','reg','f'];
function applyCamps(v,list){
if(!Array.isArray(list))return;const adm=!!v.adm;
if(adm){const by=new Map(db.camps.map(c=>[c.s,c]));for(const c of list){if(!isObj(c)||!/^[a-z0-9-]{1,60}$/.test(String(c.s)))continue;const o=by.get(c.s);if(o)safeAssign(o,c);else{const n=safeAssign({},c);db.camps.push(n);by.set(n.s,n)}}return}
const by=new Map(db.camps.map(c=>[c.s,c]));
for(const c of list){if(!isObj(c)||!/^[a-z0-9-]{1,60}$/.test(String(c.s)))continue;const o=by.get(c.s);
if(o){if(o.ow!==v.email)continue;const st=o.st;C_ALWAYS.forEach(k=>{if(c[k]!==undefined)o[k]=c[k]});if(st==='pedido')C_PENDING.forEach(k=>{if(c[k]!==undefined)o[k]=c[k]});
if(typeof o.n==='string')o.n=cl(o.n).slice(0,120);
const nv=r2(num(c.val));if(nv>num(o.val)){o.val=nv;o.pool=r2(nv*(1-num(db.set.fee)/100));o.bud=o.pool}}
else{if(db.camps.filter(x=>x.ow===v.email).length>=100)continue;const val=r2(num(c.val));if(!(val>=1))continue;const pool=r2(val*(1-num(db.set.fee)/100));
const n=Object.assign({s:c.s,b:cl(v.nome),pz:'A definir',cpm:0,i:0,hue:num(c.hue)||270,st:'pedido',ow:v.email,val,pool,bud:pool,vg:0,dmin:0,dmax:0,vmin:0},pick(c,C_ALWAYS.concat(C_PENDING)));n.n=cl(n.n).slice(0,120)||'Campanha';db.camps.push(n);by.set(n.s,n)}}}
function applyTickets(v,list){if(!Array.isArray(list))return;const adm=!!v.adm,by=new Map(db.tk.map(t=>[t.id,t]));
for(const t of list){if(!isObj(t)||!t.id||BAD.has(t.id))continue;const o=by.get(t.id);
if(!o){if(!adm&&t.u!==v.email)continue;if(db.tk.length>20000)continue;const n=safeAssign({},t);n.msgs=(Array.isArray(t.msgs)?t.msgs:[]).filter(isObj).map(m=>({f:adm?m.f:'user',t:num(m.t)||Date.now(),txt:cl(m.txt).slice(0,4000)}));if(!adm)n.u=v.email;db.tk.push(n);by.set(n.id,n);continue}
if(!adm&&o.u!==v.email)continue;
const have=new Set(o.msgs.map(m=>m.t+'|'+m.txt));(Array.isArray(t.msgs)?t.msgs:[]).filter(isObj).forEach(m=>{const txt=cl(m.txt).slice(0,4000),k=num(m.t)+'|'+txt;if(!have.has(k)){o.msgs.push({f:adm?(m.f==='admin'?'admin':'user'):'user',t:num(m.t)||Date.now(),txt});have.add(k)}});
if(adm){if(['aberto','respondido','fechado'].includes(t.st))o.st=t.st}else if(['aberto','fechado'].includes(t.st))o.st=t.st;if(t.up)o.up=num(t.up)}}
function applyNotifs(v,list){if(!Array.isArray(list))return;const adm=!!v.adm,by=new Map(db.nt.map(n=>[n.id,n]));
for(const n of list){if(!isObj(n)||!n.id||BAD.has(n.id))continue;const o=by.get(n.id);
if(o){if(!adm&&o.u!==v.email)continue;if(n.r===true)o.r=true;continue}
if(!adm&&n.u!==v.email)continue;const x={id:String(n.id).slice(0,60),u:String(n.u),t:num(n.t)||Date.now(),ic:cl(n.ic).slice(0,8),tx:cl(n.tx).slice(0,400),link:/^#\//.test(String(n.link||''))?String(n.link).slice(0,200):'',r:false};db.nt.unshift(x);by.set(x.id,x)}
if(db.nt.length>5000)db.nt.length=5000}
function applyWrites(v,w){
const adm=!!v.adm;
if(adm){if(isObj(w.cz_set)){const s=w.cz_set;db.set=Object.assign({},DEFAULT_SET,{auto:!!s.auto,autoSub:!!s.autoSub,car:Math.min(60,Math.max(0,Math.round(num(s.car)))),carV:Math.min(60,Math.max(0,Math.round(num(s.carV)))),min:Math.max(0,num(s.min)),fee:Math.min(100,Math.max(0,num(s.fee))),aviso:cl(s.aviso).slice(0,300),contato:cl(s.contato).slice(0,120)||CONTACT_EMAIL})}
if(Array.isArray(w.cz_nw))db.nw=w.cz_nw.filter(isObj).slice(0,100);
if(Array.isArray(w.cz_log))db.log=w.cz_log.filter(isObj).slice(0,100)}
// campanhas e carteira: valida juntos
const beforeCamps=clone(db.camps),beforeUser=clone(db.users[v.email]);
if(w.cz_u&&isObj(w.cz_u)){
if(adm){for(const em of Object.keys(w.cz_u)){const st=db.users[em];if(!st||BAD.has(em))continue;mergeUserAdmin(st,w.cz_u[em])}}
else{const c=w.cz_u[v.email],st=db.users[v.email];if(isObj(c)&&st)mergeUserSelf(st,c)}}
if(w.cz_c)applyCamps(v,w.cz_c);
if(!adm){const after=db.users[v.email],oldV=new Map(beforeCamps.filter(c=>c.ow===v.email).map(c=>[c.s,num(c.val)]));let inc=0;db.camps.filter(c=>c.ow===v.email).forEach(c=>{inc+=num(c.val)-(oldV.get(c.s)||0)});
const spent=num(beforeUser.cw)-num(after.cw);
if(inc>spent+0.005||num(after.cw)>num(beforeUser.cw)+0.005){db.camps=beforeCamps;db.users[v.email]=beforeUser}}
if(w.cz_tk)applyTickets(v,w.cz_tk);
if(w.cz_nt)applyNotifs(v,w.cz_nt);
touch()}
/* ---------- HTTP ---------- */
function send(res,code,obj,extra){const b=JSON.stringify(obj);res.writeHead(code,Object.assign({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},extra||{}));res.end(b)}
function readBody(req){return new Promise((ok,no)=>{let n=0;const a=[];req.on('data',c=>{n+=c.length;if(n>MAX_BODY){no(new Error('grande'));req.destroy();return}a.push(c)});req.on('end',()=>{try{ok(a.length?JSON.parse(Buffer.concat(a).toString()):{})}catch(e){no(new Error('json'))}});req.on('error',no)})}
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.txt':'text/plain'};
function sec(res){res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()')}
async function api(req,res,url){
const ip=(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim(),m=req.method,p=url.pathname;
if(m==='GET'&&p==='/api/ping')return send(res,200,{ok:true,server:true});
if(m==='GET'&&p==='/api/state'){const v=viewerOf(req);if(url.searchParams.get('v')==String(db.ver)&&url.searchParams.get('s')===(v?v.email:''))return send(res,200,{same:true,ver:db.ver});return send(res,200,view(v))}
if(m!=='POST')return send(res,405,{err:'Método não permitido.'});
if(req.headers['x-requested-with']!=='cortei')return send(res,403,{err:'Requisição inválida.'});
let b;try{b=await readBody(req)}catch(e){return send(res,400,{err:'Dados inválidos.'})}
if(p==='/api/register'){if(limited('reg:'+ip,10,3600e3))return send(res,429,{err:'Muitas tentativas. Tente mais tarde.'});
const email=String(b.email||'').trim().toLowerCase(),role=b.role==='cliente'?'cliente':'cortador',nome=cl(b.nome).slice(0,80),zap=cl(b.zap),zd=zap.replace(/\D/g,''),senha=String(b.senha||'');
if(!EMAIL_RE.test(email)||email.length>120)return send(res,400,{err:'Informe um e-mail válido.'});
if(db.users[email]||email===CLIENT_ADM||email===ADMIN_EMAIL)return send(res,400,{err:'Esse e-mail já tem conta ou não está disponível.'});
if(nome.length<2)return send(res,400,{err:'Informe seu nome.'});
if(zd.length<10||zd.length>13)return send(res,400,{err:'Informe um WhatsApp válido, com DDD.'});
if(senha.length<6||senha.length>200)return send(res,400,{err:'Use ao menos 6 caracteres.'});
const u=newUser({email,nome,zap,role,pix:role==='cortador'?cl(b.pix).slice(0,200):'',auth:hashPw(senha)});db.users[email]=u;touch();setCookie(res,req,makeToken(u));return send(res,200,view(u))}
if(p==='/api/login'){const email=String(b.email||'').trim().toLowerCase();if(limited('ip:'+ip,30,600e3)||limited('em:'+email,8,900e3))return send(res,429,{err:'Muitas tentativas. Aguarde alguns minutos.'});
const u=db.users[email];if(!u||!checkPw(String(b.senha||''),u.auth))return send(res,401,{err:'E-mail ou senha incorretos.'});
if(u.ban)return send(res,403,{err:'Conta suspensa. Fale com o suporte.'});
const role=b.role==='cliente'?'cliente':'cortador';if(!u.adm&&(u.role||'cortador')!==role)return send(res,400,{err:'Essa conta é de '+((u.role||'cortador')==='cliente'?'cliente':'cortador')+'. Escolha a opção certa acima.'});
setCookie(res,req,makeToken(u));return send(res,200,view(u))}
if(p==='/api/logout'){setCookie(res,req,'',true);return send(res,200,view(null))}
const v=viewerOf(req);if(!v)return send(res,401,{err:'Sessão expirada. Entre novamente.'});
if(p==='/api/state'){if(!isObj(b.writes))return send(res,400,{err:'Dados inválidos.'});try{applyWrites(v,b.writes)}catch(e){console.error('erro ao aplicar',e)}return send(res,200,view(db.users[v.email]||null))}
if(p==='/api/me/delete'){if(v.adm)return send(res,400,{err:'A conta de administrador não pode ser excluída aqui.'});delete db.users[v.email];touch();setCookie(res,req,'',true);return send(res,200,view(null))}
if(p==='/api/me/password'){const nova=String(b.nova||'');if(!checkPw(String(b.atual||''),v.auth))return send(res,400,{err:'Senha atual incorreta.'});if(nova.length<6)return send(res,400,{err:'Use ao menos 6 caracteres.'});v.auth=hashPw(nova);v.auth.v=((v.auth&&v.auth.v)||1)+1;touch();setCookie(res,req,makeToken(v));return send(res,200,{ok:true})}
if(!v.adm)return send(res,403,{err:'Sem permissão.'});
if(p==='/api/admin/delete-user'){const e=String(b.email||'').trim().toLowerCase(),u=db.users[e];if(!u||u.adm)return send(res,400,{err:'Usuário não encontrado ou protegido.'});delete db.users[e];touch();return send(res,200,view(v))}
if(p==='/api/admin/reset-password'){const e=String(b.email||'').trim().toLowerCase(),u=db.users[e],s=String(b.senha||'');if(!u)return send(res,400,{err:'Usuário não encontrado.'});if(s.length<6)return send(res,400,{err:'Use ao menos 6 caracteres.'});const nv=((u.auth&&u.auth.v)||1)+1;u.auth=hashPw(s);u.auth.v=nv;touch();return send(res,200,{ok:true})}
return send(res,404,{err:'Não encontrado.'})}
const server=http.createServer(async(req,res)=>{sec(res);let url;try{url=new URL(req.url,'http://x')}catch(e){res.writeHead(400);return res.end()}
try{if(url.pathname.startsWith('/api/'))return await api(req,res,url);
if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end()}
let f=path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[\/\\])+/,'');if(f==='/'||f==='\\'||f==='.')f='/index.html';
const full=path.join(PUBLIC_DIR,f);if(!full.startsWith(PUBLIC_DIR)){res.writeHead(403);return res.end()}
fs.readFile(full,(e,d)=>{if(e){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return res.end('Não encontrado')}const ext=path.extname(full).toLowerCase();res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream','Cache-Control':ext==='.html'?'no-cache':'public, max-age=3600'});res.end(req.method==='HEAD'?undefined:d)})}
catch(e){console.error(e);if(!res.headersSent){res.writeHead(500,{'Content-Type':'application/json'});res.end('{"err":"Erro interno."}')}}});
if(require.main===module){server.listen(PORT,()=>console.log('Cortei no ar em http://localhost:'+PORT));backup();setInterval(backup,6*3600e3)}
module.exports={server,db:()=>db,view,applyWrites,aliasOf};
