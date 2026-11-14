#!/usr/bin/env bash
# E13 overnight/main runner: 3 provider groups in parallel (Workers AI, Anthropic, OpenAI), 4 formats, 10 scenarios (240 sessions).
# Each provider group enforces its own --max-usd safety cap and auto-resumes transient errors.
#   bash overnight-e13.sh main     real run against http://127.0.0.1:8787 after verifying prereg-e13.sha256
#   bash overnight-e13.sh dry      0-USD mock run under results/dry-e13
set -u
ROOT=/home/gyeol/apart-epistemics-sprint
cd "$ROOT" || exit 1
export PATH=/home/gyeol/.nvm/versions/node/v22.23.4/bin:$PATH

MODE=${1:-main}
if [ "$MODE" = dry ]; then
  OUTDIR=results/dry-e13
  MOCK=--mock
  WAIT=1
  REP=report/dry-metrics-e13.md
  JSN=report/dry-metrics-e13.json
else
  OUTDIR=results/e13
  MOCK=
  WAIT=60
  REP=report/metrics-e13.md
  JSN=report/metrics-e13.json
fi
SESSIONS=data/sessions-e13.json
CELLS=(deepseek_on deepseek_off haiku_on haiku_off luna_on luna_off)

mkdir -p "$OUTDIR" report
LOG=$OUTDIR/overnight.log
exec 9> "$OUTDIR/overnight.lock"
flock -n 9 || { echo "$(date '+%F %T %Z') already running, exiting" >> "$LOG"; exit 0; }
log() { echo "$(date '+%F %T %Z') $*" | tee -a "$LOG"; }

[ -f "$OUTDIR/DONE" ] && { log "DONE marker present, nothing to do"; exit 0; }
[ -f "$OUTDIR/FAILED" ] && { log "FAILED marker present, check manually"; exit 4; }
log "start E13 ($MODE), node $(node -v), cells: ${CELLS[*]}"

if [ "$MODE" = dry ] && [ ! -f prereg-e13.sha256 ]; then
  log "dry run: no prereg-e13.sha256 yet"
elif [ -f prereg-e13.sha256 ]; then
  if ! sha256sum -c prereg-e13.sha256 --quiet >> "$LOG" 2>&1; then
    log "hash mismatch against prereg-e13.sha256: stop"
    echo "hash mismatch against prereg-e13.sha256" > "$OUTDIR/FAILED"
    exit 4
  fi
  log "prereg-e13.sha256 ok"
elif [ "$MODE" != dry ]; then
  log "missing prereg-e13.sha256 for main run: stop"
  echo "missing prereg-e13.sha256" > "$OUTDIR/FAILED"
  exit 4
fi

proxy_ok() { [ "$(curl -s -o /dev/null -m 10 -w '%{http_code}' http://127.0.0.1:8787/)" = 200 ]; }
if [ -z "$MOCK" ] && ! proxy_ok; then
  log "proxy unreachable at http://127.0.0.1:8787/"
  echo "proxy unreachable at 127.0.0.1:8787" > "$OUTDIR/FAILED"
  exit 1
fi

cap_of() {
  case "$1" in
    deepseek_*) echo 12.0 ;;
    haiku_*) echo 9.0 ;;
    luna_*) echo 10.0 ;;
  esac
}
conc_of() {
  case "$1" in
    luna_*) echo 3 ;;
    *) echo 4 ;;
  esac
}

run_cell() {
  local c="$1"
  node src/run-e13.mjs $MOCK --sessions "$SESSIONS" --models "$c" --formats natural,json,jsonchain,lon \
    --concurrency "$(conc_of "$c")" --min-gap-ms 400 --max-usd "$(cap_of "$c")" \
    --out "$OUTDIR/e13-$c.jsonl" >> "$OUTDIR/e13-$c.log" 2>&1
}

run_group() {
  local name="$1"; shift
  local gcells=("$@")
  declare -A grc
  for c in "${gcells[@]}"; do grc[$c]=9; done
  for pass in 1 2 3 4; do
    for c in "${gcells[@]}"; do
      if [ "${grc[$c]}" != 0 ]; then
        run_cell "$c"
        grc[$c]=$?
      fi
    done
    local summary="" all_done=1
    for c in "${gcells[@]}"; do
      summary="$summary $c=${grc[$c]}"
      [ "${grc[$c]}" != 0 ] && all_done=0
    done
    log "group $name pass $pass:$summary"
    [ "$all_done" = 1 ] && return 0
    sleep "$WAIT"
  done
  return 2
}

run_group workersai deepseek_on deepseek_off & P_DS=$!
run_group anthropic haiku_on haiku_off & P_HK=$!
run_group openai luna_on luna_off & P_LN=$!

RC_ALL=0
wait "$P_DS" || RC_ALL=$?
wait "$P_HK" || RC_ALL=$?
wait "$P_LN" || RC_ALL=$?

IN_FILES=$(printf "$OUTDIR/e13-%s.jsonl," "${CELLS[@]}" | sed 's/,$//')
node src/score-e13.mjs --in "$IN_FILES" --sessions "$SESSIONS" --report "$REP" --json "$JSN" >> "$LOG" 2>&1 || log "score-e13 failed"

if [ "$RC_ALL" = 0 ]; then
  echo "finished $(date '+%F %T %Z') rc=0" > "$OUTDIR/DONE"
  log "DONE written"
else
  log "finished with non-zero group exit rc=$RC_ALL"
fi
exit "$RC_ALL"
