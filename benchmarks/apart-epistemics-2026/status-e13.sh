#!/usr/bin/env bash
# Read-only status check for E13 run under results/e13 (zero model calls).
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT" || exit 1
D=results/e13

echo "time: $(TZ=Australia/Brisbane date '+%F %T') Brisbane"
if [ -f "$D/DONE" ]; then echo "marker: DONE"; elif [ -f "$D/FAILED" ]; then echo "marker: FAILED"; else echo "marker: running/open"; fi
if [ -e "$D/overnight.lock" ] && ! flock -n "$D/overnight.lock" true; then echo "driver: active"; else echo "driver: idle"; fi
if [ -f prereg-e13.sha256 ] && sha256sum -c prereg-e13.sha256 --quiet > /dev/null 2>&1; then echo "hashes: ok"; else echo "hashes: check/missing"; fi

node -e "
const fs = require('fs');
for (const c of ['deepseek_on','deepseek_off','haiku_on','haiku_off','luna_on','luna_off']) {
  const f = '$D/e13-' + c + '.jsonl';
  if (!fs.existsSync(f)) { console.log(c.padEnd(14), 'not started'); continue; }
  const rows = fs.readFileSync(f,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  const errs = rows.filter(r => r.error).length;
  const usd = rows.reduce((a, r) => a + (r.usd ?? 0), 0);
  const sids = new Set(rows.map(r => r.sid));
  console.log(c.padEnd(14), 'sessions=' + sids.size, 'rows=' + rows.length, 'errs=' + errs, 'usd=' + usd.toFixed(4));
}
"
[ -f "$D/overnight.log" ] && { echo; echo "== tail overnight.log =="; tail -n 10 "$D/overnight.log"; }
