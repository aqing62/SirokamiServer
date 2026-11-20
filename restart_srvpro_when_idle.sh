#!/bin/bash
# 空闲重启 srvpro2_siro:50010（让断线宽限补丁生效）
# 空闲判定：连续 3 次（每 20 秒）
#   ① 没有 ocgcore 对局进程
#   ② /api/liverooms 里没有"有玩家的房间"
LOG=/root/servers/siro/logs/idle_restart.log
idle=0
for i in $(seq 1 900); do
  n=$(pgrep -f "ocgcore" | wc -l)
  busy=$(curl -sk --max-time 6 https://siro.ygopro3.cn/api/liverooms 2>/dev/null | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
except Exception:
    print('0'); raise SystemExit
rooms=d.get('rooms') if isinstance(d,dict) else d
n=0
for r in (rooms or []):
    ps=[p for p in (r.get('players') or []) if isinstance(p,dict) and p.get('name')]
    if len(ps)>=1: n+=1
print(n)
" 2>/dev/null)
  [ -z "$busy" ] && busy=0
  if [ "$n" = "0" ] && [ "$busy" = "0" ]; then idle=$((idle+1)); else idle=0; fi
  echo "[$(date '+%F %T')] check#$i ocg=$n busyRooms=$busy idle=$idle" >> "$LOG"
  if [ "$idle" -ge 3 ]; then
    echo "[$(date '+%F %T')] 空闲确认 → 重启 srvpro2_siro:50010" >> "$LOG"
    pm2 restart srvpro2_siro:50010 >> "$LOG" 2>&1
    sleep 14
    ok=$(ss -ltn 2>/dev/null | grep -c ':50010')
    echo "[$(date '+%F %T')] 重启后 50010 监听=$ok" >> "$LOG"
    if [ "$ok" -ge 1 ]; then
      echo "[$(date '+%F %T')] 完成：断线宽限已生效" >> "$LOG"
      exit 0
    fi
    idle=0
  fi
  sleep 20
done
echo "[$(date '+%F %T')] 等待超时（5 小时）未重启" >> "$LOG"
