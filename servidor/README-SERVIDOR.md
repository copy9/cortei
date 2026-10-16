# Cortei: como colocar no ar, com domínio, para usuários reais

Este pacote é a plataforma **com servidor**: contas reais com senha, dados compartilhados entre todos os usuários, painel de admin e backups automáticos. Não tem dependências para instalar (só o Node.js, que já vem no Docker).

## O que está incluído
- `public/index.html`: o site (português, inglês e espanhol).
- `server.js`: o servidor (cadastro, login, permissões, banco de dados em arquivo, backup diário).
- `Dockerfile`, `docker-compose.yml`, `Caddyfile`: sobe tudo com HTTPS automático.
- `deploy/`: alternativa sem Docker (nginx + systemd).
- `reset-password.js`: redefine a senha de um usuário.

## O que você precisa
1. Um **domínio** (por exemplo, no Registro.br, cerca de R$ 40 por ano).
2. Um **servidor VPS** com Ubuntu 22.04 ou 24.04 e 1 GB de RAM (Hetzner, DigitalOcean, Contabo, Hostinger... cerca de R$ 25 a 60 por mês).

## Passo a passo (com Docker, o mais simples)

### 1. Apontar o domínio para o servidor
No painel do seu domínio, em **DNS**, crie dois registros do tipo **A** apontando para o **IP do servidor**:
- `@` (o domínio sem nada) → IP do servidor
- `www` → IP do servidor

A propagação leva de minutos a algumas horas.

### 2. Entrar no servidor e instalar o Docker
No seu computador, abra o terminal e conecte (troque `IP`):
```
ssh root@IP
```
No servidor, instale o Docker:
```
curl -fsSL https://get.docker.com | sh
```

### 3. Enviar o projeto para o servidor
Descompacte o zip no seu computador e envie a pasta (no seu computador, não no servidor):
```
scp -r cortei root@IP:/opt/cortei
```
(Se preferir, suba a pasta em um repositório **privado** do GitHub e use `git clone` no servidor. Nunca envie o arquivo `.env` ao GitHub.)

### 4. Configurar
No servidor:
```
cd /opt/cortei
cp .env.example .env
nano .env
```
Preencha:
- `DOMAIN`: seu domínio, sem `https://` (ex.: `cortei.com.br`).
- `ADMIN_EMAIL` e `ADMIN_PASSWORD`: o e-mail e a senha do **administrador** (use uma senha forte, com 12 ou mais caracteres).
- `CONTACT_EMAIL`: e-mail de contato que aparece no site.
- Deixe `COOKIE_SECURE=1`.

Salve (Ctrl+O, Enter) e saia (Ctrl+X).

### 5. Liberar as portas e subir
```
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw --force enable
docker compose up -d --build
```
Em cerca de um minuto o site abre em `https://seudominio.com.br`, com o certificado de HTTPS criado sozinho.

### 6. Primeiro acesso como administrador
1. Abra o site, clique em **Entrar**, escolha **Sou cortador** e entre com o `ADMIN_EMAIL` e a `ADMIN_PASSWORD`. Você será levado ao painel de admin.
2. Em **Configurações**, confira a taxa da plataforma, o saque mínimo e a carência.
3. Pronto: cortadores e marcas já podem criar contas pelo site.

## Como operar no dia a dia (pagamentos manuais)
A plataforma **não movimenta dinheiro sozinha**. Você faz os PIX pelo seu banco e registra no painel:
- **Marca quer investir:** ela faz um PIX para você e abre um ticket com o comprovante. No admin, em **Usuários > Ficha > Ajustar saldo**, você credita o valor na carteira dela. Depois ela cria a campanha.
- **Campanha nova:** aparece como "Em análise". No admin, em **Campanhas**, você define o modelo, o valor por mil e ativa.
- **Posts:** em **Envios**, abra o post, confira as visualizações reais, registre em "Definir o que rendeu" e aprove. O valor entra em carência.
- **Saques:** em **Saques**, veja o pedido, faça o PIX no seu banco e clique em "marcar como pago".
- **Senha esquecida:** `docker compose stop app && docker compose run --rm app node reset-password.js email@exemplo.com NovaSenha123 && docker compose start app`

## Backup e atualização
- **Dados:** tudo fica na pasta `data/`. O servidor guarda uma cópia por dia em `data/backups/` (últimos 30 dias). **Copie essa pasta para fora do servidor** com frequência (por exemplo, `scp -r root@IP:/opt/cortei/data ./backup`).
- **Atualizar o site:** troque o arquivo `public/index.html` e rode `docker compose up -d --build`.
- **Ver erros:** `docker compose logs -f app`

## Alternativa sem Docker
Instale o Node.js 18 ou mais, copie a pasta para `/opt/cortei`, crie o `.env`, use `deploy/cortei.service` (systemd) e `deploy/nginx.conf` (nginx), e gere o HTTPS com `certbot --nginx`.

## Limites desta versão (leia antes de divulgar)
- **Banco em arquivo:** serve bem para um piloto (centenas a poucos milhares de usuários). Para crescer, o próximo passo é PostgreSQL.
- **Pagamentos e depósitos são manuais** (descrito acima). Integrar um gateway (Asaas, Mercado Pago, Pagar.me) exige a sua conta e chaves.
- **Visualizações:** não há leitura automática das redes. Você confere cada post e registra os números.
- **Sem e-mail automático:** não há recuperação de senha por e-mail nem avisos por e-mail (só o sino dentro do site).
- **Página pública de campanhas:** o visitante sem login vê uma vitrine de exemplo (marcas fictícias). Se quiser mostrar só campanhas reais, peça o ajuste.
- **Jurídico:** os Termos e a Política de Privacidade são rascunhos. Faça a revisão com um advogado (LGPD) antes de abrir ao público, e confirme a regulamentação de pagamentos.
- **Segurança:** senhas com hash (scrypt), sessão por cookie protegido, limite de tentativas e permissões no servidor. Mantenha o servidor atualizado e a senha de admin forte.
