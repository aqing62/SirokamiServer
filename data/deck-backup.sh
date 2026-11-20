#!/bin/bash
# 白神服：卡组目录自动备份（每小时一份，保留最近 48 份 = 2 天）
D=/root/servers/siro/data/duel-decks
B=/root/servers/siro/data/duel-decks-backup/$(date +%Y%m%d-%H)
mkdir -p "$B"
cp -an "$D"/. "$B"/ 2>/dev/null
# 只保留最近 48 个时间戳目录（手动备份 manual-* 不动 ✓）
ls -dt /root/servers/siro/data/duel-decks-backup/[0-9]*/ 2>/dev/null | tail -n +49 | xargs -r rm -rf
