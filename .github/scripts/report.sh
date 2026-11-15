#!/usr/bin/env bash
# report.sh — the last step of every refresh job: the summary table and the
# ONLY place that decides whether anyone gets notified.
#
#   report.sh "<nome>:<outcome>:<state>" … [--publish <outcome>]
#
#   outcome  steps.<id>.outcome (success|failure|cancelled|skipped)
#   state    steps.<id>.outputs.state from run-build.sh
#
# A run no longer fails because a source had a bad hour. What notifies is a
# snapshot that has outlived its grace period (state=stale), a step that died
# outside run-build.sh, or a publish that failed. Each opens ONE issue titled
# "[refresh] <nome> — …" — later runs only refresh its body (edits do not
# notify) — and the first run that finds the data healthy again closes it with
# a comment. One incident, two notifications, instead of six a day.
#
# Fallback: if an alert is due but the issue cannot be written (no token, API
# down, issues disabled), the run fails instead, so the alarm is never lost.

set -uo pipefail

REPORT=${REFRESH_REPORT_DIR:-${RUNNER_TEMP:-/tmp}/refresh-report}
RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"
SUMMARY=${GITHUB_STEP_SUMMARY:-/dev/stdout}
now=$(TZ=Europe/Lisbon date '+%d/%m/%Y %H:%M')

rows=() publish=""
while [ $# -gt 0 ]; do
  case $1 in
    --publish) publish=${2:-}; shift 2 ;;
    *)         rows+=("$1"); shift ;;
  esac
done

alert=() heal=()
mkdir -p "$REPORT"
{
  echo "| build | estado |"
  echo "|---|---|"
  for row in "${rows[@]}"; do
    name=${row%%:*}; rest=${row#*:}; outcome=${rest%%:*}; state=${rest#*:}
    case "$outcome/$state" in
      skipped/*)   s="⏸️ desativado" ;;
      failure/*|cancelled/*)
                   s="❌ o passo terminou em $outcome"; alert+=("$name")
                   [ -f "$REPORT/$name.md" ] || echo "**Motivo:** o passo terminou em \`$outcome\` fora do run-build.sh (erro do próprio runner ou timeout do passo)." > "$REPORT/$name.md" ;;
      */built)     s="✅ reconstruído";                       heal+=("$name") ;;
      */fresh)     s="⏭️ ainda fresco";                       heal+=("$name") ;;
      */kept)      s="⚠️ fonte falhou — snapshot anterior mantido" ;;
      */stale)     s="❌ dados parados além da tolerância";    alert+=("$name") ;;
      *)           s="❔ sem estado ($outcome)" ;;
    esac
    echo "| $name | $s |"
  done
  if [ -n "$publish" ]; then
    if [ "$publish" = success ]; then
      echo "| publicação | ✅ |"; heal+=("publicação")
    elif [ "$publish" != skipped ]; then
      echo "| publicação | ❌ $publish |"; alert+=("publicação")
      echo "**Motivo:** o commit/push dos dados falhou (\`$publish\`). Os builds correram mas nada chegou ao site." > "$REPORT/publicação.md"
    fi
  fi
} >> "$SUMMARY"

can_gh=true
command -v gh >/dev/null 2>&1 && [ -n "${GH_TOKEN:-}" ] || can_gh=false

find_issue() {
  gh issue list --state open --limit 200 --json number,title \
    --jq ".[] | select(.title | startswith(\"[refresh] $1 —\")) | .number" 2>/dev/null | head -n1
}

lost=""
for name in "${alert[@]}"; do
  body=$(mktemp)
  {
    echo "O refresh de **$name** precisa de atenção (${GITHUB_WORKFLOW:-refresh}, $now)."
    echo
    cat "$REPORT/$name.md" 2>/dev/null
    echo
    echo "Execução: $RUN_URL"
    echo
    echo "Enquanto isto estiver aberto, o site continua a servir o último snapshot bom."
    echo "Esta issue fecha-se sozinha quando um refresh voltar a ter dados frescos."
  } > "$body"
  if ! $can_gh; then lost="$lost $name"; rm -f "$body"; continue; fi
  n=$(find_issue "$name")
  if [ -n "$n" ]; then
    gh issue edit "$n" --body-file "$body" >/dev/null || lost="$lost $name"
    echo "Alerta já aberto para $name: #$n (corpo atualizado)."
  else
    gh issue create --title "[refresh] $name — dados parados" --body-file "$body" >/dev/null \
      && echo "Aberto alerta para $name." || lost="$lost $name"
  fi
  rm -f "$body"
done

if $can_gh; then
  for name in "${heal[@]}"; do
    n=$(find_issue "$name")
    [ -n "$n" ] || continue
    gh issue close "$n" --comment "Recuperado em $now — $RUN_URL" >/dev/null \
      && echo "Fechado alerta de $name: #$n."
  done
fi

if [ -n "$lost" ]; then
  echo "::error::alertas por publicar (sem acesso a issues):$lost"
  exit 1
fi
exit 0
