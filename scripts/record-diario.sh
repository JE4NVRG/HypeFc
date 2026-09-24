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
# titulo, snapshot/liquidacao das probabilidades, alertas dos assinantes Pro e
# publicacao dos payloads no Supabase (o site le de la em runtime). Depois:
# commita os dados do dia como historico (sem build nem deploy — o numero ja
# esta no ar pelo banco).
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

# O repo tambem recebe commit desta maquina (design, codigo). Sem sincronizar
# antes, o push do fim do job e rejeitado por non-fast-forward, o systemd marca
# a unit como failed e o grupo recebe um alerta de falha que nao existiu.
# --autostash cobre alteracao local inesperada em vez de abortar o dia.
if ! git diff --quiet -- data public/data; then
  log "AVISO: dados do dia sem commit antes do pull — commitando para poder sincronizar"
  run git add -A data public/data
  run git commit -m "chore: dados pendentes antes do recorde do dia $(date +%F)"
fi
run git pull --rebase --autostash origin main

run "$NPM" run snapshot:hype -- --today
run "$NPM" run settle:hype
run "$NPM" run ratings
run "$NPM" run titulo:prob
run "$NPM" run snapshot:prob
run "$NPM" run settle:prob
run "$NPM" run alertas
# Publica os payloads no Supabase: e por aqui que o numero do site atualiza sem
# depender do build/commit abaixo (o deploy continua valendo para codigo novo).
run "$NPM" run payloads:publicar

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

# Sem deploy aqui de proposito: o painel le os payloads do Supabase (passo
# payloads:publicar acima), entao o numero do dia ja esta no ar. O commit fica
# como historico/backup dos dados. Publicar build e coisa de codigo novo, nao de
# rotina diaria — e era o unico motivo de o job precisar de build e de gh-pages.

log "recorde diario: fim"
