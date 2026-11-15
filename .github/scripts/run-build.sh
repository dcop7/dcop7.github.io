#!/usr/bin/env bash
# run-build.sh — run ONE snapshot build so that nothing it does can hurt the
# site or break the run. Every refresh step goes through here.
#
#   run-build.sh <nome> <snapshot.json> <gate> <grace-h> <limit-min> "<paths>" -- <cmd…>
#
#   nome       label for logs, the summary and the alert issue
#   snapshot   the JSON whose own stamp says how old the data is (stale.mjs)
#   gate       rebuild when older than this: `day` or hours (stale.mjs modes)
#   grace-h    how long the site can live on the previous snapshot before a
#              human must look. Past it the build is reported as `stale`.
#   limit-min  hard wall-clock limit for the command (keep it BELOW the
#              step's timeout-minutes, so this script — not the runner — is
#              what cuts a slow build, and still reports it)
#   paths      space-separated paths the build writes (rolled back on failure)
#
# Why it exists. The external sources these builds scrape go down, change
# format, rate-limit or hang (Nov 2026: nocartaz.pt vanished whole-site behind
# a Vercel 402 and the daily run failed six times a day for nothing). A failed
# exit code is a poor alarm: it fires on every cron for an outage nobody here
# can fix, and it says nothing when a build "succeeds" without refreshing.
# So the alarm is the DATA instead:
#
#   * the command runs under its own timeout, output is tee'd for the report;
#   * on success every JSON it touched must parse, or that counts as failure;
#   * on failure everything it wrote is rolled back to the pre-build state —
#     a half-written or invalid snapshot never reaches the commit;
#   * then the snapshot's age decides: within grace → `kept` (a warning, the
#     site keeps serving the previous data); past grace → `stale`, which
#     report.sh turns into ONE issue that closes itself on recovery.
#
# Outputs (GITHUB_OUTPUT): state=fresh|built|kept|stale, built=yes on success.
# A note for report.sh lands in $REFRESH_REPORT_DIR/<nome>.md.
# This script itself always exits 0.

set -uo pipefail

name=$1 snap=$2 gate=$3 grace=$4 limit=$5 paths=$6
shift 6
[ "${1:-}" = -- ] && shift

say()  { echo "$1" >> "${GITHUB_OUTPUT:-/dev/null}"; }
note() { mkdir -p "$REPORT"; printf '%s\n' "$@" > "$REPORT/$name.md"; }
REPORT=${REFRESH_REPORT_DIR:-${RUNNER_TEMP:-/tmp}/refresh-report}
STALE=.github/scripts/stale.mjs

if [ "$(node "$STALE" "$snap" "$gate")" != true ]; then
  echo "$name: ainda fresco — nada a fazer."
  say state=fresh; exit 0
fi

# Checkpoint: stage the current state of the owned paths. The worktree-vs-index
# diff is then exactly what this build wrote, and `git checkout` puts it back.
# Staging is harmless — commit-push stages these same paths anyway.
# shellcheck disable=SC2086  # $paths is a space-separated list on purpose
git add -A -- $paths 2>/dev/null || true

log=$(mktemp)
start=$(date +%s)
timeout --kill-after=30s "${limit}m" "$@" 2>&1 | tee "$log"
rc=${PIPESTATUS[0]}
took=$(( $(date +%s) - start ))

why=""
case $rc in
  0)   ;;
  124|137) why="cortado ao fim de ${limit} min" ;;
  75)  why="fonte indisponível" ;;
  *)   why="saiu com código $rc" ;;
esac

if [ "$rc" = 0 ]; then
  # shellcheck disable=SC2086
  bad=$( { git diff --name-only -- $paths; git ls-files --others --exclude-standard -- $paths; } \
         | grep '\.json$' | sort -u \
         | node -e '
             const fs = require("fs"); const bad = [];
             for (const f of fs.readFileSync(0, "utf8").split("\n").filter(Boolean)) {
               try { if (fs.existsSync(f)) JSON.parse(fs.readFileSync(f, "utf8")); }
               catch { bad.push(f); }
             }
             process.stdout.write(bad.join(" "));' )
  [ -n "$bad" ] && { rc=65; why="escreveu JSON inválido: $bad"; }
fi

if [ "$rc" != 0 ]; then
  # Roll back whatever the build managed to write before it failed.
  # shellcheck disable=SC2086
  git checkout --quiet -- $paths 2>/dev/null || true
  # shellcheck disable=SC2086
  git clean --quiet -fd -- $paths 2>/dev/null || true
fi

# The age verdict is about the data, not the exit code, and never forced:
# a manual run (FORCE=true) must not make every snapshot look ancient.
past=$(FORCE=false node "$STALE" "$snap" "$grace")
# This excerpt ends up in a PUBLIC issue, where GitHub's log masking does not
# apply: strip the secrets the builds receive, anything key-shaped, and the
# `::` that would turn a log line into a workflow command.
tail_log=$(tail -n 25 "$log" | sed -E 's/::/: :/g; s/(gsk_|ghp_|ghs_|github_pat_|AIza|AKIA)[A-Za-z0-9_-]{8,}/[ocultado]/g')
for v in GROQ_KEY GH_TOKEN GITHUB_TOKEN ITAD_KEY TINYFISH_KEY TMDB_KEY; do
  val=${!v:-}
  [ ${#val} -ge 8 ] && tail_log=${tail_log//"$val"/[ocultado]}
done
rm -f "$log"

if [ "$rc" = 0 ] && [ "$past" != true ]; then
  echo "$name: reconstruído em ${took}s."
  say state=built; say built=yes; exit 0
fi

if [ "$past" = true ]; then
  if [ "$rc" = 0 ]; then why="terminou sem erro mas o snapshot continua com mais de ${grace} h"; fi
  echo "::error::$name: $why — dados com mais de ${grace} h."
  say state=stale
else
  echo "::warning::$name: $why — mantido o snapshot anterior (ainda dentro das ${grace} h de tolerância)."
  say state=kept
fi
note "**Motivo:** $why" "**Snapshot:** \`$snap\` (tolerância ${grace} h)" "" \
     '<details><summary>Últimas linhas do build</summary>' "" '```' "$tail_log" '```' '</details>'
exit 0
