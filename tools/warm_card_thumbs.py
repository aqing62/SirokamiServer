#!/usr/bin/env python3
"""预热卡图缩略图缓存（组卡器网格用 w=150，详情用 w=360）。

用法：
    python3 tools/warm_card_thumbs.py                # 常用卡全部分组
    python3 tools/warm_card_thumbs.py --all          # 站点全部卡（耗时很长）
    python3 tools/warm_card_thumbs.py --width 150

实现：先请求一次 /thumbcard（服务端会 302 并在后台生成），再轮询直到命中缓存。
"""
import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request

BASE = "http://127.0.0.1:8092/thumbcard/%d.jpg?w=%d"
ROOT = "/root/servers/siro"
THUMB_DIR = os.path.join(ROOT, "card_thumbs")


def http_codes(url):
    try:
        r = subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
                            "--max-time", "15", url], capture_output=True, text=True)
        return r.stdout.strip()
    except Exception:
        return "000"


def cached(cid, w):
    p = os.path.join(THUMB_DIR, "%d_%d.jpg" % (cid, w))
    return os.path.isfile(p) and os.path.getsize(p) > 512


def warm(cid, w):
    if cached(cid, w):
        return True
    http_codes(BASE % (cid, w))          # 触发一次（多半 302）
    for _ in range(20):                  # 最多等 10 秒
        time.sleep(0.5)
        if cached(cid, w):
            return True
    return False


def load_ids(all_cards=False):
    if all_cards:
        try:
            with urllib.request.urlopen("http://127.0.0.1:8092/api/cards", timeout=60) as r:
                data = json.load(r)
            if isinstance(data, dict):
                data = list(data.values())
            return [int(c["id"]) for c in data if isinstance(c, dict) and c.get("id")]
        except Exception as e:
            print("读取 /api/cards 失败:", e, file=sys.stderr)
            return []
    path = os.path.join(ROOT, "data", "common_cards.json")
    with open(path, encoding="utf-8") as f:
        d = json.load(f)
    ids = []
    for g in (d.get("groups") or d.get("Groups") or []):
        for cid in (g.get("cards") or g.get("Cards") or []):
            cid = int(cid)
            if cid not in ids:
                ids.append(cid)
    return ids


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="站点全部卡（很慢，约 1~2 小时）")
    ap.add_argument("--width", type=int, default=0, help="只做某个宽度（默认 150 和 360）")
    args = ap.parse_args()

    ids = load_ids(args.all)
    widths = [args.width] if args.width else [150, 360]
    print("待处理卡数:", len(ids), "宽度:", widths, flush=True)
    ok = 0
    t0 = time.time()
    for i, cid in enumerate(ids, 1):
        for w in widths:
            if warm(cid, w):
                ok += 1
        if i % 50 == 0:
            print("进度 %d/%d（成功 %d，用时 %ds）" % (i, len(ids), ok, time.time() - t0), flush=True)
    print("完成：%d 个缩略图（用时 %ds）" % (ok, time.time() - t0), flush=True)


if __name__ == "__main__":
    main()
