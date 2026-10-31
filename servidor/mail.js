'use strict';
/* Cortei: envio de e-mail por SMTP, sem dependências externas.
   Configure no .env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
   Sem essas variáveis o site funciona igual, só não envia e-mail. */
const net = require('net'), tls = require('tls'), crypto = require('crypto');

const HOST = (process.env.SMTP_HOST || '').trim();
const PORT = +process.env.SMTP_PORT || 587;
const USER = process.env.SMTP_USER || '';
const PASS = process.env.SMTP_PASS || '';
const FROM = (process.env.SMTP_FROM || USER || '').trim();
const NOME = process.env.SMTP_FROM_NAME || 'Cortei';
const SITE = (process.env.SITE_URL || (process.env.DOMAIN ? 'https://' + process.env.DOMAIN : '')).replace(/\/+$/, '');
const ESPERA = 20000;

const ativo = () => !!(HOST && FROM);
const site = () => SITE;

/* ---------- conversa com o servidor de e-mail ---------- */
function evento(sock, nome) {
  return new Promise((ok, no) => {
    const limpa = () => { sock.removeListener(nome, aOk); sock.removeListener('error', aNo); };
    const aOk = () => { limpa(); ok(); };
    const aNo = e => { limpa(); no(e); };
    sock.once(nome, aOk); sock.once('error', aNo);
  });
}

function canal(sock) {
  let buf = '', linhas = [], fila = [];
  sock.setEncoding('utf8');
  sock.on('data', d => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const l = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1);
      linhas.push(l);
      if (/^\d{3} /.test(l)) {
        const texto = linhas.join('\n'), code = +l.slice(0, 3);
        linhas = [];
        const f = fila.shift();
        if (f) { clearTimeout(f.t); f.ok({ code, texto }); }
      }
    }
  });
  sock.on('error', e => { while (fila.length) { const f = fila.shift(); clearTimeout(f.t); f.no(e); } });
  return {
    espera(etapa) {
      return new Promise((ok, no) => {
        const t = setTimeout(() => no(new Error('o servidor de e-mail não respondeu (' + etapa + ')')), ESPERA);
        fila.push({ ok, no, t });
      });
    },
    diz(txt) { sock.write(txt + '\r\n'); }
  };
}

async function passo(c, cmd, etapa) {
  if (cmd !== null) c.diz(cmd);
  const r = await c.espera(etapa);
  if (r.code >= 400) throw new Error('e-mail recusado em ' + etapa + ': ' + r.texto.split('\n')[0]);
  return r;
}

const b64 = s => Buffer.from(String(s), 'utf8').toString('base64');
const assunto = s => /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + b64(s) + '?=';
const remetente = () => (/^[\x20-\x7e]*$/.test(NOME) ? '"' + NOME.replace(/"/g, '') + '"' : '=?UTF-8?B?' + b64(NOME) + '?=') + ' <' + FROM + '>';

function mensagem(para, titulo, texto) {
  const id = '<' + crypto.randomBytes(12).toString('hex') + '@cortei>';
  const corpo = b64(texto.replace(/\r?\n/g, '\r\n')).replace(/(.{76})/g, '$1\r\n');
  return ['From: ' + remetente(), 'To: ' + para, 'Subject: ' + assunto(titulo),
    'Date: ' + new Date().toUTCString(), 'Message-ID: ' + id, 'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64',
    'Auto-Submitted: auto-generated', '', corpo].join('\r\n');
}

async function entrega(para, titulo, texto) {
  const direto = PORT === 465;
  let sock = direto ? tls.connect({ host: HOST, port: PORT, servername: HOST })
    : net.connect({ host: HOST, port: PORT });
  sock.setTimeout(ESPERA, () => sock.destroy(new Error('tempo esgotado na conexão de e-mail')));
  await evento(sock, direto ? 'secureConnect' : 'connect');
  let c = canal(sock);
  await passo(c, null, 'saudação');
  let r = await passo(c, 'EHLO cortei', 'EHLO');
  if (!direto && /STARTTLS/i.test(r.texto)) {
    await passo(c, 'STARTTLS', 'STARTTLS');
    sock = tls.connect({ socket: sock, host: HOST, servername: HOST });
    await evento(sock, 'secureConnect');
    sock.setTimeout(ESPERA, () => sock.destroy(new Error('tempo esgotado na conexão de e-mail')));
    c = canal(sock);
    r = await passo(c, 'EHLO cortei', 'EHLO seguro');
  }
  if (USER && PASS) {
    await passo(c, 'AUTH LOGIN', 'início do login');
    await passo(c, b64(USER), 'usuário');
    await passo(c, b64(PASS), 'senha');
  }
  await passo(c, 'MAIL FROM:<' + FROM + '>', 'remetente');
  await passo(c, 'RCPT TO:<' + para + '>', 'destinatário');
  await passo(c, 'DATA', 'início da mensagem');
  c.diz(mensagem(para, titulo, texto) + '\r\n.');
  await passo(c, null, 'envio da mensagem');
  try { c.diz('QUIT'); } catch (e) {}
  sock.end();
}

/* Envia sem travar a resposta do site: erro só vai para o log. */
function manda(para, titulo, texto) {
  if (!ativo()) { console.log('e-mail não enviado (SMTP não configurado):', titulo, '->', para); return Promise.resolve(false); }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(para || ''))) return Promise.resolve(false);
  return entrega(para, titulo, texto).then(() => { console.log('e-mail enviado:', titulo, '->', para); return true; })
    .catch(e => { console.error('falha ao enviar e-mail para ' + para + ':', e.message); return false; });
}

