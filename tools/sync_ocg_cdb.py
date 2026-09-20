#!/usr/bin/env python3
"""
同步官方卡库：把游戏侧 cards-zh-CN.cdb 中**站点缺少的卡**补进站点 cards_ocg.cdb（只增不删）。

用途：站点的官方卡库（cards_ocg.cdb）用于 /api/cards、卡池页、组卡搜索与 G-Ext 分数合并
（alias / 同名卡补分）。游戏侧更新后若新增了卡（多为异画卡），站点会因缺卡而：
  · 卡池 / 组卡搜索看不到该卡
  · 异画卡拿不到原卡分数（例如 66247040 → 66247039）
运行本脚本补齐即可。

用法：
    # 本机（Windows，已下载游戏卡库）
    python tools/sync_ocg_cdb.py --dry-run          # 先看差异
    python tools/sync_ocg_cdb.py                    # 实际补入
    # 服务器上（站点与游戏同机，直接指定两边路径）
    python3 tools/sync_ocg_cdb.py \
        --site /root/servers/siro/cards_ocg.cdb \
        --game /root/servers/ygopro/ygopro-database/locales/zh-CN/cards.cdb
    pm2 restart siro-web      # 刷新 /api/cards 与 /api/scores 缓存

默认路径：
    site = D:/YGO/Server/SirokamiServer/cards_ocg.cdb
    game = D:/YGO/ygopro3/cdb/cards-zh-CN.cdb

注：cards_ocg.cdb 在 .gitignore 中，不进 git；服务器上的文件需用 scp 上传（或在服务器上直接运行本脚本）。
"""
import argparse
import os
import shutil
import sqlite3
import sys

DEFAULT_SITE = "D:/YGO/Server/SirokamiServer/cards_ocg.cdb"
DEFAULT_GAME = "D:/YGO/ygopro3/cdb/cards-zh-CN.cdb"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", default=DEFAULT_SITE)
    ap.add_argument("--game", default=DEFAULT_GAME)
    ap.add_argument("--dry-run", action="store_true", help="只报告差异，不写入")
    ap.add_argument("--no-backup", action="store_true", help="不生成 .bak 备份")
    args = ap.parse_args()

    for p in (args.site, args.game):
        if not os.path.exists(p):
            print("找不到文件: %s" % p, file=sys.stderr)
            return 1

    site = sqlite3.connect(args.site)
    game = sqlite3.connect(args.game)

    site_ids = set(r[0] for r in site.execute("SELECT id FROM datas"))
    game_ids = set(r[0] for r in game.execute("SELECT id FROM datas"))
    missing = sorted(game_ids - site_ids)
    print("站点卡数 = %d，游戏卡数 = %d，需补 = %d" % (len(site_ids), len(game_ids), len(missing)))
    if not missing:
        print("已是最新，无需处理")
        site.close(); game.close()
        return 0
    if args.dry_run:
        for cid in missing[:40]:
            t = game.execute("SELECT name FROM texts WHERE id=?", (cid,)).fetchone()
            print("  %s  %s" % (cid, t[0] if t else ""))
        print("(--dry-run：未写入)")
        site.close(); game.close()
        return 0

    if not args.no_backup:
        bak = args.site + ".bak"
        if not os.path.exists(bak):
            shutil.copy2(args.site, bak)
            print("已备份 → %s" % bak)

    def cols(con, table):
        return [r[1] for r in con.execute("PRAGMA table_info(%s)" % table)]

    total = 0
    for table in ("datas", "texts"):
        sc, gc = cols(site, table), cols(game, table)
        common = [c for c in sc if c in gc]
        if not common:
            continue
        q = "INSERT OR REPLACE INTO %s (%s) VALUES (%s)" % (
            table, ",".join(common), ",".join(["?"] * len(common)))
        rows = game.execute(
            "SELECT %s FROM %s WHERE id IN (%s)" % (
                ",".join(common), table, ",".join(["?"] * len(missing))), missing).fetchall()
        site.executemany(q, rows)
        total = max(total, len(rows))
        print("%s 补入 %d 行" % (table, len(rows)))
    site.commit()
    print("完成：共补 %d 张卡，现站点卡数 = %d" % (total, site.execute("SELECT COUNT(*) FROM datas").fetchone()[0]))
    print("提示：请重启站点 API（pm2 restart siro-web）以刷新缓存")
    site.close(); game.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
