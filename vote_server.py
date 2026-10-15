#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""晓白形象投票后端服务器 — 端口 8092"""

import hashlib
import hmac
import base64
import gzip
import json
import logging
import os
import re
import sqlite3
import ssl
import subprocess
import threading
import time
import urllib.request
import urllib.error
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlencode, quote

# ── 配置 ──────────────────────────────────────────────────
HOST = "0.0.0.0"
PORT = 8092
ROOT = Path(__file__).resolve().parent
IMG_DIR = ROOT / "xiaobairenshe"
THUMB_DIR = ROOT / "xiaobairenshe_thumb"
DATA_FILE = ROOT / "vote_data.json"
CDB_FILE = ROOT / "DIY_Sirokami.cdb"
# 先行卡（预发布卡）CDB：**直接读游戏服目录，只调用不迁移**（用户要求）。
# 顺序 = srvpro2 的 ygoproPath 顺序里 cards-pre 内部顺序（release → update），先到先得。
PRE_CDB_FILES = [
    "/root/servers/ygopro/cards-pre/test-release.cdb",
    "/root/servers/ygopro/cards-pre/test-update.cdb",
]
MAX_VOTES = 2
THUMB_WIDTH = 200
THUMB_QUALITY = 72

# ── 比赛排表代理配置 ──────────────────────────────────────
TOURNAMENT_ID = "198"  # 默认比赛ID（当前赛事）；比赛时改这里（198=白神服新人交流友谊赛·Bo1）
# 「比赛相关」板块展示的两场比赛：左=瑞士轮，右=淘汰赛
# 前端通过 /api/tournament?slot=swiss|elim 取用；新比赛时改这里即可
# 值填 False = 该槽位编号尚未确定（例如淘汰赛要等瑞士轮结束后才知道），
# 前端会显示「待公布」占位效果，不再请求上游接口
TOURNAMENT_SLOTS = {
    "swiss": "198",   # 白神服新人交流友谊赛（Bo1）
    "elim": False,    # 尚未确定
}
# 槽位显示名 & 编号未确定时的提示文案
TOURNAMENT_SLOT_LABELS = {"swiss": "瑞士轮", "elim": "淘汰赛"}
TOURNAMENT_PENDING_MESSAGE = {
    "elim": "淘汰赛对阵将在瑞士轮结束后公布",
    "swiss": "瑞士轮对阵待公布",
}
TABULATOR_API_URL = "https://api-tabulator.moecube.com:444/api/tournament"
TABULATOR_API_KEY = "MRAUXnLph1YP2sVeC9fQr7MKSK9KvbmoKrPchtED2YjKuVe5Q2x1zv32HrRxjfiC"
TOURNAMENT_CACHE_TTL = 15  # 缓存秒数

# ── Cookie 认证配置 ─────────────────────────────────────────
COOKIE_NAME = "siro_admin"
COOKIE_SECRET = "siro_admin_secret_2026_f1a8c"
COOKIE_MAX_AGE = 86400  # 24 小时

COMMUNITY_COOKIE_NAME = "siro_community"
COMMUNITY_COOKIE_SECRET = "siro_community_secret_2026_g3b2d"
COMMUNITY_COOKIE_MAX_AGE = 604800  # 7 天

AVATAR_DIR = ROOT / "avatars"
AVATAR_SIZE = 64

# ── 腾讯云文本内容安全（TMS）配置 ─────────────────────────
TMS_ENDPOINT = "tms.tencentcloudapi.com"
TMS_ENABLED = True  # 设为 False 可临时关闭检测

def _load_tms_config():
    """从 config.local.json 加载密钥（不提交到 git）。"""
    config_path = ROOT / "config.local.json"
    if config_path.is_file():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            return cfg.get("tms_secret_id", ""), cfg.get("tms_secret_key", "")
        except Exception:
            pass
    return "", ""

TMS_SECRET_ID, TMS_SECRET_KEY = _load_tms_config()

# ── srvpro2 服务器对局监控代理配置 ─────────────────────────
SRVPRO_API_URL = "https://127.0.0.1:50009"
SRVPRO_READ_USER = "readonly"
SRVPRO_READ_PASS = "readonly123"

# ── CDB 类型常量 (与前端 card-pool-info.js 保持一致) ──────
TYPE_MASKS = {
    0x1: "怪兽", 0x2: "魔法", 0x4: "陷阱", 0x10: "通常", 0x20: "效果",
    0x40: "融合", 0x80: "仪式", 0x200: "灵魂", 0x400: "同盟", 0x800: "二重",
    0x1000: "调整", 0x2000: "同调", 0x4000: "衍生物", 0x200000: "反转",
    0x400000: "卡通", 0x800000: "超量", 0x1000000: "灵摆", 0x2000000: "特殊召唤",
    0x4000000: "连接", 0x10000: "速攻", 0x20000: "永续", 0x40000: "装备",
    0x80000: "场地", 0x100000: "反击",
}
RACE_MAP = {
    0x0: "无", 0x1: "战士族", 0x2: "魔法师族", 0x4: "天使族", 0x8: "恶魔族",
    0x10: "不死族", 0x20: "机械族", 0x40: "水族", 0x80: "炎族", 0x100: "岩石族",
    0x200: "鸟兽族", 0x400: "植物族", 0x800: "昆虫族", 0x1000: "雷族",
    0x2000: "龙族", 0x4000: "兽族", 0x8000: "兽战士族", 0x10000: "恐龙族",
    0x20000: "鱼族", 0x40000: "海龙族", 0x80000: "爬虫类族",
    0x100000: "念动力族", 0x200000: "幻神兽族", 0x400000: "创造神族",
    0x800000: "幻龙族", 0x1000000: "电子界族", 0x2000000: "幻想魔族",
}
ATTR_MAP = {0x0: "无", 0x1: "地", 0x2: "水", 0x4: "炎", 0x8: "风", 0x10: "光", 0x20: "暗", 0x40: "神"}
EXCLUDED_MONSTER_SUBTYPES = {"仪式", "融合", "同调", "超量", "灵摆", "连接"}

STATIC_EXTS = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".ico": "image/x-icon",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
}

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(message)s",
                    datefmt="%H:%M:%S")
logger = logging.getLogger("vote")

try:
    from PIL import Image

    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False

# ── 缩略图生成 ────────────────────────────────────────────
def generate_thumbnails():
    """生成 200px 宽的 JPEG 缩略图 (需要 Pillow)。"""
    if not HAS_PILLOW or not IMG_DIR.is_dir():
        return
    THUMB_DIR.mkdir(exist_ok=True)
    for src_path in sorted(IMG_DIR.iterdir()):
        if not src_path.is_file():
            continue
        if src_path.suffix.lower() not in (".png", ".jpg", ".jpeg", ".gif", ".webp"):
            continue
        dst_path = THUMB_DIR / src_path.name
        if dst_path.exists():
            continue
        try:
            im = Image.open(src_path).convert("RGB")
            w, h = im.size
            new_h = int(h * THUMB_WIDTH / w)
            im = im.resize((THUMB_WIDTH, new_h), Image.LANCZOS)
            im.save(dst_path, "JPEG", quality=THUMB_QUALITY, optimize=True)
            logger.info(f"  缩略图: {src_path.name}  ({w}x{h} -> {THUMB_WIDTH}x{new_h})")
        except Exception as e:
            logger.warning(f"  缩略图失败 {src_path.name}: {e}")


