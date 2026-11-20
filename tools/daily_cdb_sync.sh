#!/bin/bash
# 每日同步官方卡库：把游戏侧 cards.cdb 新增的卡补进站点 cards_ocg.cdb，
# 有新增时重启 siro-web 让 /api/cards、卡池、组卡搜索立刻看到新卡。
#
# 背景：站点卡库 cards_ocg.cdb 在 .gitignore 里，游戏侧（ygopro-database）更新后
# 站点不会自动跟进；之前出现过「异解」等新卡在官网卡池里搜不到（用户反馈）。
set -u

SITE=/root/servers/siro/cards_ocg.cdb
GAME=/root/servers/ygopro/ygopro-database/locales/zh-CN/cards.cdb
LOG=/root/servers/siro/logs/cdb_sync.log
mkdir -p "$(dirname "$LOG")"

if [ ! -f "$GAME" ]; then
  echo "[$(date '+%F %T')] 找不到游戏卡库: $GAME" >> "$LOG"
  exit 0
fi

OUT=$(cd /root/servers/siro && python3 tools/sync_ocg_cdb.py --site "$SITE" --game "$GAME" 2>&1)
echo "[$(date '+%F %T')] $OUT" >> "$LOG"

if echo "$OUT" | grep -q "完成：共补"; then
  echo "[$(date '+%F %T')] 有新增卡 → 重建决斗页卡文表" >> "$LOG"
  # PATCH(白神服) 2026-11-16: 决斗页用的是 data/duel-cards-text.json（预生成），
  #   卡库更新后必须一起重建，否则决斗页的卡文/种族/属性还是旧库（和组卡界面不一致）
  if [ -f /root/servers/siro/tools/gen-duel-data.mjs ]; then
    GEN=$(cd /root/servers/siro && node tools/gen-duel-data.mjs 2>&1 | tail -2)
    echo "[$(date '+%F %T')] gen-duel-data: $GEN" >> "$LOG"
  fi
  echo "[$(date '+%F %T')] 重启 siro-web 刷新缓存" >> "$LOG"
  pm2 restart siro-web >/dev/null 2>&1
  sleep 15
  n=$(curl -sk --max-time 10 "https://siro.ygopro3.cn/api/cards?t=$(date +%s)" | grep -o '"id"' | wc -l)
  t=$(curl -sk --max-time 20 "https://siro.ygopro3.cn/api/cardtext?t=$(date +%s)" | head -c 200 | grep -c '"d"' || true)
  echo "[$(date '+%F %T')] 重启完成，/api/cards 卡数≈$n，cardtext 可用=$t" >> "$LOG"
fi