/* ---------- mensagens da plataforma ---------- */
const rodape = '\n\n— Cortei' + (SITE ? '\n' + SITE : '') +
  '\n\nVocê recebeu este e-mail porque tem uma conta na Cortei. Não responda a esta mensagem.';

const T = {
  boasVindas: (nome, papel) => ['Sua conta na Cortei está criada',
    'Olá, ' + nome + '!\n\nSua conta de ' + (papel === 'cliente' ? 'marca' : 'cortador') + ' na Cortei está criada.\n\n' +
    (papel === 'cliente'
      ? 'Próximos passos: deposite um valor na carteira, crie sua campanha e defina as regras. A plataforma configura o valor por mil visualizações e coloca a campanha no ar.'
      : 'Próximos passos: cadastre suas contas de redes sociais e sua chave PIX no perfil, entre em uma campanha e envie o link do seu primeiro corte.') +
    (SITE ? '\n\nAcesse: ' + SITE : '') + rodape],

  senha: (nome, link) => ['Redefinir sua senha da Cortei',
    'Olá, ' + nome + '!\n\nRecebemos um pedido para redefinir a senha da sua conta na Cortei.\n\n' +
    'Abra o endereço abaixo para escolher uma nova senha:\n' + link + '\n\n' +
    'O link vale por 1 hora e só pode ser usado uma vez.\n\n' +
    'Se não foi você que pediu, ignore este e-mail: sua senha atual continua valendo.' + rodape],

  saquePago: (nome, valor, chave) => ['Seu saque foi pago',
    'Olá, ' + nome + '!\n\nO seu saque de ' + valor + ' foi pago via PIX para a chave ' + chave + '.\n\n' +
    'O comprovante fica no histórico da sua conta, em Ganhos > Recibos.' + rodape],

  saqueRecusado: (nome, valor) => ['Seu pedido de saque foi recusado',
    'Olá, ' + nome + '!\n\nO seu pedido de saque de ' + valor + ' foi recusado e o valor voltou para o seu saldo.\n\n' +
    'Se quiser entender o motivo, abra um ticket na sua conta e nossa equipe responde por lá.' + rodape]
};

module.exports = {
  ativo, site,
  boasVindas: (para, nome, papel) => manda(para, ...T.boasVindas(nome, papel)),
  senha: (para, nome, link) => manda(para, ...T.senha(nome, link)),
  saquePago: (para, nome, valor, chave) => manda(para, ...T.saquePago(nome, valor, chave)),
  saqueRecusado: (para, nome, valor) => manda(para, ...T.saqueRecusado(nome, valor))
};
