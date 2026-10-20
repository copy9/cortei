process.env.DATA_DIR='/tmp/czdata';process.env.ADMIN_EMAIL='dono@meusite.com';process.env.ADMIN_PASSWORD='SenhaForte123';process.env.PORT='0';
const {server,db}=require('./server.js');
let base;const log=(...a)=>console.log(...a);let fails=0;
let checks=0;const ok=(c,m)=>{checks++;if(!c){fails++;console.log('  >>> FALHOU:',m)}return !!c};
function sameSite(){try{const fs=require('fs'),path=require('path');
const a=fs.readFileSync(path.join(__dirname,'public','index.html'));
const b=fs.readFileSync(path.join(__dirname,'..','index.html'));
return a.equals(b)}catch(e){return false}}
class J{constructor(){this.c=''}async call(m,p,b){const r=await fetch(base+p,{method:m,headers:{'Content-Type':'application/json','X-Requested-With':'cortei',cookie:this.c},body:b?JSON.stringify(b):undefined});const sc=r.headers.get('set-cookie');if(sc){const v=sc.split(';')[0];this.c=v.endsWith('=')?'':v}let j={};try{j=await r.json()}catch(e){}return{s:r.status,j}}}
(async()=>{
await new Promise(r=>server.listen(0,r));base='http://127.0.0.1:'+server.address().port;
const V=new J(),A=new J(),C1=new J(),C2=new J(),B=new J();
let r=await V.call('GET','/api/ping');log('1) ping:',r.j.ok);ok(r.j.ok===true,'ping responde ok');
ok(sameSite(),'public/index.html igual ao index.html da raiz (rode ./sync-site.sh)');
r=await A.call('POST','/api/login',{email:'dono@meusite.com',senha:'errada'});log('2) senha errada do admin:',r.s,r.j.err);ok(r.s===401,'senha errada do admin devolve 401');
r=await A.call('POST','/api/login',{email:'dono@meusite.com',senha:'SenhaForte123'});log('   admin entra:',r.s,r.j.session&&r.j.session.adm);ok(r.s===200&&r.j.session&&r.j.session.adm===true,'admin entra com a senha certa');
// cadastro
r=await C1.call('POST','/api/register',{email:'ana@x.com',nome:'Ana',zap:'11 98888-7777',senha:'123456',role:'cortador',pix:'ana@pix'});log('3) cadastro cortadora:',r.s,r.j.session&&r.j.session.role);ok(r.s===200&&r.j.session.role==='cortador','cadastro de cortadora');
r=await C1.call('POST','/api/register',{email:'ana@x.com',nome:'Ana',zap:'11 98888-7777',senha:'123456',role:'cortador'});log('   e-mail repetido bloqueado:',r.s===400);ok(r.s===400,'e-mail repetido bloqueado');
r=await C2.call('POST','/api/register',{email:'bia@x.com',nome:'Bia',zap:'11 97777-6666',senha:'123456',role:'cortador',pix:'bia@pix'});
r=await B.call('POST','/api/register',{email:'marca@x.com',nome:'Marca X',zap:'11 96666-5555',senha:'123456',role:'cliente'});log('   marca criada:',r.j.session.role);ok(r.j.session.role==='cliente','marca criada');
r=await V.call('POST','/api/register',{email:'admin@cortei.com.br',nome:'Fake',zap:'11 96666-5555',senha:'123456'});log('   e-mail admin do site não pode ser registrado:',r.s===400);ok(r.s===400,'e-mail reservado do admin nao pode ser registrado');
r=await V.call('POST','/api/login',{email:'ana@x.com',senha:'123456',role:'cliente'});log('   papel errado no login:',r.j.err);ok(r.s===400&&!!r.j.err,'login com o papel errado e recusado');
// visibilidade
r=await V.call('GET','/api/state');log('4) visitante vê usuários:',Object.keys(r.j.users).length,'| só marcas, sem nome:',Object.values(r.j.users).every(u=>u.role==='cliente'&&u.nome===''),'| sessão:',r.j.session);ok(Object.values(r.j.users).every(u=>u.role==='cliente'&&u.nome===''),'visitante so ve marcas, sem nome');ok(r.j.session===null,'visitante nao tem sessao');
r=await C1.call('GET','/api/state');const us=Object.values(r.j.users);log('   Ana vê:',us.length,'registros | só ela tem PIX:',us.filter(u=>u.pix).length===1,'| vê e-mail real de outros:',us.some(u=>u.email==='bia@x.com'||u.email==='marca@x.com'),'| campos sensíveis de outros ausentes:',us.filter(u=>u.email!=='ana@x.com').every(u=>!u.pix&&!u.zap&&!(u.wd||[]).length));ok(us.filter(u=>u.pix).length===1,'so a propria conta expoe o PIX');ok(!us.some(u=>u.email==='bia@x.com'||u.email==='marca@x.com'),'e-mails de terceiros ficam anonimos');ok(us.filter(u=>u.email!=='ana@x.com').every(u=>!u.pix&&!u.zap&&!(u.wd||[]).length),'dados sensiveis de terceiros ausentes');
r=await A.call('GET','/api/state');log('   admin vê todos com e-mail real:',Object.keys(r.j.users).sort().join(','),'| sem hash de senha:',!JSON.stringify(r.j).includes('"auth"')&&!JSON.stringify(r.j).includes('scrypt'));ok(!JSON.stringify(r.j).includes('"auth"'),'a API nunca devolve o hash da senha');
// admin cria campanha pública
const camp={s:'maratona',n:'Maratona Fit',b:'Fit Brasil',t:'cpm',pz:'R$ 2,00 por mil visualizações',cpm:2,bud:1000,pool:1000,hue:200,pl:['TikTok','Instagram'],esc:'geral',reg:[],f:'31 de dezembro',st:'ativa',h:'#fit',ds:'x',soc:{},rq:[],cont:[],pr:[],vg:0,dmin:0,dmax:0,vmin:0,i:0,p1:''};
r=await A.call('POST','/api/state',{writes:{cz_c:[camp]}});log('5) admin cria campanha:',r.j.camps.length);ok(r.j.camps.length===1,'admin cria campanha');
r=await C1.call('POST','/api/state',{writes:{cz_c:[Object.assign({},camp,{cpm:99,bud:99999,st:'ativa',n:'HACK'})]}});log('   cortadora tenta alterar campanha da plataforma:',r.j.camps[0].cpm===2&&r.j.camps[0].n==='Maratona Fit'?'bloqueado':'FALHA');ok(r.j.camps[0].cpm===2&&r.j.camps[0].n==='Maratona Fit','cortadora nao altera campanha da plataforma');
// cortadora se inscreve e envia post
let st=(await C1.call('GET','/api/state')).j,me=st.users['ana@x.com'];
me.enr=['maratona'];me.enT={maratona:Date.now()};me.subs=[{cid:'maratona',url:'https://www.tiktok.com/@ana/video/1',p:'Tiktok',acc:'a1',t:Date.now()}];
r=await C1.call('POST','/api/state',{writes:{cz_u:{'ana@x.com':me}}});const me2=r.j.users['ana@x.com'];log('6) inscrição + post:',me2.enr,me2.subs.length,'| post marcado manual (sem métricas simuladas):',me2.subs[0].manual===true);ok(me2.enr.length===1&&me2.subs.length===1,'inscricao e post gravados');ok(me2.subs[0].manual===true,'post do usuario nasce manual, sem metricas simuladas');
// fraude: cortadora tenta aprovar o próprio post, dar saldo e virar admin
const evil=JSON.parse(JSON.stringify(me2));evil.subs[0].ov='aprovado';evil.subs[0].obs={v:9999999,ok:9999999};evil.subs[0].at=1;evil.adj=1e6;evil.adm=true;evil.vf=true;evil.role='cliente';evil.cw=1e6;evil.ban=false;evil.wd=[{v:50,t:Date.now(),st:'pago'}];
r=await C1.call('POST','/api/state',{writes:{cz_u:{'ana@x.com':evil}}});const m3=r.j.users['ana@x.com'];
log('7) fraude da cortadora:','ov:',m3.subs[0].ov,'| obs:',m3.subs[0].obs,'| adj:',m3.adj,'| adm:',m3.adm,'| vf:',m3.vf,'| role:',m3.role,'| cw:',m3.cw,'| saque já "pago":',(m3.wd[0]||{}).st);
ok(m3.subs[0].ov===undefined,'cortadora nao aprova o proprio post');ok(m3.subs[0].obs===undefined,'cortadora nao registra as proprias metricas');ok(m3.adj===undefined,'cortadora nao se da ajuste de saldo');ok(m3.adm===undefined,'cortadora nao vira admin');ok(m3.vf===undefined,'cortadora nao se da o selo');ok(m3.role==='cortador','cortadora nao troca de papel');ok(m3.cw===0,'cortadora nao se da saldo de carteira');ok((m3.wd[0]||{}).st===undefined,'cortadora nao marca o proprio saque como pago');
r=await C2.call('POST','/api/state',{writes:{cz_u:{'ana@x.com':Object.assign({},evil,{nome:'INVADIDA'})}}});r=await A.call('GET','/api/state');log('   Bia tenta alterar a Ana:',r.j.users['ana@x.com'].nome==='Ana'?'bloqueado':'FALHA');ok(r.j.users['ana@x.com'].nome==='Ana','um usuario nao altera o cadastro de outro');
// pedido de saque
me=(await C1.call('GET','/api/state')).j.users['ana@x.com'];me.wd=[{v:30,t:Date.now()}];r=await C1.call('POST','/api/state',{writes:{cz_u:{'ana@x.com':me}}});log('   pedido de saque criado:',r.j.users['ana@x.com'].wd.length,'sem status:',!r.j.users['ana@x.com'].wd[0].st);
// admin aprova com números reais
st=(await A.call('GET','/api/state')).j;const ana=st.users['ana@x.com'];const sp=ana.subs[0];sp.ov='aprovado';sp.at=Date.now();sp.cd=15;sp.obs={v:48200,ok:45790,lk:3100,cm:142,sh:260,tm:9,d:5,note:'interno'};
r=await A.call('POST','/api/state',{writes:{cz_u:{'ana@x.com':{subs:[sp],email:'ana@x.com'}}}});
r=await C1.call('GET','/api/state');log('8) admin aprovou: ana vê ov =',r.j.users['ana@x.com'].subs[0].ov,'| total do contador:',r.j.total);ok(r.j.users['ana@x.com'].subs[0].ov==='aprovado','admin aprova o post');ok(r.j.total===45790,'contador publico usa as visualizacoes validadas');
r=await V.call('GET','/api/state');log('   visitante vê o mesmo contador:',r.j.total);
r=await C2.call('GET','/api/state');const ana2=Object.values(r.j.users).find(u=>u.nome==='Ana');log('   Bia vê o post aprovado da Ana:',ana2.subs.length,'| sem anotação interna:',!JSON.stringify(ana2).includes('interno'),'| sem pix:',!ana2.pix);ok(ana2.subs.length===1,'posts aprovados ficam visiveis');ok(!JSON.stringify(ana2).includes('interno'),'anotacao interna da revisao nao vaza');ok(!ana2.pix,'PIX nao vaza para outro cortador');
// marca: carteira e campanha
me=(await B.call('GET','/api/state')).j.users['marca@x.com'];me.cw=5000;
r=await B.call('POST','/api/state',{writes:{cz_u:{'marca@x.com':me}}});log('9) marca tenta se dar saldo:',r.j.users['marca@x.com'].cw===0?'bloqueado':'FALHA');ok(r.j.users['marca@x.com'].cw===0,'marca nao se credita saldo');
st=(await A.call('GET','/api/state')).j;const mu=st.users['marca@x.com'];mu.cw=500;r=await A.call('POST','/api/state',{writes:{cz_u:{'marca@x.com':mu}}});log('   admin credita R$ 500:',r.j.users['marca@x.com'].cw);ok(r.j.users['marca@x.com'].cw===500,'admin credita a carteira da marca');
const nova={s:'minha-camp',n:'Minha Campanha',pl:['TikTok'],esc:'geral',reg:[],f:'20 de dezembro',h:'#m',ds:'',soc:{},rq:[],cont:[],val:300,hue:100};
me=(await B.call('GET','/api/state')).j.users['marca@x.com'];me.cw=200;
r=await B.call('POST','/api/state',{writes:{cz_u:{'marca@x.com':me},cz_c:[nova]}});const mc=r.j.camps.find(c=>c.s==='minha-camp');log('   cria campanha de R$ 300 gastando R$ 300 do saldo:',mc&&mc.val,mc&&mc.pool,mc&&mc.st,'| saldo:',r.j.users['marca@x.com'].cw);ok(mc&&mc.val===300&&mc.st==='pedido','campanha nasce com o valor pago e em analise');ok(r.j.users['marca@x.com'].cw===200,'o valor sai da carteira da marca');
me=(await B.call('GET','/api/state')).j.users['marca@x.com'];
r=await B.call('POST','/api/state',{writes:{cz_u:{'marca@x.com':me},cz_c:[Object.assign({},nova,{s:'dinheiro-fake',val:99999})]}});log('   campanha de R$ 99.999 sem pagar:',r.j.camps.some(c=>c.s==='dinheiro-fake')?'FALHA':'bloqueada');ok(!r.j.camps.some(c=>c.s==='dinheiro-fake'),'campanha sem pagamento e bloqueada');
me=(await B.call('GET','/api/state')).j;const mine=me.camps.find(c=>c.s==='minha-camp');mine.val=5000;mine.st='ativa';mine.cpm=50;
r=await B.call('POST','/api/state',{writes:{cz_c:[mine]}});const mc2=r.j.camps.find(c=>c.s==='minha-camp');log('   aumentar valor sem pagar / ativar sozinha:',mc2.val,mc2.st,mc2.cpm);ok(mc2.val===300&&mc2.st==='pedido'&&mc2.cpm===0,'marca nao aumenta o valor nem ativa a campanha sozinha');
r=await C1.call('GET','/api/state');log('   cortadora não vê campanha em análise:',!r.j.camps.some(c=>c.s==='minha-camp'));ok(!r.j.camps.some(c=>c.s==='minha-camp'),'campanha em analise fica invisivel para cortadores');
// configurações
r=await C1.call('POST','/api/state',{writes:{cz_set:{fee:0,min:0,car:0}}});r=await V.call('GET','/api/state');log('10) cortadora altera configurações:',r.j.set.fee===15?'bloqueado':'FALHA');ok(r.j.set.fee===15,'cortadora nao altera as configuracoes');
r=await A.call('POST','/api/state',{writes:{cz_set:{auto:true,autoSub:false,car:10,carV:5,min:20,fee:12,contato:'oi@x.com',aviso:'Teste'}}});log('    admin altera:',r.j.set.fee,r.j.set.min,r.j.set.car);ok(r.j.set.fee===12&&r.j.set.min===20&&r.j.set.car===10,'admin altera as configuracoes');
// tickets e notificações
r=await C1.call('POST','/api/state',{writes:{cz_tk:[{id:'t1',u:'ana@x.com',nome:'Ana',sub:'Ajuda',cat:'Pagamento',st:'aberto',up:Date.now(),msgs:[{f:'user',t:Date.now(),txt:'Oi'}]}]}});log('11) ticket criado:',r.j.tk.length);ok(r.j.tk.length===1,'ticket criado');
r=await C2.call('GET','/api/state');log('    Bia não vê ticket da Ana:',r.j.tk.length===0);ok(r.j.tk.length===0,'ticket de outro usuario fica invisivel');
r=await A.call('GET','/api/state');const t1=r.j.tk[0];t1.msgs.push({f:'admin',t:Date.now()+1,txt:'Resolvido'});t1.st='respondido';
r=await A.call('POST','/api/state',{writes:{cz_tk:[t1],cz_nt:[{id:'n1',u:'ana@x.com',t:Date.now(),ic:'💬',tx:'O suporte respondeu',link:'#/tickets',r:false}]}});
r=await C1.call('GET','/api/state');log('    Ana vê resposta e aviso:',r.j.tk[0].msgs.length,r.j.nt.length);ok(r.j.tk[0].msgs.length===2&&r.j.nt.length===1,'resposta do suporte e aviso chegam');
r=await C1.call('POST','/api/state',{writes:{cz_nt:[{id:'n2',u:'bia@x.com',t:Date.now(),ic:'x',tx:'falso',link:'',r:false}]}});r=await C2.call('GET','/api/state');log('    Ana não consegue criar aviso para a Bia:',r.j.nt.length===0);ok(r.j.nt.length===0,'um usuario nao cria aviso para outro');
// sessão, logout, permissões de admin
r=await C1.call('POST','/api/admin/delete-user',{email:'bia@x.com'});log('12) cortadora tenta excluir usuária:',r.s);ok(r.s===403,'cortadora nao usa rota de admin');
r=await C1.call('POST','/api/logout');r=await C1.call('POST','/api/state',{writes:{}});log('    após logout, escrita:',r.s);ok(r.s===401,'escrita apos logout e recusada');
r=await fetch(base+'/api/state',{method:'POST',headers:{'Content-Type':'application/json',cookie:A.c},body:'{"writes":{}}'});log('    POST sem o cabeçalho de segurança:',r.status);ok(r.status===403,'POST sem o cabecalho de seguranca e recusado');
r=await A.call('POST','/api/admin/reset-password',{email:'bia@x.com',senha:'nova123'});r=await C2.call('GET','/api/state');log('    senha trocada pelo admin derruba a sessão da Bia:',r.j.session===null);ok(r.j.session===null,'troca de senha derruba a sessao antiga');
r=await V.call('POST','/api/login',{email:'bia@x.com',senha:'nova123'});log('    login com a senha nova:',r.s);ok(r.s===200,'login com a senha nova funciona');
r=await A.call('POST','/api/admin/delete-user',{email:'bia@x.com'});log('    admin exclui usuária:',r.s,'| restantes:',Object.keys(r.j.users).length);ok(r.s===200&&!r.j.users['bia@x.com'],'admin exclui usuaria');
// persistência
await new Promise(r=>setTimeout(r,400));const fs=require('fs');const saved=JSON.parse(fs.readFileSync('/tmp/czdata/db.json'));log('13) dados gravados no disco:',Object.keys(saved.users).length,'usuários,',saved.camps.length,'campanhas | senhas em texto puro:',JSON.stringify(saved).includes('123456')?'SIM (FALHA)':'não');ok(Object.keys(saved.users).length===3&&saved.camps.length===2,'dados gravados no disco');ok(!JSON.stringify(saved).includes('123456'),'nenhuma senha em texto puro no disco');
// injeção de protótipo
r=await C1.call('POST','/api/login',{email:'ana@x.com',senha:'123456',role:'cortador'});
const bad=JSON.parse('{"__proto__":{"polluted":1},"nome":"Ana2"}');r=await C1.call('POST','/api/state',{writes:{cz_u:{'ana@x.com':bad}}});log('14) injeção de __proto__:',({}).polluted===undefined?'bloqueada':'FALHA');ok(({}).polluted===undefined,'injecao de __proto__ bloqueada');
log(fails?('\nFALHAS: '+fails+' de '+checks+' verificações.'):('\nTodas as '+checks+' verificações passaram.'));server.close();process.exit(fails?1:0)})().catch(e=>{console.log('ERRO',e);process.exit(1)});
