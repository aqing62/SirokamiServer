#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""称号商店 · 赛季积分结算（兜底脚本）

正常情况下**不需要**跑它：
  游戏服 `POST /api/ladder/reset`（resetSeason）会在清空 player_rating **之前**，
  自动把每个人的最终天梯积分写进 `ygo_ladder_season_result`，
  官网称号商店直接按这张表发称号点。

什么时候需要手动跑：
  - 游戏服还是旧版本（没有赛季积分快照），但赛季已经要重置了；
  - 重置时赛季名传错 / 结果表没写成功，想按当前 player_rating 重算一次。

用法（在**服务器**上跑，需要能连 srvpro2_siro）：
  python3 tools/settle-season.py --dry-run          # 只看会发多少，不写库
  python3 tools/settle-season.py                    # 按官网 SEASON_NAME 结算
  python3 tools/settle-season.py --season S4        # 指定赛季名

说明：
  - 幂等：同赛季同账号重复写只会更新数值（ON CONFLICT DO UPDATE）；
  - 只结算 rating >= 1 的账号：1 分 = 1 称号点，0 分没东西可发；
  - 赛季名要与官网 vote_server.py 的 SEASON_NAME 一致，否则商店里看不到记录。
"""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import vote_server as vs  # noqa: E402  （复用同一套 psql 连接/配置）


INSERT_SQL = (
    'INSERT INTO ygo_ladder_season_result\n'
    '  (season, "accountName", "displayName", rating, wins, losses, draws, "totalDuels", tier, "settledAt")\n'
    "VALUES (:'season', :'acct', :'disp', :'rating'::int, :'wins'::int, :'losses'::int,\n"
    "        :'draws'::int, :'duels'::int, :'tier', now())\n"
    'ON CONFLICT (season, "accountName") DO UPDATE SET\n'
    '  "displayName" = EXCLUDED."displayName",\n'
    "  rating        = EXCLUDED.rating,\n"
    "  wins          = EXCLUDED.wins,\n"
    "  losses        = EXCLUDED.losses,\n"
    "  draws         = EXCLUDED.draws,\n"
    '  "totalDuels"  = EXCLUDED."totalDuels",\n'
    "  tier          = EXCLUDED.tier,\n"
    '  "settledAt"   = now();\n'
)


def main() -> int:
    parser = argparse.ArgumentParser(description="把当前 player_rating 结算成称号点流水")
    parser.add_argument("--season", default=vs.SEASON_NAME, help=f"赛季名（默认 {vs.SEASON_NAME}）")
    parser.add_argument("--min-rating", type=int, default=1, help="最低结算积分（默认 1）")
    parser.add_argument("--dry-run", action="store_true", help="只打印，不写库")
    args = parser.parse_args()

    season = (args.season or "").strip()[:32]
    if not season:
        print("赛季名不能为空")
        return 2
    if season != vs.SEASON_NAME:
        print(f"⚠ 赛季名 {season} 与官网 SEASON_NAME={vs.SEASON_NAME} 不一致，商店里可能显示不到")

    vs.ensure_title_shop_schema()

    try:
        rows = vs._pg_query(
            'select "accountName", coalesce("displayName", \'\'), rating, wins, losses, draws, "totalDuels"\n'
            'from player_rating where rating >= :\'min\'::int order by rating desc',
            {"min": str(max(1, args.min_rating))},
        )
    except Exception as e:
        print(f"读取 player_rating 失败: {e}")
        return 1

    total_points = 0
    written = 0
    preview = []
    for row in rows:
        try:
            acct = row[0]
            disp = row[1] if len(row) > 1 else ""
            rating = int(row[2] or 0) if len(row) > 2 else 0
            wins = int(row[3] or 0) if len(row) > 3 else 0
            losses = int(row[4] or 0) if len(row) > 4 else 0
            draws = int(row[5] or 0) if len(row) > 5 else 0
            duels = int(row[6] or 0) if len(row) > 6 else 0
        except (ValueError, IndexError) as e:
            print(f"跳过一行异常数据: {row} ({e})")
            continue
        if not acct or rating <= 0:
            continue
        total_points += rating
        if len(preview) < 5:
            preview.append(f"  {acct}（{disp or '-'}） +{rating}")
        if args.dry_run:
            continue
        try:
            vs._psql_run(INSERT_SQL, {
                "season": season, "acct": acct, "disp": disp or "",
                "rating": str(rating), "wins": str(wins), "losses": str(losses),
                "draws": str(draws), "duels": str(duels), "tier": "",
            }, ["-tA"])
            written += 1
        except Exception as e:
            print(f"写入失败 {acct}: {e}")

    print(f"赛季 {season}: {len(rows)} 条 player_rating，合计 {total_points} 称号点")
    if preview:
        print("积分前 5：")
        print("\n".join(preview))
    if args.dry_run:
        print("（--dry-run：没有写库）")
    else:
        print(f"已写入 {written} 条到 ygo_ladder_season_result")
        print("提示：官网称号商店刷新即可看到「赛季发放记录」。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