# ── 数据持久化 (内存缓存) ──────────────────────────────────
class VoteStore:
    """线程安全的投票数据存储，内存缓存 + 惰性写入。"""

    def __init__(self, path: Path):
        self._path = path
        self._lock = threading.Lock()
        self._data: dict = {}
        self._load()

    def _load(self):
        if self._path.exists():
            try:
                raw = self._path.read_text(encoding="utf-8-sig")
                self._data = json.loads(raw) if raw.strip() else {}
            except (json.JSONDecodeError, OSError) as e:
                logger.warning(f"读取数据文件失败: {e}，使用空数据")
                self._data = {}
        self._data.setdefault("votes", {})
        self._data.setdefault("ips", {})
        self._data.setdefault("ip_votes", {})

    def _save(self):
        try:
            self._path.write_text(
                json.dumps(self._data, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except OSError as e:
            logger.error(f"写入数据文件失败: {e}")

    def get_results(self) -> dict:
        with self._lock:
            return {"votes": dict(self._data.get("votes", {}))}

    def get_remaining(self, ip: str) -> int:
        with self._lock:
            used = len(self._data.get("ip_votes", {}).get(ip, []))
            return max(0, MAX_VOTES - used)

    def vote(self, image: str, ip: str) -> dict:
        """投一票。返回 {"ok": bool, "remaining": int, "error"?: str, "votes"?: dict}"""
        with self._lock:
            voted = self._data.setdefault("ip_votes", {}).setdefault(ip, [])
            if len(voted) >= MAX_VOTES:
                return {"ok": False, "error": f"您的{MAX_VOTES}票已全部投出",
                        "remaining": 0}

            self._data.setdefault("votes", {})
            self._data["votes"][image] = self._data["votes"].get(image, 0) + 1
            voted.append(image)
            self._data["ips"][ip] = self._data.get("ips", {}).get(ip, 0) + 1
            self._save()
            remaining = MAX_VOTES - len(voted)
            return {"ok": True, "remaining": remaining,
                    "votes": dict(self._data["votes"])}

    def dump(self) -> dict:
        """返回完整数据快照 (调试用)。"""
        with self._lock:
            return {
                "votes": dict(self._data.get("votes", {})),
                "ips": dict(self._data.get("ips", {})),
                "ip_votes": dict(self._data.get("ip_votes", {})),
            }


# ── 全局存储实例 ──────────────────────────────────────────
store = VoteStore(DATA_FILE)


# ── CDB → JSON 预处理器 ──────────────────────────────────

def _parse_type(type_val: int) -> dict:
    """解析卡牌类型位掩码 (复刻前端 preParseCard 逻辑)。"""
    type_parts = []
    base_type = ""
    for mask_val, name in TYPE_MASKS.items():
        if type_val & mask_val:
            type_parts.append(name)
            if name in ("怪兽", "魔法", "陷阱"):
                base_type = name

    sub_types = [t for t in type_parts if t not in ("怪兽", "魔法", "陷阱")]
    monster_category = "其他怪兽"
    if base_type == "怪兽":
        has_excluded = any(s in EXCLUDED_MONSTER_SUBTYPES for s in sub_types)
        if not has_excluded and "效果" in sub_types:
            monster_category = "纯效果怪兽"
        elif "仪式" in sub_types:
            monster_category = "仪式怪兽"
        elif "融合" in sub_types:
            monster_category = "融合怪兽"
        elif "同调" in sub_types:
            monster_category = "同调怪兽"
        elif "超量" in sub_types:
            monster_category = "超量怪兽"
        elif "灵摆" in sub_types:
            monster_category = "灵摆怪兽"
        elif "连接" in sub_types:
            monster_category = "连接怪兽"

    return {
        "fullType": " ".join(type_parts) or "未知类型",
        "baseType": base_type,
        "subTypes": sub_types,
        "monsterCategory": monster_category,
    }


def _parse_race(race_val: int) -> str:
    """解析种族位掩码 (取第一个匹配的位)。"""
    for mask_val, name in RACE_MAP.items():
        if race_val & mask_val:
            return name
    return "未知种族"


def _parse_attr(attr_val: int) -> str:
    """解析属性位掩码 (取第一个匹配的位)。"""
    for mask_val, name in ATTR_MAP.items():
        if attr_val & mask_val:
            return name
    return "未知属性"


def _extract_author_and_desc(desc: str) -> tuple:
    """从效果文本中提取 DIY 作者和纯效果描述。"""
    author = ""
    processed_desc = "无效果描述"
    if desc:
        lines = desc.split("\n")
        effect_lines = []
        for line in lines:
            t = line.strip()
            if t.startswith("DIY by"):
                author = t
                break
            effect_lines.append(line)
        processed_desc = "\n".join(effect_lines).strip() or "无效果描述"
    return author, processed_desc


def load_cards_from_cdb(cdb_path: Path) -> list:
    """从 CDB 读取全量卡牌数据，预解析后返回与前端 preParseCard 一致的 dict 列表。"""
    if not cdb_path.is_file():
        logger.warning(f"CDB 文件不存在: {cdb_path}")
        return []

    conn = sqlite3.connect(str(cdb_path))
    try:
        rows = conn.execute(
            "SELECT datas.id, texts.name, datas.type, datas.atk, datas.def, "
            "datas.level, datas.race, datas.attribute, texts.desc, datas.alias, datas.setcode "
            "FROM datas JOIN texts ON datas.id = texts.id"
        ).fetchall()
    finally:
        conn.close()

    cards = []
    for row in rows:
        card_id, name, type_val, atk, def_, level, race, attr, desc, alias, setcode = row
        type_info = _parse_type(type_val)
        cards.append({
            "id": card_id,
            "name": name,
            "type": type_val,
            "atk": atk,
            "def": def_,
            # level 为 CDB 原始值：灵摆/连接卡是位打包的（低8位为等级/链接标记），需取低8位
        "level": (level or 0) & 0xFF,
            "race": race,
            "attribute": attr,
            "desc": desc,
            "alias": alias or 0,
            "setcode": setcode or 0,   # 字段（系列）编号，配合 /api/archetypes 映射为字段名
            "typeInfo": type_info,
            "raceName": _parse_race(race),
            "attrName": _parse_attr(attr),
            "author": _extract_author_and_desc(desc)[0],
            "processedDesc": _extract_author_and_desc(desc)[1],
        })

    logger.info(f"CDB 加载完成: {len(cards)} 张卡牌")
    return cards


# 全局卡牌缓存 (启动时加载，内存驻留)
_cards_cache: list = []
_cards_json: bytes = b"[]"
_cards_json_gz: bytes = b""
_cards_etag: str = ""

# G-Ext 分数缓存 (启动时加载，alias 已解析)
_scores_cache: dict = {}
_scores_json: bytes = b"{}"
_scores_limit: int = 100  # G-Ext 卡组总分上限（lflist.conf $genesys）

# 字段（系列）映射表：setcode → 字段名，由 tools/gen_archetypes.py 从 strings.conf 生成
_archetypes_json: bytes = b"{}"
_archetypes_etag: str = ""


def load_archetypes():
    """读取 archetypes.json（字段表），供前端「相关卡片 → 同字段」使用。"""
    global _archetypes_json, _archetypes_etag
    path = ROOT / "archetypes.json"
    if not path.is_file():
        logger.warning(f"字段表不存在: {path}")
        return
    data = path.read_bytes()
    _archetypes_json = data
    _archetypes_etag = f'"{hashlib.md5(data).hexdigest()}"'
    try:
        count = len(json.loads(data.decode("utf-8")))
    except Exception:
        count = 0
    logger.info(f"字段表已加载: {count} 条, {len(data) / 1024:.0f} KB")

# 比赛数据缓存 (惰性加载，定期刷新)
_tournament_cache: dict | None = None
_tournament_cache_time: float = 0


# ── 决斗客户端数据（嵌官网用） ──────────────────────────────
# 两份大表由 tools/gen-duel-data.mjs 生成（不进 git）：
#   data/duel-cards-text.json  卡文表（约 6.8MB → gzip 约 1MB，客户端懒加载）
#   data/duel-strings.json     提示文本表（system/victory/counter/setname）
DUEL_DATA_DIR = ROOT / "data"
_duel_text: dict = {"raw": None, "gz": None, "etag": ""}
_duel_strings: dict = {"raw": None, "gz": None, "etag": ""}


def _load_duel_json(filename: str, cache: dict, label: str):
    """惰性读取大 JSON（首次请求时读入并 gzip；文件缺失返回 None）"""
    if cache["raw"] is not None:
        return cache
    path = DUEL_DATA_DIR / filename
    if not path.is_file():
        logger.warning(f"{label} 不存在: {path}（跑 tools/gen-duel-data.mjs 生成）")
        return None
    raw = path.read_bytes()
    cache["raw"] = raw
    cache["gz"] = gzip.compress(raw, compresslevel=6)
    cache["etag"] = f'"{hashlib.md5(raw).hexdigest()}"'
    logger.info(f"{label} 已加载: {len(raw) / 1048576:.2f} MB → gzip {len(cache['gz']) / 1024:.0f} KB")
    return cache


def _send_duel_json(handler, cache: dict, max_age: int = 86400):
    """按 ETag/gzip 输出大 JSON 表"""
    if handler.headers.get("If-None-Match") == cache["etag"]:
        handler.send_response(304)
        handler.send_header("ETag", cache["etag"])
        handler.end_headers()
        return
    body = cache["gz"]
    handler.send_response(200)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", f"public, max-age={max_age}")
    handler.send_header("ETag", cache["etag"])
    if "gzip" in (handler.headers.get("Accept-Encoding") or ""):
        handler.send_header("Content-Encoding", "gzip")
    else:
        body = cache["raw"]
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


# ── 客户端错误上报（决斗客户端 window.onerror → POST /api/clientlog） ──
CLIENTLOG_FILE = ROOT / "logs" / "clientlog.jsonl"
CLIENTLOG_DIR = ROOT / "logs"
CLIENTLOG_KEEP_DAYS = 7


def _rotate_clientlog():
    """按天切分，只保留最近 7 天"""
    try:
        CLIENTLOG_DIR.mkdir(exist_ok=True)
        if not CLIENTLOG_FILE.is_file():
            return
        today = time.strftime("%Y-%m-%d")
        mtime_day = time.strftime("%Y-%m-%d", time.localtime(CLIENTLOG_FILE.stat().st_mtime))
        if mtime_day != today:
            CLIENTLOG_FILE.rename(CLIENTLOG_DIR / f"clientlog-{mtime_day}.jsonl")
        cutoff = time.time() - CLIENTLOG_KEEP_DAYS * 86400
        for old in CLIENTLOG_DIR.glob("clientlog-*.jsonl"):
            try:
                if old.stat().st_mtime < cutoff:
                    old.unlink()
            except OSError:
                pass
    except OSError as e:
        logger.warning(f"clientlog 轮转失败: {e}")


def append_clientlog(payload) -> None:
    """追加一条客户端上报（JSONL，一行一条；无上限字段，超长截断）"""
    try:
        CLIENTLOG_DIR.mkdir(exist_ok=True)
        _rotate_clientlog()
        line = json.dumps(payload, ensure_ascii=False)
        if len(line) > 64 * 1024:
            line = line[:64 * 1024] + '…(truncated)"}'
        with CLIENTLOG_FILE.open("a", encoding="utf-8") as f:
            f.write(line.replace("\n", " ") + "\n")
    except Exception as e:
        logger.warning(f"写入 clientlog 失败: {e}")


def _ladder_decks_of(player: str) -> list:
    """取某账号最近打过天梯的卡组（走游戏服的 /api/ladder/decks）。
    返回 [{'name','main','extra','side'}, …]；任何异常都返回 []（前端要能兜底）。"""
    if not player:
        return []
    try:
        resp = urllib.request.urlopen(
            "https://api.ygopro3.cn/api/ladder/decks?player="
            + quote(player) + "&t=" + str(int(time.time() * 1000)),
            timeout=8,
        )
        data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        logger.warning(f"取卡组列表失败({player}): {e}")
        return []
    items = data.get("decks") if isinstance(data, dict) else data
    if not isinstance(items, list):
        return []
    out = []
    for it in items:
        if isinstance(it, dict) and isinstance(it.get("main"), list) and it["main"]:
            out.append(it)
    return out


def _pg_exec(sql: str, variables: dict) -> None:
    """执行一条写 SQL。变量用 psql 的 :'名字' 绑定（psql 自己做转义，避免注入）。"""
    conf = _srvpro_db_config()
    env = dict(os.environ)
    if conf["password"]:
        env["PGPASSWORD"] = conf["password"]
    args = ["psql", "-h", conf["host"], "-p", str(conf["port"]), "-U", conf["user"],
            "-d", conf["dbname"], "-v", "ON_ERROR_STOP=1"]
    for k, v in variables.items():
        args += ["-v", f"{k}={v}"]
    args += ["-tAc", sql]
    proc = subprocess.run(args, capture_output=True, text=True, timeout=25, env=env)
    if proc.returncode != 0:
        msg = (proc.stderr or "").strip().splitlines()
        raise RuntimeError(msg[-1] if msg else "psql 执行失败")


def pg_register_user(account: str, password: str, display_name: str) -> None:
    """在游戏服账号表里建号（与游戏客户端 /register 走同一张表、同一套字段）。
    ⚠ 只负责插库；登录/哈希等逻辑仍归游戏服，不在这里重复实现。"""
    _pg_exec(
        'INSERT INTO srv_user ("accountName", password, enabled, permissions, "displayName",\n'
        '                      title, "lastIp", "ladderTitle", titles, "selectedTitle", "selectedTitle2",\n'
        '                      "createTime", "updateTime")\n'
        "VALUES (:'acct', :'pw', true, '', :'dname', '', '', '', '[]', '', '', now(), now())",
        {"acct": account, "pw": password, "dname": display_name},
    )


def pg_user_exists(account: str) -> bool:
    """账号是否已被注册（用 psql 变量绑定，避免引号注入）"""
    rows = _pg_query(
        'select count(*) from srv_user where "accountName" = :\'acct\'',
        {"acct": account},
    )
    return bool(rows) and rows[0][0].strip().isdigit() and int(rows[0][0]) > 0


def refresh_cards_cache():
    """重新从 CDB 加载卡牌数据并更新缓存。

    卡池 = DIY + **先行卡（pre）** + 官方 OCG，按 id 去重、**先到先得**
    —— 顺序刻意与 srvpro2 的 ygoproPath 一致（cards-diy → cards-pre → cards），
    所以"先行卡覆盖官方同号卡"的行为和游戏里完全一样。

    ⚠ 先行卡的 CDB 在游戏服目录里，这里**只读不搬**（用户要求：调用即可，不要迁移）。
       路径见 PRE_CDB_FILES；换预发布包时那边换了这里自动跟着变 ✓
    """
    global _cards_cache, _cards_json, _cards_json_gz, _cards_etag
    groups = [
        ("diy", [CDB_FILE]),
        ("pre", [Path(p) for p in PRE_CDB_FILES]),
        ("ocg", [ROOT / "cards_ocg.cdb"]),
    ]
    seen: set = set()
    merged: list = []
    counts = {}
    for source, paths in groups:
        n = 0
        for path in paths:
            if not Path(path).is_file():
                continue          # 先行卡目录没有/被清空时静默跳过，不影响其它来源
            for c in load_cards_from_cdb(Path(path)):
                if c["id"] in seen:
                    continue
                seen.add(c["id"])
                c["source"] = source
                merged.append(c)
                n += 1
        counts[source] = n
    _cards_cache = merged
    _cards_json = json.dumps(_cards_cache, ensure_ascii=False).encode("utf-8")
    _cards_json_gz = gzip.compress(_cards_json, compresslevel=6)
    _cards_etag = f'"{hashlib.md5(_cards_json).hexdigest()}"'
    logger.info(
        "卡牌缓存已刷新: DIY %d + 先行卡 %d + OCG %d = %d 张, %d KB JSON → %d KB gzip"
        % (counts["diy"], counts["pre"], counts["ocg"], len(merged),
           len(_cards_json) / 1024, len(_cards_json_gz) / 1024)
    )


def refresh_scores_cache():
    """解析 lflist.conf G-Ext 分数，结合 CDB alias + 同名卡补充分数。"""
    global _scores_cache, _scores_json, _scores_limit
    lflist = ROOT / "lflist.conf"
    if not lflist.is_file():
        logger.warning("lflist.conf 不存在，跳过分数缓存")
        return

    text = lflist.read_text(encoding="utf-8")
    sirokami_idx = text.find("!DIY_Sirokami")
    gext = text[:sirokami_idx] if sirokami_idx > -1 else text

    # G-Ext 上限：$genesys <N> 行
    m_limit = re.search(r"(?m)^\s*\$genesys\s+(\d+)", gext)
    if m_limit:
        _scores_limit = int(m_limit.group(1))
        logger.info(f"G-Ext 卡组总分上限: {_scores_limit}")

    scores = {}
    for line in gext.split("\n"):
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("!") or line.startswith("$genesys"):
            continue
        m = re.match(r"^(\d+)\s+0\s+--", line)
        if m:
            scores[int(m.group(1))] = {"score": 0, "forbidden": True}
            continue
        m = re.match(r"^(\d+)\s+\$genesys\s+(\d+)\s+--", line)
        if m:
            scores[int(m.group(1))] = {"score": int(m.group(2)), "forbidden": False}

    # ── 从 CDB (DIY + OCG) 构建 alias 映射 + 卡名索引 ──
    aliases = {}
    name_to_ids = {}  # 卡名 → 所有同名卡 ID
    for cdb_path in [CDB_FILE, ROOT / "cards_ocg.cdb"]:
        if cdb_path.is_file():
            conn = sqlite3.connect(str(cdb_path))
            try:
                for row in conn.execute("SELECT id, alias FROM datas WHERE alias != 0"):
                    aliases[int(row[0])] = int(row[1])
                for row in conn.execute(
                    "SELECT datas.id, texts.name FROM datas JOIN texts ON datas.id = texts.id"
                ):
                    cid, cname = int(row[0]), row[1]
                    name_to_ids.setdefault(cname, []).append(cid)
            finally:
                conn.close()

    # ── Step 1: alias 直接复制分数 ──
    for alt_id, canon_id in aliases.items():
        if alt_id not in scores and canon_id in scores:
            scores[alt_id] = scores[canon_id]

    # ── Step 2: 同名卡补充 (有分直接用分，没分按同名卡的分) ──
    # 对有分数的卡，按卡名建立分数映射
    name_score = {}
    for cid, sc in scores.items():
        # 找这个 cid 对应的卡名
        for cname, id_list in name_to_ids.items():
            if cid in id_list:
                # 如果同名卡有多个分数，保留第一个遇到的 (已有的不覆盖)
                if cname not in name_score:
                    name_score[cname] = sc
                break

    # 为没分数的同名卡补充分数
    filled = 0
    for cname, sc in name_score.items():
        for cid in name_to_ids.get(cname, []):
            if cid not in scores:
                scores[cid] = sc
                filled += 1

    _scores_cache = scores
    _scores_json = json.dumps(scores, ensure_ascii=False).encode("utf-8")
    logger.info(f"分数缓存已刷新: {len(scores)} 张, alias {len(aliases)} 条, 同名补充 {filled} 张")


def _fetch_tournament_upstream(tournament_id: str) -> dict:
    """同步向上游取一次赛事数据（握手类错误重试一次）。"""
    global _tournament_cache, _tournament_cache_time
    url = f"{TABULATOR_API_URL}/{tournament_id}"
    req = urllib.request.Request(url)
    req.add_header("Authorization", "Bearer " + TABULATOR_API_KEY)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    last_err = None
    for _attempt in range(2):
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=8) as resp:
                data = json.loads(resp.read())
                if not isinstance(_tournament_cache, dict):
                    _tournament_cache = {}
                if not isinstance(_tournament_cache_time, dict):
                    _tournament_cache_time = {}
                _tournament_cache[tournament_id] = data
                _tournament_cache_time[tournament_id] = time.time()
                logger.info(f"比赛数据已刷新 (ID={tournament_id})")
                return data
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            last_err = Exception(f"上游API返回 {e.code}: {body}")
            break                      # HTTP 错误重试无意义
        except Exception as e:
            last_err = Exception(f"请求上游API失败: {e}")
            continue                   # 握手/连接类错误重试一次
    raise last_err


_tournament_refreshing: set = set()   # 正在后台刷新的赛事ID（避免重复请求）


def _refresh_tournament_async(tournament_id: str):
    """后台刷新指定赛事，不阻塞请求线程。"""
    if tournament_id in _tournament_refreshing:
        return
    _tournament_refreshing.add(tournament_id)

    def worker():
        try:
            _fetch_tournament_upstream(tournament_id)
        except Exception as e:
            logger.warning(f"后台刷新比赛数据失败 (ID={tournament_id}): {e}")
        finally:
            _tournament_refreshing.discard(tournament_id)

    threading.Thread(target=worker, daemon=True).start()


def _start_tournament_refresher(interval: int = 60):
    """启动后台定时刷新（预热缓存 + 保持数据新鲜）。"""
    slot_ids = sorted({str(v) for v in TOURNAMENT_SLOTS.values() if v})

    def loop():
        while True:
            for tid in slot_ids:
                try:
                    _fetch_tournament_upstream(tid)
                except Exception as e:
                    logger.warning(f"定时刷新比赛数据失败 (ID={tid}): {e}")
            time.sleep(interval)

    threading.Thread(target=loop, daemon=True).start()
    logger.info(f"比赛数据后台刷新已启动（每 {interval}s，ID={slot_ids}）")


def _get_tournament_data(tid: str | None = None) -> dict:
    """获取比赛数据。

    策略：有缓存（哪怕已过期）立即返回，并在后台异步刷新 —— 请求永不阻塞在上游，
    避免反向代理超时导致 502；只有完全没缓存时才同步取一次。
    """
    tournament_id = str(tid or TOURNAMENT_ID)
    now = time.time()
    cached = _tournament_cache.get(tournament_id) if isinstance(_tournament_cache, dict) else None
    cached_at = _tournament_cache_time.get(tournament_id, 0) if isinstance(_tournament_cache_time, dict) else 0

    if cached is not None:
        if (now - cached_at) >= TOURNAMENT_CACHE_TTL:
            _refresh_tournament_async(tournament_id)      # 后台刷新，立即用旧数据响应
        return cached
    return _fetch_tournament_upstream(tournament_id)      # 首次：同步取（8s×2 上限）


# ── srvpro2 API 代理 ───────────────────────────────────────

def _srvpro_fetch(endpoint: str, params: dict) -> dict:
    """代理请求到 srvpro2 API (HTTPS, 自签证书)。"""
    url = f"{SRVPRO_API_URL}{endpoint}"
    qs = urlencode(params)
    full_url = f"{url}?{qs}" if qs else url

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(full_url)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            raw = resp.read()
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise Exception(f"srvpro2 API 返回 {e.code}: {body}")
    except Exception as e:
        raise Exception(f"请求 srvpro2 API 失败: {e}")


def _srvpro_post(endpoint: str, params: dict, payload: dict) -> dict:
    """代理 POST 请求到 srvpro2 API (HTTPS, 自签证书)。"""
    url = f"{SRVPRO_API_URL}{endpoint}"
    qs = urlencode(params)
    full_url = f"{url}?{qs}" if qs else url

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(full_url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            raw = resp.read()
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        raise Exception(f"srvpro2 API 返回 {e.code}: {body_text}")
    except Exception as e:
        raise Exception(f"请求 srvpro2 API 失败: {e}")

def _srvpro_put(endpoint: str, params: dict, payload: dict) -> dict:
    """代理 PUT 请求到 srvpro2 API。"""
    url = f"{SRVPRO_API_URL}{endpoint}"
    qs = urlencode(params)
    full_url = f"{url}?{qs}" if qs else url
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(full_url, data=body, method="PUT")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        raise Exception(f"srvpro2 API 返回 {e.code}: {body_text}")
    except Exception as e:
        raise Exception(f"请求 srvpro2 API 失败: {e}")

def _srvpro_delete(endpoint: str, params: dict) -> dict:
    """代理 DELETE 请求到 srvpro2 API。"""
    url = f"{SRVPRO_API_URL}{endpoint}"
    qs = urlencode(params)
    full_url = f"{url}?{qs}" if qs else url

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(full_url, method="DELETE")
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            raw = resp.read()
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        raise Exception(f"srvpro2 API 返回 {e.code}: {body_text}")
    except Exception as e:
        raise Exception(f"请求 srvpro2 API 失败: {e}")


def _tms_check(text: str) -> tuple:
    """腾讯云文本内容安全检测。返回 (ok: bool, label: str)。"""
    if not TMS_ENABLED or not text or not text.strip():
        return (True, "")
    try:
        import hashlib as _hashlib
        import datetime as _dt
        import uuid as _uuid

        service = "tms"
        host = TMS_ENDPOINT
        action = "TextModeration"
        version = "2020-12-29"
        region = "ap-guangzhou"
        algorithm = "TC3-HMAC-SHA256"
        timestamp = int(time.time())
        date = _dt.datetime.fromtimestamp(timestamp, _dt.timezone.utc).strftime("%Y-%m-%d")

        # payload — Content 需要 base64 编码
        content_b64 = base64.b64encode(text.strip().encode("utf-8")).decode("utf-8")
        payload = json.dumps({"Content": content_b64})
        # canonical request
        http_method = "POST"
        canonical_uri = "/"
        canonical_querystring = ""
        ct = "application/json; charset=utf-8"
        canonical_headers = f"content-type:{ct}\nhost:{host}\nx-tc-action:{action.lower()}\n"
        signed_headers = "content-type;host;x-tc-action"
        hashed_payload = _hashlib.sha256(payload.encode("utf-8")).hexdigest()
        canonical_request = (
            f"{http_method}\n{canonical_uri}\n{canonical_querystring}\n"
            f"{canonical_headers}\n{signed_headers}\n{hashed_payload}"
        )
        # string to sign
        credential_scope = f"{date}/{service}/tc3_request"
        hashed_cr = _hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()
        string_to_sign = f"{algorithm}\n{timestamp}\n{credential_scope}\n{hashed_cr}"
        # signature
        def _hmac_sha256(key, msg):
            return hmac.new(key, msg.encode("utf-8"), _hashlib.sha256).digest()
        secret_date = _hmac_sha256(("TC3" + TMS_SECRET_KEY).encode("utf-8"), date)
        secret_service = _hmac_sha256(secret_date, service)
        secret_signing = _hmac_sha256(secret_service, "tc3_request")
        signature = _hashlib.sha256(secret_signing + string_to_sign.encode("utf-8")).hexdigest()
        if isinstance(signature, bytes):
            signature = signature.decode()
        # authorization
        authorization = (
            f"{algorithm} Credential={TMS_SECRET_ID}/{credential_scope}, "
            f"SignedHeaders={signed_headers}, Signature={signature}"
        )
        # request
        req = urllib.request.Request(f"https://{host}/", data=payload.encode("utf-8"))
        req.add_header("Content-Type", ct)
        req.add_header("Host", host)
        req.add_header("X-TC-Action", action)
        req.add_header("X-TC-Version", version)
        req.add_header("X-TC-Region", region)
        req.add_header("X-TC-Timestamp", str(timestamp))
        req.add_header("Authorization", authorization)

        ctx = ssl.create_default_context()
        with urllib.request.urlopen(req, context=ctx, timeout=5) as resp:
            result = json.loads(resp.read())
        resp_data = result.get("Response", {})
        if resp_data.get("Error"):
            logger.warning(f"TMS API 错误: {resp_data.get('Error')}")
            return (True, "")  # API 异常放行，避免阻塞用户
        suggestion = resp_data.get("Suggestion", "Pass")
        label = resp_data.get("Label", "")
        if suggestion == "Pass":
            return (True, "")
        return (False, label)
    except Exception as e:
        logger.warning(f"TMS 检测失败 (放行): {e}")
        return (True, "")  # 网络异常放行


def _sign_cookie(username: str, password: str) -> str:
    payload = f"{username}:{password}:{int(time.time())}"
    sig = hmac.new(COOKIE_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:24]
    return base64.b64encode(f"{payload}:{sig}".encode()).decode()

def _sign_community_cookie(username: str, password: str) -> str:
    payload = f"{username}:{password}:{int(time.time())}"
    sig = hmac.new(COMMUNITY_COOKIE_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:24]
    return base64.b64encode(f"{payload}:{sig}".encode()).decode()


def _verify_cookie(token: str) -> tuple | None:
    try:
        raw = base64.b64decode(token).decode()
        parts = raw.rsplit(":", 1)
        payload, sig = parts[0], parts[1]
        expected = hmac.new(COOKIE_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:24]
        if not hmac.compare_digest(sig, expected):
            return None
        username, password, ts = payload.split(":", 2)
        if int(time.time()) - int(ts) > COOKIE_MAX_AGE:
            return None
        return username, password
    except Exception:
        return None

def _verify_community_cookie(token: str) -> tuple | None:
    try:
        raw = base64.b64decode(token).decode()
        parts = raw.rsplit(":", 1)
        payload, sig = parts[0], parts[1]
        expected = hmac.new(COMMUNITY_COOKIE_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:24]
        if not hmac.compare_digest(sig, expected):
            return None
        username, password, ts = payload.split(":", 2)
        if int(time.time()) - int(ts) > COMMUNITY_COOKIE_MAX_AGE:
            return None
        return username, password
    except Exception:
        return None


# ── 先手 / 后手 胜率统计（读游戏服的 Postgres） ──────────────
# 数据来自 duel_record_player.isFirst（每场 2 条记录）
# 赛季信息：换赛季时改这三行即可（页面主要展示当前赛季的天梯先后手胜率）
SEASON_NAME = "S3"
SEASON_START = "2026-09-28"      # S3 开始（第二赛季 9/28 结算 + 重置）
SEASON_END = "2026-10-31"
SRVPRO_DIR = Path("/root/servers/ygopro/srvpro-siro")
_FS_CACHE = {"t": 0.0, "data": None}
_FS_CACHE_TTL = 300          # 5 分钟缓存，别每次都打数据库
_DB_CONFIG_CACHE = {"t": 0.0, "conf": None}


def _srvpro_db_config():
    """从游戏服 config.yaml 读数据库连接（读不到就用已知默认值）"""
    now = time.time()
    if _DB_CONFIG_CACHE["conf"] and now - _DB_CONFIG_CACHE["t"] < 600:
        return _DB_CONFIG_CACHE["conf"]
    conf = {"host": "127.0.0.1", "port": 5432, "user": "postgres",
            "password": "", "dbname": "srvpro2_siro"}
    try:
        text = (SRVPRO_DIR / "config.yaml").read_text(encoding="utf-8", errors="ignore")
        for key, field in (("dbHost", "host"), ("dbPort", "port"), ("dbUser", "user"),
                           ("dbPass", "password"), ("dbName", "dbname")):
            m = re.search(r'^\s*' + key + r'\s*:\s*"?([^"\n#]+)"?', text, re.M)
            if m:
                val = m.group(1).strip()
                conf[field] = int(val) if field == "port" else val
    except Exception as e:
        logger.warning(f"读取游戏服数据库配置失败，用默认值: {e}")
    _DB_CONFIG_CACHE["conf"] = conf
    _DB_CONFIG_CACHE["t"] = now
    return conf


def _pg_query(sql, variables=None):
    """用 psql 执行只读查询（不引入新依赖），返回二维列表。
    variables 里的值由 psql 的 :'名字' 绑定（自动转义，避免注入）。"""
    conf = _srvpro_db_config()
    env = dict(os.environ)
    if conf["password"]:
        env["PGPASSWORD"] = conf["password"]
    args = ["psql", "-h", conf["host"], "-p", str(conf["port"]), "-U", conf["user"],
            "-d", conf["dbname"], "-tA", "-F", "\t"]
    for k, v in (variables or {}).items():
        args += ["-v", f"{k}={v}"]
    args += ["-c", sql]
    proc = subprocess.run(args, capture_output=True, text=True, timeout=25, env=env)
    if proc.returncode != 0:
        msg = (proc.stderr or "").strip().splitlines()
        raise RuntimeError(msg[-1] if msg else "psql 执行失败")
    rows = []
    for line in proc.stdout.splitlines():
        if line.strip():
            rows.append(line.split("\t"))
    return rows


def _wr(wins, games):
    return round(100.0 * wins / games, 2) if games else None


def _first_second_stats():
    """先手/后手胜率：当前赛季天梯（主）+ 最近7天 + 全部 + 按月趋势"""
    now = time.time()
    if _FS_CACHE["data"] and now - _FS_CACHE["t"] < _FS_CACHE_TTL:
        return _FS_CACHE["data"]

    def scope_rows(where):
        sql = (
            'select count(*) filter (where "isFirst"),\n'
            '       count(*) filter (where "isFirst" and winner),\n'
            '       count(*) filter (where not "isFirst"),\n'
            '       count(*) filter (where not "isFirst" and winner)\n'
            'from duel_record_player p\n'
        )
        if where:
            sql = (
                'select count(*) filter (where p."isFirst"),\n'
                '       count(*) filter (where p."isFirst" and p.winner),\n'
                '       count(*) filter (where not p."isFirst"),\n'
                '       count(*) filter (where not p."isFirst" and p.winner)\n'
                'from duel_record_player p join duel_record d on d.id = p."duelRecordId"\n'
                'where ' + where + '\n'
            )
        rows = _pg_query(sql)
        if not rows:
            return None
        fg, fw, sg, sw = [int(x) for x in rows[0][:4]]
        return {"firstGames": fg, "firstWins": fw, "firstWinRate": _wr(fw, fg),
                "secondGames": sg, "secondWins": sw, "secondWinRate": _wr(sw, sg),
                "games": fg + sg}

    # 天梯口径：M# 房 + 双方都已登录（DB 里用 realName 不含 $ 判定，与服务器重算积分一致）
    ladder_cond = ("d.name like 'M#%' and p.\"realName\" not like '%$%'")
    month_cond = 'p."createTime" > now() - interval \'7 days\''
    season_cond = ('d.name like \'M#%\' and p."realName" not like \'%$%\' '
                   'and p."createTime" >= \'' + SEASON_START + '\'')

    monthly = []
    for mon, fg, fw, sg, sw in _pg_query(
        'select to_char("createTime", \'YYYY-MM\') as mon,\n'
        '       count(*) filter (where "isFirst"),\n'
        '       count(*) filter (where "isFirst" and winner),\n'
        '       count(*) filter (where not "isFirst"),\n'
        '       count(*) filter (where not "isFirst" and winner)\n'
        'from duel_record_player group by 1 order by 1'
    ):
        fg, fw, sg, sw = int(fg), int(fw), int(sg), int(sw)
        monthly.append({"month": mon, "firstGames": fg, "firstWinRate": _wr(fw, fg),
                        "secondWinRate": _wr(sw, sg), "games": fg + sg})

    data = {
        "ok": True,
        "generatedAt": int(now),
        "season": {
            "name": SEASON_NAME,
            "start": SEASON_START,
            "end": SEASON_END,
            **(scope_rows(season_cond) or {}),
        },
        "scopes": [
            dict(scope_rows(None) or {}, key="all", label="全部对局"),
            dict(scope_rows(month_cond) or {}, key="week", label="最近 7 天"),
            dict(scope_rows(ladder_cond) or {}, key="ladder", label="天梯房 M#（历史全部）"),
        ],
        "monthly": monthly,
    }
    _FS_CACHE["data"] = data
    _FS_CACHE["t"] = now
    return data


# ── HTTP 请求处理器 ───────────────────────────────────────
class VoteHandler(SimpleHTTPRequestHandler):
    """投票 API + 静态文件服务"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def get_client_ip(self) -> str:
        """获取真实客户端 IP，支持反向代理头。"""
        xff = self.headers.get("X-Forwarded-For", "")
        if xff:
            return xff.split(",")[0].strip()
        xri = self.headers.get("X-Real-IP", "")
        if xri:
            return xri.strip()
        return self.client_address[0]

    def log_message(self, fmt, *args):
        logger.info(f"[{self.client_address[0]}] {fmt % args}")

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    # ── 路由分发 ───────────────────────────────────────

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path.startswith("/api/"):
            self._handle_api_get(path)
        elif path.startswith("/thumb/"):
            self._serve_thumb(path)
        elif path.startswith("/img/"):
            self._serve_image(path)
        else:
            # 新版引导把每一步的地址写成 /next.html/天梯 这种形式（history API，不刷新页面）。
            # 直接刷新或收藏这类地址时浏览器会来请求它，这里统一回落到 next.html：
            # 地址栏保持不变，页面加载后会自己把地址规范回 /next.html。
            if path.startswith("/next.html/"):
                self.path = "/next.html"
            # 决斗客户端入口页：要把登录态注入成 window._duelUser（客户端启动时同步读它，
            # 所以必须服务端注入，不能等前端 fetch）——见官方交接文档 §2.1 / §3
            if path in ("/duel.html", "/duel"):
                self._serve_duel_page()
                return
            super().do_GET()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if not path.startswith("/api/"):
            self.send_error(404)
            return
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len) if content_len else b"{}"
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            payload = {}
        self._handle_api_post(path, payload)

    # ── API GET ────────────────────────────────────────

    def _handle_api_get(self, path: str):
        # 百鸽 ygocdb 代理（避免浏览器直连外部域名的网络/CORS问题）
        if path.startswith("/api/ygocdb/"):
            self._proxy_ygocdb(path)
            return

        if path == "/api/images":
            imgs = []
            if IMG_DIR.is_dir():
                imgs = sorted(
                    f.name for f in IMG_DIR.iterdir()
                    if f.is_file() and f.suffix.lower() in
                    (".png", ".jpg", ".jpeg", ".gif", ".webp")
                )
            self._json_response(imgs)

        elif path == "/api/my-votes":
            remaining = store.get_remaining(self.get_client_ip())
            self._json_response({"remaining": remaining})

        elif path == "/api/results":
            self._json_response(store.get_results())

        elif path == "/api/cards":
            # ETag 缓存: 304 未修改则免传输
            if self.headers.get("If-None-Match") == _cards_etag:
                self.send_response(304)
                self.end_headers()
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "public, max-age=3600")
            self.send_header("ETag", _cards_etag)
            # gzip 压缩传输（浏览器均支持）
            accept = self.headers.get("Accept-Encoding", "")
            if "gzip" in accept and _cards_json_gz:
                self.send_header("Content-Encoding", "gzip")
                self.send_header("Content-Length", len(_cards_json_gz))
                self.end_headers()
                self.wfile.write(_cards_json_gz)
            else:
                self.send_header("Content-Length", len(_cards_json))
                self.end_headers()
                self.wfile.write(_cards_json)

        elif path == "/api/tournament":
            # 支持 ?slot=swiss|elim（配置内映射）或 ?id=NNN（直接指定），不带参数=默认赛事
            qs = self.path.split("?", 1)[1] if "?" in self.path else ""
            qargs = {}
            for pair in qs.split("&"):
                if not pair:
                    continue
                k, _, v = pair.partition("=")
                qargs[unquote(k)] = unquote(v)
            slot = (qargs.get("slot") or "").strip().lower()
            raw_id = (qargs.get("id") or "").strip()
            tid = None
            err = None
            pending = False
            if slot:
                if slot not in TOURNAMENT_SLOTS:
                    err = f"未知赛事槽位: {slot}"
                else:
                    tid = TOURNAMENT_SLOTS[slot]
                    # 编号未确定（值为 false/null/空）：通知前端显示「待公布」占位
                    if not tid:
                        pending = True
            elif raw_id:
                if not raw_id.isdigit() or len(raw_id) > 10:
                    err = "比赛ID格式不正确"
                else:
                    tid = raw_id
            if err:
                self._json_response({"error": err}, status=400)
            elif pending:
                self._json_response({
                    "pending": True,
                    "slot": slot,
                    "label": TOURNAMENT_SLOT_LABELS.get(slot, slot),
                    "message": TOURNAMENT_PENDING_MESSAGE.get(slot, "对阵待公布"),
                })
            else:
                try:
                    data = _get_tournament_data(tid)
                    self._json_response(data)
                except Exception as e:
                    logger.error(f"获取比赛数据失败: {e}")
                    self._json_response({"error": str(e)}, status=502)
        elif path == "/api/liverooms":
            try:
                data = _srvpro_fetch("/api/getrooms", {
                    "username": SRVPRO_READ_USER,
                    "pass": SRVPRO_READ_PASS,
                })
                rooms = data.get("rooms", [])
                for room in rooms:
                    # 天梯 = M# 前缀 + 双方都已登录
                    isM = room.get("roomname", "").startswith("M#")
                    users = room.get("users", [])
                    p0 = next((u for u in users if u.get("pos") == 0), None)
                    p1 = next((u for u in users if u.get("pos") == 1), None)
                    bothLoggedIn = bool(p0 and p0.get("loggedIn") and p1 and p1.get("loggedIn"))
                    room["isLadder"] = isM and bothLoggedIn
                self._json_response(data)
            except Exception as e:
                logger.error(f"获取服务器对局数据失败: {e}")
                self._json_response({"error": str(e)}, status=502)

        elif path == "/api/admin":
            creds = self._get_admin_cookie()
            if not creds:
                self._json_response({"error": "未登录"}, status=401)
                return
            username, password = creds
            query = {}
            raw_query = unquote(self.path.split("?", 1)[1]) if "?" in self.path else ""
            for part in raw_query.split("&"):
                if "=" in part:
                    k, v = part.split("=", 1)
                    query[k] = v
            action_keys = [k for k in query if k not in ("username", "pass", "password", "callback")]
            if not action_keys:
                self._json_response({"error": "缺少操作参数"}, status=400)
                return
            query["username"] = username
            query["pass"] = password
            try:
                data = _srvpro_fetch("/api/message", query)
                self._json_response(data)
            except Exception as e:
                logger.error(f"管理员操作失败: {e}")
                self._json_response({"error": str(e)}, status=502)
        elif path == "/api/scores":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            # 禁止缓存：宕机/异常期间的中间缓存可能存坏数据，导致前端拿到空分数表
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
            self.send_header("X-GExt-Limit", str(_scores_limit))
            self.send_header("Content-Length", len(_scores_json))
            self.end_headers()
            self.wfile.write(_scores_json)

        elif path == "/api/stats/first-second":
            # 先手 / 后手 胜率（来自游戏服数据库 duel_record_player.isFirst）
            try:
                data = _first_second_stats()
                self._json_response(data)
            except Exception as e:
                logger.error(f"先后手统计失败: {e}")
                self._json_response({"ok": False, "error": str(e)}, status=502)

        elif path == "/api/cardtext":
            # 决斗客户端的卡文表（约 6.8MB → gzip，客户端懒加载；首次请求才读盘）
            cache = _load_duel_json("duel-cards-text.json", _duel_text, "卡文表")
            if cache is None:
                self._json_response({"error": "卡文表未生成，请先跑 tools/gen-duel-data.mjs"}, status=503)
            else:
                _send_duel_json(self, cache)

        elif path == "/api/strings":
            # 提示文本表（system/victory/counter/setname）：决斗客户端显示效果/阶段名用
            cache = _load_duel_json("duel-strings.json", _duel_strings, "提示文本表")
            if cache is None:
                self._json_response({"error": "提示文本表未生成，请先跑 tools/gen-duel-data.mjs"}, status=503)
            else:
                _send_duel_json(self, cache)

        elif path == "/api/duel/whoami":
            # 决斗客户端身份（交接文档 §2.1）：站点自己的 siro_community cookie
            creds = self._get_community_cookie()
            if not creds:
                self._json_response({"loggedIn": False})
            else:
                account = creds[0]
                self._json_response({
                    "loggedIn": True,
                    "account": account,
                    "name": account,     # 昵称=账号：断线重连按昵称认人（文档 §4.3）
                    "avatar": f"/api/forum/avatar/{account}",
                })

        elif path == "/api/duel/deck":
            # 当前卡组（交接文档 §2.2）：取该账号最近一局天梯用过的卡组；
            # 取不到就返回空，客户端仍可用容器里的「导入卡组 (.ydk)」按钮
            creds = self._get_community_cookie()
            if not creds:
                self._json_response({"error": "未登录"}, status=401)
            else:
                deck = None
                try:
                    for d0 in _ladder_decks_of(creds[0])[:1]:
                        deck = {
                            "name": d0.get("name") or d0.get("deckName") or "最近使用",
                            "main": d0.get("main") or [],
                            "extra": d0.get("extra") or [],
                            "side": d0.get("side") or [],
                        }
                except Exception as e:
                    logger.warning(f"取最近卡组失败: {e}")
                self._json_response(deck or {"name": None, "main": [], "extra": [], "side": []})

        elif path == "/api/decks":
            # 决斗客户端的「卡组选择」下拉（契约：{dir, names:[…]}）。
            # 站点没有「我的卡组」存储，所以用**账号最近打过天梯的卡组**顶上；
            # 没有就返回空列表（客户端会只留「（内置默认卡组）」，导入按钮仍可用）。
            creds = self._get_community_cookie()
            decks = _ladder_decks_of(creds[0]) if creds else []
            names = [f"卡组{i}（主{len(d.get('main') or [])}张）.ydk" for i, d in enumerate(decks, 1)]
            self._json_response({"dir": "白神服 · 账号最近使用", "names": names})

        elif path == "/api/deck":
            # 读某个卡组（契约：{name, main, extra, side}）。name 用 /api/decks 给的那个。
            creds = self._get_community_cookie()
            raw = unquote(self.path.split("?", 1)[1]) if "?" in self.path else ""
            want = ""
            for part in raw.split("&"):
                if part.startswith("name="):
                    want = part[5:]
            decks = _ladder_decks_of(creds[0]) if creds else []
            deck = None
            m = re.match(r"^卡组(\d+)", want)
            if m:
                idx = int(m.group(1)) - 1
                if 0 <= idx < len(decks):
                    d = decks[idx]
                    deck = {"name": want, "main": d.get("main") or [],
                            "extra": d.get("extra") or [], "side": d.get("side") or []}
            if deck is None:
                self._json_response({"error": "找不到卡组：" + want}, status=404)
            else:
                self._json_response(deck)

        elif path == "/api/archetypes":
            # 字段（系列）表：setcode(16进制) → 字段名
            if self.headers.get("If-None-Match") == _archetypes_etag and _archetypes_etag:
                self.send_response(304)
                self.end_headers()
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "public, max-age=3600")
            if _archetypes_etag:
                self.send_header("ETag", _archetypes_etag)
            accept = self.headers.get("Accept-Encoding", "")
            if "gzip" in accept:
                body = gzip.compress(_archetypes_json, compresslevel=6)
                self.send_header("Content-Encoding", "gzip")
            else:
                body = _archetypes_json
            self.send_header("Content-Length", len(body))
            self.end_headers()
            self.wfile.write(body)

        elif path == "/api/admin/status":
            creds = self._get_admin_cookie()
            self._json_response({"loggedIn": creds is not None})

        # ── 论坛社区 API (GET, 代理到 srvpro2) ──

        elif path == "/api/forum/status":
            creds = self._get_community_cookie()
            self._json_response({
                "loggedIn": creds is not None,
                "username": creds[0] if creds else None,
            })

        elif path.startswith("/api/forum/avatar/"):
            account_name = unquote(path.split("/api/forum/avatar/", 1)[1])
            if not account_name:
                self.send_error(404)
                return
            avatar_file = AVATAR_DIR / f"{account_name}.png"
            if avatar_file.is_file():
                with open(avatar_file, "rb") as f:
                    data = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                self.send_header("Cache-Control", "public, max-age=86400")
                self.send_header("Content-Length", len(data))
                self.end_headers()
                self.wfile.write(data)
            else:
                self.send_error(404)

        elif path.startswith("/api/forum/"):
            self._proxy_forum_get(path)

        else:
            self.send_error(404)

    # ── API POST ───────────────────────────────────────

    def _handle_api_post(self, path: str, payload: dict):
        if path == "/api/admin/login":
            username = payload.get("username", "").strip()
            password = payload.get("password", "")
            if not username or not password:
                self._json_response({"ok": False, "error": "缺少用户名或密码"}, status=400)
                return
            try:
                _srvpro_fetch("/api/message", {
                    "username": username, "pass": password, "shout": "test"
                })
            except Exception:
                self._json_response({"ok": False, "error": "账号或密码错误"}, status=401)
                return
            token = _sign_cookie(username, password)
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Set-Cookie",
                f"{COOKIE_NAME}={token}; HttpOnly; SameSite=Strict; Max-Age={COOKIE_MAX_AGE}; Path=/")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True}, ensure_ascii=False).encode("utf-8"))

        elif path == "/api/admin/logout":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Set-Cookie",
                f"{COOKIE_NAME}=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True}, ensure_ascii=False).encode("utf-8"))

        elif path == "/api/vote":
            image = payload.get("image", "")
            if not image:
                self._json_response({"ok": False, "error": "缺少 image 参数"},
                                    status=400)
                return
            result = store.vote(image, self.get_client_ip())
            status = 200 if result["ok"] else 400
            self._json_response(result, status=status)

        elif path == "/api/clientlog":
            # 决斗客户端错误上报：写 logs/clientlog.jsonl（按天轮转，保留 7 天）
            append_clientlog(payload)
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

        elif path == "/api/duel/enter":
            # 进匹配（交接文档 §2.3）：房号由服务端给。
            # 现阶段 srvpro2 侧的「票据校验 + M# 配对」还没做（GAP A4），
            # 所以先返回天梯固定前缀 M#，客户端用账号昵称自己进随机匹配队列。
            creds = self._get_community_cookie()
            if not creds:
                self._json_response({"error": "未登录"}, status=401)
            else:
                self._json_response({
                    "room": "M#",          # 客户端会自动走随机匹配队列
                    "ticket": None,        # 票据待 srvpro2 侧中间件就绪后再签发
                    "expiresIn": 60,
                    "name": creds[0],
                })

        elif path == "/api/forum/register":
            # 自助注册（交接文档 §0/§8.2）：名称 / 账号 / 密码 / 再次输入密码
            # ⚠ 账号与密码**允许中文**（游戏服账号表就是这么存的：如「路基霸」）——
            #    所以这里只挡控制字符和长度，不用只允许 ASCII 的正则。
            account = (payload.get("username") or "").strip()
            password = payload.get("password") or ""
            password2 = payload.get("password2")
            display_name = (payload.get("displayName") or "").strip() or account
            if password2 is not None and password2 != password:
                self._json_response({"ok": False, "error": "两次输入的密码不一致"}, status=400)
                return
            if not (2 <= len(account) <= 24):
                self._json_response({"ok": False, "error": "账号长度需在 2~24 个字符之间"}, status=400)
                return
            if not (6 <= len(password) <= 64):
                self._json_response({"ok": False, "error": "密码长度需在 6~64 个字符之间"}, status=400)
                return
            if len(display_name) > 64:
                self._json_response({"ok": False, "error": "名称太长（最多 64 个字符）"}, status=400)
                return
            for value, label in ((account, "账号"), (display_name, "名称")):
                if any(ord(ch) < 32 for ch in value):
                    self._json_response({"ok": False, "error": f"{label}不能包含控制字符"}, status=400)
                    return
            try:
                if pg_user_exists(account):
                    self._json_response({"ok": False, "error": "该账号已被注册，换一个吧"}, status=400)
                    return
                pg_register_user(account, password, display_name)
                logger.info(f"新账号已注册: {account}（名称 {display_name}）")
            except Exception as e:
                logger.error(f"注册失败 {account}: {e}")
                self._json_response({"ok": False, "error": "注册失败，请稍后再试"}, status=500)
                return
            # 按文档 §0 的流程：注册完成 → 回到登录页（这里只回成功，不自动登录）
            self._json_response({"ok": True, "account": account, "name": display_name})

        # ── 论坛社区 API (POST) ──

        elif path == "/api/forum/login":
            username = payload.get("username", "").strip()
            password = payload.get("password", "")
            if not username or not password:
                self._json_response({"ok": False, "error": "缺少用户名或密码"}, status=400)
                return
            try:
                result = _srvpro_post("/api/forum/verify", {}, {
                    "username": username, "password": password,
                })
                if not result.get("ok"):
                    raise Exception("账号或密码错误")
            except Exception:
                self._json_response({"ok": False, "error": "账号或密码错误"}, status=401)
                return
            token = _sign_community_cookie(username, password)
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Set-Cookie",
                f"{COMMUNITY_COOKIE_NAME}={token}; HttpOnly; SameSite=Strict; Max-Age={COMMUNITY_COOKIE_MAX_AGE}; Path=/")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "username": username}, ensure_ascii=False).encode("utf-8"))

        elif path == "/api/forum/logout":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Set-Cookie",
                f"{COMMUNITY_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True}, ensure_ascii=False).encode("utf-8"))

        elif path.startswith("/api/forum/"):
            self._proxy_forum_post(path, payload)

        else:
            self.send_error(404)

    # ── API DELETE ─────────────────────────────────────

    def do_DELETE(self):
        path = self.path.split("?", 1)[0]
        if path.startswith("/api/forum/"):
            creds = self._get_community_cookie()
            if not creds:
                self._json_response({"error": "未登录"}, status=401)
                return
            username, password = creds
            try:
                data = _srvpro_delete(path, {"username": username, "pass": password})
                self._json_response(data)
            except Exception as e:
                logger.error(f"论坛 DELETE 失败: {e}")
                self._json_response({"error": str(e)}, status=502)
        else:
            self.send_error(404)

    # ── API PUT ─────────────────────────────────────

    def do_PUT(self):
        path = self.path.split("?", 1)[0]
        if path.startswith("/api/forum/"):
            creds = self._get_community_cookie()
            if not creds:
                self._json_response({"error": "未登录"}, status=401)
                return
            content_len = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_len) if content_len else b"{}"
            try:
                payload = json.loads(body)
            except json.JSONDecodeError:
                payload = {}
            username, password = creds
            payload["username"] = username
            payload["password"] = password
            try:
                data = _srvpro_put(path, {"username": username, "pass": password}, payload)
                self._json_response(data)
            except Exception as e:
                logger.error(f"论坛 PUT 失败: {e}")
                self._json_response({"error": str(e)}, status=502)
        else:
            self.send_error(404)

    # ── 图片服务 ───────────────────────────────────────

    def _serve_thumb(self, path: str):
        """提供缩略图: 优先 Pillow 缓存，回退到原图。"""
        filename = unquote(Path(path).name)
        if HAS_PILLOW and (THUMB_DIR / filename).is_file():
            self._serve_file(filename, THUMB_DIR, 604800)
        else:
            self._serve_file(filename, IMG_DIR, 3600)

    def _serve_image(self, path: str):
        """提供原图。"""
        self._serve_file(unquote(Path(path).name), IMG_DIR, 3600)

    def _serve_file(self, filename: str, directory: Path, cache_sec: int):
        filepath = directory / filename
        if not filepath.is_file():
            self.send_error(404)
            return

        ext = filepath.suffix.lower()
        content_type = STATIC_EXTS.get(ext, "application/octet-stream")

        try:
            data = filepath.read_bytes()
        except OSError:
            self.send_error(500)
            return

        # 稳定的 ETag (基于 MD5)
        etag = f'"{hashlib.md5(data).hexdigest()}"'

        # 检查客户端 If-None-Match
        if self.headers.get("If-None-Match") == etag:
            self.send_response(304)
            self.end_headers()
            return

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", len(data))
        self.send_header("Cache-Control", f"public, max-age={cache_sec}")
        self.send_header("ETag", etag)
        self.end_headers()
        self.wfile.write(data)

    # ── 辅助方法 ───────────────────────────────────────

    def _serve_duel_page(self):
        """输出 duel.html，并把登录态注入为 window._duelUser（客户端启动时同步读它）"""
        path = ROOT / "duel.html"
        if not path.is_file():
            self.send_error(404, "duel.html not found")
            return
        html = path.read_text(encoding="utf-8")
        creds = self._get_community_cookie()
        if creds:
            # 昵称 = 账号：srvpro2 的断线重连是按昵称认人的（交接文档 §4.3）
            account = creds[0]
            inject = (
                "<script>window._duelUser="
                + json.dumps({"name": account, "account": account}, ensure_ascii=False)
                + ";window._communityUsername=" + json.dumps(account, ensure_ascii=False) + ";</script>"
            )
        else:
            inject = "<script>window._duelUser=null;</script>"
        html = html.replace("<body>", "<body>\n" + inject, 1) if "<body>" in html else inject + html
        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _get_admin_cookie(self) -> tuple | None:
        return self._get_cookie(COOKIE_NAME, _verify_cookie)

    def _get_community_cookie(self) -> tuple | None:
        return self._get_cookie(COMMUNITY_COOKIE_NAME, _verify_community_cookie)

    def _get_cookie(self, name: str, verifier) -> tuple | None:
        cookie_header = self.headers.get("Cookie", "")
        for part in cookie_header.split(";"):
            part = part.strip()
            if part.startswith(f"{name}="):
                token = part[len(name) + 1:]
                return verifier(token)
        return None

    # ── 论坛代理方法 ───────────────────────────────────

    def _proxy_forum_get(self, path: str):
        """将 GET 请求代理到 srvpro2 论坛 API。"""
        query = {}
        raw_query = unquote(self.path.split("?", 1)[1]) if "?" in self.path else ""
        for part in raw_query.split("&"):
            if "=" in part:
                k, v = part.split("=", 1)
                query[k] = v

        # 需要登录的操作自动附上 cookie 凭证
        creds = self._get_community_cookie()
        if creds:
            query["username"] = creds[0]
            query["pass"] = creds[1]

        try:
            data = _srvpro_fetch(path, query)
            self._json_response(data)
        except Exception as e:
            logger.error(f"论坛 GET 代理失败 {path}: {e}")
            self._json_response({"error": str(e)}, status=502)

    def _proxy_forum_post(self, path: str, payload: dict):
        """将 POST 请求代理到 srvpro2 论坛 API。"""
        creds = self._get_community_cookie()
        if not creds:
            self._json_response({"error": "未登录"}, status=401)
            return
        username, password = creds
        query = {"username": username, "pass": password}

        # ── 内容安全检测 ──
        if path == "/api/forum/posts":
            check_text = (payload.get("title", "") + " " + payload.get("content", "")).strip()
            if check_text:
                ok, label = _tms_check(check_text)
                if not ok:
                    self._json_response({"error": "内容包含违规信息，请修改后重试"}, status=400)
                    return
        elif path.startswith("/api/forum/posts/") and path.endswith("/replies"):
            check_text = (payload.get("content", "")).strip()
            if check_text:
                ok, label = _tms_check(check_text)
                if not ok:
                    self._json_response({"error": "内容包含违规信息，请修改后重试"}, status=400)
                    return
        elif path == "/api/forum/profile/display-name":
            check_text = (payload.get("displayName", "")).strip()
            if check_text:
                ok, label = _tms_check(check_text)
                if not ok:
                    self._json_response({"error": "显示名包含违规信息，请修改后重试"}, status=400)
                    return

        # 头像上传特殊处理：base64 → Pillow 64×64 → 存文件
        if path == "/api/forum/profile/avatar":
            try:
                avatar_b64 = payload.get("avatar", "")
                if not avatar_b64:
                    self._json_response({"error": "缺少 avatar 数据"}, status=400)
                    return
                # 去掉 data:image/...;base64, 前缀
                if "," in avatar_b64:
                    avatar_b64 = avatar_b64.split(",", 1)[1]
                import binascii
                try:
                    img_data = base64.b64decode(avatar_b64)
                except binascii.Error:
                    self._json_response({"error": "无效的图片数据"}, status=400)
                    return

                # Pillow 缩放为 64×64
                try:
                    from io import BytesIO
                    img = Image.open(BytesIO(img_data))
                    img = img.convert("RGB")
                    img.thumbnail((AVATAR_SIZE, AVATAR_SIZE), Image.LANCZOS)
                    # 补到 64×64，居中
                    out = Image.new("RGB", (AVATAR_SIZE, AVATAR_SIZE), (30, 30, 30))
                    offset_x = (AVATAR_SIZE - img.width) // 2
                    offset_y = (AVATAR_SIZE - img.height) // 2
                    out.paste(img, (offset_x, offset_y))
                    # 保存
                    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
                    avatar_path = AVATAR_DIR / f"{username}.png"
                    out.save(avatar_path, "PNG")
                except Exception as img_err:
                    self._json_response({"error": f"图片处理失败: {img_err}"}, status=400)
                    return

                # 通知 srvpro2 更新 avatarVersion
                try:
                    data = _srvpro_post(path, query, {"avatar_version_increment": True})
                    self._json_response(data)
                except Exception:
                    # 即使 srvpro2 通知失败，文件已保存，也算成功
                    self._json_response({"ok": True, "avatarSaved": True})
            except Exception as e:
                logger.error(f"头像上传失败: {e}")
                self._json_response({"error": str(e)}, status=500)
            return

        # 普通 POST 代理 — 注入凭证到 body，srvpro2 从 body 读
        payload["username"] = username
        payload["password"] = password
        try:
            data = _srvpro_post(path, query, payload)
            self._json_response(data)
        except Exception as e:
            logger.error(f"论坛 POST 代理失败 {path}: {e}")
            self._json_response({"error": str(e)}, status=502)

    def _proxy_ygocdb(self, path: str):
        """代理百鸽 ygocdb API：/api/ygocdb/<rest> → https://ygocdb.com/api/v0/<rest>"""
        rest = path[len("/api/ygocdb/"):]
        url = "https://ygocdb.com/api/v0/" + rest
        parts = self.path.split("?", 1)
        if len(parts) > 1:
            # 对查询串百分号编码（保留已编码的 % 与 & =），兼容 raw 中文
            url += "?" + urllib.parse.quote(parts[1], safe="=&%")
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json",
            })
            with urllib.request.urlopen(req, timeout=20) as resp:
                body = resp.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            logger.error(f"ygocdb 代理失败 {url}: {e}")
            self._json_response({"error": str(e)}, status=502)

    def _json_response(self, obj, status: int = 200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)


# ── 入口 ──────────────────────────────────────────────────
if __name__ == "__main__":
    logger.info(f"晓白投票服务启动 -> http://{HOST}:{PORT}")
    logger.info(f"图片目录: {IMG_DIR}")
    logger.info(f"数据文件: {DATA_FILE}")
    logger.info(f"每IP票数: {MAX_VOTES}")
    logger.info(f"Pillow: {'YES' if HAS_PILLOW else 'NO (pip install Pillow)'}")
    refresh_cards_cache()
    refresh_scores_cache()
    load_archetypes()
    generate_thumbnails()
    _start_tournament_refresher()

    server = ThreadingHTTPServer((HOST, PORT), VoteHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("服务已停止")
        server.server_close()
