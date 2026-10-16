'use strict';
// Uso: node reset-password.js email@exemplo.com NovaSenha123   (pare o servidor antes)
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data'),F=path.join(DATA_DIR,'db.json');
const [email,senha]=[(process.argv[2]||'').toLowerCase(),process.argv[3]||''];
if(!email||senha.length<6){console.log('Uso: node reset-password.js email NovaSenha (mínimo 6 caracteres)');process.exit(1)}
const db=JSON.parse(fs.readFileSync(F,'utf8')),u=db.users[email];
if(!u){console.log('Usuário não encontrado:',email);process.exit(1)}
const salt=crypto.randomBytes(16).toString('hex');
u.auth={s:salt,h:crypto.scryptSync(senha,salt,64).toString('hex'),v:(((u.auth||{}).v)||1)+1};
fs.writeFileSync(F,JSON.stringify(db));console.log('Senha de',email,'alterada. Inicie o servidor de novo.');
