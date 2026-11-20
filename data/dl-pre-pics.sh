#!/bin/bash
T=/root/servers/website/resource/siro
python3 - <<'PY' > /tmp/pre_ids.txt
import sqlite3, glob
ids = set()
for f in glob.glob('/root/servers/ygopro/srvpro-siro/cards-pre/*.cdb'):
    try:
        c = sqlite3.connect(f)
        for (i,) in c.execute('select id from texts'):
            ids.add(int(i))
        c.close()
    except Exception:
        pass
for i in sorted(ids):
    print(i)
PY
LOG=/root/servers/siro/data/dl-pre-pics.log
echo "$(date '+%F %T') 开始：共 $(wc -l < /tmp/pre_ids.txt) 个先行卡号" > "$LOG"
dl_one() {
  ID="$1"; OUT="$T/$ID.jpg"
  [ -s "$OUT" ] && { echo "skip $ID" >> "$LOG.done"; return; }
  for u in "https://cdn.233.momobako.com/ygopro/pics/$ID.jpg" "https://cdn02.moecube.com:444/ygopro-super-pre/data/pics/$ID.jpg"; do
    code=$(curl -s -o "$OUT.tmp" -w '%{http_code}' --max-time 12 "$u")
    if [ "$code" = "200" ] && [ -s "$OUT.tmp" ]; then mv "$OUT.tmp" "$OUT"; echo "ok $ID" >> "$LOG.done"; return; fi
  done
  rm -f "$OUT.tmp"; echo "miss $ID" >> "$LOG.done"
}
export -f dl_one 2>/dev/null || true
: > "$LOG.done"
cat /tmp/pre_ids.txt | xargs -P 8 -I {} bash -c 'dl_one "$@"' _ {}
echo "$(date '+%F %T') 完成： ok=$(grep -c '^ok' "$LOG.done") skip=$(grep -c '^skip' "$LOG.done") miss=$(grep -c '^miss' "$LOG.done")" >> "$LOG"
