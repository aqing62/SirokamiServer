#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""没人打的时候重启 srvpro2_siro（把观战卡号补丁生效）。
判空标准：/api/liverooms 返回 0 个房间（连房间都没有），连续 2 次都空才重启，避免误判。
"""
import json, subprocess, time, urllib.request, ssl, datetime, sys, os

SSLCTX = ssl.create_default_context()
SSLCTX.check_hostname = False
SSLCTX.verify_mode = ssl.CERT_NONE
API = 'https://siro.ygopro3.cn/api/liverooms'
LOG = '/root/servers/siro/restart-when-idle.log'
MAX_HOURS = 8


def log(msg):
    line = '[%s] %s' % (datetime.datetime.now().strftime('%m-%d %H:%M:%S'), msg)
    print(line, flush=True)
    with open(LOG, 'a', encoding='utf-8') as f:
        f.write(line + '\n')


def rooms():
    req = urllib.request.Request(API + '?t=%d' % time.time(), headers={'User-Agent': 'idle-watchdog'})
    with urllib.request.urlopen(req, timeout=10, context=SSLCTX) as r:
        d = json.loads(r.read().decode('utf-8'))
    return d.get('rooms') or []


def main():
    log('看门狗启动：空房连续 2 次 → 重启 srvpro2_siro')
    empty_streak = 0
    t0 = time.time()
    while time.time() - t0 < MAX_HOURS * 3600:
        try:
            rs = rooms()
            if not rs:
                empty_streak += 1
                log('无人（连续 %d 次空）' % empty_streak)
                if empty_streak >= 2:
                    log('→ 执行 pm2 restart srvpro2_siro:50010')
                    subprocess.run(['pm2', 'restart', 'srvpro2_siro:50010'], capture_output=True)
                    time.sleep(12)
                    out = subprocess.run(['bash', '-lc', "ss -ltn | grep -c ':50010'"], capture_output=True, text=True)
                    log('重启完成，50010 监听数=%s' % (out.stdout.strip() or '0'))
                    return
            else:
                empty_streak = 0
                names = ', '.join(r.get('roomname', '?') for r in rs[:3])
                log('有 %d 个房间（%s），继续等' % (len(rs), names))
        except Exception as e:
            log('检查失败：%s' % e)
        time.sleep(30)
    log('超时退出（%d 小时内一直有人）' % MAX_HOURS)


if __name__ == '__main__':
    main()
