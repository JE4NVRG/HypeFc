#!/bin/bash
# Job diario do HypeFC — roda na VPS (luna-vps) pelo timer hypefc-recorde-diario.timer.
#
# Antes disto o mesmo trabalho era um cron de AGENTE no Mac: dependia do Mac
# ligado, de o shell exportar as variaveis de ambiente por fora e de um LLM
# decidir os passos. Aqui e deterministico: a unica entrada e o .env.local e
# qualquer falha aborta com codigo != 0 (o systemd marca a unit como failed —
# silencio nunca e interpretado como sucesso).
#
# Passos, na ordem: snapshot do dia, liquidacao do hype, ratings, chance de
# titulo, snapshot/liquidacao das probabilidades e alertas dos assinantes Pro.
# Depois: commita os dados do dia e publica (deploy:domain).
set -uo pipefail

cd "$(dirname "$0")/.." || { echo "ERRO: nao achei a raiz do repo"; exit 1; }

if [ ! -f .env.local ]; then
  echo "ERRO: .env.local ausente (precisa de SUPABASE_URL/SERVICE_KEY/VAPID_*)"
  exit 1
fi
# set -a porque os scripts leem de process.env: no Mac isso so funcionava
# porque o shell exportava por fora, o que e fragilidade, nao configuracao.
set -a
# shellcheck disable=SC1091
. ./.env.local
set +a

export TZ="${TZ:-America/Sao_Paulo}"
export PATH="$HOME/.local/bin:$PATH"
NPM="${NPM:-npm}"

log() { echo "[$(date '+%F %T %Z')] $*"; }

run() {
  "$@"
  local codigo=$?
  if [ "$codigo" -ne 0 ]; then
    echo "ERRO: passo falhou (exit $codigo): $*"
    exit "$codigo"
  fi
}

log "recorde diario: inicio"

run "$NPM" run snapshot:hype -- --today
run "$NPM" run settle:hype
run "$NPM" run ratings
run "$NPM" run titulo:prob
run "$NPM" run snapshot:prob
run "$NPM" run settle:prob
run "$NPM" run alertas

# O .env.local tem a service key: se ele aparecer como rastreavel, algo esta
# errado e o job para aqui em vez de publicar um commit com segredo.
if [ -n "$(git status --porcelain -- .env.local)" ]; then
  echo "ERRO: .env.local aparece no git status — abortando sem commitar nem publicar"
  exit 5
fi

if ! git diff --quiet -- data public/data; then
  run git add -A data public/data
  run git commit -m "chore: recorde do dia $(date +%F)"
  run git push origin main
else
  log "sem mudanca nos dados do dia (normal quando nao ha jogo)"
fi

# Publicacao: SEMPRE deploy:domain (builda sem basePath, grava o CNAME e carimba
# o service worker). deploy:pages quebra o dominio e nao carimba o SW.
run "$NPM" run deploy:domain

log "recorde diario: fim"
