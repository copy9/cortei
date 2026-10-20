# Cortei

Plataforma de campanhas de cortes pagas por mil visualizações validadas.
Português, inglês e espanhol. Perfis: visitante, cortador, marca e admin.

## Publicar no GitHub Pages (site no ar em 3 minutos)

1. Crie um repositório no GitHub (por exemplo `cortei`).
2. Envie **todo o conteúdo desta pasta** (pelo botão *uploading an existing file*, arrastando os arquivos e pastas) e clique em **Commit changes**.
3. Vá em **Settings > Pages**. Em *Build and deployment*, escolha **Deploy from a branch**, selecione a branch `main` e a pasta `/ (root)`, e salve.
4. Em cerca de um minuto o site abre em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

O arquivo que o Pages publica é o `index.html`. Ele contém a plataforma inteira.

## Importante: o que o GitHub Pages faz e não faz

O GitHub Pages só hospeda arquivos estáticos, **não roda servidor**. Por isso, no Pages a plataforma funciona em **modo demonstração**:
- Todas as telas e fluxos funcionam (cadastro, campanhas, posts, revisão, saques, notificações, idiomas, painel admin).
- Os dados ficam **no navegador de cada visitante**. Uma pessoa não vê o que outra criou, e limpar o histórico apaga tudo.
- O PIX e as visualizações são simulados.
- Acesso de admin na demonstração: abra `#/acesso-admin` na barra de endereço (ou clique 5 vezes no logo do rodapé) e use o código `CORTEI-ADMIN-2026`. Como cada pessoa só vê os próprios dados, isso não expõe nada de ninguém.

## Para operar com usuários reais

Use a pasta `servidor/`: ela tem o servidor (contas, dados compartilhados, permissões, backups) e o passo a passo para subir no seu domínio com HTTPS. Leia `servidor/README-SERVIDOR.md`.
O mesmo `index.html` funciona nos dois modos: ele detecta sozinho se há um servidor por trás.

## Estrutura

```
cortei/
├── index.html                  # a plataforma (publicada pelo GitHub Pages)
├── .nojekyll
├── sync-site.sh                # copia o index.html da raiz para servidor/public/
├── README.md
└── servidor/                   # versão com servidor para usuários reais
    ├── README-SERVIDOR.md
    ├── server.js, package.json
    ├── Dockerfile, docker-compose.yml, Caddyfile, .env.example
    ├── reset-password.js, test-server.js
    ├── deploy/                 # alternativa sem Docker (nginx + systemd)
    └── public/index.html       # cópia do index.html da raiz
```

## Mexendo no site

O `index.html` existe em dois lugares: na **raiz** (o que o GitHub Pages publica) e em **`servidor/public/`** (o que o servidor Node entrega). Edite sempre o da raiz e rode:

```
./sync-site.sh
```

Para conferir o servidor e, de quebra, se as duas cópias estão iguais:

```
cd servidor && npm test
```
