#!/bin/sh
# Copia o index.html da raiz (o que o GitHub Pages publica) para servidor/public/,
# que é o mesmo arquivo servido pelo servidor Node. Rode sempre que mexer no site.
set -e
cd "$(dirname "$0")"
cp index.html servidor/public/index.html
echo "servidor/public/index.html atualizado a partir do index.html da raiz."
