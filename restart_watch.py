#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
白神服 · 空闲自动重启看门狗
---------------------------------------------------
用途：srvpro2_siro 打了「观战者补发当前局历史」的补丁，需要重启一次才生效。
      这个脚本每 30 秒检查一次有没有人在打，连续 4 分钟没人打就自动重启一次，然后退出。

取消：touch /root/servers/siro/.no-restart   （下一次检查时脚本会自己退出）
日志：/root/servers/siro/restart-watch.log
"""
import json
import os
import subprocess
import sys
import time
import urllib.request
import ssl

API = "https://siro.ygopro3.cn/api/liverooms"
PM2_NAME = "srvpro2_siro:50010"
STOP_FILE = "/root/servers/siro/.no-restart"
LOG = "/root/servers/siro/restart-watch.log"
INTERVAL = 30          # 每 30 秒检查一次
IDLE_NEEDED = 8        # 连续 8 次（≈4 分钟）没人打才重启

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def log(msg):
    line = time.strftime("%Y-%m-%d %H:%M:%S") + "  " + str(msg)
    print(line, flush=True)
    try:
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def busy_count():
    """返回正在对局的人数（status 非空即视为在打）"""
    try:
        req = urllib.request.Request(API + "?t=" + str(int(time.time())))
        with urllib.request.urlopen(req, context=ctx, timeout=10) as r:
            data = json.loads(r.read())
    except Exception as e:
        log("⚠ 取房间失败：%s" % e)
        return None
    n = 0
    rooms = data.get("rooms") or []
    for room in rooms:
        for u in room.get("users") or []:
            if u.get("status"):
                n += 1
    return n, len(rooms)


def restart_srvpro():
    log("▶ 开始重启 %s ..." % PM2_NAME)
    try:
        out = subprocess.run(["pm2", "restart", PM2_NAME], capture_output=True, text=True, timeout=120)
        log("  pm2 输出：%s" % (out.stdout or "").strip().replace("\n", " | ")[:300])
    except Exception as e:
        log("✗ pm2 restart 失败：%s" % e)
        return False
    time.sleep(12)
    # 校验 1：端口在监听
    try:
        ss = subprocess.run(["bash", "-lc", "ss -ltn | grep -c ':50010'"], capture_output=True, text=True, timeout=20)
        log("  端口 50010 监听数：%s" % (ss.stdout or "").strip())
    except Exception as e:
        log("  ⚠ 端口检查失败：%s" % e)
    # 校验 2：API 可用
    try:
        req = urllib.request.Request("https://127.0.0.1:50009/api/getrooms?username=x&pass=x")
        with urllib.request.urlopen(req, context=ctx, timeout=10) as r:
            log("  API 状态码：%s" % r.status)
    except Exception as e:
        log("  ⚠ API 检查：%s" % e)
    # 校验 3：pm2 状态
    try:
        st = subprocess.run(["pm2", "jlist"], capture_output=True, text=True, timeout=30)
        arr = json.loads(st.stdout or "[]")
        for p in arr:
            if p.get("name") == PM2_NAME:
                log("  pm2 状态：%s（restarts=%s）" % (p.get("pm2_env", {}).get("status"), p.get("pm2_env", {}).get("restart_time")))
    except Exception as e:
        log("  ⚠ pm2 状态检查失败：%s" % e)
    return True


def main():
    log("=== 空闲自动重启看门狗启动（每 %ds 检查，连续 %d 次空闲触发）===" % (INTERVAL, IDLE_NEEDED))
    idle = 0
    while True:
        if os.path.exists(STOP_FILE):
            log("检测到 %s → 退出（未重启）" % STOP_FILE)
            return
        res = busy_count()
        if res is None:
            idle = 0                      # 取不到数据就当有人在打，保守
        else:
            busy, rooms = res
            if busy == 0:
                idle += 1
                log("空闲中 %d/%d（房间 %d 个，对局中 0 人）" % (idle, IDLE_NEEDED, rooms))
                if idle >= IDLE_NEEDED:
                    log("✅ 连续 %d 次没有人在打 → 执行重启" % idle)
                    if restart_srvpro():
                        log("=== 重启完成，补丁已生效，脚本退出 ===")
                    else:
                        log("=== 重启失败，脚本退出（请手动 pm2 restart %s）===" % PM2_NAME)
                    return
            else:
                if idle:
                    log("有人在打（%d 人）→ 空闲计数清零" % busy)
                idle = 0
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
