process.env.DATA_DIR='/tmp/czdata';process.env.ADMIN_EMAIL='dono@meusite.com';process.env.ADMIN_PASSWORD='SenhaForte123';process.env.PORT='0';
const {server,db}=require('./server.js');
let base;const log=(...a)=>console.log(...a);let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('  FALHOU:',m)}return c};
class J{constructor(){this.c=''}async call(m,p,b){const r=await fetch(base+p,{method:m,headers:{'Content-Type':'application/json','X-Requested-With':'cortei',cookie:this.c},body:b?JSON.stringify(b):undefined});const sc=r.headers.get('set-cookie');if(sc){const v=sc.split(';')[0];this.c=v.endsWith('=')?'':v}let j={};try{j=await r.json()}catch(e){}return{s:r.status,j}}}
(async()=>{
await new Promise(r=>server.listen(0,r));base='http://127.0.0.1:'+server.address().port;
const V=new J(),A=new J(),C1=new J(),C2=new J(),B=new J();
let r=await V.call('GET','/api/ping');log('1) ping:',r.j.ok);
r=await A.call('POST','/api/login',{email:'dono@meusite.com',senha:'errada'});log('2) senha errada do admin:',r.s,r.j.err);
r=await A.call('POST','/api/login',{email:'dono@meusite.com',senha:'SenhaForte123'});log('   admin entra:',r.s,r.j.session&&r.j.session.adm);
// cadastro
r=await C1.call('POST','/api/register',{email:'ana@x.com',nome:'Ana',zap:'11 98888-7777',senha:'123456',role:'cortador',pix:'ana@pix'});log('3) cadastro cortadora:',r.s,r.j.session&&r.j.session.role);
r=await C1.call('POST','/api/register',{email:'ana@x.com',nome:'Ana',zap:'11 98888-7777',senha:'123456',role:'cortador'});log('   e-mail repetido bloqueado:',r.s===400);
r=await C2.call('POST','/api/register',{email:'bia@x.com',nome:'Bia',zap:'11 97777-6666',senha:'123456',role:'cortador',pix:'bia@pix'});
r=await B.call('POST','/api/register',{email:'marca@x.com',nome:'Marca X',zap:'11 96666-5555',senha:'123456',role:'cliente'});log('   marca criada:',r.j.session.role);
r=await V.call('POST','/api/register',{email:'admin@cortei.com.br',nome:'Fake',zap:'11 96666-5555',senha:'123456'});log('   e-mail admin do site não pode ser registrado:',r.s===400);
r=await V.call('POST','/api/login',{email:'ana@x.com',senha:'123456',role:'cliente'});log('   papel errado no login:',r.j.err);
// visibilidade
r=await V.call('GET','/api/state');log('4) visitante vê usuários:',Object.keys(r.j.users).length,'| só marcas, sem nome:',Object.values(r.j.users).every(u=>u.role==='cliente'&&u.nome===''),'| sessão:',r.j.session);
r=await C1.call('GET','/api/state');const us=Object.values(r.j.users);log('   Ana vê:',us.length,'registros | só ela tem PIX:',us.filter(u=>u.pix).length===1,'| vê e-mail real de outros:',us.some(u=>u.email==='bia@x.com'||u.email==='marca@x.com'),'| campos sensíveis de outros ausentes:',us.filter(u=>u.email!=='ana@x.com').every(u=>!u.pix&&!u.zap&&!(u.wd||[]).length));
r=await A.call('GET','/api/state');log('   admin vê todos com e-mail real:',Object.keys(r.j.users).sort().join(','),'| sem hash de senha:',!JSON.stringify(r.j).includes('"auth"')&&!JSON.stringify(r.j).includes('scrypt'));
// admin cria campanha pública
const camp={s:'maratona',n:'Maratona Fit',b:'Fit Brasil',t:'cpm',pz:'R$ 2,00 por mil visualizações',cpm:2,bud:1000,pool:1000,hue:200,pl:['TikTok','Instagram'],esc:'geral',reg:[],f:'31 de dezembro',st:'ativa',h:'#fit',ds:'x',soc:{},rq:[],cont:[],pr:[],vg:0,dmin:0,dmax:0,vmin:0,i:0,p1:''};
r=await A.call('POST','/api/state',{writes:{cz_c:[camp]}});log('5) admin cria campanha:',r.j.camps.length);
r=await C1.call('POST','/api/state',{writes:{cz_c:[Object.assign({},camp,{cpm:99,bud:99999,st:'ativa',n:'HACK'})]}});log('   cortadora tenta alterar campanha da plataforma:',r.j.camps[0].cpm===2&&r.j.camps[0].n==='Maratona Fit'?'bloqueado':'FALHA');
// cortadora se inscreve e envia post
let st=(await C1.call('GET','/api/state')).j,me=st.users['ana@x.com'];
me.enr=['maratona'];me.enT={maratona:Date.now()};me.subs=[{cid:'maratona',url:'https://www.tiktok.com/@ana/video/1',p:'Tiktok',acc:'a1',t:Date.now()}];
r=await C1.call('POST','/api/state',{writes:{cz_u:{'ana@x.com':me}}});const me2=r.j.users['ana@x.com'];log('6) inscrição + post:',me2.enr,me2.subs.length,'| post marcado manual (sem métricas simuladas):',me2.subs[0].manual===true);
// fraude: cortadora tenta aprovar o próprio post, dar saldo e virar admin
const evil=JSON.parse(JSON.stringify(me2));evil.subs[0].ov='aprovado';evil.subs[0].obs={v:9999999,ok:9999999};evil.subs[0].at=1;evil.adj=1e6;evil.adm=true;evil.vf=true;evil.role='cliente';evil.cw=1e6;evil.ban=false;evil.wd=[{v:50,t:Date.now(),st:'pago'}];
r=await C1.call('POST','/api/state',{writes:{cz_u:{'ana@x.com':evil}}});const m3=r.j.users['ana@x.com'];
log('7) fraude da cortadora:','ov:',m3.subs[0].ov,'| obs:',m3.subs[0].obs,'| adj:',m3.adj,'| adm:',m3.adm,'| vf:',m3.vf,'| role:',m3.role,'| cw:',m3.cw,'| saque já "pago":',(m3.wd[0]||{}).st);
r=await C2.call('POST','/api/state',{writes:{cz_u:{'ana@x.com':Object.assign({},evil,{nome:'INVADIDA'})}}});r=await A.call('GET','/api/state');log('   Bia tenta alterar a Ana:',r.j.users['ana@x.com'].nome==='Ana'?'bloqueado':'FALHA');
// pedido de saque
me=(await C1.call('GET','/api/state')).j.users['ana@x.com'];me.wd=[{v:30,t:Date.now()}];r=await C1.call('POST','/api/state',{writes:{cz_u:{'ana@x.com':me}}});log('   pedido de saque criado:',r.j.users['ana@x.com'].wd.length,'sem status:',!r.j.users['ana@x.com'].wd[0].st);
// admin aprova com números reais
st=(await A.call('GET','/api/state')).j;const ana=st.users['ana@x.com'];const sp=ana.subs[0];sp.ov='aprovado';sp.at=Date.now();sp.cd=15;sp.obs={v:48200,ok:45790,lk:3100,cm:142,sh:260,tm:9,d:5,note:'interno'};
r=await A.call('POST','/api/state',{writes:{cz_u:{'ana@x.com':{subs:[sp],email:'ana@x.com'}}}});
r=await C1.call('GET','/api/state');log('8) admin aprovou: ana vê ov =',r.j.users['ana@x.com'].subs[0].ov,'| total do contador:',r.j.total);
r=await V.call('GET','/api/state');log('   visitante vê o mesmo contador:',r.j.total);
r=await C2.call('GET','/api/state');const ana2=Object.values(r.j.users).find(u=>u.nome==='Ana');log('   Bia vê o post aprovado da Ana:',ana2.subs.length,'| sem anotação interna:',!JSON.stringify(ana2).includes('interno'),'| sem pix:',!ana2.pix);
// marca: carteira e campanha
me=(await B.call('GET','/api/state')).j.users['marca@x.com'];me.cw=5000;
r=await B.call('POST','/api/state',{writes:{cz_u:{'marca@x.com':me}}});log('9) marca tenta se dar saldo:',r.j.users['marca@x.com'].cw===0?'bloqueado':'FALHA');
st=(await A.call('GET','/api/state')).j;const mu=st.users['marca@x.com'];mu.cw=500;r=await A.call('POST','/api/state',{writes:{cz_u:{'marca@x.com':mu}}});log('   admin credita R$ 500:',r.j.users['marca@x.com'].cw);
const nova={s:'minha-camp',n:'Minha Campanha',pl:['TikTok'],esc:'geral',reg:[],f:'20 de dezembro',h:'#m',ds:'',soc:{},rq:[],cont:[],val:300,hue:100};
me=(await B.call('GET','/api/state')).j.users['marca@x.com'];me.cw=200;
r=await B.call('POST','/api/state',{writes:{cz_u:{'marca@x.com':me},cz_c:[nova]}});const mc=r.j.camps.find(c=>c.s==='minha-camp');log('   cria campanha de R$ 300 gastando R$ 300 do saldo:',mc&&mc.val,mc&&mc.pool,mc&&mc.st,'| saldo:',r.j.users['marca@x.com'].cw);
me=(await B.call('GET','/api/state')).j.users['marca@x.com'];
r=await B.call('POST','/api/state',{writes:{cz_u:{'marca@x.com':me},cz_c:[Object.assign({},nova,{s:'dinheiro-fake',val:99999})]}});log('   campanha de R$ 99.999 sem pagar:',r.j.camps.some(c=>c.s==='dinheiro-fake')?'FALHA':'bloqueada');
me=(await B.call('GET','/api/state')).j;const mine=me.camps.find(c=>c.s==='minha-camp');mine.val=5000;mine.st='ativa';mine.cpm=50;
r=await B.call('POST','/api/state',{writes:{cz_c:[mine]}});const mc2=r.j.camps.find(c=>c.s==='minha-camp');log('   aumentar valor sem pagar / ativar sozinha:',mc2.val,mc2.st,mc2.cpm);
r=await C1.call('GET','/api/state');log('   cortadora não vê campanha em análise:',!r.j.camps.some(c=>c.s==='minha-camp'));
// configurações
r=await C1.call('POST','/api/state',{writes:{cz_set:{fee:0,min:0,car:0}}});r=await V.call('GET','/api/state');log('10) cortadora altera configurações:',r.j.set.fee===15?'bloqueado':'FALHA');
r=await A.call('POST','/api/state',{writes:{cz_set:{auto:true,autoSub:false,car:10,carV:5,min:20,fee:12,contato:'oi@x.com',aviso:'Teste'}}});log('    admin altera:',r.j.set.fee,r.j.set.min,r.j.set.car);
// tickets e notificações
r=await C1.call('POST','/api/state',{writes:{cz_tk:[{id:'t1',u:'ana@x.com',nome:'Ana',sub:'Ajuda',cat:'Pagamento',st:'aberto',up:Date.now(),msgs:[{f:'user',t:Date.now(),txt:'Oi'}]}]}});log('11) ticket criado:',r.j.tk.length);
r=await C2.call('GET','/api/state');log('    Bia não vê ticket da Ana:',r.j.tk.length===0);
r=await A.call('GET','/api/state');const t1=r.j.tk[0];t1.msgs.push({f:'admin',t:Date.now()+1,txt:'Resolvido'});t1.st='respondido';
r=await A.call('POST','/api/state',{writes:{cz_tk:[t1],cz_nt:[{id:'n1',u:'ana@x.com',t:Date.now(),ic:'💬',tx:'O suporte respondeu',link:'#/tickets',r:false}]}});
r=await C1.call('GET','/api/state');log('    Ana vê resposta e aviso:',r.j.tk[0].msgs.length,r.j.nt.length);
r=await C1.call('POST','/api/state',{writes:{cz_nt:[{id:'n2',u:'bia@x.com',t:Date.now(),ic:'x',tx:'falso',link:'',r:false}]}});r=await C2.call('GET','/api/state');log('    Ana não consegue criar aviso para a Bia:',r.j.nt.length===0);
// sessão, logout, permissões de admin
r=await C1.call('POST','/api/admin/delete-user',{email:'bia@x.com'});log('12) cortadora tenta excluir usuária:',r.s);
r=await C1.call('POST','/api/logout');r=await C1.call('POST','/api/state',{writes:{}});log('    após logout, escrita:',r.s);
r=await fetch(base+'/api/state',{method:'POST',headers:{'Content-Type':'application/json',cookie:A.c},body:'{"writes":{}}'});log('    POST sem o cabeçalho de segurança:',r.status);
r=await A.call('POST','/api/admin/reset-password',{email:'bia@x.com',senha:'nova123'});r=await C2.call('GET','/api/state');log('    senha trocada pelo admin derruba a sessão da Bia:',r.j.session===null);
r=await V.call('POST','/api/login',{email:'bia@x.com',senha:'nova123'});log('    login com a senha nova:',r.s);
r=await A.call('POST','/api/admin/delete-user',{email:'bia@x.com'});log('    admin exclui usuária:',r.s,'| restantes:',Object.keys(r.j.users).length);
// persistência
await new Promise(r=>setTimeout(r,400));const fs=require('fs');const saved=JSON.parse(fs.readFileSync('/tmp/czdata/db.json'));log('13) dados gravados no disco:',Object.keys(saved.users).length,'usuários,',saved.camps.length,'campanhas | senhas em texto puro:',JSON.stringify(saved).includes('123456')?'SIM (FALHA)':'não');
// injeção de protótipo
r=await C1.call('POST','/api/login',{email:'ana@x.com',senha:'123456',role:'cortador'});
const bad=JSON.parse('{"__proto__":{"polluted":1},"nome":"Ana2"}');r=await C1.call('POST','/api/state',{writes:{cz_u:{'ana@x.com':bad}}});log('14) injeção de __proto__:',({}).polluted===undefined?'bloqueada':'FALHA');
log(fails?('\nFALHAS: '+fails):'\nTodas as verificações passaram.');server.close();process.exit(fails?1:0)})().catch(e=>{console.log('ERRO',e);process.exit(1)});
