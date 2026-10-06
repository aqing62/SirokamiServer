#!/bin/bash
# 部署前备份：把站点里"可能被本地/线上单独改过"的数据文件快照一份。
# 起因：这些文件若在服务器上被直接改过又没进 git，git reset --hard 会把改动冲掉且无法找回。
# 用法（在服务器上、git reset 之前执行）：bash tools/backup-data.sh
set -u

SITE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-/root/siro-data-backups}"
KEEP="${KEEP:-30}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_ROOT/$STAMP"

mkdir -p "$DEST"
cd "$SITE_DIR" || exit 1

# 需要保护的数据/配置（含大数据文件与用户手改过的脚本）
FILES=(
    "new_cards.json"
    "lflist.conf"
    "DIY_Sirokami.cdb"
    "js/chronicle-decks.js"
    "decks/decks_data.json"
    "decks/chronicle_decks.json"
    "data/common_cards.json"
)

count=0
for f in "${FILES[@]}"; do
    if [ -f "$f" ]; then
        mkdir -p "$DEST/$(dirname "$f")"
        cp -p "$f" "$DEST/$f" && count=$((count + 1))
    fi
done

# 八强卡组的 ydk 原件
if [ -d decks ]; then
    mkdir -p "$DEST/decks"
    for d in 1 2 3 4 5 6; do
        [ -d "decks/$d" ] && cp -rp "decks/$d" "$DEST/decks/" 2>/dev/null
    done
fi

# 把当前 git 状态也记一笔，方便判断"哪些文件没进 git"
{
    echo "# $STAMP"
    echo "## 已备份文件"
    printf '%s\n' "${FILES[@]}"
    echo "## git status（未提交 = 有被 reset 冲掉的风险）"
    git status --porcelain 2>/dev/null
} > "$DEST/README.txt"

# 只保留最近 KEEP 份
ls -1dt "$BACKUP_ROOT"/*/ 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -rf

echo "已备份 $count 个数据文件 → $DEST"
du -sh "$DEST" 2>/dev/null | awk '{print "占用：" $1}'
